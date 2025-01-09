import { z } from 'zod';

// Request schemas
export const createWorkspaceSchema = z.object({
    name: z.string().min(1).max(100),
});

export const inviteUserSchema = z.object({
    email: z.string().email(),
});

// Response schemas
export const WorkspaceSchema = z.object({
    id: z.string(),
    name: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const WorkspaceWithRoleSchema = z.object({
    id: z.string(),
    name: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    role: z.string(),
});

export const WorkspaceMembershipSchema = z.object({
    workspace_id: z.string(),
    user_id: z.string(),
    role: z.string(),
    joined_at: z.string(),
    updated_at: z.string(),
});

export const SuccessMessageSchema = z.object({
    message: z.string(),
});

export const ErrorResponseSchema = z.object({
    error: z.string(),
});

// Response schema aliases
export const CreateWorkspaceResponseSchema = WorkspaceSchema;
export const ListWorkspacesResponseSchema = z.array(WorkspaceWithRoleSchema);
export const InviteUserResponseSchema = SuccessMessageSchema;
export const AcceptInviteResponseSchema = z.object({
    message: z.string(),
    membership: WorkspaceMembershipSchema,
});
export const RemoveWorkspaceMemberResponseSchema = SuccessMessageSchema; 