import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>) {
  // Users table
  await db.schema.alterTable('users')
    .alterColumn('created_at', (col) => col.setDataType('timestamptz'))
    .alterColumn('updated_at', (col) => col.setDataType('timestamptz'))
    .alterColumn('deleted_at', (col) => col.setDataType('timestamptz'))
    .execute();

  // Workspaces table
  await db.schema.alterTable('workspaces')
    .alterColumn('created_at', (col) => col.setDataType('timestamptz'))
    .alterColumn('updated_at', (col) => col.setDataType('timestamptz'))
    .alterColumn('deleted_at', (col) => col.setDataType('timestamptz'))
    .execute();

  // Channels table
  await db.schema.alterTable('channels')
    .alterColumn('created_at', (col) => col.setDataType('timestamptz'))
    .alterColumn('updated_at', (col) => col.setDataType('timestamptz'))
    .alterColumn('deleted_at', (col) => col.setDataType('timestamptz'))
    .execute();

  // Messages table
  await db.schema.alterTable('messages')
    .alterColumn('created_at', (col) => col.setDataType('timestamptz'))
    .alterColumn('updated_at', (col) => col.setDataType('timestamptz'))
    .alterColumn('deleted_at', (col) => col.setDataType('timestamptz'))
    .execute();

  // Workspace members table
  await db.schema.alterTable('workspace_members')
    .alterColumn('joined_at', (col) => col.setDataType('timestamptz'))
    .alterColumn('updated_at', (col) => col.setDataType('timestamptz'))
    .alterColumn('deleted_at', (col) => col.setDataType('timestamptz'))
    .execute();

  // Channel members table
  await db.schema.alterTable('channel_members')
    .alterColumn('joined_at', (col) => col.setDataType('timestamptz'))
    .alterColumn('updated_at', (col) => col.setDataType('timestamptz'))
    .alterColumn('deleted_at', (col) => col.setDataType('timestamptz'))
    .execute();

  // Direct message channels table
  await db.schema.alterTable('direct_message_channels')
    .alterColumn('created_at', (col) => col.setDataType('timestamptz'))
    .alterColumn('updated_at', (col) => col.setDataType('timestamptz'))
    .alterColumn('deleted_at', (col) => col.setDataType('timestamptz'))
    .execute();

  // Direct message members table
  await db.schema.alterTable('direct_message_members')
    .alterColumn('joined_at', (col) => col.setDataType('timestamptz'))
    .alterColumn('updated_at', (col) => col.setDataType('timestamptz'))
    .alterColumn('deleted_at', (col) => col.setDataType('timestamptz'))
    .execute();

  // Direct messages table
  await db.schema.alterTable('direct_messages')
    .alterColumn('created_at', (col) => col.setDataType('timestamptz'))
    .alterColumn('updated_at', (col) => col.setDataType('timestamptz'))
    .alterColumn('deleted_at', (col) => col.setDataType('timestamptz'))
    .execute();

  // Message reactions table
  await db.schema.alterTable('message_reactions')
    .alterColumn('created_at', (col) => col.setDataType('timestamptz'))
    .execute();
}

export async function down(db: Kysely<any>) {
  // Users table
  await db.schema.alterTable('users')
    .alterColumn('created_at', (col) => col.setDataType('timestamp'))
    .alterColumn('updated_at', (col) => col.setDataType('timestamp'))
    .alterColumn('deleted_at', (col) => col.setDataType('timestamp'))
    .execute();

  // Workspaces table
  await db.schema.alterTable('workspaces')
    .alterColumn('created_at', (col) => col.setDataType('timestamp'))
    .alterColumn('updated_at', (col) => col.setDataType('timestamp'))
    .alterColumn('deleted_at', (col) => col.setDataType('timestamp'))
    .execute();

  // Channels table
  await db.schema.alterTable('channels')
    .alterColumn('created_at', (col) => col.setDataType('timestamp'))
    .alterColumn('updated_at', (col) => col.setDataType('timestamp'))
    .alterColumn('deleted_at', (col) => col.setDataType('timestamp'))
    .execute();

  // Messages table
  await db.schema.alterTable('messages')
    .alterColumn('created_at', (col) => col.setDataType('timestamp'))
    .alterColumn('updated_at', (col) => col.setDataType('timestamp'))
    .alterColumn('deleted_at', (col) => col.setDataType('timestamp'))
    .execute();

  // Workspace members table
  await db.schema.alterTable('workspace_members')
    .alterColumn('joined_at', (col) => col.setDataType('timestamp'))
    .alterColumn('updated_at', (col) => col.setDataType('timestamp'))
    .alterColumn('deleted_at', (col) => col.setDataType('timestamp'))
    .execute();

  // Channel members table
  await db.schema.alterTable('channel_members')
    .alterColumn('joined_at', (col) => col.setDataType('timestamp'))
    .alterColumn('updated_at', (col) => col.setDataType('timestamp'))
    .alterColumn('deleted_at', (col) => col.setDataType('timestamp'))
    .execute();

  // Direct message channels table
  await db.schema.alterTable('direct_message_channels')
    .alterColumn('created_at', (col) => col.setDataType('timestamp'))
    .alterColumn('updated_at', (col) => col.setDataType('timestamp'))
    .alterColumn('deleted_at', (col) => col.setDataType('timestamp'))
    .execute();

  // Direct message members table
  await db.schema.alterTable('direct_message_members')
    .alterColumn('joined_at', (col) => col.setDataType('timestamp'))
    .alterColumn('updated_at', (col) => col.setDataType('timestamp'))
    .alterColumn('deleted_at', (col) => col.setDataType('timestamp'))
    .execute();

  // Direct messages table
  await db.schema.alterTable('direct_messages')
    .alterColumn('created_at', (col) => col.setDataType('timestamp'))
    .alterColumn('updated_at', (col) => col.setDataType('timestamp'))
    .alterColumn('deleted_at', (col) => col.setDataType('timestamp'))
    .execute();

  // Message reactions table
  await db.schema.alterTable('message_reactions')
    .alterColumn('created_at', (col) => col.setDataType('timestamp'))
    .execute();
} 