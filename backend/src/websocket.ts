// src/websocket.ts
import { WebSocketServer } from "ws";
import * as http from "http";
import { setupWSConnection } from "y-websocket/bin/utils";


/**
 * Creates a WebSocket server that works with Yjs.
 * This enables real-time shared editing between users
 * Every collaboration “room” is created automatically by Yjs. Each client (browser) connects to a room via ws://localhost:3000/<room>.
 */

export function createWSServer(server: http.Server) {
  const wss = new WebSocketServer({ noServer: true });

  // Connect Yjs to incoming WebSocket upgrades
  server.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
      });
  });

  wss.on("connection", (ws, req) => {
    setupWSConnection(ws, req);
  });

  console.log("✅ WebSocket/Yjs server initialized");
}
