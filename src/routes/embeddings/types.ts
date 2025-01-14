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