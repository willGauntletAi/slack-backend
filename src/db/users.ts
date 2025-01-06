import { db } from './index';
import type { InsertObject } from 'kysely';
import type { Users } from './types';

export type CreateUserData = Omit<Users, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;

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

export async function createUser(data: CreateUserData) {
  return db
    .insertInto('users')
    .values(data)
    .returning(['id', 'username', 'email'])
    .executeTakeFirst();
} 