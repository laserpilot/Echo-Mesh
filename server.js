// server.js - Node.js server code
const { performance } = require('perf_hooks');
const { randomUUID } = require('crypto');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Log incoming requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Add a simple API route to check server is responding
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Store connected clients
// Store connected clients
const clients = new Map(); // Maps WebSocket to a client object { id, ws }

// Utility function to send to a specific client
const sendToClient = (clientId, message) => {
  for (const client of clients.values()) {
    if (client.id === clientId) {
      try {
        client.ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error(`Error sending message to client ${clientId}:`, error);
        return false;
      }
    }
  }
  console.log(`Client ${clientId} not found in clients map`);
  return false;
};

// Utility function to broadcast to all clients
const broadcast = (message, excludeId = null) => {
  for (const client of clients.values()) {
    if (excludeId === null || client.id !== excludeId) {
      client.ws.send(JSON.stringify(message));
    }
  }
};

// Get all connected client IDs
const getClientIds = () => {
  return Array.from(clients.values()).map(c => c.id);
};

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  // When a client connects, it can either be new or reconnecting with an ID.
  // We will wait for its first message.

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`Received message:`, data);

      // The first message from a client MUST be 'register'
      if (data.type === 'register') {
        let clientId = data.id;
        let isNew = false;

        // If the client has no ID, or its ID is not in our list, it's a new client.
        if (!clientId || ![...clients.values()].some(c => c.id === clientId)) {
          clientId = randomUUID();
          isNew = true;
        }

        const client = { id: clientId, ws: ws };
        clients.set(ws, client);

        console.log(`Client registered with ID ${clientId} (${clients.size} total connected). New: ${isNew}`);

        // Send the client its definitive ID
        ws.send(JSON.stringify({
          type: 'id',
          id: clientId
        }));

        // Notify all other clients about this connection
        broadcast({
          type: 'clientConnected',
          id: clientId
        }, clientId);

        // Remove the register listener and add the general message handler
        ws.removeListener('message', ws.listeners('message')[0]);
        ws.on('message', createMessageHandler(clientId));

      } else {
        // If the first message isn't register, ask them to register.
        ws.send(JSON.stringify({ type: 'error', message: 'Please register first.' }));
      }

    } catch (e) {
      console.log(`Invalid message from connecting client:`, e.message);
    }
  });

  ws.on('close', () => {
    const client = clients.get(ws);
    if (client) {
      console.log(`Client ${client.id} disconnected`);
      broadcast({
        type: 'clientDisconnected',
        id: client.id
      });
      clients.delete(ws);
    }
  });

  ws.on('error', (error) => {
    const client = clients.get(ws);
    console.error(`WebSocket error for client ${client ? client.id : 'unknown'}:`, error);
  });
});

const createMessageHandler = (clientId) => (message) => {
  try {
    const data = JSON.parse(message.toString());
    console.log(`Received message from client ${clientId}:`, data);

    // Handle different message types
    switch (data.type) {
      case 'getClients':
        // Send the client list to the requester
        sendToClient(clientId, {
          type: 'clientList',
          clients: getClientIds()
        });
        break;

      case 'scheduleNote':
        if (data.clientId) {
          sendToClient(data.clientId, data);
        }
        break;

      case 'sync':
          // Immediately reply with the original t0 and the current server time
          ws.send(JSON.stringify({
            type: 'sync-reply',
            t0: data.t0,
            serverTime: performance.now()
          }));
          break;

      default:
        console.log(`Unknown message type from ${clientId}: ${data.type}`);
    }
  } catch (e) {
    console.log(`Invalid message from client ${clientId}:`, e.message);
  }
};

// API routes for triggering sounds via HTTP (as alternative to WebSocket)
app.get('/api/trigger/:id/:sound', (req, res) => {
  const clientId = parseInt(req.params.id);
  const sound = req.params.sound;
  
  console.log(`HTTP request to trigger ${sound} on client ${clientId}`);
  
  const success = sendToClient(clientId, {
    type: 'triggerSound',
    clientId: clientId,
    sound: sound
  });
  
  res.json({ success, message: success ? 'Sound triggered' : 'Client not found' });
});

// API route for triggering a specific frequency note
app.get('/api/note/:id/:sound/:frequency', (req, res) => {
  const clientId = parseInt(req.params.id);
  const sound = req.params.sound;
  const frequency = parseFloat(req.params.frequency);
  
  console.log(`HTTP request to trigger ${sound} note at ${frequency}Hz on client ${clientId}`);
  
  const success = sendToClient(clientId, {
    type: 'triggerNote',
    clientId: clientId,
    sound: sound,
    frequency: frequency
  });
  
  res.json({ 
    success, 
    message: success ? `Note triggered at ${frequency}Hz` : 'Client not found' 
  });
});

app.get('/api/sequence/:sound/:delay', (req, res) => {
  const sound = req.params.sound;
  const delay = parseInt(req.params.delay);
  const clientIds = getClientIds().sort((a, b) => a - b);
  
  console.log(`HTTP request to play sequence with ${sound} sound and ${delay}ms delay`);
  
  clientIds.forEach((clientId, index) => {
    setTimeout(() => {
      sendToClient(clientId, {
        type: 'triggerSound',
        clientId: clientId,
        sound: sound
      });
    }, index * delay);
  });
  
  res.json({ success: true, clients: clientIds.length });
});

app.get('/api/clients', (req, res) => {
  res.json({ 
    clients: getClientIds(),
    count: clients.size
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log(`Open http://localhost:${PORT}/client.html for client page`);
  console.log(`Open http://localhost:${PORT}/controller.html for controller page`);
  
  // Print local IP addresses for easy connection
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  
  console.log('\nAvailable IP addresses to connect from other devices:');
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`http://${net.address}:${PORT}/client.html`);
      }
    }
  }
});