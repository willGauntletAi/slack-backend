import { z } from 'zod';

const jwtEnvSchema = z.object({
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),
});

// Extend the existing env schema
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      JWT_SECRET: string;
      JWT_ACCESS_EXPIRATION?: string;
      JWT_REFRESH_EXPIRATION?: string;
    }
  }
}

export const jwtConfig = jwtEnvSchema.parse({
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_ACCESS_EXPIRATION: process.env.JWT_ACCESS_EXPIRATION,
  JWT_REFRESH_EXPIRATION: process.env.JWT_REFRESH_EXPIRATION,
}); 