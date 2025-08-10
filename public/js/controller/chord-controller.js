// Chord progression controller module for Echo Mesh
export class ChordController {
    constructor(websocketController, uiController) {
        this.websocketController = websocketController;
        this.uiController = uiController;
        
        // Chord progression state
        this.state = {
            isRunning: false,
            currentProgression: null,
            currentChordIndex: 0,
            bpm: 120
        };
        
        // Musical data
        this.keys = {
            'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
            'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
        };
        
        this.scales = {
            major: [0, 2, 4, 5, 7, 9, 11],
            minor: [0, 2, 3, 5, 7, 8, 10]
        };
        
        this.chordTypes = {
            major: [0, 4, 7],
            minor: [0, 3, 7],
            diminished: [0, 3, 6],
            augmented: [0, 4, 8],
            major7: [0, 4, 7, 11],
            minor7: [0, 3, 7, 10],
            dominant7: [0, 4, 7, 10]
        };
        
        this.romanNumeralChords = {
            'I': { root: 0, type: 'major' },
            'ii': { root: 1, type: 'minor' },
            'iii': { root: 2, type: 'minor' },
            'IV': { root: 3, type: 'major' },
            'V': { root: 4, type: 'major' },
            'vi': { root: 5, type: 'minor' },
            'vii°': { root: 6, type: 'diminished' },
            // Minor key variants
            'i': { root: 0, type: 'minor' },
            'ii°': { root: 1, type: 'diminished' },
            'III': { root: 2, type: 'major' },
            'iv': { root: 3, type: 'minor' },
            'v': { root: 4, type: 'minor' },
            'VI': { root: 5, type: 'major' },
            'VII': { root: 6, type: 'major' }
        };
        
        this.chordProgressions = {
            // Pop & Rock
            'I-V-vi-IV': ['I', 'V', 'vi', 'IV'],
            'vi-IV-I-V': ['vi', 'IV', 'I', 'V'],
            'I-vi-IV-V': ['I', 'vi', 'IV', 'V'],
            'vi-V-IV-V': ['vi', 'V', 'IV', 'V'],
            // Jazz & Blues
            'ii-V-I': ['ii', 'V', 'I'],
            'I-vi-ii-V': ['I', 'vi', 'ii', 'V'],
            'I-IV-V': ['I', 'IV', 'V'],
            'I-IV-V-IV': ['I', 'IV', 'V', 'IV'],
            // Minor & Modal
            'i-VII-VI-VII': ['i', 'VII', 'VI', 'VII'],
            'i-iv-V': ['i', 'iv', 'V'],
            'i-VI-VII': ['i', 'VI', 'VII'],
            'i-ii°-V': ['i', 'ii°', 'V'],
            // Extended
            'I-iii-vi-IV': ['I', 'iii', 'vi', 'IV'],
            'I-V-vi-iii-IV-I-IV-V': ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'],
            'vi-ii-V-I': ['vi', 'ii', 'V', 'I']
        };
        
        this.setupElements();
        this.setupEventHandlers();
    }
    
    // Set up DOM elements
    setupElements() {
        this.elements = {
            progressionSelect: document.getElementById('chordProgression'),
            playButton: document.getElementById('playChordProgressionButton'),
            stopButton: document.getElementById('stopChordProgressionButton'),
            bpmInput: document.getElementById('chordBpm'),
            keySelect: document.getElementById('musicalKey'),
            octaveSelect: document.getElementById('octave')
        };
    }
    
    // Set up event handlers
    setupEventHandlers() {
        this.elements.playButton?.addEventListener('click', () => {
            this.start();
        });
        
        this.elements.stopButton?.addEventListener('click', () => {
            this.stop();
        });
        
        // Set up WebSocket message handler
        this.websocketController.onMessage('chordProgressionUpdate', (data) => {
            this.handleProgressionUpdate(data);
        });
    }
    
    // Start chord progression
    start() {
        const progressionName = this.elements.progressionSelect?.value;
        if (!progressionName || !this.chordProgressions[progressionName]) {
            this.uiController.logMessage('Please select a chord progression');
            return;
        }
        
        if (!this.websocketController.isConnected) {
            this.uiController.logMessage('WebSocket not connected');
            return;
        }
        
        const bpm = parseInt(this.elements.bpmInput?.value || '120');
        
        // Send message to server
        this.websocketController.sendMessage('startChordProgression', {
            progression: progressionName,
            bpm: bpm
        });
        
        // Update local state
        this.state.isRunning = true;
        this.state.currentProgression = progressionName;
        this.state.bpm = bpm;
        this.state.currentChordIndex = 0;
        
        this.updateUI();
        this.uiController.logMessage(`Starting chord progression: ${progressionName}`);
    }
    
