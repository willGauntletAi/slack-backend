import { Router } from 'express';
import { RequestHandler } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { registry } from '../../utils/openapi';
import OpenAI from 'openai';
import { GenerateEmbeddingsResponseSchema, ErrorResponseSchema } from './types';
import { getMessagesWithoutEmbeddings } from '../../db/messages';
import { createMessageEmbedding } from '../../services/openai';
const router = Router();

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// POST /embeddings/all - Generate embeddings for all messages
registry.registerPath({
  method: 'post',
  path: '/embeddings/all',
  tags: ['embeddings'],
  summary: 'Generate embeddings for all messages that don\'t have them',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Successfully generated embeddings',
      content: {
        'application/json': {
          schema: GenerateEmbeddingsResponseSchema,
        },
      },
    },
    400: {
      description: 'Error generating embeddings',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const generateAllEmbeddingsHandler: RequestHandler = async (req: AuthRequest, res) => {
  try {
    // Get all messages without embeddings
    const messages = await getMessagesWithoutEmbeddings();

    let count = 0;
    const batchSize = 100; // Process in batches to avoid memory issues
    
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      
      // Generate embeddings in parallel for the batch
      const embeddingPromises = batch.map(async (message) => {
        try {
          const response = await openai.embeddings.create({
            input: message.content,
            model: "text-embedding-3-large",
            dimensions: 2000,
          });

          await createMessageEmbedding({
            messageId: message.id,
            embedding: response.data[0].embedding,
            model: 'text-embedding-3-large',
          });

          count++;
        } catch (error) {
          console.error(`Failed to generate embedding for message ${message.id}:`, error);
        }
      });

      await Promise.all(embeddingPromises);
    }

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error('Error generating embeddings:', error);
    res.status(400).json({
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

router.post('/all', authenticate, generateAllEmbeddingsHandler);

export default router; 