import { sql } from "kysely";
import { db } from "../db";

export async function createMessageEmbedding(params: {
  messageId: string;
  embedding: number[];
  model: string;
}): Promise<void> {
  await db
    .insertInto('message_embeddings')
    .values({
      message_id: params.messageId,
      embedding: sql`${params.embedding}::vector`,
      model: params.model,
    })
    .execute();
} 