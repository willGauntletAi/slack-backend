import { db } from './index';
import type { Users } from './types';

export type CreateUserData = Omit<Users, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;
export type UpdateUserData = Partial<CreateUserData>;

export async function findUserByEmailOrUsername(email: string, username: string) {
  return db
    .selectFrom('users')
    .where(eb =>
      eb.or([
        eb('email', '=', email),
        eb('username', '=', username)
      ])
    )
    .selectAll()
    .executeTakeFirst();
}

export async function findUserByEmail(email: string) {
  return db
    .selectFrom('users')
    .where('email', '=', email)
    .selectAll()
    .executeTakeFirst();
}

export async function findUserById(id: string) {
  return db
    .selectFrom('users')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst();
}

export async function createUser(data: CreateUserData) {
  return db
    .insertInto('users')
    .values(data)
    .returning(['id', 'email', 'username', 'created_at', 'updated_at'])
    .executeTakeFirst();
}

export async function updateUser(id: string, data: UpdateUserData) {
  return db
    .updateTable('users')
    .set({
      ...data,
      updated_at: new Date(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();
}

export async function checkUsersShareWorkspace(userId1: string, userId2: string): Promise<boolean> {
  const sharedWorkspaces = await db
    .selectFrom('workspace_members as wm1')
    .innerJoin('workspace_members as wm2', join =>
      join.onRef('wm1.workspace_id', '=', 'wm2.workspace_id')
    )
    .where('wm1.user_id', '=', userId1)
    .where('wm2.user_id', '=', userId2)
    .select('wm1.workspace_id')
    .execute();

  return sharedWorkspaces.length > 0;
}

// Get users in a workspace
export async function getWorkspaceUsers(workspaceId: string) {
  return await db
    .selectFrom('users as u')
    .innerJoin('workspace_members as wm', 'u.id', 'wm.user_id')
    .where('wm.workspace_id', '=', workspaceId)
    .where('wm.deleted_at', 'is', null)
    .where('u.deleted_at', 'is', null)
    .select([
      'u.id',
      'u.username',
      'u.email',
      'wm.joined_at',
      'wm.role',
    ])
    .execute();
}

// Get users in a channel
export async function getChannelUsers(channelId: string) {
  return await db
    .selectFrom('users as u')
    .innerJoin('channel_members as cm', 'u.id', 'cm.user_id')
    .where('cm.channel_id', '=', channelId)
    .where('cm.deleted_at', 'is', null)
    .where('u.deleted_at', 'is', null)
    .select([
      'u.id',
      'u.username',
      'u.email',
      'cm.joined_at',
    ])
    .execute();
} 