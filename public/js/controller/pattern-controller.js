// Pattern and rhythm controller for Echo Mesh
export class PatternController {
    constructor(websocketController, uiController, clientManager) {
        this.websocketController = websocketController;
        this.uiController = uiController;
        this.clientManager = clientManager;
        
        // Pattern state
        this.rhythmState = {
            isPlaying: false,
            currentPattern: null,
            currentStep: 0,
            tempo: 120,
            interval: null
        };
        
        // Sequencer state
        this.sequencerState = {
            isPlaying: false,
            currentStep: 0,
            data: [],
            bpm: 120
        };
        
        // Pattern queue
        this.patternQueue = {
            queue: [],
            currentIndex: 0,
            isPlaying: false
        };
        
        // Rhythm patterns data
        this.rhythmPatterns = {
            'kick-snare': {
                steps: 16,
                tracks: {
                    kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
                    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
                    hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0]
                }
            },
            'four-on-floor': {
                steps: 16,
                tracks: {
                    kick: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
                    hihat: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
                    openhat: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0]
                }
            },
            'breakbeat': {
                steps: 16,
                tracks: {
                    kick: [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0],
                    snare: [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,0],
                    hihat: [1,1,0,1, 1,1,0,1, 1,1,0,1, 1,1,0,1]
                }
            },
            'polyrhythm': {
                steps: 16,
                tracks: {
                    kick: [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,0],
                    snare: [0,0,1,0, 0,1,0,0, 1,0,0,1, 0,0,0,0],
                    hihat: [1,0,1,1, 0,1,0,1, 1,0,1,0, 1,1,0,1]
                }
            }
        };
        
        // Sound mappings for rhythm tracks
        this.rhythmSounds = {
            kick: { type: 'kick', frequency: 60, attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.2 },
            snare: { type: 'snare', frequency: 200, attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.1 },
            hihat: { type: 'hihat', frequency: 8000, attack: 0.01, decay: 0.05, sustain: 0.1, release: 0.05 },
            openhat: { type: 'hihat', frequency: 6000, attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.3 }
        };
        
        this.setupElements();
        this.setupEventHandlers();
    }
    
    // Set up DOM elements
    setupElements() {
        this.elements = {
            // Rhythm controls
            rhythmPattern: document.getElementById('rhythmPattern'),
            rhythmTempo: document.getElementById('rhythmTempo'),
            playRhythmButton: document.getElementById('playRhythmButton'),
            stopRhythmButton: document.getElementById('stopRhythmButton'),
            
            // Sequencer controls
            sequencerGrid: document.getElementById('sequencer-grid'),
            sequencerBpm: document.getElementById('sequencerBpm'),
            sequencerPlayButton: document.getElementById('sequencerPlayButton'),
            sequencerStopButton: document.getElementById('sequencerStopButton'),
            
            // Pattern queue
            patternQueue: document.getElementById('patternQueue'),
            queuePosition: document.getElementById('queuePosition'),
            currentPatternDisplay: document.getElementById('currentPatternDisplay')
        };
    }
    
    // Set up event handlers
    setupEventHandlers() {
        // Rhythm controls
        this.elements.playRhythmButton?.addEventListener('click', () => {
            this.startRhythm();
        });
        
        this.elements.stopRhythmButton?.addEventListener('click', () => {
            this.stopRhythm();
        });
        
        // Sequencer controls
        this.elements.sequencerPlayButton?.addEventListener('click', () => {
            this.startSequencer();
        });
        
        this.elements.sequencerStopButton?.addEventListener('click', () => {
            this.stopSequencer();
        });
        
        // Build initial sequencer grid
        this.buildSequencerGrid();
    }
    
    // Start rhythm pattern
    startRhythm() {
        if (this.rhythmState.isPlaying) {
            this.stopRhythm();
        }
        
        const clients = this.clientManager.getActiveClients();
        if (clients.length === 0) {
            this.uiController.logMessage('No clients to play rhythm on');
            return;
        }
        
        const patternName = this.elements.rhythmPattern?.value;
        const tempo = parseInt(this.elements.rhythmTempo?.value || '120');
        const pattern = this.rhythmPatterns[patternName];
        
        if (!pattern) {
            this.uiController.logMessage('Invalid rhythm pattern selected');
            return;
        }
        
        this.rhythmState.isPlaying = true;
        this.rhythmState.currentPattern = pattern;
        this.rhythmState.tempo = tempo;
        this.rhythmState.currentStep = 0;
        
        // Calculate step duration (16th notes)
        const stepDuration = (60 / tempo / 4) * 1000; // milliseconds per 16th note
        
        this.rhythmState.interval = setInterval(() => {
            this.playRhythmStep(pattern, this.rhythmState.currentStep);
            this.rhythmState.currentStep = (this.rhythmState.currentStep + 1) % pattern.steps;
        }, stepDuration);
        
        this.updateRhythmUI();
        this.uiController.logMessage(`Started rhythm pattern: ${patternName} at ${tempo} BPM`);
    }
    
    // Stop rhythm pattern
    stopRhythm() {
        if (this.rhythmState.interval) {
            clearInterval(this.rhythmState.interval);
            this.rhythmState.interval = null;
        }
        
        this.rhythmState.isPlaying = false;
        this.rhythmState.currentPattern = null;
        this.rhythmState.currentStep = 0;
        
        this.updateRhythmUI();
        this.uiController.logMessage('Stopped rhythm pattern');
    }
    
    // Play rhythm step
    playRhythmStep(pattern, step) {
        const clients = this.clientManager.getActiveClients();
        if (clients.length === 0) return;
        
        const tracks = Object.keys(pattern.tracks);
        const clientsPerTrack = Math.max(1, Math.floor(clients.length / tracks.length));
        const sortedClients = [...clients].sort();
        
        tracks.forEach((trackName, trackIndex) => {
            const trackPattern = pattern.tracks[trackName];
            if (trackPattern[step] === 1) {
                // Assign clients to this track
                const startIndex = trackIndex * clientsPerTrack;
                const endIndex = Math.min(startIndex + clientsPerTrack, sortedClients.length);
                
                for (let i = startIndex; i < endIndex; i++) {
                    const clientId = sortedClients[i];
                    const soundInfo = this.rhythmSounds[trackName];
                    
                    if (soundInfo) {
                        // Trigger sound on client
                        this.websocketController.scheduleNote(
                            [clientId],
                            soundInfo.type,
                            soundInfo.frequency,
                            performance.now() + this.websocketController.serverTimeOffset,
                            {
                                attack: soundInfo.attack,
                                decay: soundInfo.decay,
                                sustain: soundInfo.sustain,
                                release: soundInfo.release
                            }
                        );
                    }
                }
            }
        });
    }
    
    // Update rhythm UI
    updateRhythmUI() {
        if (this.rhythmState.isPlaying) {
            if (this.elements.playRhythmButton) this.elements.playRhythmButton.style.display = 'none';
            if (this.elements.stopRhythmButton) this.elements.stopRhythmButton.style.display = 'inline-block';
        } else {
            if (this.elements.playRhythmButton) this.elements.playRhythmButton.style.display = 'inline-block';
            if (this.elements.stopRhythmButton) this.elements.stopRhythmButton.style.display = 'none';
        }
    }
    
    // Build sequencer grid
    buildSequencerGrid() {
        if (!this.elements.sequencerGrid) return;
        
        this.elements.sequencerGrid.innerHTML = '';
        this.sequencerState.data = [];
        
        const clients = this.clientManager.getClients();
        
        clients.forEach(clientId => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.marginBottom = '5px';
            row.style.alignItems = 'center';
            
            // Client label
            const label = document.createElement('div');
            label.textContent = `${clientId.substring(0, 8)}`;
            label.style.width = '80px';
            label.style.fontSize = '12px';
            label.style.marginRight = '10px';
            row.appendChild(label);
            
            const steps = [];
            for (let i = 0; i < 16; i++) {
                const step = document.createElement('button');
                step.className = 'sequencer-step';
                step.style.width = '30px';
                step.style.height = '30px';
                step.style.margin = '1px';
                step.style.border = '2px solid #ccc';
                step.style.backgroundColor = '#f9f9f9';
                step.style.cursor = 'pointer';
                step.dataset.clientId = clientId;
                step.dataset.step = i;
                
                const stepData = { step: i, active: false, element: step };
                
                step.addEventListener('click', () => {
                    stepData.active = !stepData.active;
                    step.style.backgroundColor = stepData.active ? '#4CAF50' : '#f9f9f9';
                    step.style.borderColor = stepData.active ? '#4CAF50' : '#ccc';
                });
                
                row.appendChild(step);
                steps.push(stepData);
            }
            
            this.sequencerState.data.push({
                clientId: clientId,
                steps: steps
            });
            
            this.elements.sequencerGrid.appendChild(row);
        });
    }
    
    // Start sequencer
    startSequencer() {
        const clients = this.clientManager.getClients();
        if (clients.length === 0) {
            this.uiController.logMessage('No clients for sequencer');
            return;
        }
        
        const bpm = parseInt(this.elements.sequencerBpm?.value || '120');
        const stepDuration = (60 / bpm / 4) * 1000; // 16th notes
        
        this.sequencerState.isPlaying = true;
        this.sequencerState.currentStep = 0;
        this.sequencerState.bpm = bpm;
        
        this.sequencerState.interval = setInterval(() => {
            this.playSequencerStep(this.sequencerState.currentStep);
            this.sequencerState.currentStep = (this.sequencerState.currentStep + 1) % 16;
        }, stepDuration);
        
        this.updateSequencerUI();
        this.uiController.logMessage(`Started sequencer at ${bpm} BPM`);
    }
    
    // Stop sequencer
    stopSequencer() {
        if (this.sequencerState.interval) {
            clearInterval(this.sequencerState.interval);
            this.sequencerState.interval = null;
        }
        
        this.sequencerState.isPlaying = false;
        this.sequencerState.currentStep = 0;
        
        // Remove playing highlights
        this.sequencerState.data.forEach(row => {
            row.steps.forEach(step => {
                step.element.classList.remove('playing');
            });
        });
        
        this.updateSequencerUI();
        this.uiController.logMessage('Stopped sequencer');
    }
    
    // Play sequencer step
    playSequencerStep(stepIndex) {
        this.sequencerState.data.forEach(row => {
            row.steps.forEach((step, index) => {
                if (index === stepIndex) {
                    step.element.classList.add('playing');
                    
                    if (step.active) {
                        // Trigger note on this client
                        const frequency = this.clientManager.getClientPitch(row.clientId)?.frequency || 440;
                        this.websocketController.triggerSound([row.clientId], 'sine', frequency);
                    }
                } else {
                    step.element.classList.remove('playing');
                }
            });
        });
    }
    
    // Update sequencer UI
    updateSequencerUI() {
        if (this.sequencerState.isPlaying) {
            if (this.elements.sequencerPlayButton) this.elements.sequencerPlayButton.style.display = 'none';
            if (this.elements.sequencerStopButton) this.elements.sequencerStopButton.style.display = 'inline-block';
        } else {
            if (this.elements.sequencerPlayButton) this.elements.sequencerPlayButton.style.display = 'inline-block';
            if (this.elements.sequencerStopButton) this.elements.sequencerStopButton.style.display = 'none';
        }
    }
    
    // Pattern queue management
    queuePattern(patternName, progression) {
        if (progression) {
            this.patternQueue.queue.push({
                name: patternName,
                progression: [...progression],
                length: 4 // Default pattern length
            });
            this.updatePatternQueueDisplay();
            this.uiController.logMessage(`Queued pattern: ${patternName}`);
        }
    }
    
    // Update pattern queue display
    updatePatternQueueDisplay() {
        if (!this.elements.patternQueue) return;
        
        if (this.patternQueue.queue.length === 0) {
            this.elements.patternQueue.innerHTML = '<span style="color: #999; font-style: italic;">Click patterns below to queue them</span>';
            if (this.elements.queuePosition) this.elements.queuePosition.textContent = 'Queue Empty';
            if (this.elements.currentPatternDisplay) this.elements.currentPatternDisplay.textContent = 'No pattern loaded';
            return;
        }
        
        // Update queue display
        this.elements.patternQueue.innerHTML = '';
        this.patternQueue.queue.forEach((item, index) => {
            const patternElement = document.createElement('div');
            patternElement.className = `queued-pattern ${index === this.patternQueue.currentIndex ? 'current' : ''}`;
            patternElement.textContent = item.name;
            patternElement.style.padding = '5px 10px';
            patternElement.style.margin = '2px';
            patternElement.style.backgroundColor = index === this.patternQueue.currentIndex ? '#4CAF50' : '#f0f0f0';
            patternElement.style.borderRadius = '4px';
            patternElement.style.cursor = 'pointer';
            
            patternElement.addEventListener('click', () => {
                this.patternQueue.currentIndex = index;
                this.updatePatternQueueDisplay();
            });
            
            this.elements.patternQueue.appendChild(patternElement);
        });
        
        // Update position display
        if (this.elements.queuePosition) {
            this.elements.queuePosition.textContent = `${this.patternQueue.currentIndex + 1}/${this.patternQueue.queue.length}`;
        }
        
        const currentPattern = this.patternQueue.queue[this.patternQueue.currentIndex];
        if (this.elements.currentPatternDisplay && currentPattern) {
            this.elements.currentPatternDisplay.textContent = currentPattern.name;
        }
    }
    
    // Get available rhythm patterns
    getAvailablePatterns() {
        return Object.keys(this.rhythmPatterns);
    }
    
    // Get pattern state
    getRhythmState() {
        return { ...this.rhythmState };
    }
    
    // Get sequencer state
    getSequencerState() {
        return { ...this.sequencerState };
    }
    
    // Check if rhythm is playing
    isRhythmPlaying() {
        return this.rhythmState.isPlaying;
    }
    
    // Check if sequencer is playing
    isSequencerPlaying() {
        return this.sequencerState.isPlaying;
    }
    
    // Rebuild sequencer when clients change
    onClientsChanged() {
        this.buildSequencerGrid();
    }
}