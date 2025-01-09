import { Router } from 'express';
import { z } from 'zod';
import type { RequestHandler } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { registry } from '../../utils/openapi';
import { createWorkspace, listWorkspacesForUser, getWorkspaceById, isWorkspaceMember, inviteUserByEmail, acceptWorkspaceInvite, removeWorkspaceMember } from '../../db/workspaces';
import { findUserById } from '../../db/users';
import {
  createWorkspaceSchema,
  inviteUserSchema,
  CreateWorkspaceResponseSchema,
  ListWorkspacesResponseSchema,
  InviteUserResponseSchema,
  AcceptInviteResponseSchema,
  RemoveWorkspaceMemberResponseSchema,
  ErrorResponseSchema,
  CreateWorkspaceRequest,
  InviteUserRequest,
  CreateWorkspaceResponse,
  ListWorkspacesResponse,
  InviteUserResponse,
  AcceptInviteResponse,
  RemoveWorkspaceMemberResponse,
  ErrorResponse,
} from './types';

const router = Router();

type CreateWorkspaceBody = CreateWorkspaceRequest;
type InviteUserBody = InviteUserRequest;

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
          schema: CreateWorkspaceResponseSchema.openapi('CreateWorkspaceResponse'),
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
  },
});

const createWorkspaceHandler: RequestHandler<{}, CreateWorkspaceResponse | ErrorResponse, CreateWorkspaceBody> = async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const data = createWorkspaceSchema.parse(req.body);
    const workspace = await createWorkspace(req.user.id, data);
    const response: CreateWorkspaceResponse = {
      id: workspace.id,
      name: workspace.name,
      created_at: workspace.created_at.toISOString(),
      updated_at: workspace.updated_at.toISOString(),
    };
    res.status(201).json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
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
          schema: ListWorkspacesResponseSchema.openapi('ListWorkspacesResponse'),
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

const listWorkspacesHandler: RequestHandler<{}, ListWorkspacesResponse | ErrorResponse> = async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const workspaces = await listWorkspacesForUser(req.user.id);
    const response: ListWorkspacesResponse = workspaces.map(workspace => ({
      id: workspace.id,
      name: workspace.name,
      created_at: workspace.created_at.toISOString(),
      updated_at: workspace.updated_at.toISOString(),
      role: workspace.role,
    }));
    res.json(response);
  } catch (error) {
    console.error('List workspaces error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /workspace/:id/invite - Invite a user to a workspace by email
registry.registerPath({
  method: 'post',
  path: '/workspace/{id}/invite',
  tags: ['workspaces'],
  summary: 'Invite a user to a workspace by email',
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
          schema: inviteUserSchema,
        },
      },
    },
  },
  responses: {
    '200': {
      description: 'User invited successfully',
      content: {
        'application/json': {
          schema: InviteUserResponseSchema.openapi('InviteUserResponse'),
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
      description: 'Not authorized to invite members',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '404': {
      description: 'User or workspace not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const inviteUserHandler: RequestHandler<{ id: string }, InviteUserResponse | ErrorResponse, InviteUserBody> = async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { email } = inviteUserSchema.parse(req.body);
    await inviteUserByEmail(req.params.id, email, req.user.id);
    const response: InviteUserResponse = { message: 'User invited successfully' };
    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
      return;
    }
    if (error instanceof Error) {
      if (error.message === 'Not authorized to invite members') {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error.message === 'User not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.message === 'User is already a member of this workspace') {
        res.status(400).json({ error: error.message });
        return;
      }
    }
    console.error('Invite user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /workspace/:id/accept - Accept a workspace invitation
registry.registerPath({
  method: 'post',
  path: '/workspace/{id}/accept',
  tags: ['workspaces'],
  summary: 'Accept an invitation to join a workspace',
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
      description: 'Invitation accepted successfully',
      content: {
        'application/json': {
          schema: AcceptInviteResponseSchema.openapi('AcceptInviteResponse'),
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
    '404': {
      description: 'No invitation found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '400': {
      description: 'Already a member or other error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const acceptInviteHandler: RequestHandler<{ id: string }, AcceptInviteResponse | ErrorResponse> = async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id: workspaceId } = req.params;

    // Check if workspace exists
    const workspace = await getWorkspaceById(workspaceId);
    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    const membership = await acceptWorkspaceInvite(workspaceId, req.user.id);
    if (!membership) {
      res.status(404).json({ error: 'No invitation found' });
      return;
    }

    const response: AcceptInviteResponse = {
      message: 'Invitation accepted successfully',
      membership: {
        workspace_id: membership.workspace_id,
        user_id: membership.user_id,
        role: membership.role,
        joined_at: membership.joined_at.toISOString(),
        updated_at: membership.updated_at.toISOString(),
      },
    };
    res.json(response);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'No invitation found') {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.message === 'User is already a member of this workspace') {
        res.status(400).json({ error: error.message });
        return;
      }
    }
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /workspace/:id/member/:userId - Remove a member from a workspace
registry.registerPath({
  method: 'delete',
  path: '/workspace/{id}/member/{userId}',
  tags: ['workspaces'],
  summary: 'Remove a member from a workspace',
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
      description: 'ID of the user to remove',
    },
  ],
  responses: {
    '200': {
      description: 'Member removed successfully',
      content: {
        'application/json': {
          schema: RemoveWorkspaceMemberResponseSchema.openapi('RemoveWorkspaceMemberResponse'),
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
      description: 'Not authorized to remove members or cannot remove last admin',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    '404': {
      description: 'Workspace or user not found, or user is not a member',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const removeWorkspaceMemberHandler: RequestHandler<{ id: string; userId: string }, RemoveWorkspaceMemberResponse | ErrorResponse> = async (req: AuthRequest, res) => {
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

    await removeWorkspaceMember(workspaceId, userId, req.user.id);
    const response: RemoveWorkspaceMemberResponse = { message: 'Member removed successfully' };
    res.json(response);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Not authorized to remove members') {
        res.status(403).json({ error: error.message });
        return;
      }
      if (error.message === 'User is not a member of this workspace') {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.message === 'Cannot remove the last admin from the workspace') {
        res.status(403).json({ error: error.message });
        return;
      }
    }
    console.error('Remove workspace member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

router.post('/', authenticate, createWorkspaceHandler);
router.get('/', authenticate, listWorkspacesHandler);
router.post('/:id/invite', authenticate, inviteUserHandler);
router.post('/:id/accept', authenticate, acceptInviteHandler);
router.delete('/:id/member/:userId', authenticate, removeWorkspaceMemberHandler);

export default router; 