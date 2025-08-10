// Metronome controller module for Echo Mesh
export class MetronomeController {
    constructor(websocketController, uiController) {
        this.websocketController = websocketController;
        this.uiController = uiController;
        
        // Metronome state
        this.state = {
            isRunning: false,
            bpm: 120
        };
        
        // DOM elements
        this.elements = {
            startButton: document.getElementById('startMetronomeButton'),
            stopButton: document.getElementById('stopMetronomeButton'),
            bpmInput: document.getElementById('metronomeBpm'),
            statusElement: document.getElementById('metronomeStatus')
        };
        
        this.setupEventHandlers();
        this.setupMessageHandlers();
        this.updateUI();
    }
    
    // Set up event handlers
    setupEventHandlers() {
        this.elements.startButton?.addEventListener('click', () => {
            this.start();
        });
        
        this.elements.stopButton?.addEventListener('click', () => {
            this.stop();
        });
    }
    
    // Set up WebSocket message handlers
    setupMessageHandlers() {
        this.websocketController.onMessage('metronomeState', (data) => {
            this.handleMetronomeState(data);
        });
    }
    
    // Start metronome
    start() {
        const bpm = parseInt(this.elements.bpmInput?.value || '120');
        
        if (bpm < 40 || bpm > 240) {
            this.uiController.logMessage('BPM must be between 40 and 240');
            return;
        }
        
        if (!this.websocketController.isConnected) {
            this.uiController.logMessage('WebSocket not connected');
            return;
        }
        
        // Send message to server
        this.websocketController.sendMessage('startMetronome', { bpm });
        
        // Update local state immediately for responsiveness
        this.state.isRunning = true;
        this.state.bpm = bpm;
        this.updateUI();
        
        this.uiController.logMessage(`Starting metronome at ${bpm} BPM`);
    }
    
    // Stop metronome
    stop() {
        if (!this.websocketController.isConnected) {
            this.uiController.logMessage('WebSocket not connected');
            return;
        }
        
        // Send message to server
        this.websocketController.sendMessage('stopMetronome');
        
        // Update local state immediately for responsiveness
        this.state.isRunning = false;
        this.updateUI();
        
        this.uiController.logMessage('Stopping metronome');
    }
    
    // Handle metronome state updates from server
    handleMetronomeState(data) {
        this.state.isRunning = data.isRunning;
        this.state.bpm = data.bpm;
        this.updateUI();
        
        const status = data.isRunning ? 'running' : 'stopped';
        this.uiController.logMessage(`Metronome state: ${status} at ${data.bpm} BPM`);
    }
    
    // Update UI elements
    updateUI() {
        if (!this.elements.startButton || !this.elements.stopButton || !this.elements.statusElement) {
            return;
        }
        
        if (this.state.isRunning) {
            this.elements.startButton.style.display = 'none';
            this.elements.stopButton.style.display = 'inline-block';
            this.elements.statusElement.textContent = `Running at ${this.state.bpm} BPM`;
            this.elements.statusElement.style.color = '#4CAF50';
        } else {
            this.elements.startButton.style.display = 'inline-block';
            this.elements.stopButton.style.display = 'none';
            this.elements.statusElement.textContent = 'Stopped';
            this.elements.statusElement.style.color = '#666';
        }
    }
    
    // Get current state
    getState() {
        return { ...this.state };
    }
    
    // Set BPM programmatically
    setBPM(bpm) {
        if (bpm >= 40 && bpm <= 240) {
            if (this.elements.bpmInput) {
                this.elements.bpmInput.value = bpm.toString();
            }
            
            // If metronome is running, restart with new BPM
            if (this.state.isRunning) {
                this.start();
            }
        }
    }
    
    // Check if metronome is running
    isRunning() {
        return this.state.isRunning;
    }
    
    // Get current BPM
    getBPM() {
        return this.state.bpm;
    }
}