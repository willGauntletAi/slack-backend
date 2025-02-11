/**
 * This file was generated by kysely-codegen.
 * Please do not edit it manually.
 */

import type { ColumnType } from "kysely";

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export type Int8 = ColumnType<string, bigint | number | string, bigint | number | string>;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface ChannelMembers {
  channel_id: string;
  deleted_at: Timestamp | null;
  joined_at: Generated<Timestamp>;
  last_read_message: Int8 | null;
  updated_at: Generated<Timestamp>;
  user_id: string;
}

export interface Channels {
  created_at: Generated<Timestamp>;
  deleted_at: Timestamp | null;
  id: Generated<string>;
  is_private: Generated<boolean>;
  name: string | null;
  updated_at: Generated<Timestamp>;
  workspace_id: string;
}

export interface MessageAttachments {
  created_at: Generated<Timestamp>;
  file_key: string;
  filename: string;
  id: Generated<string>;
  message_id: Int8;
  mime_type: string;
  size: Int8;
  updated_at: Generated<Timestamp>;
}

export interface MessageEmbeddings {
  created_at: Generated<Timestamp | null>;
  embedding: string;
  message_id: Int8;
  model: string;
}

export interface MessageReactions {
  created_at: Generated<Timestamp>;
  emoji: string;
  id: Generated<string>;
  message_id: Int8;
  user_id: string;
}

export interface Messages {
  channel_id: string;
  content: string;
  created_at: Generated<Timestamp>;
  deleted_at: Timestamp | null;
  id: Generated<Int8>;
  is_avatar: Generated<boolean>;
  parent_id: Int8 | null;
  updated_at: Generated<Timestamp>;
  user_id: string;
}

export interface RefreshTokens {
  created_at: Generated<Timestamp>;
  expires_at: Timestamp;
  id: Generated<string>;
  revoked_at: Timestamp | null;
  token: string;
  user_id: string;
}

export interface Users {
  created_at: Generated<Timestamp>;
  deleted_at: Timestamp | null;
  email: string;
  id: Generated<string>;
  override_status: string | null;
  password_hash: string;
  updated_at: Generated<Timestamp>;
  username: string;
}

export interface WebsocketConnections {
  connection_id: Generated<string>;
  created_at: Generated<Timestamp>;
  server_id: string;
  user_id: string;
}

export interface WorkspaceMembers {
  deleted_at: Timestamp | null;
  joined_at: Generated<Timestamp>;
  role: string;
  updated_at: Generated<Timestamp>;
  user_id: string;
  workspace_id: string;
}

export interface Workspaces {
  created_at: Generated<Timestamp>;
  deleted_at: Timestamp | null;
  id: Generated<string>;
  name: string;
  updated_at: Generated<Timestamp>;
}

export interface DB {
  channel_members: ChannelMembers;
  channels: Channels;
  message_attachments: MessageAttachments;
  message_embeddings: MessageEmbeddings;
  message_reactions: MessageReactions;
  messages: Messages;
  refresh_tokens: RefreshTokens;
  users: Users;
  websocket_connections: WebsocketConnections;
  workspace_members: WorkspaceMembers;
  workspaces: Workspaces;
}
