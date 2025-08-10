// Base WebSocket functionality shared between controller and client
import { CONSTANTS } from './constants.js';

export class WebSocketBase {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = CONSTANTS.CONNECTION.RECONNECT_DELAY;
        this.messageHandlers = new Map();
        this.connectionCallbacks = {
            onOpen: null,
            onClose: null,
            onError: null,
            onMessage: null
        };
    }
    
    // Register message handler for specific message type
    onMessage(type, handler) {
        if (!this.messageHandlers.has(type)) {
            this.messageHandlers.set(type, []);
        }
        this.messageHandlers.get(type).push(handler);
    }
    
    // Set connection event callbacks
    onOpen(callback) { this.connectionCallbacks.onOpen = callback; }
    onClose(callback) { this.connectionCallbacks.onClose = callback; }
    onError(callback) { this.connectionCallbacks.onError = callback; }
    
    // Connect to WebSocket server
    connect(url = null) {
        if (!url) {
            const currentUrl = window.location.href;
            const urlObj = new URL(currentUrl);
            const wsProtocol = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
            url = `${wsProtocol}//${urlObj.host}`;
        }
        
        try {
            this.ws = new WebSocket(url);
            this.setupEventHandlers();
        } catch (error) {
            console.error('Error creating WebSocket:', error);
            if (this.connectionCallbacks.onError) {
                this.connectionCallbacks.onError(error);
            }
        }
    }
    
    // Set up WebSocket event handlers
    setupEventHandlers() {
        if (!this.ws) return;
        
        this.ws.addEventListener('open', (event) => {
            console.log('WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            if (this.connectionCallbacks.onOpen) {
                this.connectionCallbacks.onOpen(event);
            }
        });
        
        this.ws.addEventListener('message', async (event) => {
            try {
                const data = JSON.parse(event.data);
                await this.handleMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        });
        
        this.ws.addEventListener('close', (event) => {
            console.log('WebSocket disconnected:', event.code, event.reason);
            this.isConnected = false;
            
            if (this.connectionCallbacks.onClose) {
                this.connectionCallbacks.onClose(event);
            }
            
            // Auto-reconnect unless it was a normal closure
            if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                setTimeout(() => {
                    this.reconnectAttempts++;
                    console.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
                    this.connect();
                }, this.reconnectDelay);
            }
        });
        
        this.ws.addEventListener('error', (event) => {
            console.error('WebSocket error:', event);
            
            if (this.connectionCallbacks.onError) {
                this.connectionCallbacks.onError(event);
            }
        });
    }
    
    // Handle incoming message
    async handleMessage(data) {
        console.log('Received message:', data);
        
        // Call registered handlers for this message type
        if (this.messageHandlers.has(data.type)) {
            const handlers = this.messageHandlers.get(data.type);
            for (const handler of handlers) {
                try {
                    await handler(data);
                } catch (error) {
                    console.error(`Error in message handler for ${data.type}:`, error);
                }
            }
        }
        
        // Call global message callback if set
        if (this.connectionCallbacks.onMessage) {
            this.connectionCallbacks.onMessage(data);
        }
    }
    
    // Send message to server
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
            return true;
        } else {
            console.warn('WebSocket not connected, cannot send message:', message);
            return false;
        }
    }
    
    // Send message with specific type
    sendMessage(type, payload = {}) {
        return this.send({ type, ...payload });
    }
    
    // Close connection
    disconnect() {
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
        }
    }
    
    // Get connection state
    getState() {
        if (!this.ws) return 'disconnected';
        
        switch (this.ws.readyState) {
            case WebSocket.CONNECTING: return 'connecting';
            case WebSocket.OPEN: return 'open';
            case WebSocket.CLOSING: return 'closing';
            case WebSocket.CLOSED: return 'closed';
            default: return 'unknown';
        }
    }
    
    // Manual reconnect
    reconnect() {
        this.disconnect();
        this.reconnectAttempts = 0;
        setTimeout(() => this.connect(), 1000);
    }
}