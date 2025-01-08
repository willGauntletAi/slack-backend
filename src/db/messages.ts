import { db } from './index';
import { z } from 'zod';
import { isChannelMember } from './channels';
import { publishNewMessage } from '../services/redis';

// Schema for creating a message
export const createMessageSchema = z.object({
  content: z.string().min(1),
  parent_id: z.string().optional(),
});

export type CreateMessageData = z.infer<typeof createMessageSchema>;

// Schema for updating a message
export const updateMessageSchema = z.object({
  content: z.string().min(1),
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
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Get the username
    const user = await trx
      .selectFrom('users')
      .where('id', '=', userId)
      .select('username')
      .executeTakeFirstOrThrow();

    return { ...message, username: user.username };
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
  before?: string // message ID to fetch messages before
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
    .limit(limit)
    .select([
      'm.id',
      'm.content',
      'm.parent_id',
      'm.created_at',
      'm.updated_at',
      'm.user_id',
      'm.channel_id',
      'u.username',
    ]);

  if (before) {
    query = query.where('m.id', '<', before);
  }

  return await query.execute();
}

// Get a message by ID
export async function getMessageById(messageId: string) {
  return await db
    .selectFrom('messages')
    .where('id', '=', messageId)
    .where('deleted_at', 'is', null)
    .selectAll()
    .executeTakeFirst();
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

  const updatedMessage = await db
    .updateTable('messages')
    .set({
      content: data.content,
      updated_at: now,
    })
    .where('id', '=', messageId)
    .where('deleted_at', 'is', null)
    .returningAll()
    .executeTakeFirst();

  return updatedMessage;
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