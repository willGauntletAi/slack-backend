import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>) {
    // Drop the old table
    await db.schema.dropTable("websocket_connections").execute();

    // Create the new table with connection_id
    await db.schema
        .createTable("websocket_connections")
        .addColumn("connection_id", "uuid", (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn("user_id", "uuid", (col) =>
            col.references("users.id").onDelete("cascade").notNull(),
        )
        .addColumn("server_id", "varchar", (col) => col.notNull())
        .addColumn("created_at", "timestamp", (col) =>
            col.defaultTo(sql`now()`).notNull(),
        )
        .execute();
}

export async function down(db: Kysely<any>) {
    // Drop the new table
    await db.schema.dropTable("websocket_connections").execute();

    // Recreate the old table structure
    await db.schema
        .createTable("websocket_connections")
        .addColumn("user_id", "uuid", (col) =>
            col.references("users.id").onDelete("cascade").notNull(),
        )
        .addColumn("server_id", "varchar", (col) => col.notNull())
        .addColumn("created_at", "timestamp", (col) =>
            col.defaultTo(sql`now()`).notNull(),
        )
        .addPrimaryKeyConstraint("websocket_connections_pk", ["user_id", "server_id"])
        .execute();
} 