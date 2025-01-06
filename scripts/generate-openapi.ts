import { writeFileSync } from 'fs';
import { join } from 'path';
import { generateOpenApiDocument } from '../src/utils/openapi';

// Generate the OpenAPI document
const openApiDocument = generateOpenApiDocument();

// Convert to JSON with pretty formatting
const openApiJson = JSON.stringify(openApiDocument, null, 2);

// Save to the frontend project
const outputPath = join(__dirname, '../../slack-frontend/openapi.json');
writeFileSync(outputPath, openApiJson);

console.log(`OpenAPI document saved to ${outputPath}`); 