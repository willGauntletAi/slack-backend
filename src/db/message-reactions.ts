import { db } from './index';
import { z } from 'zod';
import { isChannelMember } from './channels';
import { getMessageById } from './messages';
import { publishReaction, publishDeletedReaction } from '../services/redis';
import { findUserById } from './users';

// Schema for creating a message reaction
export const createMessageReactionSchema = z.object({
    emoji: z.string().min(1),
});

export type CreateMessageReactionData = z.infer<typeof createMessageReactionSchema>;

// Add a reaction to a message
export async function addMessageReaction(messageId: string, userId: string, data: CreateMessageReactionData) {
    // Get the message to check if it exists and get the channel ID
    const message = await getMessageById(messageId);
    if (!message) {
        throw new Error('Message not found');
    }

    // Check if user is a member of the channel
    const isMember = await isChannelMember(message.channel_id, userId);
    if (!isMember) {
        throw new Error('Not a member of this channel');
    }

    // Check if the user has already reacted with this emoji
    const existingReaction = await db
        .selectFrom('message_reactions')
        .where('message_id', '=', messageId)
        .where('user_id', '=', userId)
        .where('emoji', '=', data.emoji)
        .selectAll()
        .executeTakeFirst();

    if (existingReaction) {
        return existingReaction;
    }

    // Add the reaction
    const reaction = await db
        .insertInto('message_reactions')
        .values({
            message_id: messageId,
            user_id: userId,
            emoji: data.emoji,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

    // Get user info for the event
    const user = await findUserById(userId);
    if (!user) {
        throw new Error('User not found');
    }

    // Publish the reaction event
    await publishReaction({
        channelId: message.channel_id,
        messageId,
        reactionId: reaction.id,
        userId,
        username: user.username,
        emoji: data.emoji,
    });

    return reaction;
}

// Delete a reaction from a message
export async function deleteMessageReaction(reactionId: string, userId: string) {
    // Get the reaction to check if it exists and get the message ID
    const reaction = await db
        .selectFrom('message_reactions')
        .where('id', '=', reactionId)
        .selectAll()
        .executeTakeFirst();

    if (!reaction) {
        throw new Error('Reaction not found');
    }

    // Check if the user owns the reaction
    if (reaction.user_id !== userId) {
        throw new Error('Not authorized to delete this reaction');
    }

    // Get the message to get the channel ID
    const message = await getMessageById(reaction.message_id);
    if (!message) {
        throw new Error('Message not found');
    }

    // Delete the reaction
    await db
        .deleteFrom('message_reactions')
        .where('id', '=', reactionId)
        .execute();

    // Publish the reaction deletion event
    await publishDeletedReaction({
        channelId: message.channel_id,
        messageId: reaction.message_id,
        reactionId: reaction.id,
    });

    return reaction;
} 