import Redis from 'ioredis';
import { WebSocketHandler } from '../websocket/server';
import { NewMessageEvent } from '../websocket/types';

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL environment variable is required');
}

console.log('Connecting to Redis at:', process.env.REDIS_URL);

class RedisService {
  private publisher: Redis;
  private subscriber: Redis;
  private wsHandler?: WebSocketHandler;
  private isSubscribed = false;

  constructor() {
    this.publisher = new Redis(process.env.REDIS_URL!);
    this.subscriber = new Redis(process.env.REDIS_URL!);

    this.setupErrorHandling();
  }

  private setupErrorHandling() {
    this.publisher.on('error', (err) => {
      console.error('Redis publisher error:', err);
    });

    this.publisher.on('connect', () => {
      console.log('Redis publisher connected');
    });

    this.subscriber.on('error', (err) => {
      console.error('Redis subscriber error:', err);
    });

    this.subscriber.on('connect', () => {
      console.log('Redis subscriber connected');
      if (!this.isSubscribed) {
        this.setupSubscriptions();
      }
    });
  }

  public initialize(websocketHandler: WebSocketHandler) {
    console.log('Initializing Redis service');
    this.wsHandler = websocketHandler;
    if (!this.isSubscribed) {
      this.setupSubscriptions();
    }
  }

  private setupSubscriptions() {
    if (!this.subscriber) {
      console.error('Subscriber not initialized');
      return;
    }

    console.log('Setting up Redis subscriptions');
    this.subscriber.subscribe('new_message', (err) => {
      if (err) {
        console.error('Failed to subscribe to new_message channel:', err);
        this.isSubscribed = false;
        return;
      }
      console.log('Successfully subscribed to new_message channel');
      this.isSubscribed = true;
    });

    this.subscriber.on('message', (channel, message) => {
      console.log('Received message on channel:', channel);
      console.log('Message content:', message);
      
      try {
        switch (channel) {
          case 'new_message':
            this.handleNewMessage(JSON.parse(message));
            break;
          default:
            console.log('Unhandled channel:', channel);
        }
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });
  }

  private handleNewMessage(event: RedisMessageEvent) {
    if (!this.wsHandler) {
      console.error('WebSocket handler not initialized');
      return;
    }

    console.log('Handling new message:', event);
    this.wsHandler.broadcastToChannel(event.channelId, {
      type: 'new_message',
      channelId: event.channelId,
      message: event.message,
    } satisfies NewMessageEvent);
  }

  public async publishNewMessage(channelId: string, message: RedisMessageEvent['message']) {
    const payload = {
      channelId,
      message,
    };
    console.log('Publishing new message:', payload);
    const result = await this.publisher.publish('new_message', JSON.stringify(payload));
    console.log('Publish result:', result);
    return result;
  }
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

const redisService = new RedisService();
export const initializeRedis = redisService.initialize.bind(redisService);
export const publishNewMessage = redisService.publishNewMessage.bind(redisService);
