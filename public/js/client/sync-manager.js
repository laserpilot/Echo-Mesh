// Time synchronization manager for client
import { CONSTANTS } from '../shared/constants.js';

export class SyncManager {
    constructor(websocketClient) {
        this.websocketClient = websocketClient;
        this.serverTimeOffset = 0;
        this.isSynced = false;
        this.syncIntervalId = null;
        this.syncCallbacks = [];
        
        this.setupMessageHandlers();
    }
    
    // Set up message handlers for sync messages
    setupMessageHandlers() {
        this.websocketClient.onMessage(CONSTANTS.MESSAGE_TYPES.SYNC_REPLY, (data) => {
            this.handleSyncReply(data);
        });
    }
    
    // Request clock synchronization with server
    requestSync() {
        if (!this.websocketClient.isConnected) return false;
        
        console.log('Requesting clock sync...');
        return this.websocketClient.sendMessage(CONSTANTS.MESSAGE_TYPES.SYNC, {
            t0: performance.now()
        });
    }
    
    // Handle sync reply from server
    handleSyncReply(data) {
        const t1 = performance.now();
        const rtt = t1 - data.t0; // Round trip time
        const estimatedServerTime = data.serverTime + rtt / 2;
        
        // Calculate offset between server time and local time
        this.serverTimeOffset = estimatedServerTime - t1;
        
        if (!this.isSynced) {
            this.isSynced = true;
            this.startPeriodicSync();
            console.log('Initial sync completed');
        }
        
        console.log(`Clock synced. RTT: ${rtt.toFixed(2)}ms, Offset: ${this.serverTimeOffset.toFixed(2)}ms`);
        
        // Notify all sync callbacks
        this.syncCallbacks.forEach(callback => {
            try {
                callback({
                    isSynced: this.isSynced,
                    rtt: rtt,
                    offset: this.serverTimeOffset
                });
            } catch (error) {
                console.error('Error in sync callback:', error);
            }
        });
    }
    
    // Start periodic synchronization
    startPeriodicSync() {
        if (this.syncIntervalId) {
            clearInterval(this.syncIntervalId);
        }
        
        this.syncIntervalId = setInterval(() => {
            if (this.websocketClient.isConnected) {
                this.requestSync();
            }
        }, CONSTANTS.UI.SYNC_INTERVAL);
    }
    
    // Stop periodic synchronization
    stopPeriodicSync() {
        if (this.syncIntervalId) {
            clearInterval(this.syncIntervalId);
            this.syncIntervalId = null;
        }
    }
    
    // Get current server time estimate
    getServerTime() {
        return performance.now() + this.serverTimeOffset;
    }
    
    // Convert server time to local audio context time
    serverTimeToAudioTime(serverTime, audioContext) {
        const localTime = serverTime - this.serverTimeOffset;
        const localAudioTime = audioContext.currentTime + (localTime - performance.now()) / 1000;
        return Math.max(audioContext.currentTime, localAudioTime);
    }
    
    // Calculate delay until a scheduled server time
    getDelayUntilServerTime(serverTime) {
        const localTime = performance.now();
        const scheduledLocalTime = serverTime - this.serverTimeOffset;
        return scheduledLocalTime - localTime;
    }
    
    // Check if a scheduled time is stale (too old)
    isStaleTime(serverTime, toleranceMs = 50) {
        const delay = this.getDelayUntilServerTime(serverTime);
        return delay < -toleranceMs;
    }
    
    // Register callback for sync events
    onSync(callback) {
        this.syncCallbacks.push(callback);
    }
    
    // Remove sync callback
    removeSync(callback) {
        const index = this.syncCallbacks.indexOf(callback);
        if (index > -1) {
            this.syncCallbacks.splice(index, 1);
        }
    }
    
    // Force immediate sync
    forceSync() {
        return this.requestSync();
    }
    
    // Reset sync state (useful for reconnection)
    reset() {
        this.isSynced = false;
        this.serverTimeOffset = 0;
        this.stopPeriodicSync();
        console.log('Sync manager reset');
    }
    
    // Get sync status information
    getSyncStatus() {
        return {
            isSynced: this.isSynced,
            offset: this.serverTimeOffset,
            hasPeriodicSync: this.syncIntervalId !== null
        };
    }
    
    // Initialize sync process
    async initialize() {
        // Wait a bit for connection to stabilize
        setTimeout(() => {
            if (this.websocketClient.isConnected) {
                this.requestSync();
            }
        }, 500);
    }
    
    // Clean up resources
    destroy() {
        this.stopPeriodicSync();
        this.syncCallbacks = [];
        this.isSynced = false;
        this.serverTimeOffset = 0;
    }
}