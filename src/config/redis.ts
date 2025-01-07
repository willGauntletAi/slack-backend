import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

const configSchema = z.object({
  REDIS_URL: z.string().url(),
});

export const config = configSchema.parse({
  REDIS_URL: process.env.REDIS_URL,
}); 