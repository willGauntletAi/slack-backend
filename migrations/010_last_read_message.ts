import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>) {
    await db.schema
        .alterTable('channel_members')
        .addColumn('last_read_message', 'bigint', col =>
            col.references('messages.id').onDelete('set null')
        )
        .execute();
}

export async function down(db: Kysely<any>) {
    await db.schema
        .alterTable('channel_members')
        .dropColumn('last_read_message')
        .execute();
}
