import { Router } from 'express';
import { z } from 'zod';
import type { RequestHandler } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { registry } from '../../utils/openapi';
import { createChannel, listChannelsInWorkspace, updateChannel, addChannelMember, removeChannelMember, getChannelById, listUserChannels } from '../../db/channels';
import { findUserById } from '../../db/users';
import {
  createChannelSchema,
  updateChannelSchema,
  CreateChannelResponseSchema,
  ListChannelsResponseSchema,
  ListUserChannelsResponseSchema,
  UpdateChannelResponseSchema,
  SuccessMessageSchema,
  ErrorResponseSchema,
} from './types';

const router = Router();

type CreateChannelBody = z.infer<typeof createChannelSchema>;
type UpdateChannelBody = z.infer<typeof updateChannelSchema>;

// POST /channel/workspace/:id - Create a channel in a workspace
registry.registerPath({
  method: 'post',
  path: '/channel/workspace/{id}',
  tags: ['channels'],
  summary: 'Create a new channel in a workspace',
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'id',
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
          schema: createChannelSchema,
        },
      },
    },
  },
  responses: {
    '201': {
      description: 'Channel created successfully',
      content: {
        'application/json': {
          schema: CreateChannelResponseSchema.openapi('CreateChannelResponse'),
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
      description: 'Not a member of the workspace',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '404': {
      description: 'Workspace not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const createChannelHandler: RequestHandler<{ id: string }, {}, CreateChannelBody> = async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const data = createChannelSchema.parse(req.body);
    const channel = await createChannel(req.params.id, req.user.id, data);
    res.status(201).json(channel);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    if (error instanceof Error && error.message === 'Not a member of the workspace') {
      res.status(403).json({ error: error.message });
      return;
    }
    console.error('Create channel error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /channel/workspace/:id - List channels in a workspace
registry.registerPath({
  method: 'get',
  path: '/channel/workspace/{id}',
  tags: ['channels'],
  summary: 'List channels in a workspace',
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'id',
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
      description: 'Search term to filter channels by name (case-insensitive)',
    },
    {
      name: 'exclude_mine',
      in: 'query',
      required: false,
      schema: { type: 'boolean' },
      description: 'If true, only returns channels the user is not a member of',
    },
  ],
  responses: {
    '200': {
      description: 'List of channels retrieved successfully',
      content: {
        'application/json': {
          schema: ListChannelsResponseSchema.openapi('ListChannelsResponse'),
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
      description: 'Not a member of the workspace',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '404': {
      description: 'Workspace not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const listChannelsHandler: RequestHandler<{ id: string }> = async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Validate search parameter
    const searchParam = req.query.search;
    const search = typeof searchParam === 'string' ? searchParam : undefined;

    // Validate exclude_mine parameter
    const excludeMineParam = req.query.exclude_mine;
    const excludeMine = excludeMineParam === 'true';

    const channels = await listChannelsInWorkspace(req.params.id, req.user.id, search, excludeMine);
    res.json(channels.map(channel => ({
      ...channel,
      usernames: channel.members.map(member => member.username),
    })));
  } catch (error) {
    if (error instanceof Error && error.message === 'Not a member of the workspace') {
      res.status(403).json({ error: error.message });
      return;
    }
    console.error('List channels error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /channel/me - List all channels the user is a member of
registry.registerPath({
  method: 'get',
  path: '/channel/me',
  tags: ['channels'],
  summary: 'List all channels the user is a member of',
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'workspace_id',
      in: 'query',
      required: false,
      schema: { type: 'string' },
      description: 'Optional workspace ID to filter channels',
    },
  ],
  responses: {
    '200': {
      description: 'List of channels retrieved successfully',
      content: {
        'application/json': {
          schema: ListUserChannelsResponseSchema.openapi('ListUserChannelsResponse'),
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
  },
});

const listUserChannelsHandler: RequestHandler = async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get workspace_id from query params if it exists
    const workspaceId = typeof req.query.workspace_id === 'string' ? req.query.workspace_id : undefined;

    const channels = await listUserChannels(req.user.id, workspaceId);
    const result = channels.map(({ members, ...channel }) => ({
      ...channel,
      usernames: members.map(member =>
        member.username,
      ),
    }))
    res.json(result);
  } catch (error) {
    console.error('List user channels error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /channel/:id - Update a channel
registry.registerPath({
  method: 'put',
  path: '/channel/{id}',
  tags: ['channels'],
  summary: 'Update a channel',
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
          schema: updateChannelSchema,
        },
      },
    },
  },
  responses: {
    '200': {
      description: 'Channel updated successfully',
      content: {
        'application/json': {
          schema: UpdateChannelResponseSchema.openapi('UpdateChannelResponse'),
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
      description: 'Channel not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const updateChannelHandler: RequestHandler<{ id: string }, {}, UpdateChannelBody> = async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const data = updateChannelSchema.parse(req.body);
    const channel = await updateChannel(req.params.id, req.user.id, data);
    res.json(channel);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    if (error instanceof Error && error.message === 'Not a member of the channel') {
      res.status(403).json({ error: error.message });
      return;
    }
    console.error('Update channel error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /channel/:id/member/:userId - Add member to channel
registry.registerPath({
  method: 'post',
  path: '/channel/{id}/member/{userId}',
  tags: ['channels'],
  summary: 'Add a member to a channel',
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
      name: 'userId',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'User ID to add to the channel',
    },
  ],
  responses: {
    '200': {
      description: 'Member added successfully',
      content: {
        'application/json': {
          schema: SuccessMessageSchema,
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
      description: 'Not authorized to add members',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '404': {
      description: 'Channel or user not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const addChannelMemberHandler: RequestHandler<{ id: string; userId: string }> = async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id: channelId, userId } = req.params;

    // Check if channel exists
    const channel = await getChannelById(channelId);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    // Check if user exists
    const user = await findUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await addChannelMember(channelId, userId, req.user.id);
    res.json({ message: 'Member added successfully' });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'Not authorized to add members':
          res.status(403).json({ error: error.message });
          return;
        case 'User is already a member of this channel':
          res.status(400).json({ error: error.message });
          return;
        case 'Both users must be members of the workspace for private channels':
          res.status(403).json({ error: error.message });
          return;
      }
    }
    console.error('Add channel member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /channel/:id/member/:userId - Remove member from channel
registry.registerPath({
  method: 'delete',
  path: '/channel/{id}/member/{userId}',
  tags: ['channels'],
  summary: 'Remove a member from a channel',
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
      name: 'userId',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'User ID to remove from the channel',
    },
  ],
  responses: {
    '200': {
      description: 'Member removed successfully',
      content: {
        'application/json': {
          schema: SuccessMessageSchema,
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
      description: 'Not authorized to remove members',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '404': {
      description: 'Channel or user not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const removeChannelMemberHandler: RequestHandler<{ id: string; userId: string }> = async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id: channelId, userId } = req.params;

    // Check if channel exists
    const channel = await getChannelById(channelId);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    // Check if user exists
    const user = await findUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await removeChannelMember(channelId, userId, req.user.id);
    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'Not authorized to remove members':
          res.status(403).json({ error: error.message });
          return;
        case 'User is not a member of this channel':
          res.status(400).json({ error: error.message });
          return;
      }
    }
    console.error('Remove channel member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

router.get('/me', authenticate, listUserChannelsHandler);
router.post('/workspace/:id', authenticate, createChannelHandler);
router.get('/workspace/:id', authenticate, listChannelsHandler);
router.put('/:id', authenticate, updateChannelHandler);
router.post('/:id/member/:userId', authenticate, addChannelMemberHandler);
router.delete('/:id/member/:userId', authenticate, removeChannelMemberHandler);

export default router; 