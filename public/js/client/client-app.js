// Main client application module
import { WebSocketClient } from './websocket-client.js';
import { ClientAudioEngine } from './audio-engine.js';
import { PianoKeyboard } from './piano-keyboard.js';
import { SyncManager } from './sync-manager.js';
import { CONSTANTS } from '../shared/constants.js';
import { AudioUtils } from '../shared/audio-utils.js';

export class ClientApp {
    constructor() {
        // Core components
        this.websocketClient = null;
        this.audioEngine = null;
        this.pianoKeyboard = null;
        this.syncManager = null;
        
        // DOM elements
        this.elements = {
            clientId: document.getElementById('clientId'),
            status: document.getElementById('status'),
            soundIndicator: document.getElementById('soundIndicator'),
            pianoKeyboard: document.getElementById('pianoKeyboard'),
            resyncButton: document.getElementById('resyncButton'),
            stopMetronomeButton: document.getElementById('stopMetronomeButton'),
            log: document.getElementById('log')
        };
        
        // State
        this.isInitialized = false;
        this.logEntries = [];
    }
    
    // Initialize the client application
    async init() {
        if (this.isInitialized) return;
        
        try {
            console.log('Initializing Echo Mesh Client...');
            
            // Initialize core components
            await this.initializeComponents();
            
            // Set up event handlers
            this.setupEventHandlers();
            
            // Set up user interaction handlers for audio
            this.setupAudioActivation();
            
            // Connect to server
            await this.connectToServer();
            
            // Keep screen awake
            this.keepScreenAwake();
            
            this.isInitialized = true;
            this.logMessage('Echo Mesh Client initialized successfully');
            
        } catch (error) {
            console.error('Error initializing client:', error);
            this.updateStatus('Initialization failed');
            throw error;
        }
    }
    
    // Initialize core components
    async initializeComponents() {
        // WebSocket client
        this.websocketClient = new WebSocketClient();
        
        // Audio engine
        this.audioEngine = new ClientAudioEngine();
        
        // Sync manager
        this.syncManager = new SyncManager(this.websocketClient);
        
        // Piano keyboard
        this.pianoKeyboard = new PianoKeyboard(
            this.elements.pianoKeyboard, 
            this.audioEngine, 
            this.websocketClient
        );
    }
    
    // Set up event handlers
    setupEventHandlers() {
        // WebSocket client events
        this.websocketClient.onRegistration((clientId) => {
            this.handleClientRegistration(clientId);
        });
        
        this.websocketClient.onStatusChange((status, data) => {
            this.handleConnectionStatusChange(status, data);
        });
        
        // Sync manager events
        this.syncManager.onSync((syncData) => {
            this.handleSyncUpdate(syncData);
        });
        
        // Message handlers
        this.setupMessageHandlers();
        
        // UI event handlers
        this.setupUIEventHandlers();
    }
    
    // Set up WebSocket message handlers
    setupMessageHandlers() {
        const { MESSAGE_TYPES } = CONSTANTS;
        
        // Sound triggering
        this.websocketClient.onMessage(MESSAGE_TYPES.TRIGGER_SOUND, (data) => {
            this.handleTriggerSound(data);
        });
        
        // Scheduled notes
        this.websocketClient.onMessage(MESSAGE_TYPES.SCHEDULE_NOTE, (data) => {
            this.handleScheduleNote(data);
        });
        
        // Metronome
        this.websocketClient.onMessage(MESSAGE_TYPES.METRONOME_CLICK, (data) => {
            this.handleMetronomeClick(data);
        });
        
        this.websocketClient.onMessage(MESSAGE_TYPES.METRONOME_STOPPED, (data) => {
            this.handleMetronomeStopped(data);
        });
        
        this.websocketClient.onMessage(MESSAGE_TYPES.METRONOME_STATE, (data) => {
            this.handleMetronomeState(data);
        });
        
        // Volume control
        this.websocketClient.onMessage(MESSAGE_TYPES.SET_VOLUME, (data) => {
            this.handleSetVolume(data);
        });
        
        // Panic stop
        this.websocketClient.onMessage(MESSAGE_TYPES.PANIC_STOP, (data) => {
            this.handlePanicStop(data);
        });
        
        // Stop all notes (MIDI stop)
        this.websocketClient.onMessage(MESSAGE_TYPES.STOP_ALL_NOTES, (data) => {
            this.handleStopAllNotes(data);
        });
    }
    
