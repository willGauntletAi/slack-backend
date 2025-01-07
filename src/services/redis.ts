import Redis from 'ioredis';
import { WebSocketHandler } from '../websocket/server';
import { NewMessageEvent } from '../websocket/types';

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL environment variable is required');
}

const redis = new Redis(process.env.REDIS_URL);
const subscriber = new Redis(process.env.REDIS_URL);

let wsHandler: WebSocketHandler;

export function initializeRedis(websocketHandler: WebSocketHandler) {
  wsHandler = websocketHandler;
  setupSubscriptions();
}

function setupSubscriptions() {
  subscriber.subscribe('new_message', (err) => {
    if (err) {
      console.error('Failed to subscribe to new_message channel:', err);
      return;
    }
  });

  subscriber.on('message', (channel, message) => {
    switch (channel) {
      case 'new_message':
        handleNewMessage(JSON.parse(message));
        break;
    }
  });
}

interface RedisMessageEvent {
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

function handleNewMessage(event: RedisMessageEvent) {
  wsHandler.broadcastToChannel(event.channelId, {
    type: 'new_message',
    channelId: event.channelId,
    message: event.message,
  } satisfies NewMessageEvent);
}

export async function publishNewMessage(channelId: string, message: RedisMessageEvent['message']) {
  await redis.publish('new_message', JSON.stringify({
    channelId,
    message,
  }));
}
