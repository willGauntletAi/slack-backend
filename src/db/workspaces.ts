import { db } from './index';
import { z } from 'zod';
import { findUserByEmail } from './users';

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
    .where('wm.deleted_at', 'is', null)
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

// Accept a workspace invitation
export async function acceptWorkspaceInvite(workspaceId: string, userId: string) {
  // Check if the user has an invitation
  const membership = await db
    .selectFrom('workspace_members')
    .where('workspace_id', '=', workspaceId)
    .where('user_id', '=', userId)
    .where('deleted_at', 'is', null)
    .selectAll()
    .executeTakeFirst();

  if (!membership) {
    throw new Error('No invitation found');
  }

  if (membership.role !== 'invited') {
    throw new Error('User is already a member of this workspace');
  }

  const now = new Date().toISOString();

  // Update the member role to 'member'
  return await db
    .updateTable('workspace_members')
    .set({
      role: 'member',
      updated_at: now,
    })
    .where('workspace_id', '=', workspaceId)
    .where('user_id', '=', userId)
    .returningAll()
    .executeTakeFirst();
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

// Invite a user to a workspace by email
export async function inviteUserByEmail(workspaceId: string, email: string, invitedByUserId: string) {
  // Check if the user inviting is an admin
  const isAdmin = await isWorkspaceAdmin(workspaceId, invitedByUserId);
  if (!isAdmin) {
    throw new Error('Not authorized to invite members');
  }

  // Find the user by email
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error('User not found');
  }

  // Check if the user is already a member
  const existingMembership = await db
    .selectFrom('workspace_members')
    .where('workspace_id', '=', workspaceId)
    .where('user_id', '=', user.id)
    .selectAll()
    .executeTakeFirst();

  if (existingMembership) {
    if (existingMembership.deleted_at === null) {
      throw new Error('User is already a member of this workspace');
    }

    // If they were previously a member but were removed, reinvite them
    const now = new Date().toISOString();
    return await db
      .updateTable('workspace_members')
      .set({
        role: 'invited',
        deleted_at: null,
        joined_at: now,
      })
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', user.id)
      .returningAll()
      .executeTakeFirst();
  }

  const now = new Date().toISOString();

  // Add the new member with role 'invited'
  return await db
    .insertInto('workspace_members')
    .values({
      workspace_id: workspaceId,
      user_id: user.id,
      role: 'invited',
      joined_at: now,
    })
    .returningAll()
    .executeTakeFirst();
}

// Leave a workspace
export async function leaveWorkspace(workspaceId: string, userId: string) {
  // Check if the user is a member
  const membership = await db
    .selectFrom('workspace_members')
    .where('workspace_id', '=', workspaceId)
    .where('user_id', '=', userId)
    .where('deleted_at', 'is', null)
    .selectAll()
    .executeTakeFirst();

  if (!membership) {
    throw new Error('Not a member of this workspace');
  }

  // If user is an admin, check if they're the last admin
  if (membership.role === 'admin') {
    const adminCount = await db
      .selectFrom('workspace_members')
      .where('workspace_id', '=', workspaceId)
      .where('role', '=', 'admin')
      .where('deleted_at', 'is', null)
      .select(({ fn }) => [fn.count<number>('user_id').as('count')])
      .executeTakeFirst();

    if (adminCount && Number(adminCount.count) <= 1) {
      throw new Error('Cannot leave workspace as the last admin');
    }
  }

  const now = new Date().toISOString();

  return await db
    .updateTable('workspace_members')
    .set({
      deleted_at: now,
    })
    .where('workspace_id', '=', workspaceId)
    .where('user_id', '=', userId)
    .returningAll()
    .executeTakeFirst();
}

// Remove a member from a workspace
export async function removeWorkspaceMember(workspaceId: string, userId: string, removedByUserId: string) {
  // Check if the remover is an admin (unless removing self)
  if (userId !== removedByUserId) {
    const isAdmin = await isWorkspaceAdmin(workspaceId, removedByUserId);
    if (!isAdmin) {
      throw new Error('Not authorized to remove members');
    }
  }

  // Check if the user to be removed is a member
  const membership = await db
    .selectFrom('workspace_members')
    .where('workspace_id', '=', workspaceId)
    .where('user_id', '=', userId)
    .where('deleted_at', 'is', null)
    .selectAll()
    .executeTakeFirst();

  if (!membership) {
    throw new Error('User is not a member of this workspace');
  }

  // If user is an admin, check if they're the last admin
  if (membership.role === 'admin') {
    const adminCount = await db
      .selectFrom('workspace_members')
      .where('workspace_id', '=', workspaceId)
      .where('role', '=', 'admin')
      .where('deleted_at', 'is', null)
      .select(({ fn }) => [fn.count<number>('user_id').as('count')])
      .executeTakeFirst();

    if (adminCount && Number(adminCount.count) <= 1) {
      throw new Error('Cannot remove the last admin from the workspace');
    }
  }

  const now = new Date().toISOString();

  return await db
    .updateTable('workspace_members')
    .set({
      deleted_at: now,
    })
    .where('workspace_id', '=', workspaceId)
    .where('user_id', '=', userId)
    .returningAll()
    .executeTakeFirst();
} 