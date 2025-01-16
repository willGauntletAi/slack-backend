import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('messages')
    .addColumn('is_avatar', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('messages')
    .dropColumn('is_avatar')
    .execute()
} 