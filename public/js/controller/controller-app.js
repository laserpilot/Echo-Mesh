// Main controller application module
import { WebSocketController } from './websocket-controller.js';
import { UIController } from './ui-controller.js';
import { MetronomeController } from './metronome-controller.js';
import { ChordController } from './chord-controller.js';
import { ClientManager } from './client-manager.js';
import { PatternController } from './pattern-controller.js';
import { AudioController } from './audio-controller.js';
import { ADSRVisualizer } from './adsr-visualizer.js';
import { BPMController } from './bpm-controller.js';
import { EffectsController } from './effects-controller.js';
import { MidiController } from './midi-controller.js';
import { SpatialController } from './spatial-controller.js';
import { CONSTANTS } from '../shared/constants.js';

export class ControllerApp {
    constructor() {
        this.websocketController = null;
        this.uiController = null;
        this.metronomeController = null;
        this.chordController = null;
        this.clientManager = null;
        this.patternController = null;
        this.audioController = null;
        this.adsrVisualizer = null;
        this.bpmController = null;
        this.effectsController = null;
        this.midiController = null;
        this.spatialController = null;
        this.isInitialized = false;
        
        // Make testClientSound globally available for UI
        window.controllerApp = this;
        
        // Make simulateTestClients available for debugging
        window.simulateTestClients = () => {
            if (this.websocketController) {
                this.websocketController.simulateTestClients();
            }
        };
    }
    
    // Initialize the controller application
    async init() {
        if (this.isInitialized) return;
        
        try {
            console.log('Initializing Echo Mesh Controller...');
            
            // Initialize WebSocket controller
            this.websocketController = new WebSocketController();
            
            // Initialize UI controller
            this.uiController = new UIController(this.websocketController);
            
            // Initialize feature controllers
            this.clientManager = new ClientManager(this.websocketController, this.uiController);
            this.metronomeController = new MetronomeController(this.websocketController, this.uiController);
            this.chordController = new ChordController(this.websocketController, this.uiController);
            this.patternController = new PatternController(this.websocketController, this.uiController, this.clientManager);
            this.audioController = new AudioController(this.websocketController, this.uiController);
            
            // Make chord controller globally available for HTML onclick handlers
            window.chordController = this.chordController;
            
            // Initialize ADSR visualizer
            this.adsrVisualizer = new ADSRVisualizer();
            window.adsrVisualizer = this.adsrVisualizer;
            
            // Initialize BPM controller (after metronome and chord controllers)
            this.bpmController = new BPMController(this.metronomeController, this.chordController);
            window.bpmController = this.bpmController;
            
            // Initialize effects controller
            this.effectsController = new EffectsController();
            window.effectsController = this.effectsController;
            
            // Initialize MIDI controller
            this.midiController = new MidiController(this.websocketController, this.uiController, this.audioController);
            window.midiController = this.midiController;
            
            // Initialize spatial controller
            this.spatialController = new SpatialController(this.websocketController, this.uiController, this.clientManager, this.chordController);
            window.spatialController = this.spatialController;
            
            // Connect to server
            await this.connectToServer();
            
            // Initialize UI
            await this.uiController.initialize();
            
            this.isInitialized = true;
            this.uiController.logMessage('Echo Mesh Controller initialized successfully');
            
        } catch (error) {
            console.error('Error initializing controller:', error);
            throw error;
        }
    }
    
    // Connect to WebSocket server
    async connectToServer() {
        try {
            await this.websocketController.connectAsController();
            this.uiController.logMessage('Connected to WebSocket server');
        } catch (error) {
            console.error('Failed to connect to server:', error);
            this.uiController.logMessage(`Connection failed: ${error.message}`);
            throw error;
        }
    }
    
    // Test sound on specific client (called from UI)
    testClientSound(clientId) {
        if (this.clientManager) {
            this.clientManager.triggerClientSound(clientId, 'sine');
        }
    }
    
    // Get WebSocket controller
    getWebSocketController() {
        return this.websocketController;
    }
    
    // Get UI controller
    getUIController() {
        return this.uiController;
    }
    
    // Get client manager
    getClientManager() {
        return this.clientManager;
    }
    
    // Get metronome controller
    getMetronomeController() {
        return this.metronomeController;
    }
    
    // Get chord controller
    getChordController() {
        return this.chordController;
    }
    
    // Get pattern controller
    getPatternController() {
        return this.patternController;
    }
    
    // Get audio controller
    getAudioController() {
        return this.audioController;
    }
    
    // Get MIDI controller
    getMidiController() {
        return this.midiController;
    }
    
    // Clean up resources
    destroy() {
        if (this.websocketController) {
            this.websocketController.destroy();
        }
        
        if (this.midiController) {
            this.midiController.destroy();
        }
        
        this.isInitialized = false;
        window.controllerApp = null;
        console.log('Controller app destroyed');
    }
}