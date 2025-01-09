import { Router } from 'express';
import { z } from 'zod';
import type { RequestHandler } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { registry } from '../../utils/openapi';
import { createMessage, listChannelMessages, updateMessage, deleteMessage } from '../../db/messages';
import { addMessageReaction } from '../../db/message-reactions';
import {
  createMessageSchema,
  updateMessageSchema,
  createMessageReactionSchema,
  CreateMessageResponseSchema,
  ListMessagesResponseSchema,
  UpdateMessageResponseSchema,
  CreateMessageReactionResponseSchema,
  ErrorResponseSchema,
} from './types';

const router = Router();

// POST /message/channel/:id - Create a message in a channel
registry.registerPath({
  method: 'post',
  path: '/message/channel/{id}',
  tags: ['messages'],
  summary: 'Create a new message in a channel',
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'Channel ID',
    },
  ],
  request: {
    body: {
      content: {
        'application/json': {
          schema: createMessageSchema,
        },
      },
    },
  },
  responses: {
    '201': {
      description: 'Message created successfully',
      content: {
        'application/json': {
          schema: CreateMessageResponseSchema.openapi('CreateMessageResponse'),
        },
      },
    },
    '400': {
      description: 'Invalid request body',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '401': {
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '403': {
      description: 'Not a member of the channel',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const createMessageHandler: RequestHandler<{ id: string }, {}, z.infer<typeof createMessageSchema>> = async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const data = createMessageSchema.parse(req.body);
    const message = await createMessage(req.params.id, req.user.id, data);
    res.status(201).json(message);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    if (error instanceof Error && error.message === 'Not a member of this channel') {
      res.status(403).json({ error: error.message });
      return;
    }
    console.error('Create message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /message/channel/:id - List messages in a channel
registry.registerPath({
  method: 'get',
  path: '/message/channel/{id}',
  tags: ['messages'],
  summary: 'List messages in a channel',
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'Channel ID',
    },
    {
      name: 'limit',
      in: 'query',
      required: false,
      schema: { type: 'number', default: 50 },
      description: 'Number of messages to return',
    },
    {
      name: 'before',
      in: 'query',
      required: false,
      schema: { type: 'string' },
      description: 'Message ID to fetch messages before',
    },
  ],
  responses: {
    '200': {
      description: 'List of messages retrieved successfully',
      content: {
        'application/json': {
          schema: ListMessagesResponseSchema.openapi('ListMessagesResponse'),
        },
      },
    },
    '401': {
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '403': {
      description: 'Not a member of the channel',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const listMessagesHandler: RequestHandler<{ id: string }> = async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;

    const messages = await listChannelMessages(req.params.id, req.user.id, limit, before);
    res.json(messages);
  } catch (error) {
    if (error instanceof Error && error.message === 'Not a member of this channel') {
      res.status(403).json({ error: error.message });
      return;
    }
    console.error('List messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /message/:id - Update a message
registry.registerPath({
  method: 'put',
  path: '/message/{id}',
  tags: ['messages'],
  summary: 'Update a message',
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'Message ID',
    },
  ],
  request: {
    body: {
      content: {
        'application/json': {
          schema: updateMessageSchema,
        },
      },
    },
  },
  responses: {
    '200': {
      description: 'Message updated successfully',
      content: {
        'application/json': {
          schema: UpdateMessageResponseSchema.openapi('UpdateMessageResponse'),
        },
      },
    },
    '400': {
      description: 'Invalid request body',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '401': {
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '403': {
      description: 'Not authorized to update this message',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '404': {
      description: 'Message not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const updateMessageHandler: RequestHandler<{ id: string }, {}, z.infer<typeof updateMessageSchema>> = async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const data = updateMessageSchema.parse(req.body);
    const message = await updateMessage(req.params.id, req.user.id, data);
    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }
    res.json(message);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    if (error instanceof Error) {
      switch (error.message) {
        case 'Message not found':
          res.status(404).json({ error: error.message });
          return;
        case 'Not authorized to update this message':
          res.status(403).json({ error: error.message });
          return;
      }
    }
    console.error('Update message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /message/:id - Delete a message
registry.registerPath({
  method: 'delete',
  path: '/message/{id}',
  tags: ['messages'],
  summary: 'Delete a message',
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'Message ID',
    },
  ],
  responses: {
    '200': {
      description: 'Message deleted successfully',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
          }).openapi('DeleteMessageResponse'),
        },
      },
    },
    '401': {
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '403': {
      description: 'Not authorized to delete this message',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '404': {
      description: 'Message not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const deleteMessageHandler: RequestHandler<{ id: string }> = async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    await deleteMessage(req.params.id, req.user.id);
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'Message not found':
          res.status(404).json({ error: error.message });
          return;
        case 'Not authorized to delete this message':
          res.status(403).json({ error: error.message });
          return;
      }
    }
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /message/:id/reaction - Add a reaction to a message
registry.registerPath({
  method: 'post',
  path: '/message/{id}/reaction',
  tags: ['messages'],
  summary: 'Add a reaction to a message',
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'Message ID',
    },
  ],
  request: {
    body: {
      content: {
        'application/json': {
          schema: createMessageReactionSchema,
        },
      },
    },
  },
  responses: {
    '201': {
      description: 'Reaction added successfully',
      content: {
        'application/json': {
          schema: CreateMessageReactionResponseSchema.openapi('CreateMessageReactionResponse'),
        },
      },
    },
    '400': {
      description: 'Invalid request body',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '401': {
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '403': {
      description: 'Not a member of the channel',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '404': {
      description: 'Message not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const addReactionHandler: RequestHandler<{ id: string }, {}, z.infer<typeof createMessageReactionSchema>> = async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const data = createMessageReactionSchema.parse(req.body);
    const reaction = await addMessageReaction(req.params.id, req.user.id, data);
    res.status(201).json(reaction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    if (error instanceof Error) {
      switch (error.message) {
        case 'Message not found':
          res.status(404).json({ error: error.message });
          return;
        case 'Not a member of this channel':
          res.status(403).json({ error: error.message });
          return;
        case 'User has already reacted with this emoji':
          res.status(400).json({ error: error.message });
          return;
      }
    }
    console.error('Add reaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

router.post('/channel/:id', authenticate, createMessageHandler);
router.get('/channel/:id', authenticate, listMessagesHandler);
router.put('/:id', authenticate, updateMessageHandler);
router.delete('/:id', authenticate, deleteMessageHandler);
router.post('/:id/reaction', authenticate, addReactionHandler);

export default router; 