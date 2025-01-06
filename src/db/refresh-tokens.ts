import { db } from './index';
import type { RefreshTokens } from './types';

export type CreateRefreshTokenData = Omit<
  RefreshTokens,
  'id' | 'created_at' | 'revoked_at' | 'expires_at'
> & { expires_at: Date };

export async function createRefreshToken(data: CreateRefreshTokenData) {
  return db
    .insertInto('refresh_tokens')
    .values(data)
    .returningAll()
    .executeTakeFirst();
}

export async function findRefreshToken(token: string) {
  return db
    .selectFrom('refresh_tokens')
    .where('token', '=', token)
    .selectAll()
    .executeTakeFirst();
}

export async function revokeRefreshToken(token: string) {
  return db
    .updateTable('refresh_tokens')
    .set({ revoked_at: new Date() })
    .where('token', '=', token)
    .returningAll()
    .executeTakeFirst();
}

export async function revokeAllUserRefreshTokens(userId: string) {
  return db
    .updateTable('refresh_tokens')
    .set({ revoked_at: new Date() })
    .where('user_id', '=', userId)
    .where('revoked_at', 'is', null)
    .execute();
} 