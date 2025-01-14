import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    // Create the vector extension using a separate connection with superuser privileges
    await sql`CREATE EXTENSION IF NOT EXISTS vector SCHEMA public`.execute(db);

    // Create the message_embeddings table
    await sql`
        CREATE TABLE IF NOT EXISTS message_embeddings (
            message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
            embedding vector(2000) NOT NULL,
            model VARCHAR(255) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (message_id)
        )
    `.execute(db);

    // Create an index for vector similarity search
    await sql`CREATE INDEX IF NOT EXISTS message_embeddings_vector_idx ON message_embeddings USING ivfflat (embedding vector_cosine_ops)`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
    await sql`DROP TABLE IF EXISTS message_embeddings`.execute(db);
    // Note: The vector extension is not dropped as it might be used by other tables
} 