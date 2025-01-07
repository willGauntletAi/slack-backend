import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

// Client -> Server messages
export const subscribeMessageSchema = z.object({
  type: z.literal('subscribe'),
  channelId: z.string().uuid(),
}).openapi({
  description: 'Subscribe to a channel',
});

export const unsubscribeMessageSchema = z.object({
  type: z.literal('unsubscribe'),
  channelId: z.string().uuid(),
}).openapi({
  description: 'Unsubscribe from a channel',
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  subscribeMessageSchema,
  unsubscribeMessageSchema,
]);

// Server -> Client messages
export const newMessageSchema = z.object({
  type: z.literal('new_message'),
  channelId: z.string().uuid(),
  message: z.object({
    id: z.string(),
    content: z.string(),
    parent_id: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    user_id: z.string().uuid(),
    username: z.string(),
  }),
}).openapi({
  description: 'New message event',
});

export const connectedMessageSchema = z.object({
  type: z.literal('connected'),
  userId: z.string().uuid(),
}).openapi({
  description: 'Connection successful event',
});

export const subscribedMessageSchema = z.object({
  type: z.literal('subscribed'),
  channelId: z.string().uuid(),
}).openapi({
  description: 'Channel subscription successful event',
});

export const unsubscribedMessageSchema = z.object({
  type: z.literal('unsubscribed'),
  channelId: z.string().uuid(),
}).openapi({
  description: 'Channel unsubscription successful event',
});

export const errorMessageSchema = z.object({
  error: z.string(),
}).openapi({
  description: 'Error event',
});

export const serverMessageSchema = z.discriminatedUnion('type', [
  newMessageSchema,
  connectedMessageSchema,
  subscribedMessageSchema,
  unsubscribedMessageSchema,
]).or(errorMessageSchema);

// Type exports
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type ServerMessage = z.infer<typeof serverMessageSchema>;
export type NewMessageEvent = z.infer<typeof newMessageSchema>;
export type ConnectedMessage = z.infer<typeof connectedMessageSchema>;
export type SubscribedMessage = z.infer<typeof subscribedMessageSchema>;
export type UnsubscribedMessage = z.infer<typeof unsubscribedMessageSchema>;
export type ErrorMessage = z.infer<typeof errorMessageSchema>; 