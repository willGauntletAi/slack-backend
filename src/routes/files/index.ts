import { Router } from 'express';
import { z } from 'zod';
import type { RequestHandler } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { registry } from '../../utils/openapi';
import { generateUploadUrl, generateDownloadUrl } from '../../utils/s3';
import {
    getUploadUrlSchema,
    UploadUrlSchema,
    DownloadUrlSchema,
    ErrorResponseSchema,
    GetUploadUrlRequest,
    UploadUrlResponse,
    DownloadUrlResponse,
    ErrorResponse,
} from './types';

const router = Router();

// POST /file/upload-url - Get a presigned URL for uploading a file
registry.registerPath({
    method: 'post',
    path: '/file/upload-url',
    tags: ['files'],
    summary: 'Get a presigned URL for uploading a file',
    security: [{ bearerAuth: [] }],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: getUploadUrlSchema,
                },
            },
        },
    },
    responses: {
        '200': {
            description: 'Upload URL generated successfully',
            content: {
                'application/json': {
                    schema: UploadUrlSchema,
                },
            },
        },
        '400': {
            description: 'Invalid request body',
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

const getUploadUrlHandler: RequestHandler<{}, UploadUrlResponse | ErrorResponse, GetUploadUrlRequest> = async (req: AuthRequest, res) => {
    try {
        if (!req.user?.id) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }

        const { fileName } = getUploadUrlSchema.parse(req.body);
        const { url, key } = await generateUploadUrl(fileName);
        res.json({ url, key });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.errors.map(e => e.message).join(', ') });
            return;
        }
        console.error('Get upload URL error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// GET /file/:key/download-url - Get a presigned URL for downloading a file
registry.registerPath({
    method: 'get',
    path: '/file/{key}/download-url',
    tags: ['files'],
    summary: 'Get a presigned URL for downloading a file',
    security: [{ bearerAuth: [] }],
    parameters: [
        {
            name: 'key',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'File key in S3',
        },
    ],
    responses: {
        '200': {
            description: 'Download URL generated successfully',
            content: {
                'application/json': {
                    schema: DownloadUrlSchema,
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
        '404': {
            description: 'File not found',
            content: {
                'application/json': {
                    schema: ErrorResponseSchema,
                },
            },
        },
    },
});

const getDownloadUrlHandler: RequestHandler<{ key: string }, DownloadUrlResponse | ErrorResponse> = async (req: AuthRequest, res) => {
    try {
        if (!req.user?.id) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }

        const url = await generateDownloadUrl(req.params.key);
        res.json({ url });
    } catch (error) {
        console.error('Get download URL error:', error);
        if (error instanceof Error && error.message === 'The specified key does not exist.') {
            res.status(404).json({ error: 'File not found' });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};

router.post('/upload-url', authenticate, getUploadUrlHandler);
router.get('/:key/download-url', authenticate, getDownloadUrlHandler);

export default router; 