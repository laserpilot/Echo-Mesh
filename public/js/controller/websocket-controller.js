// WebSocket server controller for Echo Mesh
import { WebSocketBase } from '../shared/websocket-base.js';
import { CONSTANTS } from '../shared/constants.js';

export class WebSocketController extends WebSocketBase {
    constructor() {
        super();
        this.clients = new Map();
        this.serverTimeOffset = 0;
        this.serverStatus = 'disconnected';
        this.statusCallbacks = [];
        this.clientUpdateCallbacks = [];
    }
    
    // Connect to controller WebSocket
    async connectAsController() {
        this.connect();
        
        this.onOpen((event) => {
            console.log('Controller WebSocket connected');
            this.serverStatus = 'connected';
            this.notifyStatusCallbacks('connected');
        });
        
        this.onClose((event) => {
            console.log('Controller WebSocket disconnected');
            this.serverStatus = 'disconnected';
            this.clients.clear();
            this.notifyStatusCallbacks('disconnected');
            this.notifyClientUpdateCallbacks();
        });
        
        this.onError((event) => {
            console.error('Controller WebSocket error:', event);
            this.serverStatus = 'error';
            this.notifyStatusCallbacks('error');
        });
        
        this.setupControllerMessageHandlers();
    }
    
    // Set up controller-specific message handlers
    setupControllerMessageHandlers() {
        // Client management
        this.onMessage('clientConnected', (data) => {
            this.handleClientConnected(data);
        });
        
        this.onMessage('clientDisconnected', (data) => {
            this.handleClientDisconnected(data);
        });
        
        this.onMessage('clientsUpdate', (data) => {
            this.handleClientsUpdate(data);
        });
        
        // Sync responses
        this.onMessage(CONSTANTS.MESSAGE_TYPES.SYNC_REPLY, (data) => {
            this.handleSyncReply(data);
        });
    }
    
    // Handle client connected
    handleClientConnected(data) {
        if (data.client) {
            this.clients.set(data.client.id, data.client);
            console.log(`Client connected: ${data.client.id}`);
            this.notifyClientUpdateCallbacks();
        }
    }
    
    // Handle client disconnected
    handleClientDisconnected(data) {
        if (data.clientId) {
            this.clients.delete(data.clientId);
            console.log(`Client disconnected: ${data.clientId}`);
            this.notifyClientUpdateCallbacks();
        }
    }
    
    // Handle clients update
    handleClientsUpdate(data) {
        if (data.clients && Array.isArray(data.clients)) {
            this.clients.clear();
            data.clients.forEach(client => {
                this.clients.set(client.id, client);
            });
            console.log(`Clients updated: ${this.clients.size} clients`);
            this.notifyClientUpdateCallbacks();
        }
    }
    
    // Handle sync reply
    handleSyncReply(data) {
        const t1 = performance.now();
        const rtt = t1 - data.t0;
        const estimatedServerTime = data.serverTime + rtt / 2;
        this.serverTimeOffset = estimatedServerTime - t1;
        
        console.log(`Controller sync - RTT: ${rtt.toFixed(2)}ms, Offset: ${this.serverTimeOffset.toFixed(2)}ms`);
    }
    
    // Send command to trigger sound on specific clients
    triggerSound(clientIds, soundType, frequency = null) {
        return this.sendMessage('triggerSound', {
            clients: Array.isArray(clientIds) ? clientIds : [clientIds],
            sound: soundType,
            frequency: frequency
        });
    }
    
    // Send command to trigger sound on all clients
    triggerSoundAll(soundType, frequency = null) {
        return this.sendMessage('triggerSoundAll', {
            sound: soundType,
            frequency: frequency
        });
    }
    
    // Schedule a note to be played
    scheduleNote(clientIds, soundType, frequency, playTime, adsr = null, lfo = null, pan = 0) {
        return this.sendMessage('scheduleNote', {
            clients: Array.isArray(clientIds) ? clientIds : [clientIds],
            sound: soundType,
            frequency: frequency,
            playTime: playTime,
            adsr: adsr || CONSTANTS.AUDIO.DEFAULT_ADSR,
            lfo: lfo || CONSTANTS.AUDIO.DEFAULT_LFO,
            pan: pan
        });
    }
    
    // Start metronome
    startMetronome(bpm = 120) {
        return this.sendMessage('startMetronome', { bpm });
    }
    
    // Stop metronome
    stopMetronome() {
        return this.sendMessage('stopMetronome');
    }
    
    // Set volume for specific clients
    setVolume(clientIds, volume) {
        return this.sendMessage('setVolume', {
            clients: Array.isArray(clientIds) ? clientIds : [clientIds],
            volume: volume
        });
    }
    
    // Set master volume for all clients
    setMasterVolume(volume) {
        return this.sendMessage('setMasterVolume', { volume });
    }
    
    // Play sequence with delay
    playSequence(clientIds, soundType, delayMs = 500) {
        return this.sendMessage('playSequence', {
            clients: Array.isArray(clientIds) ? clientIds : [clientIds],
            sound: soundType,
            delay: delayMs
        });
    }
    
    // Play reverse sequence
    playReverseSequence(clientIds, soundType, delayMs = 500) {
        return this.sendMessage('playReverseSequence', {
            clients: Array.isArray(clientIds) ? clientIds : [clientIds],
            sound: soundType,
            delay: delayMs
        });
    }
    
    // Start chord progression
    startChordProgression(progression, bpm = 120, settings = {}) {
        return this.sendMessage('startChordProgression', {
            progression,
            bpm,
            settings
        });
    }
    
    // Stop chord progression
    stopChordProgression() {
        return this.sendMessage('stopChordProgression');
    }
    
    // Request client sync
    requestClientSync() {
        return this.sendMessage(CONSTANTS.MESSAGE_TYPES.SYNC, {
            t0: performance.now()
        });
    }
    
    // Get connected clients
    getClients() {
        return Array.from(this.clients.values());
    }
    
    // Get client by ID
    getClient(clientId) {
        return this.clients.get(clientId);
    }
    
    // Get client count
    getClientCount() {
        return this.clients.size;
    }
    
    // Register status change callback
    onStatusChange(callback) {
        this.statusCallbacks.push(callback);
    }
    
    // Register client update callback
    onClientUpdate(callback) {
        this.clientUpdateCallbacks.push(callback);
    }
    
    // Notify status callbacks
    notifyStatusCallbacks(status) {
        this.statusCallbacks.forEach(callback => {
            try {
                callback(status, {
                    serverStatus: this.serverStatus,
                    clientCount: this.clients.size
                });
            } catch (error) {
                console.error('Error in status callback:', error);
            }
        });
    }
    
    // Notify client update callbacks
    notifyClientUpdateCallbacks() {
        const clients = this.getClients();
        this.clientUpdateCallbacks.forEach(callback => {
            try {
                callback(clients);
            } catch (error) {
                console.error('Error in client update callback:', error);
            }
        });
    }
    
    // Get server status
    getServerStatus() {
        return {
            status: this.serverStatus,
            clientCount: this.clients.size,
            isConnected: this.isConnected,
            offset: this.serverTimeOffset
        };
    }
    
    // Clean up resources
    destroy() {
        this.clients.clear();
        this.statusCallbacks = [];
        this.clientUpdateCallbacks = [];
        this.disconnect();
    }
}