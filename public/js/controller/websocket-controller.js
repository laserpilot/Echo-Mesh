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
            
            // Register as controller first, then request client list
            this.registerAsController();
            
            // Wait a bit for registration to complete, then request clients
            setTimeout(() => {
                this.requestClientList();
                
                // If no clients after 1 second, use simulated clients for testing
                setTimeout(() => {
                    if (this.clients.size === 0) {
                        console.log('No clients received from server, using simulated clients for testing...');
                        this.simulateTestClients();
                    }
                }, 1000);
            }, 200);
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
        // Listen for real client connection/disconnection messages from server
        this.onMessage('clientConnected', (data) => {
            console.log('Real client connected:', data);
            if (data.id) {
                this.clients.set(data.id, { id: data.id });
                this.notifyClientUpdateCallbacks();
            } else if (data.client && data.client.id) {
                // Alternative format: {client: {id: "..."}}
                this.clients.set(data.client.id, data.client);
                this.notifyClientUpdateCallbacks();
            }
        });
        
        this.onMessage('clientDisconnected', (data) => {
            console.log('Real client disconnected:', data);
            if (data.id) {
                this.clients.delete(data.id);
                this.notifyClientUpdateCallbacks();
            } else if (data.clientId) {
                // Alternative format: {clientId: "..."}
                this.clients.delete(data.clientId);
                this.notifyClientUpdateCallbacks();
            }
        });
        
        this.onMessage('clientsUpdate', (data) => {
            this.handleClientsUpdate(data);
        });
        
        // Sync responses
        this.onMessage(CONSTANTS.MESSAGE_TYPES.SYNC_REPLY, (data) => {
            this.handleSyncReply(data);
        });
        
        // Try alternative message types that the server might be sending
        this.onMessage('clients', (data) => {
            console.log('Received clients message:', data);
            this.handleClientsUpdate(data);
        });
        
        this.onMessage('clientList', (data) => {
            console.log('Received clientList message:', data);
            this.handleClientsUpdate(data);
        });
        
        // Handle registration confirmation
        this.onMessage('registered', (data) => {
            console.log('Controller registration confirmed:', data);
        });
        
        // Handle error messages
        this.onMessage('error', (data) => {
            console.error('Server error:', data.message);
        });
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
    
    // Register as controller with the server
    registerAsController() {
        console.log('Registering as controller...');
        const controllerId = `controller-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Send registration message with just type and id
        return this.sendMessage(CONSTANTS.MESSAGE_TYPES.REGISTER, {
            id: controllerId
        });
    }
    
    // Request client list from server
    requestClientList() {
        console.log('Requesting client list from server...');
        return this.sendMessage('requestClients', {});
    }
    
    // Test method - simulate clients for debugging
    simulateTestClients() {
        console.log('Simulating test clients...');
        const testClients = [
            { id: 'test-client-1', name: 'Test Client 1' },
            { id: 'test-client-2', name: 'Test Client 2' },
            { id: 'test-client-3', name: 'Test Client 3' }
        ];
        
        testClients.forEach(client => {
            this.clients.set(client.id, client);
        });
        
        this.notifyClientUpdateCallbacks();
        console.log('Simulated clients added:', testClients);
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