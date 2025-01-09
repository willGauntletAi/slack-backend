import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Client -> Server messages
export const clientTypingMessageSchema = z.object({
  type: z.literal('typing'),
  channelId: z.string().uuid(),
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  clientTypingMessageSchema,
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

export const errorMessageSchema = z.object({
  error: z.string(),
}).openapi({
  description: 'Error event',
});

export const typingMessageSchema = z.object({
  type: z.literal('typing'),
  channelId: z.string().uuid(),
  userId: z.string().uuid(),
  username: z.string(),
}).openapi({
  description: 'Typing event',
});

export const presenceMessageSchema = z.object({
  type: z.literal('presence'),
  userId: z.string().uuid(),
  username: z.string(),
  status: z.enum(['online', 'offline']),
}).openapi({
  description: 'User presence event',
});

export const serverMessageSchema = z.discriminatedUnion('type', [
  newMessageSchema,
  connectedMessageSchema,
  typingMessageSchema,
  presenceMessageSchema,
]).or(errorMessageSchema);

// Type exports
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type ServerMessage = z.infer<typeof serverMessageSchema>;
export type NewMessageEvent = z.infer<typeof newMessageSchema>;
export type ConnectedMessage = z.infer<typeof connectedMessageSchema>;
export type ErrorMessage = z.infer<typeof errorMessageSchema>;
export type PresenceMessage = z.infer<typeof presenceMessageSchema>; 