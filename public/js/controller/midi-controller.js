// MIDI File Playback Controller for Echo Mesh
export class MidiController {
    constructor(websocketController, uiController, audioController) {
        this.websocketController = websocketController;
        this.uiController = uiController;
        this.audioController = audioController;
        
        // MIDI playback state
        this.state = {
            isPlaying: false,
            parsedMidi: null,
            playbackStartTime: null,
            scheduledNotes: [],
            currentFile: null
        };
        
        // Distribution strategies
        this.distributionStrategies = {
            'round-robin': 'Distribute notes evenly across all clients',
            'track-based': 'Each track assigned to different clients',
            'frequency-based': 'High/low frequencies to different clients',
            'random': 'Random assignment of notes to clients',
            'mono': 'All notes to single client (rotating per song)'
        };
        
        this.setupElements();
        this.setupEventHandlers();
        this.setupGlobalFunctions();
    }
    
    // Set up DOM elements
    setupElements() {
        this.elements = {
            fileInput: document.getElementById('midiFileInput'),
            playButton: document.getElementById('playMidiButton'),
            stopButton: document.getElementById('stopMidiButton'),
            pauseButton: document.getElementById('pauseMidiButton'),
            distributionStrategy: document.getElementById('midiDistributionStrategy'),
            midiInfo: document.getElementById('midiFileInfo'),
            playbackProgress: document.getElementById('midiPlaybackProgress'),
            tempoSlider: document.getElementById('midiTempoSlider'),
            tempoValue: document.getElementById('midiTempoValue'),
            volumeSlider: document.getElementById('midiVolumeSlider'),
            volumeValue: document.getElementById('midiVolumeValue'),
            trackList: document.getElementById('midiTrackList')
        };
    }
    
    // Set up event handlers
    setupEventHandlers() {
        // File input
        this.elements.fileInput?.addEventListener('change', (e) => {
            this.handleFileLoad(e);
        });
        
        // Playback controls
        this.elements.playButton?.addEventListener('click', () => {
            this.play();
        });
        
        this.elements.stopButton?.addEventListener('click', () => {
            this.stop();
        });
        
        this.elements.pauseButton?.addEventListener('click', () => {
            this.pause();
        });
        
        // Tempo control
        this.elements.tempoSlider?.addEventListener('input', (e) => {
            if (this.elements.tempoValue) {
                this.elements.tempoValue.textContent = `${e.target.value}%`;
            }
        });
        
        // Volume control
        this.elements.volumeSlider?.addEventListener('input', (e) => {
            if (this.elements.volumeValue) {
                this.elements.volumeValue.textContent = `${e.target.value}%`;
            }
        });
    }
    
    // Set up global functions for HTML onclick handlers
    setupGlobalFunctions() {
        window.toggleMidiTrack = (trackIndex) => this.toggleTrack(trackIndex);
        window.soloMidiTrack = (trackIndex) => this.soloTrack(trackIndex);
    }
    
