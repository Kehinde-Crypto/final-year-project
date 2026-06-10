import { WebSocketServer } from 'ws';
import { config } from '../config.js';

/**
 * WebSocket emitter for real-time event broadcasting
 * Pushes events to connected frontend clients
 */
export class RealtimeEmitter {
  constructor() {
    this.wss = null;
    this.clients = new Set();
  }

  /**
   * Initialize WebSocket server
   */
  init() {
    this.wss = new WebSocketServer({ port: config.wsPort });

    this.wss.on('connection', (ws, req) => {
      console.log(`[Emitter] Client connected from ${req.socket.remoteAddress}`);
      this.clients.add(ws);

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log('[Emitter] Client disconnected');
      });

      ws.on('error', (error) => {
        console.error('[Emitter] WebSocket error:', error.message);
        this.clients.delete(ws);
      });

      // Send initial connection message
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to supply chain event stream',
        timestamp: new Date().toISOString(),
      }));
    });

    console.log(`[Emitter] WebSocket server listening on port ${config.wsPort}`);
    return this;
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcast(event) {
    const message = JSON.stringify({
      type: 'event',
      data: event,
      timestamp: new Date().toISOString(),
    });

    let sent = 0;
    for (const client of this.clients) {
      try {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(message);
          sent++;
        }
      } catch (error) {
        console.error('[Emitter] Error sending to client:', error.message);
      }
    }

    if (sent > 0) {
      console.log(`[Emitter] Broadcast to ${sent} client(s): ${event.type}`);
    }
  }

  /**
   * Broadcast anomaly alert
   */
  broadcastAnomaly(anomaly) {
    const message = JSON.stringify({
      type: 'anomaly',
      data: anomaly,
      timestamp: new Date().toISOString(),
    });

    for (const client of this.clients) {
      try {
        if (client.readyState === 1) {
          client.send(message);
        }
      } catch (error) {
        console.error('[Emitter] Error broadcasting anomaly:', error.message);
      }
    }
  }

  /**
   * Get connected client count
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Close server
   */
  close() {
    if (this.wss) {
      // Close all client connections
      for (const client of this.clients) {
        client.close();
      }
      this.wss.close();
      console.log('[Emitter] WebSocket server closed');
    }
  }
}
