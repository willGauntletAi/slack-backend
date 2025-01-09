import { z } from 'zod';

// Request schemas
export const updateProfileSchema = z.object({
    username: z.string().min(3).max(50).optional(),
    email: z.string().email().optional(),
}).refine(data => Object.keys(data).length > 0, {
    message: "At least one field must be provided"
});

// Response schemas
export const UserProfileSchema = z.object({
    id: z.string(),
    username: z.string(),
    email: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const WorkspaceUserSchema = z.object({
    id: z.string(),
    username: z.string(),
    email: z.string(),
    joined_at: z.string(),
    role: z.string(),
});

export const ChannelUserSchema = z.object({
    id: z.string(),
    username: z.string(),
    email: z.string(),
    joined_at: z.string(),
});

export const ErrorResponseSchema = z.object({
    error: z.string(),
});

// Type aliases for responses
export const UserProfileResponseSchema = UserProfileSchema;
export const GetUserByIdResponseSchema = UserProfileSchema;
export const UpdateProfileResponseSchema = UserProfileSchema;
export const GetWorkspaceUsersResponseSchema = z.array(WorkspaceUserSchema);
export const GetChannelUsersResponseSchema = z.array(ChannelUserSchema);

// Export inferred types
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type WorkspaceUser = z.infer<typeof WorkspaceUserSchema>;
export type ChannelUser = z.infer<typeof ChannelUserSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Response types
export type UserProfileResponse = z.infer<typeof UserProfileResponseSchema>;
export type GetUserByIdResponse = z.infer<typeof GetUserByIdResponseSchema>;
export type UpdateProfileResponse = z.infer<typeof UpdateProfileResponseSchema>;
export type GetWorkspaceUsersResponse = z.infer<typeof GetWorkspaceUsersResponseSchema>;
export type GetChannelUsersResponse = z.infer<typeof GetChannelUsersResponseSchema>; 