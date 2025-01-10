import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// Client -> Server messages
export const clientTypingMessageSchema = z.object({
  type: z.literal('typing'),
  channelId: z.string().uuid(),
});

export const clientSubscribePresenceSchema = z.object({
  type: z.literal('subscribe_to_presence'),
  userId: z.string().uuid(),
}).openapi({
  description: 'Subscribe to presence updates for a user',
});

export const clientUnsubscribePresenceSchema = z.object({
  type: z.literal('unsubscribe_from_presence'),
  userId: z.string().uuid(),
}).openapi({
  description: 'Unsubscribe from presence updates for a user',
});

export const clientMessageSchema = z.discriminatedUnion('type', [
  clientTypingMessageSchema,
  clientSubscribePresenceSchema,
  clientUnsubscribePresenceSchema,
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
    attachments: z.array(z.object({
      id: z.string(),
      file_key: z.string(),
      filename: z.string(),
      mime_type: z.string(),
      size: z.number(),
    })).default([]),
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

export const reactionMessageSchema = z.object({
  type: z.literal('reaction'),
  channelId: z.string().uuid(),
  messageId: z.string(),
  id: z.string(),
  userId: z.string().uuid(),
  username: z.string(),
  emoji: z.string(),
}).openapi({
  description: 'Reaction event',
});

export const deleteReactionMessageSchema = z.object({
  type: z.literal('delete_reaction'),
  channelId: z.string().uuid(),
  messageId: z.string(),
  reactionId: z.string(),
}).openapi({
  description: 'Reaction deletion event',
});

export const serverMessageSchema = z.discriminatedUnion('type', [
  newMessageSchema,
  connectedMessageSchema,
  typingMessageSchema,
  presenceMessageSchema,
  reactionMessageSchema,
  deleteReactionMessageSchema,
]).or(errorMessageSchema);

// Type exports
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type ServerMessage = z.infer<typeof serverMessageSchema>;
export type NewMessageEvent = z.infer<typeof newMessageSchema>;
export type ConnectedMessage = z.infer<typeof connectedMessageSchema>;
export type ErrorMessage = z.infer<typeof errorMessageSchema>;
export type PresenceMessage = z.infer<typeof presenceMessageSchema>;
export type ReactionMessage = z.infer<typeof reactionMessageSchema>;
export type DeleteReactionMessage = z.infer<typeof deleteReactionMessageSchema>; 