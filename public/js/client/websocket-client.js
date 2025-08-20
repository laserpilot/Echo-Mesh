// WebSocket client for Echo Mesh client interface
import { WebSocketBase } from '../shared/websocket-base.js';
import { CONSTANTS } from '../shared/constants.js';

export class WebSocketClient extends WebSocketBase {
    constructor() {
        super();
        this.clientId = null;
        this.registrationRetries = 0;
        this.maxRegistrationRetries = CONSTANTS.UI.MAX_REGISTRATION_RETRIES;
        this.registrationCallbacks = [];
        this.statusCallbacks = [];
    }
    
    // Connect and register as a client
    async connectAndRegister() {
        this.connect();
        
        // Set up connection event handlers
        this.onOpen((event) => {
            console.log('WebSocket connected, attempting registration...');
            this.attemptRegistration();
        });
        
        this.onClose((event) => {
            this.notifyStatusCallbacks('disconnected', event);
            
            // Clear client ID if connection was closed unexpectedly
            if (event.code !== 1000) {
                console.log('Unexpected disconnection, clearing stored ID');
                localStorage.removeItem('echoMeshClientId');
                this.clientId = null;
                this.notifyRegistrationCallbacks(null);
            }
        });
        
        this.onError((event) => {
            this.notifyStatusCallbacks('error', event);
        });
        
        // Set up message handlers
        this.setupClientMessageHandlers();
    }
    
    // Set up client-specific message handlers
    setupClientMessageHandlers() {
        this.onMessage(CONSTANTS.MESSAGE_TYPES.ID, (data) => {
            this.handleIdAssignment(data);
        });
    }
    
    // Attempt client registration with retry logic
    attemptRegistration() {
        const storedId = localStorage.getItem('echoMeshClientId');
        
        // Validate stored ID before using it
        let validStoredId = null;
        if (storedId && storedId !== 'CONTROLL' && this.isValidUUID(storedId)) {
            validStoredId = storedId;
            console.log('Using stored client ID:', validStoredId);
        } else {
            if (storedId) {
                console.log('Invalid stored ID found, clearing:', storedId);
                localStorage.removeItem('echoMeshClientId');
            }
            console.log('No valid stored ID, requesting new one');
        }
        
        const doRegistration = () => {
            if (this.registrationRetries < this.maxRegistrationRetries && this.isConnected) {
                console.log(`Registration attempt ${this.registrationRetries + 1}/${this.maxRegistrationRetries}`);
                
                this.sendMessage(CONSTANTS.MESSAGE_TYPES.REGISTER, {
                    id: validStoredId,
                    clientType: 'client'
                });
                
                this.registrationRetries++;
                
                // Set timeout for retry if no response
                setTimeout(() => {
                    if (!this.clientId && this.isConnected) {
                        console.log('No registration response, retrying...');
                        doRegistration();
                    }
                }, CONSTANTS.UI.REGISTRATION_TIMEOUT);
            } else if (this.registrationRetries >= this.maxRegistrationRetries) {
                console.error('Registration failed after maximum retries');
                this.notifyStatusCallbacks('registrationFailed');
            }
        };
        
        this.registrationRetries = 0;
        doRegistration();
    }
    
    // Handle ID assignment from server
    handleIdAssignment(data) {
        if (data.id && data.id !== this.clientId && this.isValidUUID(data.id)) {
            this.clientId = data.id;
            localStorage.setItem('echoMeshClientId', this.clientId);
            
            console.log(`Assigned client ID: ${this.clientId}`);
            
            // Notify registration callbacks
            this.notifyRegistrationCallbacks(this.clientId);
            
            // Notify status callbacks
            this.notifyStatusCallbacks('registered', { clientId: this.clientId });
        } else if (data.id && !this.isValidUUID(data.id)) {
            console.error('Received invalid client ID from server:', data.id);
            // Clear any invalid stored ID and try to re-register
            localStorage.removeItem('echoMeshClientId');
            this.clientId = null;
        }
    }
    
    // Register callback for client ID assignment
    onRegistration(callback) {
        this.registrationCallbacks.push(callback);
        
        // If already registered, call immediately
        if (this.clientId) {
            callback(this.clientId);
        }
    }
    
    // Register callback for status changes
    onStatusChange(callback) {
        this.statusCallbacks.push(callback);
    }
    
    // Notify registration callbacks
    notifyRegistrationCallbacks(clientId) {
        this.registrationCallbacks.forEach(callback => {
            try {
                callback(clientId);
            } catch (error) {
                console.error('Error in registration callback:', error);
            }
        });
    }
    
    // Notify status callbacks
    notifyStatusCallbacks(status, data = null) {
        this.statusCallbacks.forEach(callback => {
            try {
                callback(status, data);
            } catch (error) {
                console.error('Error in status callback:', error);
            }
        });
    }
    
    // Get short client ID for display
    getShortClientId() {
        if (!this.clientId) return '--';
        return this.clientId.substring(0, CONSTANTS.UI.CLIENT_ID_DISPLAY_LENGTH).toUpperCase();
    }
    
    // Get full client ID
    getClientId() {
        return this.clientId;
    }
    
    // Check if client is registered
    isRegistered() {
        return this.clientId !== null;
    }
    
    // Override reconnect to reset registration
    reconnect() {
        this.clientId = null;
        this.registrationRetries = 0;
        super.reconnect();
    }
    
    // Send client activity notification
    notifyClientActivity(type, data = {}) {
        if (!this.isConnected) return false;
        
        return this.sendMessage(type, {
            clientId: this.clientId,
            ...data
        });
    }
    
    // Request to stop metronome
    requestStopMetronome() {
        return this.sendMessage(CONSTANTS.MESSAGE_TYPES.STOP_METRONOME);
    }
    
    // Validate UUID format
    isValidUUID(uuid) {
        if (!uuid || typeof uuid !== 'string') return false;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const controllerRegex = /^controller-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid) || controllerRegex.test(uuid);
    }
    
    // Clean up client resources
    destroy() {
        this.registrationCallbacks = [];
        this.statusCallbacks = [];
        this.clientId = null;
        this.disconnect();
    }
}