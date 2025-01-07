import { db } from './index';
import { z } from 'zod';

// Schema for creating a workspace
export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
});

export type CreateWorkspaceData = z.infer<typeof createWorkspaceSchema>;

// Create a new workspace and add the creator as a member
export async function createWorkspace(userId: string, data: CreateWorkspaceData) {
  const now = new Date().toISOString();

  // Use a transaction to create the workspace and add the creator as a member
  return await db.transaction().execute(async (trx) => {
    // Create the workspace
    const workspace = await trx
      .insertInto('workspaces')
      .values({
        name: data.name,
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Add the creator as a member with admin role
    await trx
      .insertInto('workspace_members')
      .values({
        workspace_id: workspace.id,
        user_id: userId,
        role: 'admin',
        joined_at: now,
      })
      .execute();

    return workspace;
  });
}

// List workspaces for a user
export async function listWorkspacesForUser(userId: string) {
  return await db
    .selectFrom('workspaces as w')
    .innerJoin('workspace_members as wm', 'w.id', 'wm.workspace_id')
    .where('wm.user_id', '=', userId)
    .where('w.deleted_at', 'is', null)
    .select(['w.id', 'w.name', 'w.created_at', 'w.updated_at', 'wm.role'])
    .execute();
}

// Check if a user is a member of a workspace
export async function isWorkspaceMember(workspaceId: string, userId: string) {
  const member = await db
    .selectFrom('workspace_members')
    .where('workspace_id', '=', workspaceId)
    .where('user_id', '=', userId)
    .select('role')
    .executeTakeFirst();

  return member !== undefined;
}

// Check if a user is an admin of a workspace
export async function isWorkspaceAdmin(workspaceId: string, userId: string) {
  const member = await db
    .selectFrom('workspace_members')
    .where('workspace_id', '=', workspaceId)
    .where('user_id', '=', userId)
    .where('role', '=', 'admin')
    .select('role')
    .executeTakeFirst();

  return member !== undefined;
}

// Add a member to a workspace
export async function addWorkspaceMember(workspaceId: string, userId: string, addedByUserId: string) {
  // Check if the user adding is an admin
  const isAdmin = await isWorkspaceAdmin(workspaceId, addedByUserId);
  if (!isAdmin) {
    throw new Error('Not authorized to add members');
  }

  // Check if the user is already a member
  const isMember = await isWorkspaceMember(workspaceId, userId);
  if (isMember) {
    throw new Error('User is already a member of this workspace');
  }

  const now = new Date().toISOString();

  // Add the new member with default role 'member'
  return await db
    .insertInto('workspace_members')
    .values({
      workspace_id: workspaceId,
      user_id: userId,
      role: 'member',
      joined_at: now,
    })
    .execute();
}

// Get a workspace by ID
export async function getWorkspaceById(workspaceId: string) {
  return await db
    .selectFrom('workspaces')
    .where('id', '=', workspaceId)
    .where('deleted_at', 'is', null)
    .selectAll()
    .executeTakeFirst();
} 