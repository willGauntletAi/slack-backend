import { z } from 'zod';

// Request schemas
export const FileAttachmentSchema = z.object({
    file_key: z.string(),
    filename: z.string(),
    mime_type: z.string(),
    size: z.number(),
});

export const createMessageRequestSchema = z.object({
    content: z.string(),
    parent_id: z.string().optional(),
    attachments: z.array(FileAttachmentSchema).default([]),
});

export const createMessageReactionRequestSchema = z.object({
    emoji: z.string().min(1),
});

export const updateMessageRequestSchema = z.object({
  content: z.string().min(1),
  attachments: z.array(z.object({
    file_key: z.string(),
    filename: z.string(),
    mime_type: z.string(),
    size: z.number(),
  })).default([]),
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
    is_avatar: z.boolean(),
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
    is_avatar: z.boolean(),
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