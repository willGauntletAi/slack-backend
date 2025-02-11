import 'dotenv/config';
import { writeFileSync, copyFileSync } from 'fs';
import { join } from 'path';
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Extend Zod with OpenAPI functionality
extendZodWithOpenApi(z);

// Import all routes to process their OpenAPI registrations
import '../src/routes/auth';
import '../src/routes/users';
import '../src/routes/workspaces';
import '../src/routes/channels';
import '../src/routes/messages';
import '../src/routes/files';
import '../src/routes/search';
import '../src/routes/embeddings';

import { generateOpenApiDocument } from '../src/utils/openapi';

// Generate the OpenAPI document
const openApiDocument = generateOpenApiDocument();

// Convert to JSON with pretty formatting
const openApiJson = JSON.stringify(openApiDocument, null, 2);

// Save to the frontend project
const outputPath = join(__dirname, '../../slack_frontend/openapi.json');
writeFileSync(outputPath, openApiJson);

// Also save WebSocket types
import { clientMessageSchema, serverMessageSchema } from '../src/websocket/types';

console.log(`OpenAPI document saved to ${outputPath}`);

const wsTypesPath = join(__dirname, '../../slack_frontend/ws-types.ts');
copyFileSync(join(__dirname, '../src/websocket/types.ts'), wsTypesPath);

console.log(`WebSocket types saved to ${wsTypesPath}`);

process.exit(0);