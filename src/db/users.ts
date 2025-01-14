import { db } from './index';
import type { Users } from './types';
import { defaultConfig } from '../config/defaults';

export type CreateUserData = Omit<Users, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'override_status'> & { override_status?: string | null };
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
export async function getWorkspaceUsers(workspaceId: string, search?: string, excludeChannelId?: string) {
  let query = db
    .selectFrom('users as u')
    .innerJoin('workspace_members as wm', 'u.id', 'wm.user_id')
    .where('wm.workspace_id', '=', workspaceId)
    .where('wm.deleted_at', 'is', null)
    .where('u.deleted_at', 'is', null);

  if (search) {
    query = query.where(eb =>
      eb.or([
        eb('u.username', 'ilike', `%${search}%`),
        eb('u.email', 'ilike', `%${search}%`)
      ])
    );
  }

  // Exclude users who are members of the specified channel
  if (excludeChannelId) {
    query = query.where(eb =>
      eb.not(
        eb.exists(
          eb.selectFrom('channel_members as cm')
            .where('cm.channel_id', '=', excludeChannelId)
            .where('cm.user_id', '=', eb.ref('u.id'))
            .where('cm.deleted_at', 'is', null)
        )
      )
    );
  }

  return await query
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
export async function getChannelUsers(channelId: string, search?: string) {
  let query = db
    .selectFrom('users as u')
    .innerJoin('channel_members as cm', 'u.id', 'cm.user_id')
    .where('cm.channel_id', '=', channelId)
    .where('cm.deleted_at', 'is', null)
    .where('u.deleted_at', 'is', null);

  if (search) {
    query = query.where(eb =>
      eb.or([
        eb('u.username', 'ilike', `%${search}%`),
        eb('u.email', 'ilike', `%${search}%`)
      ])
    );
  }

  return await query
    .select([
      'u.id',
      'u.username',
      'u.email',
      'cm.joined_at',
    ])
    .execute();
}

/**
 * Creates a new user and optionally adds them to the default workspace and channel if configured
 */
export async function createUserWithDefaults(data: CreateUserData) {
  return await db.transaction().execute(async (trx) => {
    // Create user
    const user = await trx
      .insertInto('users')
      .values(data)
      .returning(['id', 'email', 'username', 'created_at', 'updated_at'])
      .executeTakeFirstOrThrow();

    // If default workspace is configured, add user to it
    if (defaultConfig.DEFAULT_WORKSPACE_ID) {
      const now = new Date().toISOString();
      await trx
        .insertInto('workspace_members')
        .values({
          workspace_id: defaultConfig.DEFAULT_WORKSPACE_ID,
          user_id: user.id,
          role: 'member',
          joined_at: now,
        })
        .execute();

      // If default channel is configured and in the default workspace, add user to it
      if (defaultConfig.DEFAULT_CHANNEL_ID) {
        // Verify the channel exists and belongs to the default workspace
        const channel = await trx
          .selectFrom('channels')
          .where('id', '=', defaultConfig.DEFAULT_CHANNEL_ID)
          .where('workspace_id', '=', defaultConfig.DEFAULT_WORKSPACE_ID)
          .where('deleted_at', 'is', null)
          .selectAll()
          .executeTakeFirst();

        if (channel) {
          await trx
            .insertInto('channel_members')
            .values({
              channel_id: defaultConfig.DEFAULT_CHANNEL_ID,
              user_id: user.id,
              joined_at: now,
            })
            .execute();
        }
      }
    }

    return user;
  });
} 