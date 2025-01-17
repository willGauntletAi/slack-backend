import { db } from './index';
import { z } from 'zod';
import { isChannelMember } from './channels';
import { publishNewMessage, publishTyping } from '../services/redis';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { generateAvatarResponse, generateEmbedding } from '../services/openai';
import { sql } from 'kysely';
import { semanticSearch } from '../utils/semanticSearch';
import { findUserById } from './users';


// Schema for creating a message
export const createMessageSchema = z.object({
  content: z.string(),
  parent_id: z.string().optional(),
  is_avatar: z.boolean().default(false),
  attachments: z.array(z.object({
    file_key: z.string(),
    filename: z.string(),
    mime_type: z.string(),
    size: z.number(),
  })).default([]),
});

export type CreateMessageData = z.infer<typeof createMessageSchema>;

// Schema for updating a message
export const updateMessageSchema = z.object({
  content: z.string().min(1),
  attachments: z.array(z.object({
    file_key: z.string(),
    filename: z.string(),
    mime_type: z.string(),
    size: z.number(),
  })).default([]),
});

export type UpdateMessageData = z.infer<typeof updateMessageSchema>;

// Create a new message
export async function createMessage(channelId: string, userId: string, data: CreateMessageData) {
  // Check if user is a member of the channel
  const isMember = await isChannelMember(channelId, userId);
  if (!isMember) {
    throw new Error('Not a member of this channel');
  }

  const now = new Date().toISOString();

  // Use a transaction to create the message and get user info
  const result = await db.transaction().execute(async (trx) => {
    // Create the message
    const message = await trx
      .insertInto('messages')
      .values({
        channel_id: channelId,
        user_id: userId,
        content: data.content,
        parent_id: data.parent_id ? BigInt(data.parent_id) : null,
        is_avatar: data.is_avatar,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Create attachments if any
    if (data.attachments.length > 0) {
      await trx
        .insertInto('message_attachments')
        .values(
          data.attachments.map(attachment => ({
            message_id: message.id,
            file_key: attachment.file_key,
            filename: attachment.filename,
            mime_type: attachment.mime_type,
            size: BigInt(attachment.size),
            created_at: now,
            updated_at: now,
          }))
        )
        .execute();
    }

    // Get the username
    const user = await trx
      .selectFrom('users')
      .where('id', '=', userId)
      .select('username')
      .executeTakeFirstOrThrow();

    // Get attachments
    const attachments = await trx
      .selectFrom('message_attachments')
      .where('message_id', '=', message.id)
      .select(['id', 'file_key', 'filename', 'mime_type', 'size'])
      .execute();

    const workspaceIdResult = await trx.selectFrom('channels').where('id', '=', channelId).select('workspace_id').executeTakeFirstOrThrow();

    return {
      ...message,
      workspace_id: workspaceIdResult.workspace_id,
      username: user.username,
      attachments: attachments.map(att => ({
        ...att,
        size: Number(att.size)
      }))
    };
  });

  // Publish the new message event
  await publishNewMessage({
    channelId,
    message: {
      ...result,
      parent_id: result.parent_id?.toString() || null,
      created_at: result.created_at.toISOString(),
      updated_at: result.updated_at.toISOString(),
    }
  });
  // Generate and store embedding for the message
  try {
    const embedding = await generateEmbedding(`${result.created_at.toISOString()} ${result.username}: ${data.content}`);
    await createMessageEmbedding({
      messageId: result.id.toString(),
      embedding,
      model: 'text-embedding-3-large',
    });
  } catch (error) {
    console.error('Failed to generate embedding for message:', error);
    // Don't throw the error as the message was still created successfully
  }


  return result;
}

// List messages in a channel
export async function listChannelMessages(
  channelId: string,
  userId: string,
  limit: number = 50,
  before?: string,
  after?: string,
  around?: string
) {
  // Check if user is a member of the channel
  const isMember = await isChannelMember(channelId, userId);
  if (!isMember) {
    throw new Error('Not a member of this channel');
  }

  let query = db
    .selectFrom('messages as m')
    .innerJoin('users as u', 'u.id', 'm.user_id')
    .where('m.channel_id', '=', channelId)
    .where('m.deleted_at', 'is', null)
    .orderBy('m.id', 'desc')
    .select(eb => [
      'm.id',
      'm.content',
      'm.parent_id',
      'm.created_at',
      'm.updated_at',
      'm.user_id',
      'm.channel_id',
      'm.is_avatar',
      'u.username',
      jsonArrayFrom(
        eb.selectFrom('message_reactions as mr')
          .innerJoin('users as ru', 'ru.id', 'mr.user_id')
          .select(['mr.id', 'mr.emoji', 'mr.message_id', 'mr.user_id', 'ru.username'])
          .whereRef('mr.message_id', '=', 'm.id')
      ).as('reactions'),
      jsonArrayFrom(
        eb.selectFrom('message_attachments as ma')
          .select(['ma.id', 'ma.file_key', 'ma.filename', 'ma.mime_type', 'ma.size'])
          .whereRef('ma.message_id', '=', 'm.id')
      ).as('attachments')
    ]);

  if (before) {
    query = query.where('m.id', '<', before);
    query = query.limit(limit);
  } else if (after) {
    query = query
      .where('m.id', '>', after)
      .orderBy('m.id', 'asc')
      .limit(limit);
  } else if (around) {
    // For 'around', we want messages before and after the target message
    const halfLimit = Math.floor(limit / 2);

    // Get messages before and after in separate queries
    const beforeQuery = db
      .selectFrom('messages as m')
      .where('m.channel_id', '=', channelId)
      .where('m.deleted_at', 'is', null)
      .where('m.id', '<', around)
      .orderBy('m.id', 'desc')
      .limit(halfLimit)
      .select('m.id');

    const afterQuery = db
      .selectFrom('messages as m')
      .where('m.channel_id', '=', channelId)
      .where('m.deleted_at', 'is', null)
      .where('m.id', '>', around)
      .orderBy('m.id', 'asc')
      .limit(halfLimit)
      .select('m.id');

    // Combine the queries with the target message
    query = query
      .where(eb =>
        eb.or([
          eb('m.id', '=', around),
          eb('m.id', 'in', beforeQuery),
          eb('m.id', 'in', afterQuery)
        ])
      )
      .orderBy('m.id', 'desc');
  } else {
    query = query.limit(limit);
  }

  const messages = await query.execute();

  // If we fetched with 'after', we need to reverse the results to maintain
  // consistent ordering (newest first)
  if (after) {
    messages.reverse();
  }

  // Convert BigInt sizes to numbers
  return messages.map(msg => ({
    ...msg,
    attachments: msg.attachments.map(att => ({
      ...att,
      size: Number(att.size)
    }))
  }));
}

// Get a message by ID
export async function getMessageById(messageId: string) {
  const message = await db
    .selectFrom('messages as m')
    .where('m.id', '=', messageId)
    .where('m.deleted_at', 'is', null)
    .select(eb => [
      'm.id',
      'm.content',
      'm.parent_id',
      'm.created_at',
      'm.updated_at',
      'm.user_id',
      'm.channel_id',
      jsonArrayFrom(
        eb.selectFrom('message_attachments as ma')
          .select(['ma.id', 'ma.file_key', 'ma.filename', 'ma.mime_type', 'ma.size'])
          .whereRef('ma.message_id', '=', 'm.id')
      ).as('attachments')
    ])
    .executeTakeFirst();

  if (!message) return null;

  return {
    ...message,
    attachments: message.attachments.map(att => ({
      ...att,
      size: Number(att.size)
    }))
  };
}

// Update a message
export async function updateMessage(messageId: string, userId: string, data: UpdateMessageData) {
  // Check if message exists and user is the author
  const message = await getMessageById(messageId);
  if (!message) {
    throw new Error('Message not found');
  }

  if (message.user_id !== userId) {
    throw new Error('Not authorized to update this message');
  }

  const now = new Date().toISOString();

  // Use a transaction to update the message and attachments
  const result = await db.transaction().execute(async (trx) => {
    // Update the message
    const updatedMessage = await trx
      .updateTable('messages')
      .set({
        content: data.content,
        updated_at: now,
      })
      .where('id', '=', messageId)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirstOrThrow();

    // Delete existing attachments
    await trx
      .deleteFrom('message_attachments')
      .where('message_id', '=', messageId)
      .execute();

    // Create new attachments
    if (data.attachments.length > 0) {
      await trx
        .insertInto('message_attachments')
        .values(
          data.attachments.map(attachment => ({
            message_id: messageId,
            file_key: attachment.file_key,
            filename: attachment.filename,
            mime_type: attachment.mime_type,
            size: BigInt(attachment.size),
            created_at: now,
            updated_at: now,
          }))
        )
        .execute();
    }

    // Get updated attachments
    const attachments = await trx
      .selectFrom('message_attachments')
      .where('message_id', '=', messageId)
      .select(['id', 'file_key', 'filename', 'mime_type', 'size'])
      .execute();

    return {
      ...updatedMessage,
      attachments: attachments.map(att => ({
        ...att,
        size: Number(att.size)
      }))
    };
  });

  return result;
}

// Delete a message (soft delete)
export async function deleteMessage(messageId: string, userId: string) {
  // Check if message exists and user is the author
  const message = await getMessageById(messageId);
  if (!message) {
    throw new Error('Message not found');
  }

  if (message.user_id !== userId) {
    throw new Error('Not authorized to delete this message');
  }

  const now = new Date().toISOString();

  const deletedMessage = await db
    .updateTable('messages')
    .set({
      deleted_at: now,
    })
    .where('id', '=', messageId)
    .returningAll()
    .executeTakeFirst();

  return deletedMessage;
}

// Message embedding operations
interface MessageForEmbedding {
  id: string;
  content: string;
}

export async function getMessagesWithoutEmbeddings(): Promise<MessageForEmbedding[]> {
  return db
    .selectFrom('messages')
    .leftJoin('message_embeddings', 'messages.id', 'message_embeddings.message_id')
    .select(['messages.id', 'messages.content'])
    .where('message_embeddings.message_id', 'is', null)
    .where('messages.content', 'is not', null)
    .where('messages.deleted_at', 'is', null)
    .execute();
}

// Get recent avatar message pairs
export async function getRecentAvatarMessagePairs(channelId: string, userId: string, limit: number = 5) {
  // Get messages where is_avatar is true and join with their previous message
  return db
    .selectFrom('messages as avatar_msg')
    .innerJoin('users as avatar_user', 'avatar_user.id', 'avatar_msg.user_id')
    .innerJoin('messages as prev_msg', (join) => 
      join.onRef('prev_msg.channel_id', '=', 'avatar_msg.channel_id')
          .onRef('prev_msg.id', '<', 'avatar_msg.id')
          .on('prev_msg.deleted_at', 'is', null)
    )
    .innerJoin('users as prev_user', 'prev_user.id', 'prev_msg.user_id')
    .where('avatar_msg.channel_id', '=', channelId)
    .where('avatar_msg.user_id', '=', userId)
    .where('avatar_msg.is_avatar', '=', true)
    .where('avatar_msg.deleted_at', 'is', null)
    .where('avatar_msg.parent_id', 'is', null)
    .where(({ eb }) => eb.not(
      eb.exists(
        eb.selectFrom('messages as intermediate')
          .whereRef('intermediate.channel_id', '=', 'avatar_msg.channel_id')
          .whereRef('intermediate.id', '>', 'prev_msg.id')
          .whereRef('intermediate.id', '<', 'avatar_msg.id')
          .where('intermediate.deleted_at', 'is', null)
          .limit(1)
      )
    ))
    .where('prev_msg.parent_id', 'is', null)
    .select([
      'prev_msg.id as trigger_message_id',
      'prev_msg.content as trigger_content',
      'prev_user.username as trigger_username',
      'avatar_msg.id as avatar_message_id',
      'avatar_msg.content as avatar_content',
      'avatar_user.username as avatar_username',
    ])
    .orderBy('avatar_msg.id', 'desc')
    .limit(limit)
    .execute();
}

// Get few-shot examples of avatar responses with context
export async function getAvatarFewShotExamples(channelId: string, userId: string, contextMessageCount: number = 5, limit: number = 5) {
  // First get the avatar messages
  const avatarMessages = await db
    .selectFrom('messages as avatar_msg')
    .innerJoin('users as avatar_user', 'avatar_user.id', 'avatar_msg.user_id')
    .where('avatar_msg.channel_id', '=', channelId)
    .where('avatar_msg.user_id', '=', userId)
    .where('avatar_msg.is_avatar', '=', true)
    .where('avatar_msg.deleted_at', 'is', null)
    .where('avatar_msg.parent_id', 'is', null)
    .select([
      'avatar_msg.id as avatar_message_id',
      'avatar_msg.content as avatar_content',
      'avatar_user.username as avatar_username'
    ])
    .orderBy('avatar_msg.id', 'desc')
    .limit(limit)
    .execute();

  // For each avatar message, get the previous messages
  const fewShotExamples = await Promise.all(
    avatarMessages.map(async (avatarMsg) => {
      const previousMessages = await db
        .selectFrom('messages as m')
        .innerJoin('users as u', 'u.id', 'm.user_id')
        .where('m.channel_id', '=', channelId)
        .where('m.id', '<', avatarMsg.avatar_message_id)
        .where('m.deleted_at', 'is', null)
        .where('m.parent_id', 'is', null)
        .select([
          'm.id',
          'm.content',
          'u.username'
        ])
        .orderBy('m.id', 'desc')
        .limit(contextMessageCount)
        .execute();

      return {
        context: previousMessages.reverse(),
        avatar_response: {
          content: avatarMsg.avatar_content,
          username: avatarMsg.avatar_username
        }
      };
    })
  );

  return fewShotExamples;
}

// Create a message from the AI avatar
export async function createAvatarMessage(params: {
  channelId: string;
  workspaceId: string;
  userId: string;
  requestingUserId: string;
  parent_id?: string;
}) {
  // Check if user is a member of the channel
  const isMember = await isChannelMember(params.channelId, params.userId);
  if (!isMember) {
    throw new Error('Not a member of this channel');
  }

  // Get username once for typing indicators
  const username = (await findUserById(params.userId))?.username;
  if (!username) {
    throw new Error('User not found');
  }

  const typingInterval = setInterval(async () => {
    await publishTyping({
      channelId: params.channelId,
      userId: params.userId,
      username: `${username} (bot)`
    });
  }, 1000);

  try {
    // Get channel and workspace names
    const channelAndWorkspace = await db
      .selectFrom('channels as c')
      .innerJoin('workspaces as w', 'w.id', 'c.workspace_id')
      .where('c.id', '=', params.channelId)
      .where('w.id', '=', params.workspaceId)
      .select(['c.name as channelName', 'w.name as workspaceName'])
      .executeTakeFirst();

    if (!channelAndWorkspace) {
      throw new Error('Channel or workspace not found');
    }

    // Get the last 10 messages from the channel
    const recentMessages = await db
      .selectFrom('messages as m')
      .innerJoin('users as u', 'u.id', 'm.user_id')
      .where('m.channel_id', '=', params.channelId)
      .where('m.deleted_at', 'is', null)
      .where(eb => {
        if (params.parent_id) {
          // If parent_id provided, get messages with same parent_id or no parent_id
          return eb.or([
            eb('m.parent_id', '=', params.parent_id),
            eb('m.parent_id', 'is', null)
          ]);
        } else {
          // If no parent_id, only get messages without parent_id
          return eb('m.parent_id', 'is', null);
        }
      })
      .orderBy(sql`CASE WHEN m.parent_id IS NOT NULL THEN 0 ELSE 1 END`, 'asc')
      .orderBy('m.id', 'desc')
      .limit(10)
      .select(['m.content', 'm.user_id', 'u.username'])
      .execute();

    // Get few-shot examples for additional context
    const fewShotExamples = await getAvatarFewShotExamples(params.channelId, params.userId);
    const fewShotMessages = fewShotExamples.flatMap(example => [
      ...example.context.map(msg => ({
        role: 'user' as const,
        content: msg.content
      })),
      {
        role: 'assistant' as const,
        content: example.avatar_response.content
      }
    ]);

    // Generate embedding for the recent conversation to find similar messages
    const recentConversation = recentMessages.map(msg => `${msg.username}: ${msg.content}`).join('\n');
    const embedding = await generateEmbedding(recentConversation);

    // Find semantically similar messages
    const similarMessages = await semanticSearch(
      embedding,
      params.requestingUserId,
      params.workspaceId,
      5 // Get top 5 similar messages
    );

    const similarMessagesContent = similarMessages
      .filter(msg => !recentMessages.some(recent => recent.content === msg.content))
      .map(msg => `[Related from earlier] ${msg.username}: ${msg.content}`)
      .join('\n');

    console.log(fewShotMessages)

    // Combine recent and similar messages, format for OpenAI API
    const formattedMessages = [
      {
        role: 'developer' as const,
        content: `You are serving as an avatar for a user in a messaging app. Please only respond with the content of the message, no other text. Here are some messages that may be helpful in providing a response:\n\n${similarMessagesContent}.
        You should respond in the style of the following examples:\n\n${fewShotMessages.filter(m => m.role === 'assistant').map(msg => msg.content).join('\n')}`
      },
      ...fewShotMessages,
      ...recentMessages.reverse().map(msg => ({
        role: msg.user_id === params.userId ? 'assistant' as const : 'user' as const,
        content: msg.content
      }))
    ];

    const content = await generateAvatarResponse({
      channelName: channelAndWorkspace.channelName,
      workspaceName: channelAndWorkspace.workspaceName,
      messages: formattedMessages
    });

    // Create the message with is_avatar flag
    return createMessage(params.channelId, params.userId, {
      content,
      is_avatar: true,
      parent_id: params.parent_id,
      attachments: []
    });
  } catch (error) {
    throw error;
  } finally {
    clearInterval(typingInterval);
  }
}

export async function createMessageEmbedding(params: {
  messageId: string;
  embedding: number[];
  model: string;
}): Promise<void> {
  // Format the embedding array as a PostgreSQL vector string
  const vectorStr = `[${params.embedding.join(',')}]`;
  
  await db
    .insertInto('message_embeddings')
    .values({
      message_id: params.messageId,
      embedding: sql`${vectorStr}::vector`,
      model: params.model,
    })
    .execute();
}