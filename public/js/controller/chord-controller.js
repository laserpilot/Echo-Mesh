// Chord progression controller module for Echo Mesh
export class ChordController {
    constructor(websocketController, uiController) {
        this.websocketController = websocketController;
        this.uiController = uiController;
        
        // Musical note duration mappings (in beats relative to a whole note)
        this.noteDurations = {
            'sixteenth': 1/16,     // Sixteenth note
            'eighth': 1/8,         // Eighth note
            'quarter': 1/4,        // Quarter note
            'half': 1/2,           // Half note
            'whole': 1,            // Whole note (4 beats in 4/4 time)
            'double': 2,           // Double whole note
            'dotted-quarter': 3/8, // Dotted quarter (1.5x quarter)
            'dotted-half': 3/4,    // Dotted half (1.5x half)
            'triplet-quarter': 1/6, // Quarter triplet
            'triplet-eighth': 1/12  // Eighth triplet
        };
        
        // Chord progression state
        this.state = {
            isRunning: false,
            isPaused: false,
            currentProgression: null,
            currentChordIndex: 0,
            bpm: 120,
            mode: 'preset', // 'preset', 'custom', 'sequencer'
            customProgression: [],
            sequencerPattern: Array(16).fill(''),
            sequencerStep: 0,
            patternQueue: [],
            currentPatternIndex: 0,
            queueIsRunning: false,
            autoAdvance: false,
            loopQueue: false,
            settings: {
                key: 'C',
                octave: 4,
                chordDuration: 'whole', // Changed to musical note duration
                volume: 80,
                arpeggio: 'chord',
                subdivision: '8n',
                swing: 0,
                velocity: 'even',
                clientOffset: 0,
                noteDuration: 'sustain',
                patternLength: 4,
                humanization: 0
            }
        };
        
        // Tempo automation state
        this.tempoAutomation = {
            active: false,
            type: null, // 'accelerando' or 'ritardando'
            originalTempo: 120,
            targetTempo: null,
            stepSize: 2, // BPM change per step
            interval: null
        };
        
        // Musical data
        this.keys = {
            'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
            'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
        };
        
        this.scales = {
            major: [0, 2, 4, 5, 7, 9, 11],
            minor: [0, 2, 3, 5, 7, 8, 10],
            dorian: [0, 2, 3, 5, 7, 9, 10],
            mixolydian: [0, 2, 4, 5, 7, 9, 10],
            pentatonic: [0, 2, 4, 7, 9],
            blues: [0, 3, 5, 6, 7, 10]
        };
        
        this.chordTypes = {
            // Basic triads
            major: [0, 4, 7],
            minor: [0, 3, 7],
            diminished: [0, 3, 6],
            augmented: [0, 4, 8],
            
            // 7th chords
            major7: [0, 4, 7, 11],
            minor7: [0, 3, 7, 10],
            dominant7: [0, 4, 7, 10],
            halfDiminished7: [0, 3, 6, 10],
            diminished7: [0, 3, 6, 9],
            minorMajor7: [0, 3, 7, 11],
            augmented7: [0, 4, 8, 10],
            augmentedMajor7: [0, 4, 8, 11],
            
            // 9th chords
            major9: [0, 4, 7, 11, 14],
            minor9: [0, 3, 7, 10, 14],
            dominant9: [0, 4, 7, 10, 14],
            add9: [0, 4, 7, 14],
            minorAdd9: [0, 3, 7, 14],
            
            // 11th chords
            major11: [0, 4, 7, 11, 14, 17],
            minor11: [0, 3, 7, 10, 14, 17],
            dominant11: [0, 4, 7, 10, 14, 17],
            
            // 13th chords
            major13: [0, 4, 7, 11, 14, 17, 21],
            minor13: [0, 3, 7, 10, 14, 17, 21],
            dominant13: [0, 4, 7, 10, 14, 17, 21],
            
            // Sus chords
            sus2: [0, 2, 7],
            sus4: [0, 5, 7],
            sus2sus4: [0, 2, 5, 7],
            
            // 6th chords
            major6: [0, 4, 7, 9],
            minor6: [0, 3, 7, 9],
            
            // Altered dominants
            dominantSharp5: [0, 4, 8, 10],
            dominantFlat5: [0, 4, 6, 10],
            dominantSharp9: [0, 4, 7, 10, 15],
            dominantFlat9: [0, 4, 7, 10, 13],
            dominantSharp11: [0, 4, 7, 10, 14, 18],
            dominantFlat13: [0, 4, 7, 10, 14, 17, 20]
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
        this.setupGlobalFunctions();
        
        // Initialize displays
        this.updateChordDurationDisplay();
    }
    
    // Convert musical note duration to milliseconds based on BPM
    // Assumes 4/4 time signature where whole note = 4 beats
    noteDurationToMs(noteDuration, bpm) {
        const beats = this.noteDurations[noteDuration] || 1; // Default to whole note (1 = whole note = 4 beats)
        const msPerBeat = 60000 / bpm; // milliseconds per beat
        const wholeNoteDuration = msPerBeat * 4; // A whole note = 4 beats
        return Math.round(beats * wholeNoteDuration);
    }
    
    // Get current chord duration in milliseconds
    getChordDurationMs() {
        const noteDuration = this.elements.chordDuration?.value || 'whole';
        const bpm = this.state.bpm || 120;
        return this.noteDurationToMs(noteDuration, bpm);
    }
    
    // Convert milliseconds back to closest note duration (for compatibility)
    msToNoteDuration(ms, bpm) {
        const msPerBeat = 60000 / bpm;
        const wholeNoteDuration = msPerBeat * 4; // A whole note = 4 beats
        const beats = ms / wholeNoteDuration;
        
        // Find closest note duration
        let closestDuration = 'whole';
        let closestDiff = Math.abs(beats - 1);
        
        for (const [duration, value] of Object.entries(this.noteDurations)) {
            const diff = Math.abs(beats - value);
            if (diff < closestDiff) {
                closestDiff = diff;
                closestDuration = duration;
            }
        }
        
        return closestDuration;
    }
    
    // Update chord duration display with calculated milliseconds
    updateChordDurationDisplay() {
        if (!this.elements.chordDurationDisplay) return;
        
        const noteDuration = this.elements.chordDuration?.value || 'whole';
        const bpm = this.state.bpm || 120;
        const durationMs = this.noteDurationToMs(noteDuration, bpm);
        const durationSeconds = (durationMs / 1000).toFixed(2);
        
        this.elements.chordDurationDisplay.textContent = 
            `Duration: ${durationSeconds}s (${durationMs}ms) at ${bpm} BPM`;
    }
    
    // Set up DOM elements
    setupElements() {
        this.elements = {
            // Basic controls
            progressionSelect: document.getElementById('chordProgression'),
            playButton: document.getElementById('playChordProgressionButton'),
            stopButton: document.getElementById('stopChordProgressionButton'),
            pauseButton: document.getElementById('pauseChordProgressionButton'),
            bpmInput: null, // No BPM input for basic mode, use chord duration
            keySelect: document.getElementById('globalKey'),
            scaleSelect: document.getElementById('globalScale'),
            octaveSelect: document.getElementById('octave'),
            chordDuration: document.getElementById('chordDuration'),
            chordDurationDisplay: document.getElementById('chordDurationDisplay'),
            progressionVolume: document.getElementById('progressionVolume'),
            progressionVolumeValue: document.getElementById('progressionVolumeValue'),
            
            // Custom builder elements
            customChordBuilder: document.getElementById('customChordBuilder'),
            chordPalette: document.getElementById('chordPalette'),
            clearCustomProgression: document.getElementById('clearCustomProgression'),
            saveCustomProgression: document.getElementById('saveCustomProgression'),
            
            // Step sequencer elements
            sequencerBpm: document.getElementById('sequencerBpm'),
            stepsPerChord: document.getElementById('stepsPerChord'),
            chordSequencerGrid: document.getElementById('chordSequencerGrid'),
            
            // Advanced timing elements
            arpeggioPattern: document.getElementById('arpeggioPattern'),
            subdivision: document.getElementById('subdivision'),
            swingAmount: document.getElementById('swingAmount'),
            swingValue: document.getElementById('swingValue'),
            velocityCurve: document.getElementById('velocityCurve'),
            clientOffset: document.getElementById('clientOffset'),
            offsetValue: document.getElementById('offsetValue'),
            noteDuration: document.getElementById('noteDuration'),
            patternLength: document.getElementById('patternLength'),
            humanization: document.getElementById('humanization'),
            humanizeValue: document.getElementById('humanizeValue'),
            
            // ADSR controls
            attackTime: document.getElementById('attackTime'),
            decayTime: document.getElementById('decayTime'),
            sustainLevel: document.getElementById('sustainLevel'),
            releaseTime: document.getElementById('releaseTime'),
            
            // Display elements
            currentProgressionDisplay: document.getElementById('currentProgressionDisplay'),
            progressionVisualization: document.getElementById('progressionVisualization'),
            progressionPosition: document.getElementById('progressionPosition'),
            patternQueue: document.getElementById('patternQueue'),
            currentPatternDisplay: document.getElementById('currentPatternDisplay'),
            queuePosition: document.getElementById('queuePosition'),
            
            // Pattern queue controls
            playQueueButton: document.getElementById('playQueueButton'),
            stopQueueButton: document.getElementById('stopQueueButton'),
            nextPatternButton: document.getElementById('nextPatternButton'),
            clearQueueButton: document.getElementById('clearQueueButton'),
            autoAdvanceQueue: document.getElementById('autoAdvanceQueue'),
            loopQueue: document.getElementById('loopQueue'),
            
            // Tempo automation
            accelerandoButton: document.getElementById('accelerandoButton'),
            ritardandoButton: document.getElementById('ritardandoButton'),
            resetTempoButton: document.getElementById('resetTempoButton')
        };
    }
    
    // Set up event handlers
    setupEventHandlers() {
        // Basic controls
        this.elements.playButton?.addEventListener('click', () => {
            this.start();
        });
        
        this.elements.stopButton?.addEventListener('click', () => {
            this.stop();
        });
        
        this.elements.pauseButton?.addEventListener('click', () => {
            this.pause();
        });
        
        // Volume controls
        this.elements.progressionVolume?.addEventListener('input', (e) => {
            const value = e.target.value;
            if (this.elements.progressionVolumeValue) {
                this.elements.progressionVolumeValue.textContent = `${value}%`;
            }
        });
        
        // Timing controls with value displays
        this.elements.swingAmount?.addEventListener('input', (e) => {
            if (this.elements.swingValue) {
                this.elements.swingValue.textContent = `${e.target.value}%`;
            }
        });
        
        this.elements.clientOffset?.addEventListener('input', (e) => {
            if (this.elements.offsetValue) {
                this.elements.offsetValue.textContent = `${e.target.value}ms`;
            }
        });
        
        this.elements.humanization?.addEventListener('input', (e) => {
            if (this.elements.humanizeValue) {
                this.elements.humanizeValue.textContent = `${e.target.value}%`;
            }
        });
        
        // Chord duration display update
        this.elements.chordDuration?.addEventListener('change', () => {
            this.updateChordDurationDisplay();
        });
        
        // Custom chord builder
        this.elements.clearCustomProgression?.addEventListener('click', () => {
            this.clearCustomProgression();
        });
        
        this.elements.saveCustomProgression?.addEventListener('click', () => {
            this.saveCustomProgression();
        });
        
        // Chord palette - set up individual button handlers
        this.setupChordPaletteHandlers();
        
        // Step sequencer initialization
        this.initializeStepSequencer();
        
        // Pattern queue controls
        this.setupPatternQueueHandlers();
        
        // Set up WebSocket message handlers
        this.websocketController.onMessage('chordProgressionUpdate', (data) => {
            this.handleProgressionUpdate(data);
        });
        
        this.websocketController.onMessage('chordProgressionStarted', (data) => {
            this.handleProgressionStarted(data);
        });
        
        this.websocketController.onMessage('chordProgressionStopped', (data) => {
            this.handleProgressionStopped(data);
        });
        
        this.websocketController.onMessage('chordProgressionPaused', (data) => {
            this.handleProgressionPaused(data);
        });
        
        this.websocketController.onMessage('chordProgressionResumed', (data) => {
            this.handleProgressionResumed(data);
        });
    }
    
    // Set up global functions for HTML onclick handlers
    setupGlobalFunctions() {
        window.switchProgressionMode = (mode) => this.switchProgressionMode(mode);
    }
    
    // Switch progression mode
    switchProgressionMode(mode) {
        // Update button states
        document.querySelectorAll('.mode-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeButton = document.getElementById(`${mode}ModeBtn`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
        
        // Show/hide mode panels
        const modes = ['preset', 'custom', 'sequencer'];
        modes.forEach(m => {
            const panel = document.getElementById(`${m}Mode`);
            if (panel) {
                panel.style.display = m === mode ? 'block' : 'none';
            }
        });
        
        this.currentProgressionMode = mode;
        this.uiController.logMessage(`Switched to ${mode} progression mode`);
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
        
        // Get chord duration in milliseconds from musical notation and current BPM
        const chordDurationMs = this.getChordDurationMs();
        const bpm = this.state.bpm;
        
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
            if (this.elements.pauseButton) this.elements.pauseButton.style.display = 'inline-block';
            
            // Update pause button text based on state
            if (this.elements.pauseButton) {
                this.elements.pauseButton.textContent = this.state.isPaused ? '▶️ Resume' : '⏸️ Pause';
            }
        } else {
            if (this.elements.playButton) this.elements.playButton.style.display = 'inline-block';
            if (this.elements.stopButton) this.elements.stopButton.style.display = 'none';
            if (this.elements.pauseButton) this.elements.pauseButton.style.display = 'none';
        }
        
        this.updateChordDisplay();
        this.updateProgressionDisplay();
    }
    
    // Update progression display
    updateProgressionDisplay() {
        if (this.elements.currentProgressionDisplay && this.state.currentProgression) {
            const chords = this.chordProgressions[this.state.currentProgression] || [];
            this.elements.currentProgressionDisplay.textContent = chords.join(' - ');
        } else if (this.elements.currentProgressionDisplay) {
            this.elements.currentProgressionDisplay.textContent = 'No progression selected';
        }
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
    
    // Pause chord progression
    pause() {
        if (!this.state.isRunning) return;
        
        this.state.isPaused = !this.state.isPaused;
        
        if (this.state.isPaused) {
            this.websocketController.sendMessage('pauseChordProgression');
            this.uiController.logMessage('Pausing chord progression');
        } else {
            this.websocketController.sendMessage('resumeChordProgression');
            this.uiController.logMessage('Resuming chord progression');
        }
        
        this.updateUI();
    }
    
    // Set up chord palette event handlers
    setupChordPaletteHandlers() {
        if (!this.elements.chordPalette) return;
        
        const chordButtons = this.elements.chordPalette.querySelectorAll('.chord-button');
        chordButtons.forEach(button => {
            button.addEventListener('click', () => {
                const chord = button.dataset.chord;
                this.addChordToCustomProgression(chord);
            });
        });
    }
    
    // Add chord to custom progression
    addChordToCustomProgression(chord) {
        this.state.customProgression.push(chord);
        this.updateCustomProgressionDisplay();
        this.uiController.logMessage(`Added ${chord} to custom progression`);
    }
    
    // Clear custom progression
    clearCustomProgression() {
        this.state.customProgression = [];
        this.updateCustomProgressionDisplay();
        this.uiController.logMessage('Cleared custom progression');
    }
    
    // Save custom progression
    saveCustomProgression() {
        if (this.state.customProgression.length === 0) {
            this.uiController.logMessage('No custom progression to save');
            return;
        }
        
        const name = prompt('Enter name for custom progression:');
        if (name) {
            const progressionString = this.state.customProgression.join('-');
            this.chordProgressions[name] = this.state.customProgression;
            
            // Add to select options
            if (this.elements.progressionSelect) {
                const option = document.createElement('option');
                option.value = progressionString;
                option.textContent = `${name} (Custom)`;
                this.elements.progressionSelect.appendChild(option);
            }
            
            this.uiController.logMessage(`Saved custom progression: ${name}`);
        }
    }
    
    // Update custom progression display
    updateCustomProgressionDisplay() {
        if (!this.elements.customChordBuilder) return;
        
        this.elements.customChordBuilder.innerHTML = '';
        
        if (this.state.customProgression.length === 0) {
            const placeholder = document.createElement('div');
            placeholder.className = 'chord-placeholder';
            placeholder.textContent = 'Click chords below to build your progression';
            this.elements.customChordBuilder.appendChild(placeholder);
        } else {
            this.state.customProgression.forEach((chord, index) => {
                const chordElement = document.createElement('div');
                chordElement.className = 'custom-chord-item';
                chordElement.innerHTML = `
                    <span class="chord-name">${chord}</span>
                    <button class="remove-chord" onclick="chordController.removeCustomChord(${index})">×</button>
                `;
                this.elements.customChordBuilder.appendChild(chordElement);
            });
        }
    }
    
    // Remove chord from custom progression
    removeCustomChord(index) {
        this.state.customProgression.splice(index, 1);
        this.updateCustomProgressionDisplay();
        this.uiController.logMessage(`Removed chord at position ${index + 1}`);
    }
    
    // Initialize step sequencer
    initializeStepSequencer() {
        if (!this.elements.chordSequencerGrid) return;
        
        // Generate 16 step buttons
        this.elements.chordSequencerGrid.innerHTML = '';
        for (let i = 0; i < 16; i++) {
            const stepButton = document.createElement('button');
            stepButton.className = 'sequencer-step';
            stepButton.dataset.step = i;
            stepButton.textContent = i + 1;
            
            stepButton.addEventListener('click', () => {
                this.toggleSequencerStep(i);
            });
            
            this.elements.chordSequencerGrid.appendChild(stepButton);
        }
        
        // Set up chord selection buttons for sequencer
        const chordSelects = document.querySelectorAll('.chord-select');
        chordSelects.forEach(button => {
            button.addEventListener('click', () => {
                this.selectedSequencerChord = button.dataset.chord;
                // Update visual selection
                chordSelects.forEach(btn => btn.classList.remove('selected'));
                button.classList.add('selected');
            });
        });
    }
    
    // Toggle sequencer step
    toggleSequencerStep(stepIndex) {
        const chord = this.selectedSequencerChord || '';
        this.state.sequencerPattern[stepIndex] = chord;
        
        const stepButton = this.elements.chordSequencerGrid.children[stepIndex];
        if (chord) {
            stepButton.classList.add('active');
            stepButton.textContent = chord;
        } else {
            stepButton.classList.remove('active');
            stepButton.textContent = stepIndex + 1;
        }
        
        this.uiController.logMessage(`Set step ${stepIndex + 1} to ${chord || 'rest'}`);
    }
    
    // Handle progression started message from server
    handleProgressionStarted(data) {
        this.state.isRunning = true;
        this.state.isPaused = false;
        this.updateUI();
        this.uiController.logMessage(`Chord progression started: ${data.progression}`);
    }
    
    // Handle progression stopped message from server
    handleProgressionStopped(data) {
        this.state.isRunning = false;
        this.state.isPaused = false;
        this.state.currentChordIndex = 0;
        this.updateUI();
        this.uiController.logMessage('Chord progression stopped');
    }
    
    // Handle progression paused message from server
    handleProgressionPaused(data) {
        this.state.isPaused = true;
        this.updateUI();
        this.uiController.logMessage('Chord progression paused');
    }
    
    // Handle progression resumed message from server
    handleProgressionResumed(data) {
        this.state.isPaused = false;
        this.updateUI();
        this.uiController.logMessage('Chord progression resumed');
    }
    
    // Get current settings
    getCurrentSettings() {
        return {
            key: this.elements.keySelect?.value || 'C',
            scale: this.elements.scaleSelect?.value || 'major',
            octave: parseInt(this.elements.octaveSelect?.value || '4'),
            chordDuration: this.elements.chordDuration?.value || 'whole',
            chordDurationMs: this.getChordDurationMs(),
            volume: parseInt(this.elements.progressionVolume?.value || '80') / 100,
            arpeggio: this.elements.arpeggioPattern?.value || 'chord',
            subdivision: this.elements.subdivision?.value || '8n',
            swing: parseInt(this.elements.swingAmount?.value || '0'),
            velocity: this.elements.velocityCurve?.value || 'even',
            clientOffset: parseInt(this.elements.clientOffset?.value || '0'),
            noteDuration: this.elements.noteDuration?.value || 'sustain',
            patternLength: parseInt(this.elements.patternLength?.value || '4'),
            humanization: parseInt(this.elements.humanization?.value || '0'),
            
            // ADSR envelope settings
            adsr: {
                attack: parseFloat(this.elements.attackTime?.value || '0.01'),
                decay: parseFloat(this.elements.decayTime?.value || '0.1'),
                sustain: parseFloat(this.elements.sustainLevel?.value || '0.5'),
                release: parseFloat(this.elements.releaseTime?.value || '1.0')
            }
        };
    }
    
    // Update the start method to include settings
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
        
        // Get chord duration in milliseconds from musical notation and current BPM
        const chordDurationMs = this.getChordDurationMs();
        const bpm = this.state.bpm;
        const settings = this.getCurrentSettings();
        
        // Get current LFO and effects settings
        const lfoConfig = window.controllerApp?.getAudioController()?.getLFOConfig() || {};
        const effectsConfig = window.controllerApp?.getAudioController()?.getEffectsConfig() || {};
        
        // Send message to server with enhanced settings
        this.websocketController.sendMessage('startChordProgression', {
            progression: progressionName,
            bpm: bpm,
            settings: settings,
            lfo: lfoConfig.enabled ? lfoConfig : null,
            effects: (effectsConfig.chain && effectsConfig.chain.length > 0) ? effectsConfig : null
        });
        
        // Update local state
        this.state.isRunning = true;
        this.state.isPaused = false;
        this.state.currentProgression = progressionName;
        this.state.bpm = bpm;
        this.state.currentChordIndex = 0;
        this.state.settings = settings;
        
        this.updateUI();
        this.uiController.logMessage(`Starting chord progression: ${progressionName} with advanced settings`);
    }
    
    // Setup pattern queue event handlers
    setupPatternQueueHandlers() {
        // Queue control buttons
        this.elements.playQueueButton?.addEventListener('click', () => {
            this.playQueue();
        });
        
        this.elements.stopQueueButton?.addEventListener('click', () => {
            this.stopQueue();
        });
        
        this.elements.nextPatternButton?.addEventListener('click', () => {
            this.nextPattern();
        });
        
        this.elements.clearQueueButton?.addEventListener('click', () => {
            this.clearQueue();
        });
        
        // Queue options
        this.elements.autoAdvanceQueue?.addEventListener('change', (e) => {
            this.state.autoAdvance = e.target.checked;
        });
        
        this.elements.loopQueue?.addEventListener('change', (e) => {
            this.state.loopQueue = e.target.checked;
        });
        
        // Quick pattern buttons
        document.querySelectorAll('.quick-pattern-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const pattern = e.target.getAttribute('data-pattern');
                this.addToQueue(pattern);
            });
        });
        
        // Tempo automation buttons
        this.elements.accelerandoButton?.addEventListener('click', () => {
            this.startTempoAutomation('accelerando');
        });
        
        this.elements.ritardandoButton?.addEventListener('click', () => {
            this.startTempoAutomation('ritardando');
        });
        
        this.elements.resetTempoButton?.addEventListener('click', () => {
            this.resetTempo();
        });
    }
    
    // Add pattern to queue
    addToQueue(patternName) {
        if (!this.chordProgressions[patternName]) {
            this.uiController.logMessage(`Unknown pattern: ${patternName}`);
            return;
        }
        
        this.state.patternQueue.push(patternName);
        this.updateQueueDisplay();
        this.uiController.logMessage(`Added ${patternName} to queue`);
    }
    
    // Play the pattern queue
    playQueue() {
        if (this.state.patternQueue.length === 0) {
            this.uiController.logMessage('Queue is empty');
            return;
        }
        
        this.state.queueIsRunning = true;
        this.state.currentPatternIndex = 0;
        this.playCurrentQueuePattern();
        this.updateQueueDisplay();
    }
    
    // Stop the pattern queue
    stopQueue() {
        this.state.queueIsRunning = false;
        this.stop(); // Stop current progression
        this.updateQueueDisplay();
        this.uiController.logMessage('Queue stopped');
    }
    
    // Go to next pattern in queue
    nextPattern() {
        if (!this.state.queueIsRunning || this.state.patternQueue.length === 0) {
            return;
        }
        
        this.advanceQueue();
    }
    
    // Clear the pattern queue
    clearQueue() {
        this.state.patternQueue = [];
        this.state.currentPatternIndex = 0;
        this.state.queueIsRunning = false;
        this.updateQueueDisplay();
        this.uiController.logMessage('Queue cleared');
    }
    
    // Play current pattern in queue
    playCurrentQueuePattern() {
        if (this.state.patternQueue.length === 0 || this.state.currentPatternIndex >= this.state.patternQueue.length) {
            this.handleQueueEnd();
            return;
        }
        
        const patternName = this.state.patternQueue[this.state.currentPatternIndex];
        
        // Update progression selector to match queue pattern
        if (this.elements.progressionSelect) {
            this.elements.progressionSelect.value = patternName;
        }
        
        // Start the pattern
        this.start();
        
        // Set up auto-advance if enabled
        if (this.state.autoAdvance) {
            const chordDurationMs = this.getChordDurationMs();
            const patternLength = this.chordProgressions[patternName].length;
            const totalDuration = chordDurationMs * patternLength;
            
            setTimeout(() => {
                if (this.state.queueIsRunning) {
                    this.advanceQueue();
                }
            }, totalDuration);
        }
    }
    
    // Advance to next pattern in queue
    advanceQueue() {
        this.state.currentPatternIndex++;
        
        if (this.state.currentPatternIndex >= this.state.patternQueue.length) {
            this.handleQueueEnd();
        } else {
            this.playCurrentQueuePattern();
        }
        
        this.updateQueueDisplay();
    }
    
    // Handle end of queue
    handleQueueEnd() {
        if (this.state.loopQueue && this.state.patternQueue.length > 0) {
            this.state.currentPatternIndex = 0;
            this.playCurrentQueuePattern();
        } else {
            this.state.queueIsRunning = false;
            this.stop();
            this.uiController.logMessage('Queue finished');
        }
        this.updateQueueDisplay();
    }
    
    // Update queue display
    updateQueueDisplay() {
        if (!this.elements.patternQueue || !this.elements.currentPatternDisplay || !this.elements.queuePosition) {
            return;
        }
        
        // Update queue display
        if (this.state.patternQueue.length === 0) {
            this.elements.patternQueue.innerHTML = '<span style="color: #999; font-style: italic;">Click patterns below to queue them</span>';
        } else {
            this.elements.patternQueue.innerHTML = this.state.patternQueue.map((pattern, index) => {
                const isActive = index === this.state.currentPatternIndex && this.state.queueIsRunning;
                return `<span class="queue-item ${isActive ? 'active' : ''}" 
                             style="background: ${isActive ? '#4CAF50' : '#e0e0e0'}; 
                                    color: ${isActive ? 'white' : 'black'}; 
                                    padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                            ${pattern} ${isActive ? '▶' : ''}
                        </span>`;
            }).join('');
        }
        
        // Update current pattern display
        if (this.state.queueIsRunning && this.state.patternQueue.length > 0) {
            const currentPattern = this.state.patternQueue[this.state.currentPatternIndex] || 'None';
            this.elements.currentPatternDisplay.textContent = currentPattern;
            this.elements.queuePosition.textContent = `${this.state.currentPatternIndex + 1}/${this.state.patternQueue.length}`;
        } else {
            this.elements.currentPatternDisplay.textContent = 'No pattern loaded';
            this.elements.queuePosition.textContent = this.state.patternQueue.length > 0 ? 'Queue Ready' : 'Queue Empty';
        }
    }
    
    // Start tempo automation
    startTempoAutomation(type) {
        if (this.tempoAutomation.interval) {
            clearInterval(this.tempoAutomation.interval);
        }
        
        const currentTempo = this.state.bpm || 120;
        this.tempoAutomation = {
            active: true,
            type: type,
            originalTempo: currentTempo,
            targetTempo: type === 'accelerando' ? currentTempo + 40 : Math.max(60, currentTempo - 40),
            stepSize: 2,
            interval: null
        };
        
        this.tempoAutomation.interval = setInterval(() => {
            this.updateTempo();
        }, 2000); // Update every 2 seconds
        
        this.uiController.logMessage(`Started ${type} from ${currentTempo} BPM`);
    }
    
    // Update tempo during automation
    updateTempo() {
        if (!this.tempoAutomation.active) return;
        
        const currentTempo = this.state.bpm;
        const targetTempo = this.tempoAutomation.targetTempo;
        const stepSize = this.tempoAutomation.stepSize;
        
        let newTempo;
        if (this.tempoAutomation.type === 'accelerando') {
            newTempo = Math.min(targetTempo, currentTempo + stepSize);
            if (newTempo >= targetTempo) {
                this.stopTempoAutomation();
            }
        } else { // ritardando
            newTempo = Math.max(targetTempo, currentTempo - stepSize);
            if (newTempo <= targetTempo) {
                this.stopTempoAutomation();
            }
        }
        
        // Note: Chord duration is now musical notation, tempo changes affect timing calculation
        // The actual duration in milliseconds will be recalculated in getChordDurationMs()
        
        this.state.bpm = newTempo;
        
        // Restart progression with new tempo if running
        if (this.state.isRunning) {
            this.stop();
            setTimeout(() => {
                this.start();
            }, 100);
        }
    }
    
    // Stop tempo automation
    stopTempoAutomation() {
        if (this.tempoAutomation.interval) {
            clearInterval(this.tempoAutomation.interval);
        }
        
        this.tempoAutomation.active = false;
        this.tempoAutomation.interval = null;
        this.uiController.logMessage(`Tempo automation finished at ${this.state.bpm} BPM`);
    }
    
    // Reset tempo to original
    resetTempo() {
        this.stopTempoAutomation();
        
        const originalTempo = this.tempoAutomation.originalTempo || 120;
        
        this.state.bpm = originalTempo;
        this.uiController.logMessage(`Reset tempo to ${originalTempo} BPM`);
        
        // Restart if running
        if (this.state.isRunning) {
            this.stop();
            setTimeout(() => {
                this.start();
            }, 100);
        }
    }
    
    // Get note information for a specific chord degree in a key/scale
    getNoteForChordDegree(key, scale, degree) {
        // Validate inputs
        if (!this.keys.hasOwnProperty(key)) {
            console.warn(`Unknown key: ${key}`);
            return null;
        }
        
        if (!this.scales.hasOwnProperty(scale)) {
            console.warn(`Unknown scale: ${scale}`);
            return null;
        }
        
        // Get the scale degrees
        const scaleNotes = this.scales[scale];
        const maxDegree = scaleNotes.length;
        
        if (degree < 1 || degree > maxDegree) {
            console.warn(`Invalid degree: ${degree} (must be 1-${maxDegree} for ${scale} scale)`);
            return null;
        }
        
        // Get the root note of the key
        const keyRoot = this.keys[key];
        
        // Get the note for this degree (degree is 1-indexed, array is 0-indexed)
        const degreeIndex = degree - 1;
        const scaleNote = scaleNotes[degreeIndex];
        
        // Calculate the actual MIDI note number (C4 = 60)
        const octave = this.state.settings.octave || 4;
        const midiNote = keyRoot + scaleNote + (octave * 12);
        
        // Convert to frequency (A4 = 440Hz = MIDI note 69)
        const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
        
        // Note names
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const noteName = noteNames[(keyRoot + scaleNote) % 12] + octave;
        
        return {
            name: noteName,
            frequency: Math.round(frequency * 100) / 100, // Round to 2 decimal places
            midiNote: midiNote,
            degree: degree,
            key: key,
            scale: scale,
            duration: 1000 // Default 1 second duration
        };
    }
    
    // Get all chord tones for a specific degree
    getChordForDegree(key, scale, degree) {
        const baseNote = this.getNoteForChordDegree(key, scale, degree);
        if (!baseNote) return null;
        
        // Determine chord type based on scale degree and scale type
        let chordType = 'major'; // default
        
        if (scale === 'major') {
            const majorChordTypes = {
                1: 'major',    // I
                2: 'minor',    // ii
                3: 'minor',    // iii
                4: 'major',    // IV
                5: 'major',    // V
                6: 'minor',    // vi
                7: 'diminished' // vii°
            };
            chordType = majorChordTypes[degree] || 'major';
        } else if (scale === 'minor') {
            const minorChordTypes = {
                1: 'minor',    // i
                2: 'diminished', // ii°
                3: 'major',    // III
                4: 'minor',    // iv
                5: 'minor',    // v (or major for V)
                6: 'major',    // VI
                7: 'major'     // VII
            };
            chordType = minorChordTypes[degree] || 'minor';
        }
        
        // Get chord intervals
        const intervals = this.chordTypes[chordType] || this.chordTypes.major;
        
        // Build chord tones
        const chordTones = intervals.map(interval => {
            const frequency = baseNote.frequency * Math.pow(2, interval / 12);
            const midiNote = baseNote.midiNote + interval;
            const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const noteName = noteNames[midiNote % 12] + Math.floor(midiNote / 12);
            
            return {
                name: noteName,
                frequency: Math.round(frequency * 100) / 100,
                midiNote: midiNote,
                interval: interval
            };
        });
        
        return {
            root: baseNote,
            chordType: chordType,
            tones: chordTones
        };
    }
}

// Make chord controller globally available
window.chordController = null;