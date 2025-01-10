import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .alterTable('users')
        .alterColumn('override_status', (col) => col.setDataType('text'))
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema
        .alterTable('users')
        .alterColumn('override_status', (col) => col.setDataType('boolean'))
        .execute();
}