    // Set up UI event handlers
    setupUIEventHandlers() {
        // Re-sync button
        this.elements.resyncButton?.addEventListener('click', () => {
            this.handleResyncRequest();
        });
        
        // Stop metronome button
        this.elements.stopMetronomeButton?.addEventListener('click', () => {
            this.handleStopMetronomeRequest();
        });
        
        // Group assignment color buttons
        this.setupGroupAssignmentHandlers();
    }
    
    // Set up audio activation on user interaction
    setupAudioActivation() {
        const activateAudio = async () => {
            try {
                await this.audioEngine.initAudio();
                this.logMessage('Audio context activated');
                
                const shortId = this.websocketClient.getShortClientId();
                this.updateStatus(`Audio enabled. Client ${shortId}`);
            } catch (error) {
                this.logMessage(`Error activating audio: ${error.message}`);
            }
            
            // Remove event listeners after first interaction
            document.removeEventListener('touchstart', activateAudio);
            document.removeEventListener('click', activateAudio);
        };
        
        // Listen for any user interaction to enable audio
        document.addEventListener('touchstart', activateAudio, { once: true });
        document.addEventListener('click', activateAudio, { once: true });
    }
    
    // Connect to WebSocket server
    async connectToServer() {
        this.updateStatus('Connecting to server...');
        await this.websocketClient.connectAndRegister();
    }
    
    // Handle client registration
    handleClientRegistration(clientId) {
        if (clientId) {
            const shortId = this.websocketClient.getShortClientId();
            this.elements.clientId.textContent = shortId;
            this.updateStatus(`Registered as Client ${shortId}`);
            this.logMessage(`Assigned client ID: ${clientId}`);
            
            // Initialize sync after registration
            setTimeout(() => {
                this.syncManager.initialize();
            }, 500);
        } else {
            this.elements.clientId.textContent = '--';
            this.updateStatus('Registration failed');
        }
    }
    
    // Handle connection status changes
    handleConnectionStatusChange(status, data) {
        switch (status) {
            case 'disconnected':
                this.updateStatus('Disconnected. Reconnecting...');
                this.syncManager.reset();
                break;
                
            case 'error':
                this.updateStatus('Connection error');
                break;
                
            case 'registrationFailed':
                this.updateStatus('Registration failed. Reload page to retry.');
                break;
        }
    }
    
    // Handle sync updates
    handleSyncUpdate(syncData) {
        if (syncData.isSynced) {
            const shortId = this.websocketClient.getShortClientId();
            this.updateStatus(`Synced with server as Client ${shortId}`);
            this.logMessage(`Clock synced. RTT: ${syncData.rtt.toFixed(2)}ms, Offset: ${syncData.offset.toFixed(2)}ms`);
        }
    }
    
    // Handle trigger sound message
    async handleTriggerSound(data) {
        this.logMessage(`Triggering ${data.sound} sound immediately`);
        await this.audioEngine.playSound(data.sound, data.frequency || null, 0, null, data.lfo, 0, data.effects);
    }
    
    // Handle scheduled note message
    async handleScheduleNote(data) {
        if (!this.syncManager.isSynced) {
            this.logMessage('Received note but not synced, ignoring.');
            return;
        }
        
        const delay = this.syncManager.getDelayUntilServerTime(data.playTime);
        
        // Highlight keyboard note if frequency matches a note
        if (data.frequency) {
            const note = AudioUtils.findNoteFromFrequency(data.frequency);
            if (note) {
                this.pianoKeyboard.highlightPlayingNote(note);
            }
        }
        
        if (this.syncManager.isStaleTime(data.playTime, 10)) {
            this.logMessage(`Stale note received. Scheduled for ${delay.toFixed(2)}ms in the past.`);
            // Play immediately for very late notes
            await this.audioEngine.playSound(data.sound, data.frequency, 0, data.adsr, data.lfo, data.pan, data.effects);
        } else {
            // Schedule the sound
            const audioTime = this.syncManager.serverTimeToAudioTime(data.playTime, this.audioEngine.audioContext);
            this.logMessage(`Scheduled note ${data.sound} at ${audioTime.toFixed(2)} (in ${delay.toFixed(2)}ms)`);
            await this.audioEngine.playSound(data.sound, data.frequency, audioTime, data.adsr, data.lfo, data.pan, data.effects);
        }
    }
    
