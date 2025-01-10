import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { verifyToken } from '../utils/jwt';
import { listUserChannels, updateLastReadMessage } from '../db/channels';
import { createWebsocketConnection, deleteWebsocketConnection, getConnectionsForChannel, deleteAllServerConnections, getUserPresenceStatus } from '../db/websocket';
import { publishTyping, publishPresence } from '../services/redis';
import { v4 as uuidv4 } from 'uuid';
import {
  ServerMessage,
  serverMessageSchema,
  ConnectedMessage,
  ErrorMessage,
  clientMessageSchema,
  ClientMessage,
  presenceMessageSchema,
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
  private presenceSubscriptions: Map<string, Set<string>> = new Map(); // userId -> Set of connectionIds

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
          const user = await findUserById(ws.userId);
          if (user?.override_status) {
            // Don't publish online status if user has an override
            return;
          }
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
            // Clean up presence subscriptions
            this.cleanupPresenceSubscriptions(ws.connectionId);
            // Remove from database using connection ID
            await deleteWebsocketConnection(ws.connectionId);

            if (ws.userId && ws.username) {
              const user = await findUserById(ws.userId);
              if (user?.override_status) {
                // Don't publish offline status if user has an override
                return;
              }
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
    if (!ws.userId || !ws.connectionId) {
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
      case 'mark_read':
        try {
          await updateLastReadMessage(message.channelId, ws.userId, message.messageId);
        } catch (error) {
          if (error instanceof Error) {
            this.sendError(ws, error.message);
          }
        }
        break;
      case 'subscribe_to_presence':
        this.handlePresenceSubscription(ws.connectionId, message.userId);
        break;
      case 'unsubscribe_from_presence':
        this.handlePresenceUnsubscription(ws.connectionId, message.userId);
        break;
      default:
        console.log('Unhandled message type:', message);
    }
  }

  private async handlePresenceSubscription(connectionId: string, targetUserId: string) {
    if (!this.presenceSubscriptions.has(targetUserId)) {
      this.presenceSubscriptions.set(targetUserId, new Set());
    }
    this.presenceSubscriptions.get(targetUserId)!.add(connectionId);

    // Send initial presence state
    const ws = this.connections.get(connectionId);
    if (ws && ws.userId) {
      const targetUser = await findUserById(targetUserId);
      const status = await getUserPresenceStatus(targetUserId);

      if (targetUser) {
        const presenceMessage: ServerMessage = {
          type: 'presence',
          userId: targetUserId,
          username: targetUser.username,
          status,
        };
        this.sendMessage(ws, presenceMessage);
      }
    }
  }

  private handlePresenceUnsubscription(connectionId: string, targetUserId: string) {
    const subscriptions = this.presenceSubscriptions.get(targetUserId);
    if (subscriptions) {
      subscriptions.delete(connectionId);
      if (subscriptions.size === 0) {
        this.presenceSubscriptions.delete(targetUserId);
      }
    }
  }

  private cleanupPresenceSubscriptions(connectionId: string) {
    for (const [userId, subscriptions] of this.presenceSubscriptions.entries()) {
      subscriptions.delete(connectionId);
      if (subscriptions.size === 0) {
        this.presenceSubscriptions.delete(userId);
      }
    }
  }

  public broadcastPresenceUpdate(userId: string, message: ServerMessage) {
    const subscriptions = this.presenceSubscriptions.get(userId);
    if (!subscriptions) return;

    for (const connectionId of subscriptions) {
      const ws = this.connections.get(connectionId);
      if (ws) {
        this.sendMessage(ws, message);
      }
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