export const defaultConfig = {
  DEFAULT_WORKSPACE_ID: process.env.DEFAULT_WORKSPACE_ID,
  DEFAULT_CHANNEL_ID: process.env.DEFAULT_CHANNEL_ID,
} as const;

// Validate required environment variables
if (!defaultConfig.DEFAULT_WORKSPACE_ID) {
  throw new Error('DEFAULT_WORKSPACE_ID environment variable is required');
}

if (!defaultConfig.DEFAULT_CHANNEL_ID) {
  throw new Error('DEFAULT_CHANNEL_ID environment variable is required');
} 