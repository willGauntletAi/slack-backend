import { z } from 'zod';
import { createMessageSchema, updateMessageSchema } from '../../db/messages';
import { createMessageReactionSchema } from '../../db/message-reactions';

// Request schemas
export const FileAttachmentSchema = z.object({
    file_key: z.string(),
    filename: z.string(),
    mime_type: z.string(),
    size: z.number(),
});

// Response schemas
export const CreateMessageResponseSchema = z.object({
    id: z.string(),
    content: z.string(),
    parent_id: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    user_id: z.string(),
    channel_id: z.string(),
    attachments: z.array(FileAttachmentSchema),
});

export const MessageReactionSchema = z.object({
    id: z.string(),
    emoji: z.string(),
    message_id: z.string(),
    user_id: z.string(),
    username: z.string(),
});

export const ListMessagesResponseSchema = z.array(z.object({
    id: z.string(),
    content: z.string(),
    parent_id: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    user_id: z.string(),
    username: z.string(),
    channel_id: z.string(),
    reactions: z.array(MessageReactionSchema),
    attachments: z.array(FileAttachmentSchema),
}));

export const UpdateMessageResponseSchema = CreateMessageResponseSchema;

export const CreateMessageReactionResponseSchema = z.object({
    id: z.string(),
    emoji: z.string(),
    message_id: z.string(),
    user_id: z.string(),
    created_at: z.string(),
});

export const ErrorResponseSchema = z.object({
    error: z.string(),
});

// Re-export the request schemas
export { createMessageSchema, updateMessageSchema, createMessageReactionSchema }; 