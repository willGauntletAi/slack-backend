import { z } from 'zod';

// Request schemas
export const getUploadUrlSchema = z.object({
    fileName: z.string().min(1),
});

// Response schemas
export const UploadUrlSchema = z.object({
    url: z.string().url(),
    key: z.string(),
});

export const DownloadUrlSchema = z.object({
    url: z.string().url(),
});

export const ErrorResponseSchema = z.object({
    error: z.string(),
});

// Request/Response type aliases
export type GetUploadUrlRequest = z.infer<typeof getUploadUrlSchema>;
export type UploadUrlResponse = z.infer<typeof UploadUrlSchema>;
export type DownloadUrlResponse = z.infer<typeof DownloadUrlSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>; 