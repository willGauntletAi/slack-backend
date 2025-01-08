import { db } from './index';
import { z } from 'zod';
import { publishNewMessage } from '../services/redis';
import { checkUsersShareWorkspace } from './users';

// Schema for creating a DM channel
export const createDMChannelSchema = z.object({
    user_ids: z.array(z.string()).min(1),
});

export type CreateDMChannelData = z.infer<typeof createDMChannelSchema>;

// Schema for creating a DM message
export const createDMMessageSchema = z.object({
    content: z.string().min(1),
});

export type CreateDMMessageData = z.infer<typeof createDMMessageSchema>;

// Schema for updating a DM message
export const updateDMMessageSchema = z.object({
    content: z.string().min(1),
});

export type UpdateDMMessageData = z.infer<typeof updateDMMessageSchema>;

// Check if user is a participant in a DM channel
export async function isDMChannelParticipant(channelId: string, userId: string) {
    const member = await db
        .selectFrom('direct_message_members')
        .where('channel_id', '=', channelId)
        .where('user_id', '=', userId)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();

    return !!member;
}

// Create or get existing DM channel
export async function createDMChannel(userId: string, otherUserIds: string[]) {
    // Check if all users share a workspace
    const userIds = [userId, ...otherUserIds];

    // Check each pair of users to ensure they share a workspace
    for (let i = 0; i < userIds.length; i++) {
        for (let j = i + 1; j < userIds.length; j++) {
            const canDM = await checkUsersShareWorkspace(userIds[i], userIds[j]);
            if (!canDM) {
                throw new Error('Cannot create DM channel with users from different workspaces');
            }
        }
    }

    // Check if DM channel already exists with exactly these members
    const existingChannels = await db
        .selectFrom('direct_message_members as dm')
        .where('dm.deleted_at', 'is', null)
        .groupBy('dm.channel_id')
        .having(eb =>
            eb.fn.count('dm.user_id'), '=', userIds.length
        )
        .select(['dm.channel_id'])
        .execute();

    // For each potential channel, check if it has exactly these members
    for (const { channel_id } of existingChannels) {
        const members = await db
            .selectFrom('direct_message_members')
            .where('channel_id', '=', channel_id)
            .where('deleted_at', 'is', null)
            .select('user_id')
            .execute();

        const memberIds = members.map(m => m.user_id);
        if (memberIds.length === userIds.length &&
            userIds.every(id => memberIds.includes(id))) {
            // Found existing channel with exact members
            const channel = await db
                .selectFrom('direct_message_channels')
                .where('id', '=', channel_id)
                .selectAll()
                .executeTakeFirst();

            if (channel) {
                return channel;
            }
        }
    }

    // Create new DM channel
    const now = new Date().toISOString();
    return await db.transaction().execute(async (trx) => {
        // Create the channel
        const channel = await trx
            .insertInto('direct_message_channels')
            .values({
                created_at: now,
                updated_at: now,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        // Add all users as members
        await trx
            .insertInto('direct_message_members')
            .values(
                userIds.map(uid => ({
                    channel_id: channel.id,
                    user_id: uid,
                    joined_at: now,
                    updated_at: now,
                }))
            )
            .execute();

        return channel;
    });
}

// Create a new DM message
export async function createDMMessage(channelId: string, userId: string, data: CreateDMMessageData) {
    // Check if user is a participant
    const isParticipant = await isDMChannelParticipant(channelId, userId);
    if (!isParticipant) {
        throw new Error('Not a participant in this DM channel');
    }

    const now = new Date().toISOString();

    // Use a transaction to create the message and get user info
    const result = await db.transaction().execute(async (trx) => {
        // Create the message
        const message = await trx
            .insertInto('direct_messages')
            .values({
                channel_id: channelId,
                user_id: userId,
                content: data.content,
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
    await publishNewMessage(`dm:${channelId}`, {
        id: result.id.toString(),
        content: result.content,
        parent_id: null,
        created_at: result.created_at.toISOString(),
        updated_at: result.updated_at.toISOString(),
        user_id: result.user_id,
        username: result.username,
    });

    return result;
}

// List messages in a DM channel
export async function listDMMessages(
    channelId: string,
    userId: string,
    limit: number = 50,
    before?: string
) {
    // Check if user is a participant
    const isParticipant = await isDMChannelParticipant(channelId, userId);
    if (!isParticipant) {
        throw new Error('Not a participant in this DM channel');
    }

    let query = db
        .selectFrom('direct_messages as m')
        .innerJoin('users as u', 'u.id', 'm.user_id')
        .where('m.channel_id', '=', channelId)
        .where('m.deleted_at', 'is', null)
        .orderBy('m.id', 'desc')
        .limit(limit)
        .select([
            'm.id',
            'm.content',
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

// Get a DM message by ID
export async function getDMMessageById(messageId: string) {
    return await db
        .selectFrom('direct_messages')
        .where('id', '=', messageId)
        .where('deleted_at', 'is', null)
        .selectAll()
        .executeTakeFirst();
}

// Update a DM message
export async function updateDMMessage(messageId: string, userId: string, data: UpdateDMMessageData) {
    // Check if message exists and user is the author
    const message = await getDMMessageById(messageId);
    if (!message) {
        throw new Error('Message not found');
    }

    if (message.user_id !== userId) {
        throw new Error('Not authorized to update this message');
    }

    const now = new Date().toISOString();

    return await db
        .updateTable('direct_messages')
        .set({
            content: data.content,
            updated_at: now,
        })
        .where('id', '=', messageId)
        .where('deleted_at', 'is', null)
        .returningAll()
        .executeTakeFirst();
}

// Delete a DM message (soft delete)
export async function deleteDMMessage(messageId: string, userId: string) {
    // Check if message exists and user is the author
    const message = await getDMMessageById(messageId);
    if (!message) {
        throw new Error('Message not found');
    }

    if (message.user_id !== userId) {
        throw new Error('Not authorized to delete this message');
    }

    const now = new Date().toISOString();

    return await db
        .updateTable('direct_messages')
        .set({
            deleted_at: now,
        })
        .where('id', '=', messageId)
        .returningAll()
        .executeTakeFirst();
} 