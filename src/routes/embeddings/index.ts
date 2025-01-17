import { Router } from 'express';
import { RequestHandler } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { registry } from '../../utils/openapi';
import OpenAI from 'openai';
import { GenerateEmbeddingsResponseSchema, ErrorResponseSchema, SemanticSearchResponseSchema, SemanticSearchRequestSchema } from './types';
import { createMessageEmbedding, getMessagesWithoutEmbeddings } from '../../db/messages';
import { generateEmbedding } from '../../services/openai';
import { semanticSearch } from '../../db/search';
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
          const embedding = await generateEmbedding(message.content);

          await createMessageEmbedding({
            messageId: message.id,
            embedding: embedding,
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

// GET /embeddings - Semantic search using embeddings
registry.registerPath({
  method: 'get',
  path: '/embeddings',
  tags: ['embeddings'],
  summary: 'Search messages using semantic embeddings',
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'query',
      in: 'query',
      required: true,
      schema: { type: 'string', minLength: 1, maxLength: 1000 },
      description: 'Text to find semantically similar messages to',
    },
    {
      name: 'limit',
      in: 'query',
      required: false,
      schema: { type: 'number', minimum: 1, maximum: 10, default: 10 },
      description: 'Number of results to return',
    },
  ],
  responses: {
    200: {
      description: 'Successfully found similar messages',
      content: {
        'application/json': {
          schema: SemanticSearchResponseSchema,
        },
      },
    },
    400: {
      description: 'Error performing semantic search',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const semanticSearchHandler: RequestHandler = async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const params = SemanticSearchRequestSchema.parse({
      query: String(req.query.query),
      limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined,
    });

    // Generate embedding for the query
    const embedding = await generateEmbedding(params.query);

    // Search for similar messages
    const messages = await semanticSearch(embedding, params.limit);

    res.json({
      messages: messages.map(msg => ({
        ...msg,
        id: String(msg.id),
        createdAt: msg.createdAt.toISOString(),
        updatedAt: msg.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error performing semantic search:', error);
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

router.get('/', authenticate, semanticSearchHandler);

export default router; 