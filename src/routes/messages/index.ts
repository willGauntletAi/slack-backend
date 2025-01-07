import { Router } from 'express';
import { z } from 'zod';
import type { RequestHandler } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { registry } from '../../utils/openapi';

const router = Router();

// Schema for creating a message
const createMessageSchema = z.object({
  content: z.string().min(1),
  parent_id: z.string().optional(), // For thread replies
});

type CreateMessageBody = z.infer<typeof createMessageSchema>;

// Schema for updating a message
const updateMessageSchema = z.object({
  content: z.string().min(1),
});

type UpdateMessageBody = z.infer<typeof updateMessageSchema>;

// Schema for adding a reaction
const addReactionSchema = z.object({
  emoji: z.string().min(1),
});

type AddReactionBody = z.infer<typeof addReactionSchema>;

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
          schema: z.object({
            id: z.string(),
            content: z.string(),
            parent_id: z.string().optional(),
            user_id: z.string(),
            created_at: z.string(),
            updated_at: z.string(),
          }).openapi('CreateMessageResponse'),
        },
      },
    },
    '400': {
      description: 'Invalid request body',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    '401': {
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    '403': {
      description: 'Not a member of the channel',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    '404': {
      description: 'Channel not found',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
  },
});

const createMessageHandler: RequestHandler<{ id: string }, {}, CreateMessageBody> = async (req: AuthRequest, res) => {
  try {
    // TODO: Implement message creation
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    console.error('Create message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /message/channel/:id - Get messages from a channel
registry.registerPath({
  method: 'get',
  path: '/message/channel/{id}',
  tags: ['messages'],
  summary: 'Get messages from a channel',
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
      name: 'before',
      in: 'query',
      required: false,
      schema: { type: 'string' },
      description: 'Get messages before this message id',
    },
    {
      name: 'limit',
      in: 'query',
      required: false,
      schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      description: 'Maximum number of messages to return',
    },
  ],
  responses: {
    '200': {
      description: 'Messages retrieved successfully',
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string(),
            content: z.string(),
            parent_id: z.string().optional(),
            user_id: z.string(),
            created_at: z.string(),
            updated_at: z.string(),
            reactions: z.array(z.object({
              emoji: z.string(),
              user_id: z.string(),
            })),
          })).openapi('GetMessagesResponse'),
        },
      },
    },
    '401': {
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    '403': {
      description: 'Not a member of the channel',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    '404': {
      description: 'Channel not found',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
  },
});

const getMessagesHandler: RequestHandler<{ id: string }> = async (req: AuthRequest, res) => {
  try {
    // TODO: Implement message retrieval
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    console.error('Get messages error:', error);
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
          schema: z.object({
            id: z.string(),
            content: z.string(),
            parent_id: z.string().optional(),
            user_id: z.string(),
            created_at: z.string(),
            updated_at: z.string(),
          }).openapi('UpdateMessageResponse'),
        },
      },
    },
    '400': {
      description: 'Invalid request body',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    '401': {
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    '403': {
      description: 'Not authorized to update message',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    '404': {
      description: 'Message not found',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
  },
});

const updateMessageHandler: RequestHandler<{ id: string }, {}, UpdateMessageBody> = async (req: AuthRequest, res) => {
  try {
    // TODO: Implement message update
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
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
          }),
        },
      },
    },
    '401': {
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    '403': {
      description: 'Not authorized to delete message',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    '404': {
      description: 'Message not found',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
  },
});

const deleteMessageHandler: RequestHandler<{ id: string }> = async (req: AuthRequest, res) => {
  try {
    // TODO: Implement message deletion
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
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
          schema: addReactionSchema,
        },
      },
    },
  },
  responses: {
    '200': {
      description: 'Reaction added successfully',
      content: {
        'application/json': {
          schema: z.object({
            message_id: z.string(),
            emoji: z.string(),
            user_id: z.string(),
          }).openapi('AddReactionResponse'),
        },
      },
    },
    '400': {
      description: 'Invalid request body',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    '401': {
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    '403': {
      description: 'Not a member of the channel',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    '404': {
      description: 'Message not found',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
  },
});

const addReactionHandler: RequestHandler<{ id: string }, {}, AddReactionBody> = async (req: AuthRequest, res) => {
  try {
    // TODO: Implement adding reaction
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

router.post('/channel/:id', authenticate, createMessageHandler);
router.get('/channel/:id', authenticate, getMessagesHandler);
router.put('/:id', authenticate, updateMessageHandler);
router.delete('/:id', authenticate, deleteMessageHandler);
router.post('/:id/reaction', authenticate, addReactionHandler);

export default router; 