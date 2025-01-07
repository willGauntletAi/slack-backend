import { Router } from 'express';
import { z } from 'zod';
import type { RequestHandler } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { registry } from '../../utils/openapi';

const router = Router();

// Schema for creating a DM channel
const createDMChannelSchema = z.object({
  user_id: z.string(),
});

type CreateDMChannelBody = z.infer<typeof createDMChannelSchema>;

// Schema for sending a DM
const sendDMSchema = z.object({
  content: z.string().min(1),
});

type SendDMBody = z.infer<typeof sendDMSchema>;

// Schema for updating a DM
const updateDMSchema = z.object({
  content: z.string().min(1),
});

type UpdateDMBody = z.infer<typeof updateDMSchema>;

// POST /dm - Create a direct message channel
registry.registerPath({
  method: 'post',
  path: '/dm',
  tags: ['direct-messages'],
  summary: 'Create a direct message channel',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: createDMChannelSchema,
        },
      },
    },
  },
  responses: {
    '201': {
      description: 'DM channel created successfully',
      content: {
        'application/json': {
          schema: z.object({
            id: z.string(),
            user1_id: z.string(),
            user2_id: z.string(),
            created_at: z.string(),
          }).openapi('CreateDMChannelResponse'),
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
    '404': {
      description: 'User not found',
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

const createDMChannelHandler: RequestHandler<{}, {}, CreateDMChannelBody> = async (req: AuthRequest, res) => {
  try {
    // TODO: Implement DM channel creation
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    console.error('Create DM channel error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /dm/:channelId/messages - Get messages from a DM channel
registry.registerPath({
  method: 'get',
  path: '/dm/{channelId}/messages',
  tags: ['direct-messages'],
  summary: 'Get messages from a DM channel',
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'channelId',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'DM Channel ID',
    },
    {
      name: 'before',
      in: 'query',
      required: false,
      schema: { type: 'string' },
      description: 'Get messages before this timestamp',
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
            user_id: z.string(),
            created_at: z.string(),
            updated_at: z.string(),
          })).openapi('GetDMMessagesResponse'),
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
      description: 'Not a participant in the DM channel',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    '404': {
      description: 'DM channel not found',
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

const getDMMessagesHandler: RequestHandler<{ channelId: string }> = async (req: AuthRequest, res) => {
  try {
    // TODO: Implement DM message retrieval
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    console.error('Get DM messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /dm/:messageId - Update a DM
registry.registerPath({
  method: 'put',
  path: '/dm/{messageId}',
  tags: ['direct-messages'],
  summary: 'Update a direct message',
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'messageId',
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
          schema: updateDMSchema,
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
            user_id: z.string(),
            created_at: z.string(),
            updated_at: z.string(),
          }).openapi('UpdateDMResponse'),
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

const updateDMHandler: RequestHandler<{ messageId: string }, {}, UpdateDMBody> = async (req: AuthRequest, res) => {
  try {
    // TODO: Implement DM update
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    console.error('Update DM error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

router.post('/', authenticate, createDMChannelHandler);
router.get('/:channelId/messages', authenticate, getDMMessagesHandler);
router.put('/:messageId', authenticate, updateDMHandler);

export default router; 