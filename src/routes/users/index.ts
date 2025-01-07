import { Router } from 'express';
import { z } from 'zod';
import type { RequestHandler } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { registry } from '../../utils/openapi';
import { findUserById, updateUser, checkUsersShareWorkspace } from '../../db/users';

const router = Router();

// Schema for updating user profile
const updateProfileSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  email: z.string().email().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided"
});

type UpdateProfileBody = z.infer<typeof updateProfileSchema>;

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
          schema: z.object({
            id: z.string(),
            username: z.string(),
            email: z.string(),
            created_at: z.string(),
            updated_at: z.string(),
          }).openapi('UserProfileResponse'),
        },
      },
    },
    '401': {
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }).openapi('UserProfileErrorResponse'),
        },
      },
    },
    '500': {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }).openapi('UserProfileInternalServerErrorResponse'),
        },
      },
    },
  },
});

const getMeHandler: RequestHandler = async (req: AuthRequest, res) => {
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

    // Don't send password hash in response
    const { password_hash, deleted_at, ...userWithoutSensitiveData } = user;
    res.json(userWithoutSensitiveData);
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
          schema: z.object({
            id: z.string(),
            username: z.string(),
            email: z.string(),
            created_at: z.string(),
            updated_at: z.string(),
          }).openapi('GetUserByIdResponse'),
        },
      },
    },
    '401': {
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }).openapi('GetUserByIdErrorResponse'),
        },
      },
    },
    '403': {
      description: 'Users do not share a workspace',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }).openapi('GetUserByIdForbiddenResponse'),
        },
      },
    },
    '404': {
      description: 'User not found',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }).openapi('GetUserByIdNotFoundResponse'),
        },
      },
    },
    '500': {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }).openapi('GetUserByIdInternalServerErrorResponse'),
        },
      },
    },
  },
});

const getUserByIdHandler: RequestHandler<{ id: string }> = async (req: AuthRequest, res) => {
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

    // Don't send password hash in response
    const { password_hash, deleted_at, ...userWithoutSensitiveData } = targetUser;
    res.json(userWithoutSensitiveData);
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
          schema: z.object({
            id: z.string(),
            username: z.string(),
            email: z.string(),
            created_at: z.string(),
            updated_at: z.string(),
          }).openapi('UpdateProfileResponse'),
        },
      },
    },
    '400': {
      description: 'Invalid request body',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }).openapi('UpdateProfileBadRequestResponse'),
        },
      },
    },
    '401': {
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }).openapi('UpdateProfileUnauthorizedResponse'),
        },
      },
    },
    '500': {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }).openapi('UpdateProfileInternalServerErrorResponse'),
        },
      },
    },
  },
});

const updateProfileHandler: RequestHandler<{}, {}, UpdateProfileBody> = async (req: AuthRequest, res) => {
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

    // Don't send password hash in response
    const { password_hash, deleted_at, ...userWithoutSensitiveData } = updatedUser;
    res.json(userWithoutSensitiveData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
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
  ],
  responses: {
    '200': {
      description: 'List of workspace users retrieved successfully',
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string(),
            username: z.string(),
            email: z.string(),
            joined_at: z.string(),
          })).openapi('GetWorkspaceUsersResponse'),
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
      description: 'Workspace not found',
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

const getWorkspaceUsersHandler: RequestHandler<{ id: string }> = async (req: AuthRequest, res) => {
  try {
    // TODO: Implement workspace users listing
    res.status(501).json({ error: 'Not implemented' });
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
  ],
  responses: {
    '200': {
      description: 'List of channel users retrieved successfully',
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string(),
            username: z.string(),
            email: z.string(),
            joined_at: z.string(),
          })).openapi('GetChannelUsersResponse'),
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

const getChannelUsersHandler: RequestHandler<{ id: string }> = async (req: AuthRequest, res) => {
  try {
    // TODO: Implement channel users listing
    res.status(501).json({ error: 'Not implemented' });
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