    // Handle metronome click
    async handleMetronomeClick(data) {
        if (!this.syncManager.isSynced) {
            this.logMessage('Received metronome click but not synced, ignoring.');
            return;
        }
        
        // Show stop button when metronome is running
        this.audioEngine.updateMetronomeState({ isRunning: true });
        if (this.elements.stopMetronomeButton) {
            this.elements.stopMetronomeButton.style.display = 'inline-block';
        }
        
        const delay = this.syncManager.getDelayUntilServerTime(data.serverTime);
        
        if (this.syncManager.isStaleTime(data.serverTime, 50)) {
            // Click is too old, play immediately
            await this.audioEngine.playMetronomeClick(data.isDownbeat, 0);
        } else {
            // Schedule the click
            const audioTime = this.syncManager.serverTimeToAudioTime(data.serverTime, this.audioEngine.audioContext);
            await this.audioEngine.playMetronomeClick(data.isDownbeat, audioTime);
        }
        
        // Visual feedback
        this.showMetronomeFlash(data.isDownbeat);
    }
    
    // Handle metronome stopped
    handleMetronomeStopped(data) {
        this.audioEngine.updateMetronomeState({ isRunning: false });
        if (this.elements.stopMetronomeButton) {
            this.elements.stopMetronomeButton.style.display = 'none';
        }
        this.logMessage('Metronome stopped');
    }
    
    // Handle metronome state
    handleMetronomeState(data) {
        this.audioEngine.updateMetronomeState({
            isRunning: data.isRunning,
            bpm: data.bpm
        });
        
        if (this.elements.stopMetronomeButton) {
            this.elements.stopMetronomeButton.style.display = data.isRunning ? 'inline-block' : 'none';
        }
        
        this.logMessage(`Metronome state: ${data.isRunning ? 'running' : 'stopped'} at ${data.bpm} BPM`);
    }
    
    // Handle volume change
    handleSetVolume(data) {
        const volume = Math.max(0, Math.min(1, data.volume || 1.0));
        this.audioEngine.setMasterVolume(volume);
        this.logMessage(`Volume set to ${Math.round(volume * 100)}%`);
    }
    
    // Handle panic stop
    handlePanicStop(data) {
        console.log('PANIC STOP received - stopping all sounds');
        
        // Stop all sounds in the audio engine
        if (this.audioEngine) {
            this.audioEngine.stopAllSounds();
        }
        
        // Release all piano keyboard notes
        if (this.pianoKeyboard) {
            this.pianoKeyboard.releaseAllNotes();
        }
        
        this.logMessage('PANIC STOP - All sounds stopped');
        this.updateStatus('All sounds stopped');
    }
    
    // Handle re-sync request
    handleResyncRequest() {
        if (!this.websocketClient.isConnected) {
            this.logMessage('Cannot re-sync: not connected to server');
            this.updateStatus('Not connected - cannot re-sync');
            return;
        }
        
        this.logMessage('Manual re-sync requested by user');
        this.elements.resyncButton.textContent = 'Syncing...';
        this.elements.resyncButton.disabled = true;
        
        this.syncManager.forceSync();
        
        // Re-enable button after delay
        setTimeout(() => {
            this.elements.resyncButton.textContent = 'Re-sync Timing';
            this.elements.resyncButton.disabled = false;
        }, 2000);
    }
    
    // Handle stop metronome request
    handleStopMetronomeRequest() {
        if (!this.websocketClient.isConnected) {
            this.logMessage('Cannot stop metronome: not connected to server');
            return;
        }
        
        this.logMessage('Requesting metronome stop from client');
        this.websocketClient.requestStopMetronome();
    }
    
    // Set up group assignment color button handlers
    setupGroupAssignmentHandlers() {
        const colorButtons = document.querySelectorAll('.color-button');
        const currentGroupDisplay = document.getElementById('currentGroupDisplay');
        
        colorButtons.forEach(button => {
            button.addEventListener('click', () => {
                const groupNumber = button.getAttribute('data-group');
                const groupColor = button.getAttribute('data-color');
                
                this.assignToGroup(groupNumber, groupColor, button, currentGroupDisplay);
            });
        });
    }
    
