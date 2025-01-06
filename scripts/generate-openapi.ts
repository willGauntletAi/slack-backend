import 'dotenv/config';
import { writeFileSync } from 'fs';
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
import '../src/routes/dm';

import { generateOpenApiDocument } from '../src/utils/openapi';

// Generate the OpenAPI document
const openApiDocument = generateOpenApiDocument();

// Convert to JSON with pretty formatting
const openApiJson = JSON.stringify(openApiDocument, null, 2);

// Save to the frontend project
const outputPath = join(__dirname, '../../slack-frontend/openapi.json');
writeFileSync(outputPath, openApiJson);

console.log(`OpenAPI document saved to ${outputPath}`); 