import { db } from './index';
import { z } from 'zod';
import { isChannelMember } from './channels';
import { publishNewMessage } from '../services/redis';
import { jsonArrayFrom } from 'kysely/helpers/postgres';


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

    return {
      ...message,
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