    // Assign client to a group
    assignToGroup(groupNumber, groupColor, button, displayElement) {
        // Remove previous group selections
        document.querySelectorAll('.color-button').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // Remove previous background group classes
        document.body.classList.remove('group-1', 'group-2', 'group-3', 'group-4', 'group-5', 'group-6');
        
        // Add selected class to clicked button
        button.classList.add('selected');
        
        // Add background color class to body
        document.body.classList.add(`group-${groupNumber}`);
        
        // Update display
        displayElement.textContent = `Current group: ${groupNumber}`;
        displayElement.style.color = groupColor;
        displayElement.style.fontWeight = 'bold';
        
        // Send group assignment to controller
        if (this.websocketClient && this.websocketClient.isConnected) {
            this.websocketClient.sendMessage(CONSTANTS.MESSAGE_TYPES.CLIENT_GROUP_ASSIGNMENT, {
                groupNumber: parseInt(groupNumber),
                groupColor: groupColor,
                clientId: this.websocketClient.clientId
            });
            
            this.logMessage(`Assigned to Group ${groupNumber}`);
        }
        
        console.log(`Client assigned to group ${groupNumber} with color ${groupColor}`);
    }
    
    // Handle stop all notes message (from MIDI stop)
    handleStopAllNotes(data) {
        console.log('Stop all notes received - stopping MIDI playback');
        
        // Stop all sounds in the audio engine
        if (this.audioEngine) {
            this.audioEngine.stopAllSounds();
        }
        
        // Release all piano keyboard notes
        if (this.pianoKeyboard) {
            this.pianoKeyboard.releaseAllNotes();
        }
        
        this.logMessage('MIDI playback stopped - all notes released');
        this.updateStatus('MIDI stopped');
    }
    
    // Show visual feedback for metronome
    showMetronomeFlash(isDownbeat) {
        const indicator = this.elements.soundIndicator;
        if (!indicator) return;
        
        const originalClass = indicator.className;
        const originalText = indicator.textContent;
        const originalBg = indicator.style.backgroundColor;
        
        // Flash with different colors for downbeat vs regular beat
        indicator.className = 'sound-indicator';
        indicator.style.backgroundColor = isDownbeat ? '#FF4444' : '#4444FF';
        indicator.textContent = isDownbeat ? 'DOWN' : 'BEAT';
        
        setTimeout(() => {
            indicator.className = originalClass;
            indicator.style.backgroundColor = originalBg;
            indicator.textContent = originalText;
        }, CONSTANTS.UI.METRONOME_FLASH_DURATION);
    }
    
    // Keep screen awake
    async keepScreenAwake() {
        if ('wakeLock' in navigator) {
            try {
                const wakeLock = await navigator.wakeLock.request('screen');
                this.logMessage('Screen wake lock activated');
                
                wakeLock.addEventListener('release', () => {
                    this.logMessage('Screen wake lock released');
                });
                
                // Reacquire wake lock when document becomes visible again
                document.addEventListener('visibilitychange', async () => {
                    if (document.visibilityState === 'visible') {
                        this.keepScreenAwake();
                    }
                });
            } catch (error) {
                this.logMessage(`Wake lock error: ${error.message}`);
            }
        } else {
            this.logMessage('Wake lock API not supported');
        }
    }
    
    // Update status display
    updateStatus(message) {
        if (this.elements.status) {
            this.elements.status.textContent = message;
        }
        console.log('Status:', message);
    }
    
    // Add log message
    logMessage(message) {
        console.log(message);
        
        if (!this.elements.log) return;
        
        // Add to log entries
        this.logEntries.push(message);
        
        // Keep only last N entries
        if (this.logEntries.length > CONSTANTS.UI.LOG_MAX_ENTRIES) {
            this.logEntries.shift();
        }
        
        // Create log entry element
        const entry = document.createElement('div');
        entry.className = 'log-message';
        entry.textContent = message;
        this.elements.log.appendChild(entry);
        
        // Scroll to bottom
        this.elements.log.scrollTop = this.elements.log.scrollHeight;
        
        // Clean up old entries
        while (this.elements.log.children.length > CONSTANTS.UI.LOG_MAX_ENTRIES) {
            this.elements.log.removeChild(this.elements.log.firstChild);
        }
    }
    
    // Clean up resources
    destroy() {
        if (this.websocketClient) {
            this.websocketClient.destroy();
        }
        
        if (this.syncManager) {
            this.syncManager.destroy();
        }
        
        if (this.pianoKeyboard) {
            this.pianoKeyboard.releaseAllNotes();
        }
        
        this.isInitialized = false;
        console.log('Client app destroyed');
    }
}