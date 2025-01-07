import { Router } from 'express';
import { z } from 'zod';
import type { RequestHandler } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { registry } from '../../utils/openapi';
import { createWorkspace, listWorkspacesForUser, addWorkspaceMember, getWorkspaceById, isWorkspaceMember } from '../../db/workspaces';
import { findUserById } from '../../db/users';

const router = Router();

// Schema for creating a workspace
const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
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
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const data = createWorkspaceSchema.parse(req.body);
    const workspace = await createWorkspace(req.user.id, data);
    res.status(201).json(workspace);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
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
            created_at: z.string(),
            updated_at: z.string(),
            role: z.string(),
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
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const workspaces = await listWorkspacesForUser(req.user.id);
    res.json(workspaces);
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
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id: workspaceId, userId } = req.params;

    // Check if workspace exists
    const workspace = await getWorkspaceById(workspaceId);
    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    // Check if user exists
    const user = await findUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await addWorkspaceMember(workspaceId, userId, req.user.id);
    res.json({ message: 'Member added successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Not authorized to add members') {
      res.status(403).json({ error: error.message });
      return;
    }
    if (error instanceof Error && error.message === 'User is already a member of this workspace') {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error('Add workspace member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

router.post('/', authenticate, createWorkspaceHandler);
router.get('/', authenticate, listWorkspacesHandler);
router.post('/:id/member/:userId', authenticate, addWorkspaceMemberHandler);

export default router; 