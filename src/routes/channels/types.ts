import { z } from 'zod';

// Request schemas
export const createChannelSchema = z.object({
    name: z.string().min(1).max(100).nullable(),
    is_private: z.boolean().default(false),
    member_ids: z.array(z.string()).min(1),
});

export const updateChannelSchema = z.object({
    name: z.string().min(1).max(100).nullable().optional(),
    is_private: z.boolean().optional(),
});

// Response schemas
export const ChannelSchema = z.object({
    id: z.string(),
    name: z.string(),
    is_private: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
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
    name: z.string(),
    is_private: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
    usernames: z.array(z.string()),
});

export const UserChannelSchema = z.object({
    id: z.string(),
    name: z.string().nullable(),
    is_private: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
    workspace_id: z.string(),
    workspace_name: z.string(),
    usernames: z.array(z.string()),
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