import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { verifyToken } from '../utils/jwt';
import { listUserChannels } from '../db/channels';
import { createWebsocketConnection, deleteWebsocketConnection, getConnectionsForChannel, deleteAllServerConnections } from '../db/websocket';
import { publishTyping, publishPresence } from '../services/redis';
import { v4 as uuidv4 } from 'uuid';
import {
  ServerMessage,
  serverMessageSchema,
  ConnectedMessage,
  ErrorMessage,
  clientMessageSchema,
  ClientMessage,
} from './types';
import { findUserById } from '../db/users';

interface WebSocketWithUser extends WebSocket {
  userId?: string;
  username?: string;
  connectionId?: string;
}

export class WebSocketHandler {
  private wss: WebSocketServer;
  private serverId: string;
  private connections: Map<string, WebSocketWithUser> = new Map();

  constructor(server: Server) {
    this.serverId = uuidv4();
    this.wss = new WebSocketServer({ server });
    this.setupWebSocketServer();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', async (ws: WebSocketWithUser, request) => {
      try {
        // Extract token from query string
        const url = new URL(request.url || '', 'ws://localhost');
        const token = url.searchParams.get('token');

        if (!token) {
          this.sendError(ws, 'Token required');
          ws.close(1008, 'Token required');
          return;
        }

        // Verify token and get user ID
        try {
          const payload = await verifyToken(token);
          ws.userId = payload.userId;
          ws.username = (await findUserById(ws.userId))?.username;
          // Record connection in database and store connection ID
          ws.connectionId = await createWebsocketConnection(ws.userId, this.serverId);
          this.connections.set(ws.connectionId, ws);

          // Publish presence event for new connection
          await publishPresence({
            userId: ws.userId,
            username: ws.username!,
            status: 'online'
          });
        } catch (error) {
          this.sendError(ws, 'Invalid token');
          ws.close(1008, 'Invalid token');
          return;
        }

        // Handle incoming messages
        ws.on('message', (data: string) => {
          try {
            const message = JSON.parse(data);
            const validatedMessage = clientMessageSchema.safeParse(message);

            if (!validatedMessage.success) {
              this.sendError(ws, 'Invalid message format');
              return;
            }

            this.handleMessage(ws, validatedMessage.data);
          } catch (error) {
            this.sendError(ws, 'Invalid message format');
          }
        });

        // Handle client disconnection
        ws.on('close', async () => {
          if (ws.connectionId) {
            // Remove from connections map
            this.connections.delete(ws.connectionId);
            // Remove from database using connection ID
            await deleteWebsocketConnection(ws.connectionId);

            // Publish presence event for disconnection
            if (ws.userId && ws.username) {
              await publishPresence({
                userId: ws.userId,
                username: ws.username,
                status: 'offline'
              });
            }
          }
        });

        // Send initial connection success message
        this.sendMessage(ws, {
          type: 'connected',
          userId: ws.userId,
        });
      } catch (error) {
        ws.close(1011, 'Internal server error');
      }
    });
  }

  private async handleMessage(ws: WebSocketWithUser, message: ClientMessage) {
    if (!ws.userId) {
      this.sendError(ws, 'Not authenticated');
      return;
    }

    switch (message.type) {
      case 'typing':
        await publishTyping({
          channelId: message.channelId,
          userId: ws.userId,
          username: ws.username!,
        });
        break;
      default:
        console.log('Unhandled message type:', message.type);
    }
  }

  private sendMessage(ws: WebSocket, message: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      const validatedMessage = serverMessageSchema.safeParse(message);
      if (validatedMessage.success) {
        ws.send(JSON.stringify(validatedMessage.data));
      } else {
        console.error('Invalid server message:', validatedMessage.error);
      }
    }
  }

  private sendError(ws: WebSocket, error: string) {
    const errorMessage: ErrorMessage = { error };
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(errorMessage));
    }
  }

  public async broadcastToChannel(channelId: string, message: ServerMessage) {
    const connections = await getConnectionsForChannel(channelId, this.serverId);
    for (const connection of connections) {
      const ws = this.connections.get(connection.connection_id);
      if (ws) {
        this.sendMessage(ws, message);
      } else {
        console.error(`Connection ${connection.connection_id} not found in memory`);
      }
    }
  }

  public broadcastToAll(message: ServerMessage) {
    for (const ws of this.connections.values()) {
      this.sendMessage(ws, message);
    }
  }

  public async cleanup() {
    console.log('Cleaning up WebSocket connections...');

    // Close all websocket connections
    for (const ws of this.connections.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1001, 'Server shutting down');
      }
    }

    // Clear the connections map
    this.connections.clear();

    // Remove all connections for this server from the database
    await deleteAllServerConnections(this.serverId);

    // Close the WebSocket server
    this.wss.close();

    console.log('WebSocket cleanup complete');
  }
} 