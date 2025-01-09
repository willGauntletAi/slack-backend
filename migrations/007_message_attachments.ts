import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable('message_attachments')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn('message_id', 'bigint', (col) =>
            col.references('messages.id').onDelete('cascade').notNull(),
        )
        .addColumn('file_key', 'varchar', (col) => col.notNull())
        .addColumn('filename', 'varchar', (col) => col.notNull())
        .addColumn('mime_type', 'varchar', (col) => col.notNull())
        .addColumn('size', 'bigint', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.defaultTo(sql`now()`).notNull(),
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.defaultTo(sql`now()`).notNull(),
        )
        .execute();

    await db.schema
        .createIndex('message_attachments_message_id_idx')
        .on('message_attachments')
        .column('message_id')
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable('message_attachments').execute();
} 