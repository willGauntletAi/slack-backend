import { z } from 'zod';

// Request schemas
export const registerSchema = z.object({
    username: z.string().min(3).max(50),
    email: z.string().email(),
    password: z.string().min(8),
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

export const refreshSchema = z.object({
    refreshToken: z.string(),
});

// Response schemas
export const UserSchema = z.object({
    id: z.string(),
    username: z.string(),
    email: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const UserBasicSchema = z.object({
    id: z.string(),
    username: z.string(),
    email: z.string(),
});

export const TokensSchema = z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
});

export const SuccessMessageSchema = z.object({
    message: z.string(),
});

export const ErrorResponseSchema = z.object({
    error: z.string(),
});

// Response schema aliases
export const RegisterResponseSchema = z.object({
    user: UserSchema,
    accessToken: z.string(),
    refreshToken: z.string(),
});

export const LoginResponseSchema = z.object({
    user: UserBasicSchema,
    accessToken: z.string(),
    refreshToken: z.string(),
});

export const RefreshResponseSchema = TokensSchema;
export const LogoutResponseSchema = SuccessMessageSchema;
export const LogoutAllResponseSchema = SuccessMessageSchema;

// Export inferred types
export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type RefreshRequest = z.infer<typeof refreshSchema>;
export type User = z.infer<typeof UserSchema>;
export type UserBasic = z.infer<typeof UserBasicSchema>;
export type Tokens = z.infer<typeof TokensSchema>;
export type SuccessMessage = z.infer<typeof SuccessMessageSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Response types
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;
export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;
export type LogoutAllResponse = z.infer<typeof LogoutAllResponseSchema>; 