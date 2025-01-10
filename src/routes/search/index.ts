import { Router } from 'express';
import { z } from 'zod';
import type { RequestHandler } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { registry } from '../../utils/openapi';
import { SearchRequest, SearchResponse, SearchResponseSchema } from './types';
import { ErrorResponse, ErrorResponseSchema } from '../channels/types';
import { searchMessages } from '../../db/search';

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

export default router; 