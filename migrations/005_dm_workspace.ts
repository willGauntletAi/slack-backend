import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>) {
    // Add workspace_id column to direct_message_channels
    await db.schema
        .alterTable('direct_message_channels')
        .addColumn('workspace_id', 'uuid', col =>
            col.references('workspaces.id').onDelete('cascade').notNull()
        )
        .execute();
}

export async function down(db: Kysely<any>) {
    // Remove workspace_id column from direct_message_channels
    await db.schema
        .alterTable('direct_message_channels')
        .dropColumn('workspace_id')
        .execute();
}