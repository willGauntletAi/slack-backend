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
    this.subscriber.subscribe('new_message', 'typing', 'presence', (err) => {
      if (err) {
        console.error('Failed to subscribe to channels:', err);
        this.isSubscribed = false;
        return;
      }
      console.log('Successfully subscribed to channels');
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
          case 'typing':
            this.handleTyping(JSON.parse(message));
            break;
          case 'presence':
            this.handlePresence(JSON.parse(message));
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
    });
  }

  private handleTyping(event: RedisTypingEvent) {
    if (!this.wsHandler) {
      console.error('WebSocket handler not initialized');
      return;
    }

    console.log('Handling typing event:', event);
    this.wsHandler.broadcastToChannel(event.channelId, {
      type: 'typing',
      channelId: event.channelId,
      userId: event.userId,
      username: event.username,
    });
  }

  private handlePresence(event: RedisPresenceEvent) {
    if (!this.wsHandler) {
      console.error('WebSocket handler not initialized');
      return;
    }

    console.log('Handling presence event:', event);
    this.wsHandler.broadcastToAll({
      type: 'presence',
      userId: event.userId,
      username: event.username,
      status: event.status,
    });
  }

  public async publishNewMessage(payload: RedisMessageEvent) {
    console.log('Publishing new message:', payload);
    const result = await this.publisher.publish('new_message', JSON.stringify(payload));
    console.log('Publish result:', result);
    return result;
  }

  public async publishTyping(payload: RedisTypingEvent) {
    console.log('Publishing typing event:', payload);
    const result = await this.publisher.publish('typing', JSON.stringify(payload));
    console.log('Publish result:', result);
    return result;
  }

  public async publishPresence(payload: RedisPresenceEvent) {
    console.log('Publishing presence event:', payload);
    const result = await this.publisher.publish('presence', JSON.stringify(payload));
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

interface RedisTypingEvent {
  channelId: string;
  userId: string;
  username: string;
}

interface RedisPresenceEvent {
  userId: string;
  username: string;
  status: 'online' | 'offline';
}

const redisService = new RedisService();
export const initializeRedis = redisService.initialize.bind(redisService);
export const publishNewMessage = redisService.publishNewMessage.bind(redisService);
export const publishTyping = redisService.publishTyping.bind(redisService);
export const publishPresence = redisService.publishPresence.bind(redisService);
