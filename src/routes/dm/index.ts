import { Router } from 'express';
import { z } from 'zod';
import type { RequestHandler } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { registry } from '../../utils/openapi';
import { createDMChannel, createDMMessage, listDMMessages, updateDMMessage, deleteDMMessage, listDMChannels } from '../../db/dm';

const router = Router();

// Schema for creating a DM channel
const createDMChannelSchema = z.object({
  user_ids: z.array(z.string()).min(1),
});

type CreateDMChannelBody = z.infer<typeof createDMChannelSchema>;

// Schema for sending a DM
const sendDMSchema = z.object({
  content: z.string().min(1),
  parent_id: z.string().nullable(),
});

type SendDMBody = z.infer<typeof sendDMSchema>;

// Schema for updating a DM
const updateDMSchema = z.object({
  content: z.string().min(1),
});

type UpdateDMBody = z.infer<typeof updateDMSchema>;

// POST /dm/workspace/:workspaceId - Create a direct message channel
registry.registerPath({
  method: 'post',
  path: '/dm/workspace/{workspaceId}',
  tags: ['direct-messages'],
  summary: 'Create a direct message channel in a workspace',
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'workspaceId',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'Workspace ID',
    },
  ],
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
            workspace_id: z.string(),
            created_at: z.string(),
            updated_at: z.string(),
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
    '403': {
      description: 'Not a member of the workspace',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    '404': {
      description: 'Workspace not found or one or more users not found',
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

const createDMChannelHandler: RequestHandler<{ workspaceId: string }, {}, CreateDMChannelBody> = async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const channel = await createDMChannel(req.params.workspaceId, req.user.id, req.body.user_ids);
    res.status(201).json({ ...channel, usernames: channel.usernames.map(u => u.username) });
  } catch (error) {
    console.error('Create DM channel error:', error);
    if (error instanceof Error) {
      if (error.message.includes('Not a member of this workspace')) {
        res.status(403).json({ error: error.message });
      } else if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

// GET /dm/workspace/:workspaceId - List DM channels in a workspace
registry.registerPath({
  method: 'get',
  path: '/dm/workspace/{workspaceId}',
  tags: ['direct-messages'],
  summary: 'List DM channels in a workspace',
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'workspaceId',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'Workspace ID',
    },
    {
      name: 'search',
      in: 'query',
      required: false,
      schema: { type: 'string' },
      description: 'Search term to filter DM channels',
    },
  ],
  responses: {
    '200': {
      description: 'List of DM channels retrieved successfully',
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string(),
            workspace_id: z.string(),
            created_at: z.string(),
            updated_at: z.string(),
            usernames: z.array(z.string()),
            last_message_at: z.string().nullable(),
          })).openapi('ListDMChannelsResponse'),
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
      description: 'Not a member of the workspace',
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

const listDMChannelsHandler: RequestHandler<{ workspaceId: string }, {}, {}, { search?: string }> = async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const channels = await listDMChannels(req.params.workspaceId, req.user.id, search);
    res.json(channels.map(c => ({ ...c, usernames: c.usernames.map(u => u.username) })));
  } catch (error) {
    console.error('List DM channels error:', error);
    if (error instanceof Error) {
      if (error.message === 'Not a member of this workspace') {
        res.status(403).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

// POST /dm/:channelId/messages - Send a DM
registry.registerPath({
  method: 'post',
  path: '/dm/{channelId}/messages',
  tags: ['direct-messages'],
  summary: 'Send a direct message',
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'channelId',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'DM Channel ID',
    },
  ],
  request: {
    body: {
      content: {
        'application/json': {
          schema: sendDMSchema,
        },
      },
    },
  },
  responses: {
    '201': {
      description: 'Message sent successfully',
      content: {
        'application/json': {
          schema: z.object({
            id: z.string(),
            content: z.string(),
            user_id: z.string(),
            created_at: z.string(),
            updated_at: z.string(),
            username: z.string(),
          }).openapi('SendDMResponse'),
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
      description: 'Not a participant in the DM channel',
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

const sendDMHandler: RequestHandler<{ channelId: string }, {}, SendDMBody> = async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const message = await createDMMessage(req.params.channelId, req.user.id, req.body);
    res.status(201).json(message);
  } catch (error) {
    console.error('Send DM error:', error);
    if (error instanceof Error) {
      if (error.message === 'Not a participant in this DM channel') {
        res.status(403).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
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
      description: 'Get messages before this message ID',
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
            username: z.string(),
            parent_id: z.string().nullable(),
            channel_id: z.string(),
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
  },
});

const getDMMessagesHandler: RequestHandler<
  { channelId: string },
  {},
  {},
  { before?: string; limit?: string }
> = async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Parse and validate limit
    let limit = 50;
    if (req.query.limit) {
      const parsedLimit = parseInt(req.query.limit as string, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100) {
        limit = parsedLimit;
      }
    }

    // Parse and validate before
    let before: string | undefined;
    if (req.query.before && typeof req.query.before === 'string') {
      before = req.query.before;
    }

    const messages = await listDMMessages(req.params.channelId, req.user.id, limit, before);
    res.json(messages);
  } catch (error) {
    console.error('Get DM messages error:', error);
    if (error instanceof Error) {
      if (error.message === 'Not a participant in this DM channel') {
        res.status(403).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
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
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const message = await updateDMMessage(req.params.messageId, req.user.id, req.body);
    res.json(message);
  } catch (error) {
    console.error('Update DM error:', error);
    if (error instanceof Error) {
      if (error.message === 'Not authorized to update this message') {
        res.status(403).json({ error: error.message });
      } else if (error.message === 'Message not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

// DELETE /dm/:messageId - Delete a DM
registry.registerPath({
  method: 'delete',
  path: '/dm/{messageId}',
  tags: ['direct-messages'],
  summary: 'Delete a direct message',
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
  responses: {
    '200': {
      description: 'Message deleted successfully',
      content: {
        'application/json': {
          schema: z.object({
            id: z.string(),
            deleted_at: z.string(),
          }).openapi('DeleteDMResponse'),
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

const deleteDMHandler: RequestHandler<{ messageId: string }> = async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const message = await deleteDMMessage(req.params.messageId, req.user.id);
    res.json({
      id: message?.id,
      deleted_at: message?.deleted_at,
    });
  } catch (error) {
    console.error('Delete DM error:', error);
    if (error instanceof Error) {
      if (error.message === 'Not authorized to delete this message') {
        res.status(403).json({ error: error.message });
      } else if (error.message === 'Message not found') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

// Register routes
router.use(authenticate);
router.post('/workspace/:workspaceId', createDMChannelHandler);
router.get('/workspace/:workspaceId', listDMChannelsHandler);
router.post('/:channelId/messages', sendDMHandler);
router.get('/:channelId/messages', getDMMessagesHandler);
router.put('/messages/:messageId', updateDMHandler);
router.delete('/messages/:messageId', deleteDMHandler);

export default router; 