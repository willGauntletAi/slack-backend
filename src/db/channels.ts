import { db } from './index';
import { z } from 'zod';
import { isWorkspaceMember } from './workspaces';
import { sql } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';

// Schema for creating a channel
export const createChannelSchema = z.object({
  name: z.string().min(1).max(100).nullable(),
  is_private: z.boolean().default(false),
  member_ids: z.array(z.string()).default([]),
});

export type CreateChannelData = z.infer<typeof createChannelSchema>;

// Schema for updating a channel
export const updateChannelSchema = z.object({
  name: z.string().min(1).max(100).nullable().optional(),
  is_private: z.boolean().optional(),
});

export type UpdateChannelData = z.infer<typeof updateChannelSchema>;

// Create a new channel and add the creator and specified members
export async function createChannel(workspaceId: string, userId: string, data: CreateChannelData) {
  // Verify creator is in the workspace
  const isMemberInWorkspace = await isWorkspaceMember(workspaceId, userId);
  if (!isMemberInWorkspace) {
    throw new Error(`User ${userId} is not a member of the workspace`);
  }

  // If there are additional members, verify they are in the workspace
  if (data.member_ids.length > 0) {
    for (const memberId of data.member_ids) {
      const isMemberInWorkspace = await isWorkspaceMember(workspaceId, memberId);
      if (!isMemberInWorkspace) {
        throw new Error(`User ${memberId} is not a member of the workspace`);
      }
    }
  }

  const now = new Date().toISOString();

  // Use a transaction to create the channel and add members if specified
  return await db.transaction().execute(async (trx) => {
    // Create the channel
    const channel = await trx
      .insertInto('channels')
      .values({
        workspace_id: workspaceId,
        name: data.name ?? sql`NULL`,
        is_private: data.is_private,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Add creator and specified members if any
    const memberIds = [...new Set([userId, ...data.member_ids])];
    await trx
      .insertInto('channel_members')
      .values(
        memberIds.map(memberId => ({
          channel_id: channel.id,
          user_id: memberId,
          joined_at: now,
        }))
      )
      .execute();

    // Get member usernames
    const members = await trx
      .selectFrom('users')
      .select(['username'])
      .where('id', 'in', memberIds)
      .execute();

    return {
      ...channel,
      usernames: members.map(m => m.username),
    };
  });
}

// List channels in a workspace
export async function listChannelsInWorkspace(
  workspaceId: string,
  userId: string,
  search?: string,
  excludeMine?: boolean
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
        eb.and([
          eb('cm.user_id', 'is not', null),
          eb('cm.deleted_at', 'is', null)
        ])
      ])
    );

  // Add case-insensitive search if search parameter is provided
  if (search) {
    query = query.where('c.name', 'ilike', `%${search}%`);
  }

  // Exclude channels where the user is a member if excludeMine is true
  if (excludeMine) {
    query = query.where((eb) =>
      eb.or([
        eb('cm.user_id', 'is', null),
        eb('cm.deleted_at', 'is not', null)
      ])
    );
  }

  return await query
    .select((eb) => [
      'c.id',
      'c.name',
      'c.is_private',
      'c.created_at',
      'c.updated_at',
      'cm.last_read_message',
      eb.selectFrom('messages as m')
        .select(eb.fn.countAll().as('count'))
        .where('m.channel_id', '=', eb.ref('c.id'))
        .where('m.deleted_at', 'is', null)
        .where((eb) =>
          eb.or([
            eb('cm.last_read_message', 'is', null),
            eb('m.id', '>', eb.ref('cm.last_read_message'))
          ])
        )
        .as('unread_count'),
      jsonArrayFrom(
        eb.selectFrom('users')
          .select([
            'username',
          ])
          .innerJoin('channel_members', join =>
            join
              .onRef('channel_members.user_id', '=', 'users.id')
              .onRef('channel_members.channel_id', '=', 'c.id')
          )
          .where('channel_members.deleted_at', 'is', null)
      ).as('members')
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
    .where('deleted_at', 'is', null)
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

  const updatedChannel = await db
    .updateTable('channels as c')
    .set({
      ...data,
      name: data.name ?? sql`NULL`,
      updated_at: now,
    })
    .where('c.id', '=', channelId)
    .where('c.deleted_at', 'is', null)
    .returning((eb) => [
      'c.id',
      'c.name',
      'c.is_private',
      'c.created_at',
      'c.updated_at',
      jsonArrayFrom(
        eb.selectFrom('users')
          .select(['username'])
          .innerJoin('channel_members', join =>
            join
              .onRef('channel_members.user_id', '=', 'users.id')
              .onRef('channel_members.channel_id', '=', 'c.id')
          )
          .where('channel_members.deleted_at', 'is', null)
      ).as('usernames')
    ])
    .executeTakeFirstOrThrow();

  return updatedChannel;
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

  if (workspaceMembers.length !== 2 && userId !== addedByUserId) {
    throw new Error('Both users must be members of the workspace');
  }

  // For private channels, check if the adder is a member
  if (channel.is_private) {
    const isAdderMember = await isChannelMember(channelId, addedByUserId);
    if (!isAdderMember) {
      throw new Error('Only members can add users to private channels');
    }
  }

  const now = new Date().toISOString();

  // Check if there's an existing membership record
  const existingMembership = await db
    .selectFrom('channel_members')
    .where('channel_id', '=', channelId)
    .where('user_id', '=', userId)
    .selectAll()
    .executeTakeFirst();

  if (existingMembership) {
    if (existingMembership.deleted_at === null) {
      throw new Error('User is already a member of this channel');
    }

    // Reactivate the membership
    return await db
      .updateTable('channel_members')
      .set({
        deleted_at: null,
        joined_at: now,
      })
      .where('channel_id', '=', channelId)
      .where('user_id', '=', userId)
      .execute();
  }

  // Create new membership
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

// Get all channels a user is a member of
export async function listUserChannels(userId: string, workspaceId?: string) {
  let query = db
    .selectFrom('channels as c')
    .innerJoin('channel_members as cm', (join) =>
      join
        .onRef('c.id', '=', 'cm.channel_id')
        .on('cm.user_id', '=', userId)
        .on('cm.deleted_at', 'is', null)
    )
    .innerJoin('workspaces as w', 'w.id', 'c.workspace_id')
    .where('c.deleted_at', 'is', null)
    .where('w.deleted_at', 'is', null);

  // Filter by workspace if provided
  if (workspaceId) {
    query = query.where('c.workspace_id', '=', workspaceId);
  }

  return await query
    .select(eb => [
      'c.id',
      'c.name',
      'c.is_private',
      'c.created_at',
      'c.updated_at',
      'c.workspace_id',
      'w.name as workspace_name',
      'cm.last_read_message',
      eb.selectFrom('messages as m')
        .select(eb.fn.countAll().as('count'))
        .where('m.channel_id', '=', eb.ref('c.id'))
        .where('m.deleted_at', 'is', null)
        .where((eb) =>
          eb.or([
            eb('cm.last_read_message', 'is', null),
            eb('m.id', '>', eb.ref('cm.last_read_message'))
          ])
        )
        .as('unread_count'),
      jsonArrayFrom(
        eb.selectFrom('users')
          .select([
            'id',
            'username',
            'email',
            'created_at',
          ])
          .innerJoin('channel_members', join =>
            join
              .onRef('channel_members.user_id', '=', 'users.id')
              .onRef('channel_members.channel_id', '=', eb.ref('c.id'))
          )
          .where('channel_members.deleted_at', 'is', null)
      ).as('members')
    ])
    .execute();
}

// Update the last read message for a channel member
export async function updateLastReadMessage(channelId: string, userId: string, messageId: string) {
  // First check if the message exists and belongs to this channel
  const message = await db
    .selectFrom('messages')
    .where('id', '=', messageId)
    .where('channel_id', '=', channelId)
    .where('deleted_at', 'is', null)
    .select('id')
    .executeTakeFirst();

  if (!message) {
    throw new Error('Message not found or does not belong to this channel');
  }

  // Update the last_read_message only if it's greater than the current one
  return await db
    .updateTable('channel_members')
    .set({
      last_read_message: sql`CASE 
        WHEN last_read_message IS NULL THEN ${messageId}::bigint
        WHEN last_read_message < ${messageId}::bigint THEN ${messageId}::bigint
        ELSE last_read_message
      END`,
      updated_at: new Date().toISOString(),
    })
    .where('channel_id', '=', channelId)
    .where('user_id', '=', userId)
    .where('deleted_at', 'is', null)
    .execute();
} 