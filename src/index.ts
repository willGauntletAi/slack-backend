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
import dmRouter from "./routes/dm";

const app = express();
const server = createServer(app);

console.log('Initializing WebSocket server');
const wsHandler = new WebSocketHandler(server);

console.log('Initializing Redis service in index.ts');
initializeRedis(wsHandler);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRouter);
app.use('/user', usersRouter);
app.use('/workspace', workspacesRouter);
app.use('/channel', channelsRouter);
app.use('/message', messagesRouter);
app.use('/dm', dmRouter);

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
