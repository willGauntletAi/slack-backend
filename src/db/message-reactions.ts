import { db } from './index';
import { z } from 'zod';
import { isChannelMember } from './channels';
import { getMessageById } from './messages';

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

    return reaction;
} 