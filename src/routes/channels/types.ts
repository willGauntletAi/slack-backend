import { z } from 'zod';

// Request schemas
export const createChannelSchema = z.object({
    name: z.string().min(1).max(100).nullable(),
    is_private: z.boolean().default(false),
    member_ids: z.array(z.string()).default([]),
});

export const updateChannelSchema = z.object({
    name: z.string().min(1).max(100).nullable().optional(),
    is_private: z.boolean().optional(),
});

// Response schemas
export const ChannelSchema = z.object({
    id: z.string(),
    name: z.string().nullable(),
    is_private: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
    lastUpdated: z.string(),
    members: z.array(z.object({
        id: z.string(),
        username: z.string()
    })),
});

export const UserSchema = z.object({
    id: z.string(),
    username: z.string(),
    email: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const ListChannelSchema = z.object({
    id: z.string(),
    name: z.string().nullable(),
    is_private: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
    lastUpdated: z.string(),
    members: z.array(z.object({
        id: z.string(),
        username: z.string()
    })),
    unread_count: z.number(),
    last_read_message: z.string().nullable(),
});

export const UserChannelSchema = z.object({
    id: z.string(),
    name: z.string().nullable(),
    is_private: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
    lastUpdated: z.string(),
    workspace_id: z.string(),
    workspace_name: z.string(),
    members: z.array(z.object({
        id: z.string(),
        username: z.string()
    })),
    unread_count: z.number(),
    last_read_message: z.string().nullable(),
});

export const SuccessMessageSchema = z.object({
    message: z.string(),
});

export const ErrorResponseSchema = z.object({
    error: z.string(),
});

// Response schema aliases
export const CreateChannelResponseSchema = ChannelSchema;
export const ListChannelsResponseSchema = z.array(ListChannelSchema);
export const ListUserChannelsResponseSchema = z.array(UserChannelSchema);
export const UpdateChannelResponseSchema = ChannelSchema;

// Export inferred types
export type CreateChannelRequest = z.infer<typeof createChannelSchema>;
export type UpdateChannelRequest = z.infer<typeof updateChannelSchema>;
export type Channel = z.infer<typeof ChannelSchema>;
export type User = z.infer<typeof UserSchema>;
export type ListChannel = z.infer<typeof ListChannelSchema>;
export type UserChannel = z.infer<typeof UserChannelSchema>;
export type SuccessMessage = z.infer<typeof SuccessMessageSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Response types
export type CreateChannelResponse = z.infer<typeof CreateChannelResponseSchema>;
export type ListChannelsResponse = z.infer<typeof ListChannelsResponseSchema>;
export type ListUserChannelsResponse = z.infer<typeof ListUserChannelsResponseSchema>;
export type UpdateChannelResponse = z.infer<typeof UpdateChannelResponseSchema>; 