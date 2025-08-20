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
        
        // Handle registration rejection
        this.onMessage('registrationRejected', (data) => {
            console.error('Controller registration rejected:', data.message);
            this.handleRegistrationRejection(data);
        });
    }
    
    
    // Handle registration rejection
    handleRegistrationRejection(data) {
        const message = data.message || 'Controller registration was rejected';
        
        // Stop any further reconnection attempts
        if (this.ws) {
            this.maxReconnectAttempts = 1; // Prevent auto-reconnection
        }
        
        if (data.reason === 'controllerExists') {
            // Show user-friendly error message
            this.showControllerExistsError();
        }
        
        this.serverStatus = 'rejected';
        this.notifyStatusCallbacks('rejected', data);
    }
    
    // Show error message when another controller exists
    showControllerExistsError() {
        // Create overlay if it doesn't exist
        let overlay = document.getElementById('controllerExistsOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'controllerExistsOverlay';
            overlay.className = 'controller-exists-overlay';
            overlay.innerHTML = `
                <div class="controller-exists-modal">
                    <h2>⚠️ Controller Already Active</h2>
                    <p>Another controller is already connected to this Echo Mesh network. Only one controller is allowed at a time.</p>
                    <div class="controller-exists-buttons">
                        <button onclick="location.reload()" class="retry-button">Retry Connection</button>
                        <button onclick="location.href='/'" class="home-button">Go Home</button>
                    </div>
                </div>
            `;
            
            // Add styles
            const style = document.createElement('style');
            style.textContent = `
                .controller-exists-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.8);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                    backdrop-filter: blur(5px);
                }
                
                .controller-exists-modal {
                    background: white;
                    padding: 40px;
                    border-radius: 20px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    text-align: center;
                    max-width: 400px;
                    margin: 20px;
                }
                
                .controller-exists-modal h2 {
                    margin: 0 0 20px 0;
                    color: #d32f2f;
                    font-size: 24px;
                }
                
                .controller-exists-modal p {
                    margin: 0 0 30px 0;
                    color: #666;
                    font-size: 16px;
                    line-height: 1.5;
                }
                
                .controller-exists-buttons {
                    display: flex;
                    gap: 15px;
                    justify-content: center;
                    flex-wrap: wrap;
                }
                
                .controller-exists-buttons button {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                
                .retry-button {
                    background: #2196F3;
                    color: white;
                }
                
                .retry-button:hover {
                    background: #1976D2;
                }
                
                .home-button {
                    background: #f5f5f5;
                    color: #333;
                }
                
                .home-button:hover {
                    background: #e0e0e0;
                }
            `;
            
            document.head.appendChild(style);
            document.body.appendChild(overlay);
        }
        
        overlay.style.display = 'flex';
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
    triggerSound(clientIds, soundType, frequency = null, lfoConfig = null, effectsConfig = null) {
        const message = {
            clients: Array.isArray(clientIds) ? clientIds : [clientIds],
            sound: soundType,
            frequency: frequency
        };
        
        // Add LFO configuration if provided
        if (lfoConfig && lfoConfig.enabled) {
            message.lfo = lfoConfig;
        }
        
        // Add effects configuration if provided  
        if (effectsConfig && effectsConfig.chain && effectsConfig.chain.length > 0) {
            message.effects = effectsConfig;
        }
        
        return this.sendMessage('triggerSound', message);
    }
    
    // Send command to trigger sound on all clients
    triggerSoundAll(soundType, frequency = null, lfoConfig = null, effectsConfig = null) {
        const message = {
            sound: soundType,
            frequency: frequency
        };
        
        // Add LFO configuration if provided
        if (lfoConfig && lfoConfig.enabled) {
            message.lfo = lfoConfig;
        }
        
        // Add effects configuration if provided  
        if (effectsConfig && effectsConfig.chain && effectsConfig.chain.length > 0) {
            message.effects = effectsConfig;
        }
        
        return this.sendMessage('triggerSoundAll', message);
    }
    
    // Schedule a note to be played
    scheduleNote(clientIds, soundType, frequency, playTime, adsr = null, lfo = null, pan = 0, effectsConfig = null) {
        const message = {
            clients: Array.isArray(clientIds) ? clientIds : [clientIds],
            sound: soundType,
            frequency: frequency,
            playTime: playTime,
            adsr: adsr || CONSTANTS.AUDIO.DEFAULT_ADSR,
            lfo: lfo || CONSTANTS.AUDIO.DEFAULT_LFO,
            pan: pan
        };
        
        // Add effects configuration if provided  
        if (effectsConfig && effectsConfig.chain && effectsConfig.chain.length > 0) {
            message.effects = effectsConfig;
        }
        
        return this.sendMessage('scheduleNote', message);
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
        
        // Send explicit controller registration
        return this.sendMessage(CONSTANTS.MESSAGE_TYPES.REGISTER, {
            id: null,
            clientType: 'controller'
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