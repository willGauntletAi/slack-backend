import { Router } from 'express';
import { z } from 'zod';
import type { RequestHandler } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { registry } from '../../utils/openapi';
import { 
    SearchResponseSchema,
    AskAiResponse,
    AskAiResponseSchema,
    AskAiRequestSchema
} from './types';
import { ErrorResponse, ErrorResponseSchema } from '../channels/types';
import { searchMessages } from '../../db/search';
import { openai } from '../../services/openai';
import { SearchResult, semanticSearch } from '../../utils/semanticSearch';

const router = Router();

const searchRequestSchema = z.object({
    query: z.string().min(1).max(100),
    workspaceId: z.string(),
    channelId: z.string().optional(),
    beforeId: z.string().optional(),
    limit: z.number().min(1).max(100).optional().default(20),
});

// GET /search - Search messages and attachments
registry.registerPath({
    method: 'get',
    path: '/search',
    tags: ['search'],
    summary: 'Search through messages and attachments',
    security: [{ bearerAuth: [] }],
    parameters: [
        {
            name: 'query',
            in: 'query',
            required: true,
            schema: { type: 'string', minLength: 1, maxLength: 100 },
            description: 'Search term to find in messages and attachment names',
        },
        {
            name: 'workspaceId',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Workspace to search in',
        },
        {
            name: 'channelId',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Filter results to a specific channel',
        },
        {
            name: 'beforeId',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Message ID to fetch results before (for pagination)',
        },
        {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'number', minimum: 1, maximum: 100, default: 20 },
            description: 'Number of results to return per page',
        },
    ],
    responses: {
        '200': {
            description: 'Search results retrieved successfully',
            content: {
                'application/json': {
                    schema: SearchResponseSchema.openapi('SearchResponse'),
                },
            },
        },
        '400': {
            description: 'Invalid request parameters',
            content: {
                'application/json': {
                    schema: ErrorResponseSchema,
                },
            },
        },
        '401': {
            description: 'Not authenticated',
            content: {
                'application/json': {
                    schema: ErrorResponseSchema,
                },
            },
        },
        '403': {
            description: 'Not authorized to access this workspace',
            content: {
                'application/json': {
                    schema: ErrorResponseSchema,
                },
            },
        },
    },
});

const searchHandler: RequestHandler = async (req: AuthRequest, res) => {
    try {
        if (!req.user?.id) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }

        const params = searchRequestSchema.parse({
            query: String(req.query.query),
            workspaceId: String(req.query.workspaceId),
            channelId: req.query.channelId ? String(req.query.channelId) : undefined,
            beforeId: req.query.beforeId ? String(req.query.beforeId) : undefined,
            limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined,
        });

        const response = await searchMessages(req.user.id, {
            ...params,
            limit: params.limit || 20,
        });

        res.json({
            ...response,
            messages: response.messages.map(msg => ({
                ...msg,
                id: msg.id.toString(),
                createdAt: msg.createdAt.toISOString(),
                updatedAt: msg.updatedAt.toISOString(),
                attachments: msg.attachments.map(att => ({
                    ...att,
                    size: att.size.toString(),
                    createdAt: att.createdAt.toISOString(),
                })),
            })),
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
            return;
        }
        if (error instanceof Error) {
            switch (error.message) {
                case 'Not a member of this channel':
                case 'Not a member of this workspace':
                    res.status(403).json({ error: error.message });
                    return;
            }
        }
        console.error('Search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

router.get('/', authenticate, searchHandler);

// GET /search/ask-ai - Get AI-powered answers based on message history
registry.registerPath({
    method: 'get',
    path: '/search/ask-ai',
    tags: ['search'],
    summary: 'Get AI-powered answers based on message history',
    security: [{ bearerAuth: [] }],
    parameters: [
        {
            name: 'query',
            in: 'query',
            required: true,
            schema: { type: 'string', minLength: 1, maxLength: 500 },
            description: 'Question to ask the AI',
        },
        {
            name: 'workspaceId',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Workspace to search in',
        },
        {
            name: 'channelId',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Filter context to a specific channel',
        },
        {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'number', minimum: 1, maximum: 20, default: 5 },
            description: 'Number of relevant messages to use as context',
        },
    ],
    responses: {
        '200': {
            description: 'AI response generated successfully',
            content: {
                'application/json': {
                    schema: AskAiResponseSchema.openapi('AskAiResponse'),
                },
            },
        },
        '400': {
            description: 'Invalid request parameters',
            content: {
                'application/json': {
                    schema: ErrorResponseSchema,
                },
            },
        },
        '401': {
            description: 'Not authenticated',
            content: {
                'application/json': {
                    schema: ErrorResponseSchema,
                },
            },
        },
    },
});

const askAiHandler: RequestHandler = async (req: AuthRequest, res) => {
    try {
        if (!req.user?.id) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }

        const params = AskAiRequestSchema.parse({
            query: String(req.query.query),
            workspaceId: String(req.query.workspaceId),
            channelId: req.query.channelId ? String(req.query.channelId) : undefined,
            limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined,
        });

        // Generate embedding for the query
        const embeddingResponse = await openai.embeddings.create({
            input: params.query,
            model: "text-embedding-3-large",
            dimensions: 2000,
        });

        const embedding = embeddingResponse.data[0].embedding;

        // Search for similar messages
        const messages = await semanticSearch(
            embedding, 
            req.user.id,
            params.workspaceId,
            params.limit, 
            params.channelId
        );

        // Construct the prompt with context
        const contextMessages = messages.map((msg) => 
            `[${msg.createdAt.toISOString()}] ${msg.username} (${msg.userId}) in channel ${msg.channelId}: ${msg.content}`
        ).join('\n');

        const prompt = `Based on the following conversation context, please answer this question: "${params.query}"\n\nContext:\n${contextMessages}\n\nPlease provide a clear and concise answer based on the context provided. If the context doesn't contain enough information to answer the question fully, please state that.`;

        // Get AI response
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "developer", content: "You are a helpful assistant answering questions based on chat history context. Provide clear, concise answers based only on the context provided. If you are not sure, say I'm sorry I can't help you with that " },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 500
        });

        const aiResponse: AskAiResponse = {
            answer: completion.choices[0].message.content || "No answer generated",
            relevantMessages: messages.map((msg) => ({
                id: String(msg.id),
                content: msg.content,
                createdAt: msg.createdAt.toISOString(),
                userId: msg.userId,
                username: msg.username,
                channelId: msg.channelId,
                updatedAt: msg.updatedAt.toISOString(),
                similarity: msg.similarity
            }))
        };

        // Validate response matches schema
        AskAiResponseSchema.parse(aiResponse);
        res.json(aiResponse);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
            return;
        }
        console.error('Error in ask-ai:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

router.get('/ask-ai', authenticate, askAiHandler);

export default router; 