    // Stop chord progression
    stop() {
        if (!this.websocketController.isConnected) {
            this.uiController.logMessage('WebSocket not connected');
            return;
        }
        
        // Send message to server
        this.websocketController.sendMessage('stopChordProgression');
        
        // Update local state
        this.state.isRunning = false;
        this.state.currentProgression = null;
        this.state.currentChordIndex = 0;
        
        this.updateUI();
        this.uiController.logMessage('Stopping chord progression');
    }
    
    // Handle progression updates from server
    handleProgressionUpdate(data) {
        if (data.currentChord !== undefined) {
            this.state.currentChordIndex = data.currentChord;
            this.updateChordDisplay();
        }
    }
    
    // Update UI elements
    updateUI() {
        if (this.state.isRunning) {
            if (this.elements.playButton) this.elements.playButton.style.display = 'none';
            if (this.elements.stopButton) this.elements.stopButton.style.display = 'inline-block';
        } else {
            if (this.elements.playButton) this.elements.playButton.style.display = 'inline-block';
            if (this.elements.stopButton) this.elements.stopButton.style.display = 'none';
        }
        
        this.updateChordDisplay();
    }
    
    // Update chord display highlighting
    updateChordDisplay() {
        const chordDisplayContainer = document.getElementById('chordProgressionDisplay');
        if (chordDisplayContainer && this.state.currentProgression) {
            const chordDisplays = chordDisplayContainer.querySelectorAll('.progression-chord-display');
            chordDisplays.forEach((display, index) => {
                if (index === this.state.currentChordIndex) {
                    display.classList.add('current');
                } else {
                    display.classList.remove('current');
                }
            });
        }
    }
    
    // Get chord notes for a roman numeral
    getChordNotes(romanNumeral) {
        const keyRoot = this.keys[this.elements.keySelect?.value || 'C'];
        const baseOctave = parseInt(this.elements.octaveSelect?.value || '4');
        
        const chordInfo = this.romanNumeralChords[romanNumeral];
        if (!chordInfo) {
            console.error(`Unknown chord: ${romanNumeral}`);
            return [];
        }
        
        const scaleNotes = this.scales.major; // Use major scale for chord calculation
        const chordRoot = (keyRoot + scaleNotes[chordInfo.root]) % 12;
        const chordIntervals = this.chordTypes[chordInfo.type];
        
        return chordIntervals.map(interval => {
            const semitone = (chordRoot + interval) % 12;
            const octave = baseOctave + Math.floor((chordRoot + interval) / 12);
            return {
                semitone: semitone,
                octave: octave,
                frequency: this.noteToFrequency(semitone, octave)
            };
        });
    }
    
    // Convert note to frequency
    noteToFrequency(semitone, octave) {
        return 440 * Math.pow(2, (octave - 4) + (semitone - 9) / 12);
    }
    
    // Play a specific chord
    playChord(romanNumeral) {
        const clients = this.websocketController.getClients();
        
        if (clients.length === 0) {
            this.uiController.logMessage('No clients to play chord on');
            return;
        }
        
        const chordNotes = this.getChordNotes(romanNumeral);
        if (chordNotes.length === 0) {
            return;
        }
        
        this.uiController.logMessage(`Playing ${romanNumeral} chord with ${chordNotes.length} notes across ${clients.length} clients`);
        
        // Distribute chord notes across clients
        clients.forEach((client, index) => {
            const note = chordNotes[index % chordNotes.length];
            this.websocketController.triggerSound([client.id], 'sine', note.frequency);
        });
    }
    
    // Get available progressions
    getAvailableProgressions() {
        return Object.keys(this.chordProgressions);
    }
    
    // Get progression chords
    getProgressionChords(progressionName) {
        return this.chordProgressions[progressionName] || [];
    }
    
    // Get current state
    getState() {
        return { ...this.state };
    }
    
    // Check if progression is running
    isRunning() {
        return this.state.isRunning;
    }
}