    // Handle MIDI file loading
    async handleFileLoad(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            this.uiController.logMessage(`Loading MIDI file: ${file.name}`);
            
            // Check if Midi library is available
            if (typeof Midi === 'undefined') {
                this.uiController.logMessage('Error: Midi library not loaded. Please include midi.js in your HTML.');
                return;
            }
            
            const fileBuffer = await file.arrayBuffer();
            this.state.parsedMidi = new Midi(fileBuffer);
            this.state.currentFile = file.name;
            
            this.updateMidiInfo();
            this.updateTrackList();
            this.enableControls();
            
            this.uiController.logMessage(`MIDI file parsed: ${this.state.parsedMidi.tracks.length} tracks, duration: ${this.state.parsedMidi.duration.toFixed(2)}s`);
            
        } catch (error) {
            this.uiController.logMessage(`Error loading MIDI file: ${error.message}`);
            console.error('MIDI loading error:', error);
        }
    }
    
    // Update MIDI file information display
    updateMidiInfo() {
        if (!this.elements.midiInfo || !this.state.parsedMidi) return;
        
        const midi = this.state.parsedMidi;
        this.elements.midiInfo.innerHTML = `
            <div><strong>File:</strong> ${this.state.currentFile}</div>
            <div><strong>Duration:</strong> ${midi.duration.toFixed(2)}s</div>
            <div><strong>Tracks:</strong> ${midi.tracks.length}</div>
            <div><strong>PPQ:</strong> ${midi.header.ppq}</div>
            <div><strong>Time Division:</strong> ${midi.header.timeDivision}</div>
        `;
    }
    
    // Update track list display
    updateTrackList() {
        if (!this.elements.trackList || !this.state.parsedMidi) return;
        
        const tracks = this.state.parsedMidi.tracks;
        this.elements.trackList.innerHTML = tracks.map((track, index) => {
            const noteCount = track.notes.length;
            const trackName = track.name || `Track ${index + 1}`;
            const instrument = track.instrument?.name || 'Unknown';
            
            return `
                <div class="midi-track-item" data-track-index="${index}">
                    <div class="track-info">
                        <span class="track-name">${trackName}</span>
                        <span class="track-details">${noteCount} notes • ${instrument}</span>
                    </div>
                    <div class="track-controls">
                        <button class="track-toggle" onclick="toggleMidiTrack(${index})" data-enabled="true">
                            🔊 ON
                        </button>
                        <button class="track-solo" onclick="soloMidiTrack(${index})">
                            🎯 SOLO
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Enable playback controls
    enableControls() {
        if (this.elements.playButton) this.elements.playButton.disabled = false;
        if (this.elements.stopButton) this.elements.stopButton.disabled = false;
        if (this.elements.pauseButton) this.elements.pauseButton.disabled = false;
    }
    
    // Toggle track on/off
    toggleTrack(trackIndex) {
        const trackItem = document.querySelector(`[data-track-index="${trackIndex}"]`);
        const toggleButton = trackItem?.querySelector('.track-toggle');
        
        if (toggleButton) {
            const isEnabled = toggleButton.dataset.enabled === 'true';
            toggleButton.dataset.enabled = !isEnabled;
            toggleButton.textContent = !isEnabled ? '🔊 ON' : '🔇 OFF';
            toggleButton.style.opacity = !isEnabled ? '1' : '0.5';
        }
    }
    
    // Solo a specific track
    soloTrack(trackIndex) {
        const trackItems = document.querySelectorAll('.midi-track-item');
        trackItems.forEach((item, index) => {
            const toggleButton = item.querySelector('.track-toggle');
            const soloButton = item.querySelector('.track-solo');
            
            if (index === trackIndex) {
                // Enable this track and mark as soloed
                toggleButton.dataset.enabled = 'true';
                toggleButton.textContent = '🔊 ON';
                toggleButton.style.opacity = '1';
                soloButton.style.background = '#ff9800';
                soloButton.style.color = 'white';
            } else {
                // Disable other tracks
                toggleButton.dataset.enabled = 'false';
                toggleButton.textContent = '🔇 OFF';
                toggleButton.style.opacity = '0.5';
                soloButton.style.background = '';
                soloButton.style.color = '';
            }
        });
    }
    
    // Start MIDI playback
    play() {
        if (!this.state.parsedMidi) {
            this.uiController.logMessage('No MIDI file loaded');
            return;
        }
        
        const clients = this.websocketController.getClients();
        if (clients.length === 0) {
            this.uiController.logMessage('No clients connected for MIDI playback');
            return;
        }
        
        if (!this.websocketController.isConnected) {
            this.uiController.logMessage('WebSocket not connected');
            return;
        }
        
        this.state.isPlaying = true;
        this.updatePlaybackUI();
        
        const strategy = this.elements.distributionStrategy?.value || 'round-robin';
        const tempoMultiplier = (this.elements.tempoSlider?.value || 100) / 100;
        const volumeMultiplier = (this.elements.volumeSlider?.value || 80) / 100;
        
        // Get current effects and LFO settings
        const lfoConfig = this.audioController?.getLFOConfig() || {};
        const effectsConfig = this.audioController?.getEffectsConfig() || {};
        
        const now = performance.now();
        const playbackStartTime = now + 200; // Start in 200ms
        
        this.state.playbackStartTime = playbackStartTime;
        this.state.scheduledNotes = [];
        
        this.uiController.logMessage(`Starting MIDI playback with ${strategy} distribution`);
        
        // Schedule all notes
        this.scheduleAllNotes(strategy, tempoMultiplier, volumeMultiplier, lfoConfig, effectsConfig, playbackStartTime);
        
        // Start progress tracking
        this.startProgressTracking();
    }
    
    // Schedule all MIDI notes for playback
    scheduleAllNotes(strategy, tempoMultiplier, volumeMultiplier, lfoConfig, effectsConfig, startTime) {
        const clients = this.websocketController.getClients();
        const enabledTracks = this.getEnabledTracks();
        
        let noteCounter = 0;
        
        enabledTracks.forEach((track, trackIndex) => {
            track.notes.forEach(note => {
                const scheduledPlayTime = startTime + (note.time * 1000 / tempoMultiplier);
                const frequency = 440 * Math.pow(2, (note.midi - 69) / 12);
                const velocity = (note.velocity || 0.8) * volumeMultiplier;
                
                // Determine target client based on strategy
                const clientId = this.selectClientByStrategy(strategy, noteCounter, trackIndex, note, clients);
                
                // Create ADSR envelope based on note duration
                const duration = note.duration * 1000 / tempoMultiplier;
                const adsr = {
                    attack: Math.min(0.1, duration * 0.1),
                    decay: Math.min(0.2, duration * 0.2),
                    sustain: velocity,
                    release: Math.min(1.0, duration * 0.3)
                };
                
                // Schedule the note
                this.websocketController.scheduleNote(
                    [clientId],
                    'sine',
                    frequency,
                    scheduledPlayTime,
                    adsr,
                    lfoConfig.enabled ? lfoConfig : null,
                    0, // pan
                    effectsConfig.chain && effectsConfig.chain.length > 0 ? effectsConfig : null
                );
                
                this.state.scheduledNotes.push({
                    time: scheduledPlayTime,
                    clientId: clientId,
                    note: note
                });
                
                noteCounter++;
            });
        });
        
        this.uiController.logMessage(`Scheduled ${noteCounter} MIDI notes across ${clients.length} clients`);
    }
    
    // Get enabled tracks
    getEnabledTracks() {
        const tracks = this.state.parsedMidi.tracks;
        const trackItems = document.querySelectorAll('.midi-track-item');
        
        return tracks.filter((track, index) => {
            const trackItem = trackItems[index];
            const toggleButton = trackItem?.querySelector('.track-toggle');
            return toggleButton?.dataset.enabled === 'true';
        });
    }
    
    // Select client based on distribution strategy
    selectClientByStrategy(strategy, noteCounter, trackIndex, note, clients) {
        switch (strategy) {
            case 'round-robin':
                return clients[noteCounter % clients.length].id;
                
            case 'track-based':
                return clients[trackIndex % clients.length].id;
                
            case 'frequency-based':
                const isHighFreq = note.midi > 60; // Middle C
                const clientGroup = isHighFreq ? 
                    clients.slice(Math.ceil(clients.length / 2)) : 
                    clients.slice(0, Math.ceil(clients.length / 2));
                return clientGroup[noteCounter % clientGroup.length].id;
                
            case 'random':
                return clients[Math.floor(Math.random() * clients.length)].id;
                
            case 'mono':
                return clients[0].id; // All to first client
                
            default:
                return clients[noteCounter % clients.length].id;
        }
    }
    
    // Stop MIDI playback
    stop() {
        this.state.isPlaying = false;
        this.state.scheduledNotes = [];
        this.updatePlaybackUI();
        this.stopProgressTracking();
        this.uiController.logMessage('MIDI playback stopped');
    }
    
    // Pause MIDI playback (for future implementation)
    pause() {
        // Note: Pausing scheduled notes is complex and would require server-side support
        // For now, just stop
        this.stop();
        this.uiController.logMessage('MIDI playback paused (stops current playback)');
    }
    
    // Update playback UI
    updatePlaybackUI() {
        if (this.elements.playButton) {
            this.elements.playButton.disabled = this.state.isPlaying;
        }
        if (this.elements.stopButton) {
            this.elements.stopButton.disabled = !this.state.isPlaying;
        }
        if (this.elements.pauseButton) {
            this.elements.pauseButton.disabled = !this.state.isPlaying;
        }
    }
    
    // Start progress tracking
    startProgressTracking() {
        if (!this.elements.playbackProgress || !this.state.parsedMidi) return;
        
        this.progressInterval = setInterval(() => {
            if (!this.state.isPlaying) return;
            
            const elapsed = (performance.now() - this.state.playbackStartTime) / 1000;
            const duration = this.state.parsedMidi.duration;
            const progress = Math.min(elapsed / duration * 100, 100);
            
            this.elements.playbackProgress.style.width = `${progress}%`;
            
            // Auto-stop when finished
            if (progress >= 100) {
                this.stop();
            }
        }, 100);
    }
    
    // Stop progress tracking
    stopProgressTracking() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
        
        if (this.elements.playbackProgress) {
            this.elements.playbackProgress.style.width = '0%';
        }
    }
    
    // Get current state
    getState() {
        return { ...this.state };
    }
    
    // Clean up resources
    destroy() {
        this.stopProgressTracking();
        this.state.isPlaying = false;
        this.state.scheduledNotes = [];
    }
}

// Make MIDI controller globally available
window.midiController = null;