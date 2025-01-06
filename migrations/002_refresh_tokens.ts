import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .createTable("refresh_tokens")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("user_id", "uuid", (col) =>
      col.references("users.id").onDelete("cascade").notNull(),
    )
    .addColumn("token", "varchar", (col) => col.notNull().unique())
    .addColumn("expires_at", "timestamp", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("revoked_at", "timestamp")
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema.dropTable("refresh_tokens").execute();
} 