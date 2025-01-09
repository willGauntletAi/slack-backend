import { Router } from 'express';
import { z } from 'zod';
import type { RequestHandler } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { registry } from '../../utils/openapi';
import { findUserById, updateUser, checkUsersShareWorkspace, getWorkspaceUsers, getChannelUsers } from '../../db/users';
import { isWorkspaceMember, getWorkspaceById } from '../../db/workspaces';
import { isChannelMember, getChannelById } from '../../db/channels';
import {
  updateProfileSchema,
  UserProfileResponseSchema,
  GetUserByIdResponseSchema,
  UpdateProfileResponseSchema,
  GetWorkspaceUsersResponseSchema,
  GetChannelUsersResponseSchema,
  ErrorResponseSchema,
  UpdateProfileRequest,
  UserProfileResponse,
  GetUserByIdResponse,
  UpdateProfileResponse,
  GetWorkspaceUsersResponse,
  GetChannelUsersResponse,
  ErrorResponse,
} from './types';

const router = Router();

type UpdateProfileBody = UpdateProfileRequest;

// GET /users/me - Get current user's profile
registry.registerPath({
  method: 'get',
  path: '/users/me',
  tags: ['users'],
  summary: "Get current user's profile",
  security: [{ bearerAuth: [] }],
  responses: {
    '200': {
      description: 'User profile retrieved successfully',
      content: {
        'application/json': {
          schema: UserProfileResponseSchema.openapi('UserProfileResponse'),
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
    '500': {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const getMeHandler: RequestHandler<{}, UserProfileResponse | ErrorResponse> = async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = await findUserById(req.user.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Don't send password hash in response and format dates as ISO strings
    const { password_hash, deleted_at, ...userWithoutSensitiveData } = user;
    const response: UserProfileResponse = {
      ...userWithoutSensitiveData,
      created_at: userWithoutSensitiveData.created_at.toISOString(),
      updated_at: userWithoutSensitiveData.updated_at.toISOString(),
    };
    res.json(response);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /user/:id - Get user by ID
registry.registerPath({
  method: 'get',
  path: '/user/{id}',
  tags: ['users'],
  summary: "Get user by ID",
  description: "Get a user's profile. The requesting user must share at least one workspace with the target user.",
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'User ID',
    },
  ],
  responses: {
    '200': {
      description: 'User profile retrieved successfully',
      content: {
        'application/json': {
          schema: GetUserByIdResponseSchema.openapi('GetUserByIdResponse'),
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
      description: 'Users do not share a workspace',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '404': {
      description: 'User not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '500': {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const getUserByIdHandler: RequestHandler<{ id: string }, GetUserByIdResponse | ErrorResponse> = async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const targetUser = await findUserById(req.params.id);
    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if users share a workspace
    const shareWorkspace = await checkUsersShareWorkspace(req.user.id, req.params.id);
    if (!shareWorkspace) {
      res.status(403).json({ error: 'You must share a workspace with this user to view their profile' });
      return;
    }

    // Don't send password hash in response and format dates as ISO strings
    const { password_hash, deleted_at, ...userWithoutSensitiveData } = targetUser;
    const response: GetUserByIdResponse = {
      ...userWithoutSensitiveData,
      created_at: userWithoutSensitiveData.created_at.toISOString(),
      updated_at: userWithoutSensitiveData.updated_at.toISOString(),
    };
    res.json(response);
  } catch (error) {
    console.error('Get user by id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /users/me - Update current user's profile
registry.registerPath({
  method: 'put',
  path: '/users/me',
  tags: ['users'],
  summary: "Update current user's profile",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: updateProfileSchema,
        },
      },
    },
  },
  responses: {
    '200': {
      description: 'Profile updated successfully',
      content: {
        'application/json': {
          schema: UpdateProfileResponseSchema.openapi('UpdateProfileResponse'),
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
    '500': {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const updateProfileHandler: RequestHandler<{}, UpdateProfileResponse | ErrorResponse, UpdateProfileBody> = async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const updateData = updateProfileSchema.parse(req.body);

    const updatedUser = await updateUser(req.user.id, updateData);
    if (!updatedUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Don't send password hash in response and format dates as ISO strings
    const { password_hash, deleted_at, ...userWithoutSensitiveData } = updatedUser;
    const response: UpdateProfileResponse = {
      ...userWithoutSensitiveData,
      created_at: userWithoutSensitiveData.created_at.toISOString(),
      updated_at: userWithoutSensitiveData.updated_at.toISOString(),
    };
    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
      return;
    }
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /user/workspace/:id - Get users in a workspace
registry.registerPath({
  method: 'get',
  path: '/user/workspace/{id}',
  tags: ['users'],
  summary: 'Get users in a workspace',
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
      description: 'Search term to filter users by username or email',
    },
  ],
  responses: {
    '200': {
      description: 'List of workspace users retrieved successfully',
      content: {
        'application/json': {
          schema: GetWorkspaceUsersResponseSchema.openapi('GetWorkspaceUsersResponse'),
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

const getWorkspaceUsersHandler: RequestHandler<{ id: string }, GetWorkspaceUsersResponse | ErrorResponse> = async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Check if user is a member of the workspace
    const isMember = await isWorkspaceMember(req.params.id, req.user.id);
    if (!isMember) {
      res.status(403).json({ error: 'Not a member of this workspace' });
      return;
    }

    // Get workspace to check if it exists
    const workspace = await getWorkspaceById(req.params.id);
    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    const users = await getWorkspaceUsers(req.params.id, req.query.search as string | undefined);
    const response: GetWorkspaceUsersResponse = users.map(user => ({
      ...user,
      joined_at: user.joined_at.toISOString(),
    }));
    res.json(response);
  } catch (error) {
    console.error('Get workspace users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /user/channel/:id - Get users in a channel
registry.registerPath({
  method: 'get',
  path: '/user/channel/{id}',
  tags: ['users'],
  summary: 'Get users in a channel',
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
      name: 'search',
      in: 'query',
      required: false,
      schema: { type: 'string' },
      description: 'Search term to filter users by username or email',
    },
  ],
  responses: {
    '200': {
      description: 'List of channel users retrieved successfully',
      content: {
        'application/json': {
          schema: GetChannelUsersResponseSchema.openapi('GetChannelUsersResponse'),
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

const getChannelUsersHandler: RequestHandler<{ id: string }, GetChannelUsersResponse | ErrorResponse> = async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Check if user is a member of the channel
    const isMember = await isChannelMember(req.params.id, req.user.id);
    if (!isMember) {
      res.status(403).json({ error: 'Not a member of this channel' });
      return;
    }

    // Get channel to check if it exists
    const channel = await getChannelById(req.params.id);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    const users = await getChannelUsers(req.params.id, req.query.search as string | undefined);
    const response: GetChannelUsersResponse = users.map(user => ({
      ...user,
      joined_at: user.joined_at.toISOString(),
    }));
    res.json(response);
  } catch (error) {
    console.error('Get channel users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

router.get('/me', authenticate, getMeHandler);
router.get('/workspace/:id', authenticate, getWorkspaceUsersHandler);
router.get('/channel/:id', authenticate, getChannelUsersHandler);
router.get('/:id', authenticate, getUserByIdHandler);
router.put('/me', authenticate, updateProfileHandler);

export default router; 