import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { OpenAPIObject } from 'openapi3-ts/oas30';

export const registry = new OpenAPIRegistry();

// Register security scheme
registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Enter your JWT token in the format: Bearer <token>',
});

export function generateOpenApiDocument(): OpenAPIObject {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  
  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'Slack Clone API',
      version: '1.0.0',
      description: 'API documentation for the Slack Clone project',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local development server',
      },
      {
        url: 'http://3.139.67.107',
        description: 'Production server',
      },
    ],
    tags: [
      {
        name: 'auth',
        description: 'Authentication endpoints',
      },
      {
        name: 'users',
        description: 'User management endpoints',
      },
      {
        name: 'workspaces',
        description: 'Workspace management endpoints',
      },
      {
        name: 'channels',
        description: 'Channel management endpoints',
      },
      {
        name: 'messages',
        description: 'Message management endpoints',
      },
      {
        name: 'files',
        description: 'File management endpoints',
      },
      {
        name: 'search',
        description: 'Search endpoints',
      },
      {
        name: 'embeddings',
        description: 'Message embedding generation endpoints',
      },
    ],
  });
}
