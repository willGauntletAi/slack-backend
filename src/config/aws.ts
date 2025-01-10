import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

const awsConfigSchema = z.object({
    AWS_REGION: z.string(),
    AWS_ACCESS_KEY_ID: z.string(),
    AWS_SECRET_ACCESS_KEY: z.string(),
    AWS_S3_BUCKET: z.string(),
});

// Extend the existing env schema
declare global {
    namespace NodeJS {
        interface ProcessEnv {
            SLACK_AWS_REGION: string;
            SLACK_AWS_ACCESS_KEY_ID: string;
            SLACK_AWS_SECRET_ACCESS_KEY: string;
            SLACK_AWS_S3_BUCKET: string;
        }
    }
}

// Check if we're running in a script (like OpenAPI generation)
const isScript = process.argv[1]?.includes('scripts/');

export const awsConfig = isScript
    ? {
        AWS_REGION: 'dummy-region',
        AWS_ACCESS_KEY_ID: 'dummy-key',
        AWS_SECRET_ACCESS_KEY: 'dummy-secret',
        AWS_S3_BUCKET: 'dummy-bucket',
    }
    : {
        AWS_REGION: process.env.SLACK_AWS_REGION,
        AWS_ACCESS_KEY_ID: process.env.SLACK_AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY: process.env.SLACK_AWS_SECRET_ACCESS_KEY,
        AWS_S3_BUCKET: process.env.SLACK_AWS_S3_BUCKET,
    }; 