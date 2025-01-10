import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    // Create GIN indexes for full-text search
    await sql`
    CREATE INDEX IF NOT EXISTS messages_content_search_idx 
    ON messages 
    USING GIN (to_tsvector('english', content));
  `.execute(db);

    await sql`
    CREATE INDEX IF NOT EXISTS message_attachments_filename_search_idx 
    ON message_attachments 
    USING GIN (to_tsvector('english', filename));
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
    await sql`DROP INDEX IF EXISTS messages_content_search_idx`.execute(db);
    await sql`DROP INDEX IF EXISTS message_attachments_filename_search_idx`.execute(db);
} 