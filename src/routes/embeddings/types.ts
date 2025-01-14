import { z } from 'zod';

export const GenerateEmbeddingsResponseSchema = z.object({
  success: z.boolean(),
  count: z.number(),
  error: z.string().optional()
});

export type GenerateEmbeddingsResponse = z.infer<typeof GenerateEmbeddingsResponseSchema>;

export const ErrorResponseSchema = z.object({
  error: z.string()
});

export const SemanticSearchRequestSchema = z.object({
  query: z.string().min(1).max(1000),
  limit: z.number().min(1).max(10).default(10),
});

export type SemanticSearchRequest = z.infer<typeof SemanticSearchRequestSchema>;

export const SemanticSearchResponseSchema = z.object({
  messages: z.array(z.object({
    id: z.string(),
    content: z.string(),
    score: z.number(),
    channelId: z.string(),
    userId: z.string(),
    username: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })),
});

export type SemanticSearchResponse = z.infer<typeof SemanticSearchResponseSchema>; 