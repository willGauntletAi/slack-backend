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