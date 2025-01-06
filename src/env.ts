import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  PORT: z.string().transform(Number).pipe(z.number().positive()),
});

export const env = envSchema.parse(process.env);
