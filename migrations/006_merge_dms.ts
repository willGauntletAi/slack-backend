import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>) {
    // Make name column nullable in channels table
    await db.schema
        .alterTable('channels')
        .alterColumn('name', (col) => col.dropNotNull())
        .execute();

    // Migrate DM channels to regular channels
    await sql`
        INSERT INTO channels (id, workspace_id, name, is_private, created_at, updated_at)
        SELECT id, workspace_id, NULL, TRUE, created_at, updated_at
        FROM direct_message_channels
        WHERE deleted_at IS NULL
    `.execute(db);

    // Migrate DM members to channel members
    await sql`
        INSERT INTO channel_members (channel_id, user_id, joined_at, updated_at)
        SELECT channel_id, user_id, joined_at, updated_at
        FROM direct_message_members
        WHERE deleted_at IS NULL
    `.execute(db);

    // Migrate DM messages to regular messages
    await sql`
        INSERT INTO messages (channel_id, user_id, parent_id, content, created_at, updated_at)
        SELECT channel_id, user_id, parent_id, content, created_at, updated_at
        FROM direct_messages
        WHERE deleted_at IS NULL
    `.execute(db);

    // Drop DM tables
    await db.schema.dropTable('direct_messages').execute();
    await db.schema.dropTable('direct_message_members').execute();
    await db.schema.dropTable('direct_message_channels').execute();
}

export async function down(db: Kysely<any>) {
    // Make name column not null in channels table
    await db.schema
        .alterTable('channels')
        .alterColumn('name', (col) => col.setNotNull())
        .execute();

    // Recreate DM tables
    await db.schema
        .createTable('direct_message_channels')
        .addColumn('id', 'uuid', (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn('workspace_id', 'uuid', (col) =>
            col.references('workspaces.id').onDelete('cascade').notNull()
        )
        .addColumn('created_at', 'timestamptz', (col) =>
            col.defaultTo(sql`now()`).notNull(),
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.defaultTo(sql`now()`).notNull(),
        )
        .addColumn('deleted_at', 'timestamptz')
        .execute();

    await db.schema
        .createTable('direct_message_members')
        .addColumn('channel_id', 'uuid', (col) =>
            col
                .references('direct_message_channels.id')
                .onDelete('cascade')
                .notNull(),
        )
        .addColumn('user_id', 'uuid', (col) =>
            col.references('users.id').onDelete('cascade').notNull(),
        )
        .addColumn('joined_at', 'timestamptz', (col) =>
            col.defaultTo(sql`now()`).notNull(),
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.defaultTo(sql`now()`).notNull(),
        )
        .addColumn('deleted_at', 'timestamptz')
        .addPrimaryKeyConstraint('direct_message_members_pk', [
            'channel_id',
            'user_id',
        ])
        .execute();

    await db.schema
        .createTable('direct_messages')
        .addColumn('id', 'bigserial', (col) => col.primaryKey().notNull())
        .addColumn('channel_id', 'uuid', (col) =>
            col
                .references('direct_message_channels.id')
                .onDelete('cascade')
                .notNull(),
        )
        .addColumn('user_id', 'uuid', (col) =>
            col.references('users.id').onDelete('cascade').notNull(),
        )
        .addColumn('parent_id', 'bigint', (col) =>
            col.references('direct_messages.id').onDelete('cascade'),
        )
        .addColumn('content', 'text', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) =>
            col.defaultTo(sql`now()`).notNull(),
        )
        .addColumn('updated_at', 'timestamptz', (col) =>
            col.defaultTo(sql`now()`).notNull(),
        )
        .addColumn('deleted_at', 'timestamptz')
        .execute();
} 