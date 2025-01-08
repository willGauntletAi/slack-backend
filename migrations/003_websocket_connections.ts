import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>) {
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

export async function down(db: Kysely<any>) {
    await db.schema.dropTable("websocket_connections").execute();
} 