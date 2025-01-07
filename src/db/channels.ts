import { db } from './index';
import { z } from 'zod';
import { isWorkspaceMember } from './workspaces';
import { sql } from 'kysely';

// Schema for creating a channel
export const createChannelSchema = z.object({
  name: z.string().min(1).max(100),
  is_private: z.boolean().default(false),
});

export type CreateChannelData = z.infer<typeof createChannelSchema>;

// Schema for updating a channel
export const updateChannelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  is_private: z.boolean().optional(),
});

export type UpdateChannelData = z.infer<typeof updateChannelSchema>;

// Create a new channel and add the creator as a member
export async function createChannel(workspaceId: string, userId: string, data: CreateChannelData) {
  // Check if user is a member of the workspace
  const isMember = await isWorkspaceMember(workspaceId, userId);
  if (!isMember) {
    throw new Error('Not a member of the workspace');
  }

  const now = new Date().toISOString();

  // Use a transaction to create the channel and add the creator as a member
  return await db.transaction().execute(async (trx) => {
    // Create the channel
    const channel = await trx
      .insertInto('channels')
      .values({
        workspace_id: workspaceId,
        name: data.name,
        is_private: data.is_private,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Add the creator as a member
    await trx
      .insertInto('channel_members')
      .values({
        channel_id: channel.id,
        user_id: userId,
        joined_at: now,
      })
      .execute();

    return channel;
  });
}

// List channels in a workspace
export async function listChannelsInWorkspace(
  workspaceId: string, 
  userId: string,
  search?: string
) {
  // Check if user is a member of the workspace
  const isMember = await isWorkspaceMember(workspaceId, userId);
  if (!isMember) {
    throw new Error('Not a member of the workspace');
  }

  let query = db
    .selectFrom('channels as c')
    .leftJoin('channel_members as cm', (join) =>
      join
        .onRef('c.id', '=', 'cm.channel_id')
        .on('cm.user_id', '=', userId)
    )
    .where('c.workspace_id', '=', workspaceId)
    .where('c.deleted_at', 'is', null)
    .where((eb) =>
      eb.or([
        eb('c.is_private', '=', false),
        eb('cm.user_id', 'is not', null)
      ])
    );

  // Add case-insensitive search if search parameter is provided
  if (search) {
    query = query.where('c.name', 'ilike', `%${search}%`);
  }

  return await query
    .select([
      'c.id',
      'c.name',
      'c.is_private',
      'c.created_at',
      'c.updated_at',
    ])
    .execute();
}

// Get a channel by ID
export async function getChannelById(channelId: string) {
  return await db
    .selectFrom('channels')
    .where('id', '=', channelId)
    .where('deleted_at', 'is', null)
    .selectAll()
    .executeTakeFirst();
}

// Check if a user is a member of a channel
export async function isChannelMember(channelId: string, userId: string) {
  const member = await db
    .selectFrom('channel_members')
    .where('channel_id', '=', channelId)
    .where('user_id', '=', userId)
    .selectAll()
    .executeTakeFirst();

  return member !== undefined;
}

// Update a channel
export async function updateChannel(channelId: string, userId: string, data: UpdateChannelData) {
  // Check if user is a member of the channel
  const isMember = await isChannelMember(channelId, userId);
  if (!isMember) {
    throw new Error('Not a member of the channel');
  }

  const now = new Date().toISOString();

  return await db
    .updateTable('channels')
    .set({
      ...data,
      updated_at: now,
    })
    .where('id', '=', channelId)
    .where('deleted_at', 'is', null)
    .returningAll()
    .executeTakeFirstOrThrow();
}

// Add a member to a channel
export async function addChannelMember(channelId: string, userId: string, addedByUserId: string) {
  // Get the channel to check if it exists and if it's private
  const channel = await getChannelById(channelId);
  if (!channel) {
    throw new Error('Channel not found');
  }

  // Check if both users are members of the workspace
  const workspaceMembers = await db
    .selectFrom('workspace_members')
    .where('workspace_id', '=', channel.workspace_id)
    .where('user_id', 'in', [userId, addedByUserId])
    .select('user_id')
    .execute();

  if (workspaceMembers.length !== 2) {
    throw new Error('Both users must be members of the workspace');
  }

  // Check if the user is already a member
  const isMember = await isChannelMember(channelId, userId);
  if (isMember) {
    throw new Error('User is already a member of this channel');
  }

  // For private channels, check if the adder is a member
  if (channel.is_private) {
    const isAdderMember = await isChannelMember(channelId, addedByUserId);
    if (!isAdderMember) {
      throw new Error('Only members can add users to private channels');
    }
  }

  const now = new Date().toISOString();

  return await db
    .insertInto('channel_members')
    .values({
      channel_id: channelId,
      user_id: userId,
      joined_at: now,
    })
    .execute();
}

// Remove a member from a channel
export async function removeChannelMember(channelId: string, userId: string, removedByUserId: string) {
  // Ensure the user is removing themselves
  if (userId !== removedByUserId) {
    throw new Error('Users can only remove themselves from channels');
  }

  // Check if the user is a member
  const isMember = await isChannelMember(channelId, userId);
  if (!isMember) {
    throw new Error('User is not a member of this channel');
  }

  const now = new Date().toISOString();

  return await db
    .updateTable('channel_members')
    .set({
      deleted_at: now,
    })
    .where('channel_id', '=', channelId)
    .where('user_id', '=', userId)
    .execute();
} 