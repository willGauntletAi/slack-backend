import express from "express";
import cors from "cors";
import "dotenv/config";
import { env } from "./env";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import swaggerUi from 'swagger-ui-express';
import { generateOpenApiDocument } from './utils/openapi';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

extendZodWithOpenApi(z);

// Import routes
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import workspaceRoutes from "./routes/workspaces";
import channelRoutes from "./routes/channels";
import messageRoutes from "./routes/messages";
import dmRoutes from "./routes/dm";

const app = express();
const port = env.PORT;

// Create HTTP server instance
const server = createServer(app);

// Create WebSocket server instance
const wss = new WebSocketServer({ server });

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');

  ws.on('message', (message) => {
    // Handle incoming messages
    console.log('received: %s', message);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve OpenAPI documentation
const openApiDocument = generateOpenApiDocument();
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

// Routes
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/workspace', workspaceRoutes);
app.use('/channel', channelRoutes);
app.use('/message', messageRoutes);
app.use('/dm', dmRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ status: "ok" });
});

// Use server.listen instead of app.listen
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`API documentation available at http://localhost:${port}/docs`);
  console.log(`WebSocket server is running on ws://localhost:${port}`);
});
