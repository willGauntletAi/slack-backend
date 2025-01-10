import 'dotenv/config';
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketHandler } from "./websocket/server";
import { initializeRedis } from "./services/redis";
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import workspacesRouter from "./routes/workspaces";
import channelsRouter from "./routes/channels";
import messagesRouter from "./routes/messages";
import filesRouter from "./routes/files";
import searchRouter from "./routes/search";
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import swaggerUi from 'swagger-ui-express';
import { registry, generateOpenApiDocument } from './utils/openapi';

extendZodWithOpenApi(z);
const app = express();
const server = createServer(app);

console.log('Initializing WebSocket server');
const wsHandler = new WebSocketHandler(server);

console.log('Initializing Redis service in index.ts');
initializeRedis(wsHandler);

// Middleware
app.use(cors());
app.use(express.json());

// Serve OpenAPI documentation
const openApiDocument = generateOpenApiDocument();
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

// Routes
app.use('/auth', authRouter);
app.use('/user', usersRouter);
app.use('/workspace', workspacesRouter);
app.use('/channel', channelsRouter);
app.use('/message', messagesRouter);
app.use('/file', filesRouter);
app.use('/search', searchRouter);

const port = process.env.PORT || 3000;
const httpServer = server.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`API documentation available at http://localhost:${port}/api-docs`);
});

// Graceful shutdown handlers
async function shutdown(signal: string) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Cleanup websocket connections
  await wsHandler.cleanup();

  // Close HTTP server
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // If server hasn't closed in 10 seconds, force exit
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
