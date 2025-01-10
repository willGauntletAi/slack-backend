import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .alterTable('users')
        .addColumn('override_status', 'text', (col) => col.defaultTo(null))
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema
        .alterTable('users')
        .dropColumn('override_status')
        .execute();
} 