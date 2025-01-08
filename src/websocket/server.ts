import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { verifyToken } from '../utils/jwt';
import { listUserChannels } from '../db/channels';
import {
  ClientMessage,
  ServerMessage,
  clientMessageSchema,
  serverMessageSchema,
  ConnectedMessage,
  SubscribedMessage,
  UnsubscribedMessage,
  ErrorMessage,
} from './types';

interface WebSocketWithUser extends WebSocket {
  userId?: string;
  channelSubscriptions?: Set<string>;
}

export class WebSocketHandler {
  private wss: WebSocketServer;
  private channelSubscriptions: Map<string, Set<WebSocketWithUser>> = new Map();

  constructor(server: Server) {
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
          ws.channelSubscriptions = new Set();
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
        ws.on('close', () => {
          if (ws.channelSubscriptions) {
            for (const channelId of ws.channelSubscriptions) {
              this.unsubscribeFromChannel(ws, channelId);
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

  private handleMessage(ws: WebSocketWithUser, message: ClientMessage) {
    switch (message.type) {
      case 'subscribe':
        this.handleSubscribe(ws, message.workspaceId);
        break;
      case 'unsubscribe':
        this.handleUnsubscribe(ws, message.workspaceId);
        break;
    }
  }

  private async handleSubscribe(ws: WebSocketWithUser, workspaceId: string) {
    if (!ws.userId) {
      this.sendError(ws, 'Not authenticated');
      return;
    }

    try {
      // Get all channels the user has access to in the workspace
      const channels = await listUserChannels(ws.userId, workspaceId);

      // Subscribe to each channel
      for (const channel of channels) {
        if (!ws.channelSubscriptions) {
          ws.channelSubscriptions = new Set();
        }

        // Add channel to client's subscriptions
        ws.channelSubscriptions.add(channel.id);

        // Add client to channel's subscribers
        let subscribers = this.channelSubscriptions.get(channel.id);
        if (!subscribers) {
          subscribers = new Set();
          this.channelSubscriptions.set(channel.id, subscribers);
        }
        subscribers.add(ws);
      }

      // Send success message
      this.sendMessage(ws, {
        type: 'subscribed',
        workspaceId,
      });
    } catch (error) {
      this.sendError(ws, 'Failed to subscribe to workspace');
    }
  }

  private async handleUnsubscribe(ws: WebSocketWithUser, workspaceId: string) {
    if (!ws.userId) {
      this.sendError(ws, 'Not authenticated');
      return;
    }

    try {
      // Get all channels the user has access to in the workspace
      const channels = await listUserChannels(ws.userId, workspaceId);

      // Unsubscribe from each channel
      for (const channel of channels) {
        this.unsubscribeFromChannel(ws, channel.id);
      }

      // Send success message
      this.sendMessage(ws, {
        type: 'unsubscribed',
        workspaceId,
      });
    } catch (error) {
      this.sendError(ws, 'Failed to unsubscribe from workspace');
    }
  }

  private unsubscribeFromChannel(ws: WebSocketWithUser, channelId: string) {
    // Remove channel from client's subscriptions
    ws.channelSubscriptions?.delete(channelId);

    // Remove client from channel's subscribers
    const subscribers = this.channelSubscriptions.get(channelId);
    if (subscribers) {
      subscribers.delete(ws);
      if (subscribers.size === 0) {
        this.channelSubscriptions.delete(channelId);
      }
    }
  }

  private sendMessage(ws: WebSocket, message: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      const validatedMessage = serverMessageSchema.safeParse(message);
      if (validatedMessage.success) {
        ws.send(JSON.stringify(validatedMessage.data));
      }
    }
  }

  private sendError(ws: WebSocket, error: string) {
    const errorMessage: ErrorMessage = { error };
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(errorMessage));
    }
  }

  public broadcastToChannel(channelId: string, message: ServerMessage) {
    const subscribers = this.channelSubscriptions.get(channelId);
    if (subscribers) {
      const validatedMessage = serverMessageSchema.safeParse(message);
      if (validatedMessage.success) {
        const messageStr = JSON.stringify(validatedMessage.data);
        subscribers.forEach((client: WebSocketWithUser) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
          }
        });
      }
    }
  }
} 