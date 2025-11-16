"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWSServer = createWSServer;
// src/websocket.ts
const ws_1 = require("ws");
const utils_1 = require("y-websocket/bin/utils");
/**
 * Creates a WebSocket server that works with Yjs.
 * This enables real-time shared editing between users
 * Every collaboration “room” is created automatically by Yjs. Each client (browser) connects to a room via ws://localhost:3000/<room>.
 */
function createWSServer(server) {
    const wss = new ws_1.WebSocketServer({ noServer: true });
    // Connect Yjs to incoming WebSocket upgrades
    server.on("upgrade", (req, socket, head) => {
        // Example URL pattern: ws://localhost:3000/room123
        const handle = (ws) => {
            (0, utils_1.setupWSConnection)(ws, req);
        };
        wss.handleUpgrade(req, socket, head, handle);
    });
    console.log("✅ WebSocket/Yjs server initialized");
}
