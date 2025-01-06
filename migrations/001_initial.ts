import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .createTable("users")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("username", "varchar", (col) => col.notNull().unique())
    .addColumn("email", "varchar", (col) => col.notNull().unique())
    .addColumn("password_hash", "varchar", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("deleted_at", "timestamp")
    .execute();

  await db.schema
    .createTable("workspaces")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("name", "varchar", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("deleted_at", "timestamp")
    .execute();

  await db.schema
    .createTable("channels")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("workspace_id", "uuid", (col) =>
      col.references("workspaces.id").onDelete("cascade").notNull(),
    )
    .addColumn("name", "varchar", (col) => col.notNull())
    .addColumn("is_private", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("deleted_at", "timestamp")
    .execute();

  await db.schema
    .createTable("messages")
    .addColumn("id", "bigserial", (col) => col.primaryKey().notNull())
    .addColumn("channel_id", "uuid", (col) =>
      col.references("channels.id").onDelete("cascade").notNull(),
    )
    .addColumn("user_id", "uuid", (col) =>
      col.references("users.id").onDelete("cascade").notNull(),
    )
    .addColumn("parent_id", "bigint", (col) =>
      col.references("messages.id").onDelete("cascade"),
    )
    .addColumn("content", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("deleted_at", "timestamp")
    .execute();

  await db.schema
    .createTable("workspace_members")
    .addColumn("workspace_id", "uuid", (col) =>
      col.references("workspaces.id").onDelete("cascade").notNull(),
    )
    .addColumn("user_id", "uuid", (col) =>
      col.references("users.id").onDelete("cascade").notNull(),
    )
    .addColumn("role", "varchar", (col) => col.notNull())
    .addColumn("joined_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("deleted_at", "timestamp")
    .addPrimaryKeyConstraint("workspace_members_pk", [
      "workspace_id",
      "user_id",
    ])
    .execute();

  await db.schema
    .createTable("channel_members")
    .addColumn("channel_id", "uuid", (col) =>
      col.references("channels.id").onDelete("cascade").notNull(),
    )
    .addColumn("user_id", "uuid", (col) =>
      col.references("users.id").onDelete("cascade").notNull(),
    )
    .addColumn("joined_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("deleted_at", "timestamp")
    .addPrimaryKeyConstraint("channel_members_pk", ["channel_id", "user_id"])
    .execute();

  await db.schema
    .createTable("direct_message_channels")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("deleted_at", "timestamp")
    .execute();

  await db.schema
    .createTable("direct_message_members")
    .addColumn("channel_id", "uuid", (col) =>
      col
        .references("direct_message_channels.id")
        .onDelete("cascade")
        .notNull(),
    )
    .addColumn("user_id", "uuid", (col) =>
      col.references("users.id").onDelete("cascade").notNull(),
    )
    .addColumn("joined_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("deleted_at", "timestamp")
    .addPrimaryKeyConstraint("direct_message_members_pk", [
      "channel_id",
      "user_id",
    ])
    .execute();

  await db.schema
    .createTable("direct_messages")
    .addColumn("id", "bigserial", (col) => col.primaryKey().notNull())
    .addColumn("channel_id", "uuid", (col) =>
      col
        .references("direct_message_channels.id")
        .onDelete("cascade")
        .notNull(),
    )
    .addColumn("user_id", "uuid", (col) =>
      col.references("users.id").onDelete("cascade").notNull(),
    )
    .addColumn("parent_id", "bigint", (col) =>
      col.references("direct_messages.id").onDelete("cascade"),
    )
    .addColumn("content", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn("deleted_at", "timestamp")
    .execute();

  await db.schema
    .createTable("message_reactions")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("message_id", "bigint", (col) =>
      col.references("messages.id").onDelete("cascade").notNull(),
    )
    .addColumn("user_id", "uuid", (col) =>
      col.references("users.id").onDelete("cascade").notNull(),
    )
    .addColumn("emoji", "varchar", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema.dropTable("message_reactions").execute();
  await db.schema.dropTable("direct_messages").execute();
  await db.schema.dropTable("direct_message_members").execute();
  await db.schema.dropTable("direct_message_channels").execute();
  await db.schema.dropTable("channel_members").execute();
  await db.schema.dropTable("workspace_members").execute();
  await db.schema.dropTable("messages").execute();
  await db.schema.dropTable("channels").execute();
  await db.schema.dropTable("workspaces").execute();
  await db.schema.dropTable("users").execute();
}
