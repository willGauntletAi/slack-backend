import { Router } from 'express';
import { z } from 'zod';
import type { RequestHandler } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { registry } from '../../utils/openapi';

const router = Router();

// Schema for creating a workspace
const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

type CreateWorkspaceBody = z.infer<typeof createWorkspaceSchema>;

// POST /workspace - Create a new workspace
registry.registerPath({
  method: 'post',
  path: '/workspace',
  tags: ['workspaces'],
  summary: 'Create a new workspace',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: createWorkspaceSchema,
        },
      },
    },
  },
  responses: {
    '201': {
      description: 'Workspace created successfully',
      content: {
        'application/json': {
          schema: z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().optional(),
            created_at: z.string(),
            updated_at: z.string(),
          }).openapi('CreateWorkspaceResponse'),
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
  },
});

const createWorkspaceHandler: RequestHandler<{}, {}, CreateWorkspaceBody> = async (req: AuthRequest, res) => {
  try {
    // TODO: Implement workspace creation
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    console.error('Create workspace error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /workspace - List workspaces
registry.registerPath({
  method: 'get',
  path: '/workspace',
  tags: ['workspaces'],
  summary: 'List workspaces for the current user',
  security: [{ bearerAuth: [] }],
  responses: {
    '200': {
      description: 'List of workspaces retrieved successfully',
      content: {
        'application/json': {
          schema: z.array(z.object({
            id: z.string(),
            name: z.string(),
            description: z.string().optional(),
            created_at: z.string(),
            updated_at: z.string(),
          })).openapi('ListWorkspacesResponse'),
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
  },
});

const listWorkspacesHandler: RequestHandler = async (req: AuthRequest, res) => {
  try {
    // TODO: Implement workspace listing
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    console.error('List workspaces error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /workspace/:id/member/:userId - Add member to workspace
registry.registerPath({
  method: 'post',
  path: '/workspace/{id}/member/{userId}',
  tags: ['workspaces'],
  summary: 'Add a member to a workspace',
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
      name: 'userId',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'User ID to add to the workspace',
    },
  ],
  responses: {
    '200': {
      description: 'Member added successfully',
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
      description: 'Not authorized to add members',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    '404': {
      description: 'Workspace or user not found',
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

const addWorkspaceMemberHandler: RequestHandler<{ id: string; userId: string }> = async (req: AuthRequest, res) => {
  try {
    // TODO: Implement adding workspace member
    res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    console.error('Add workspace member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

router.post('/', authenticate, createWorkspaceHandler);
router.get('/', authenticate, listWorkspacesHandler);
router.post('/:id/member/:userId', authenticate, addWorkspaceMemberHandler);

export default router; 