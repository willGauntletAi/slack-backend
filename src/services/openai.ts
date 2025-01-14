import { sql } from "kysely";
import { db } from "../db";
import OpenAI from "openai";

// Initialize the OpenAI client
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function createMessageEmbedding(params: {
  messageId: string;
  embedding: number[];
  model: string;
}): Promise<void> {
  // Format the embedding array as a PostgreSQL vector string
  const vectorStr = `[${params.embedding.join(',')}]`;
  
  await db
    .insertInto('message_embeddings')
    .values({
      message_id: params.messageId,
      embedding: sql`${vectorStr}::vector`,
      model: params.model,
    })
    .execute();
} 