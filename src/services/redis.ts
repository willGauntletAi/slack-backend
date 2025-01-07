import Redis from 'ioredis';
import { config } from '../config/redis';

// Create Redis client
export const redis = new Redis(config.REDIS_URL);

// Channel names for pub/sub
export const CHANNELS = {
  NEW_MESSAGE: 'new_message',
  MESSAGE_UPDATED: 'message_updated',
  MESSAGE_DELETED: 'message_deleted',
} as const;

// Message types for pub/sub
export interface NewMessageEvent {
  type: 'new_message';
  channelId: string;
  message: {
    id: string;
    content: string;
    parent_id: string | null;
    created_at: string;
    updated_at: string;
    user_id: string;
    username: string;
  };
}

export type MessageEvent = NewMessageEvent;

// Publish functions
export async function publishNewMessage(channelId: string, message: NewMessageEvent['message']) {
  const event: NewMessageEvent = {
    type: 'new_message',
    channelId,
    message,
  };
  await redis.publish(CHANNELS.NEW_MESSAGE, JSON.stringify(event));
}
