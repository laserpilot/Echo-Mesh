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
        
        // MIDI clock state
        this.clockState = {
            enabled: false,
            midiAccess: null,
            connectedDevices: [],
            clockTicks: 0,
            isReceivingClock: false,
            lastClockTime: 0,
            bpm: 120,
            clockStartTime: 0,
            isRunning: false,
            onBeatCallback: null
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
        this.initializeMidiClock();
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
            trackList: document.getElementById('midiTrackList'),
            
            // MIDI Clock elements
            clockEnableButton: document.getElementById('midiClockEnable'),
            clockDeviceSelect: document.getElementById('midiClockDevice'),
            clockStatus: document.getElementById('midiClockStatus'),
            clockBpmDisplay: document.getElementById('midiClockBpm'),
            clockSyncButton: document.getElementById('midiClockSync')
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
        
        // MIDI Clock controls
        this.elements.clockEnableButton?.addEventListener('click', () => {
            this.toggleMidiClock();
        });
        
        this.elements.clockSyncButton?.addEventListener('click', () => {
            this.syncToMidiClock();
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
    
    // Schedule all MIDI notes for playback (with density control)
    scheduleAllNotes(strategy, tempoMultiplier, volumeMultiplier, lfoConfig, effectsConfig, startTime) {
        const clients = this.websocketController.getClients();
        const enabledTracks = this.getEnabledTracks();
        
        // Collect all notes with timing
        let allNotes = [];
        enabledTracks.forEach((track, trackIndex) => {
            track.notes.forEach(note => {
                allNotes.push({
                    ...note,
                    trackIndex: trackIndex,
                    scheduledTime: startTime + (note.time * 1000 / tempoMultiplier)
                });
            });
        });
        
        // Sort notes by time
        allNotes.sort((a, b) => a.scheduledTime - b.scheduledTime);
        
        // Apply density control - limit concurrent notes
        const MAX_CONCURRENT_NOTES = 8; // Limit to 8 simultaneous notes
        const NOTE_SPACING_MS = 10; // Minimum 10ms between notes
        
        let adjustedNotes = this.applyDensityControl(allNotes, MAX_CONCURRENT_NOTES, NOTE_SPACING_MS);
        
        this.uiController.logMessage(`Processing ${adjustedNotes.length} notes (${allNotes.length - adjustedNotes.length} filtered for density control)`);
        
        // Schedule notes in chunks to prevent overwhelming the system
        this.scheduleNotesInChunks(adjustedNotes, strategy, volumeMultiplier, lfoConfig, effectsConfig, clients);
    }
    
    // Apply density control to prevent overwhelming playback
    applyDensityControl(notes, maxConcurrent, minSpacing) {
        let filteredNotes = [];
        let lastNoteTime = 0;
        let concurrentNotes = [];
        
        notes.forEach(note => {
            // Remove notes that have finished playing from concurrent list
            concurrentNotes = concurrentNotes.filter(n => 
                (note.scheduledTime - n.scheduledTime) < (n.duration * 1000)
            );
            
            // Check if we can add this note
            const canAdd = concurrentNotes.length < maxConcurrent && 
                          (note.scheduledTime - lastNoteTime) >= minSpacing;
            
            if (canAdd) {
                filteredNotes.push(note);
                concurrentNotes.push(note);
                lastNoteTime = note.scheduledTime;
            }
        });
        
        return filteredNotes;
    }
    
    // Schedule notes in smaller chunks to prevent system overload
    scheduleNotesInChunks(notes, strategy, volumeMultiplier, lfoConfig, effectsConfig, clients) {
        const CHUNK_SIZE = 50; // Process 50 notes at a time
        const CHUNK_DELAY = 100; // 100ms delay between chunks
        
        let noteCounter = 0;
        
        for (let i = 0; i < notes.length; i += CHUNK_SIZE) {
            const chunk = notes.slice(i, i + CHUNK_SIZE);
            
            // Schedule this chunk with a delay
            setTimeout(() => {
                if (!this.state.isPlaying) return; // Stop if playback was stopped
                
                chunk.forEach(note => {
                    const frequency = 440 * Math.pow(2, (note.midi - 69) / 12);
                    const velocity = (note.velocity || 0.8) * volumeMultiplier;
                    
                    // Determine target client based on strategy
                    const clientId = this.selectClientByStrategy(strategy, noteCounter, note.trackIndex, note, clients);
                    
                    // Create ADSR envelope based on note duration
                    const duration = note.duration * 1000;
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
                        note.scheduledTime,
                        adsr,
                        lfoConfig.enabled ? lfoConfig : null,
                        0, // pan
                        effectsConfig.chain && effectsConfig.chain.length > 0 ? effectsConfig : null
                    );
                    
                    this.state.scheduledNotes.push({
                        time: note.scheduledTime,
                        clientId: clientId,
                        note: note
                    });
                    
                    noteCounter++;
                });
                
                if (i === 0) {
                    this.uiController.logMessage(`Started MIDI playback - scheduling ${notes.length} notes across ${clients.length} clients`);
                }
            }, Math.floor(i / CHUNK_SIZE) * CHUNK_DELAY);
        }
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
        
        // Send stop message to all clients to actually stop playing sounds
        const clients = this.websocketController.getClients();
        if (clients.length > 0) {
            this.websocketController.broadcast({
                type: 'stopAllNotes',
                timestamp: Date.now()
            });
            this.uiController.logMessage('MIDI playback stopped - stop signal sent to all clients');
        } else {
            this.uiController.logMessage('MIDI playback stopped');
        }
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
    
    // Initialize MIDI Clock functionality
    async initializeMidiClock() {
        try {
            if (!navigator.requestMIDIAccess) {
                console.warn('Web MIDI API not supported');
                this.updateClockStatus('Web MIDI API not supported');
                return;
            }
            
            this.clockState.midiAccess = await navigator.requestMIDIAccess();
            this.updateMidiDeviceList();
            this.updateClockStatus('MIDI Clock ready');
            
            // Listen for device changes
            this.clockState.midiAccess.onstatechange = () => {
                this.updateMidiDeviceList();
            };
            
        } catch (error) {
            console.error('Failed to initialize MIDI Clock:', error);
            this.updateClockStatus('MIDI Clock initialization failed');
        }
    }
    
    // Update MIDI device list
    updateMidiDeviceList() {
        if (!this.elements.clockDeviceSelect || !this.clockState.midiAccess) return;
        
        this.elements.clockDeviceSelect.innerHTML = '<option value="">Select MIDI Device...</option>';
        this.clockState.connectedDevices = [];
        
        for (let input of this.clockState.midiAccess.inputs.values()) {
            const option = document.createElement('option');
            option.value = input.id;
            option.textContent = `${input.name} (${input.manufacturer || 'Unknown'})`;
            this.elements.clockDeviceSelect.appendChild(option);
            
            this.clockState.connectedDevices.push({
                id: input.id,
                name: input.name,
                input: input
            });
        }
        
        this.uiController.logMessage(`Found ${this.clockState.connectedDevices.length} MIDI input devices`);
    }
    
    // Toggle MIDI Clock listening
    toggleMidiClock() {
        if (!this.clockState.enabled) {
            const selectedDeviceId = this.elements.clockDeviceSelect?.value;
            if (!selectedDeviceId) {
                this.uiController.logMessage('Please select a MIDI device first');
                return;
            }
            
            this.startMidiClock(selectedDeviceId);
        } else {
            this.stopMidiClock();
        }
    }
    
    // Start listening for MIDI Clock
    startMidiClock(deviceId) {
        const device = this.clockState.connectedDevices.find(d => d.id === deviceId);
        if (!device) {
            this.uiController.logMessage('Selected MIDI device not found');
            return;
        }
        
        this.clockState.enabled = true;
        this.clockState.clockTicks = 0;
        this.clockState.isReceivingClock = false;
        this.clockState.isRunning = false;
        
        // Listen for MIDI messages
        device.input.onmidimessage = (message) => {
            this.handleMidiClockMessage(message);
        };
        
        this.updateClockUI();
        this.updateClockStatus(`Listening to ${device.name}`);
        this.uiController.logMessage(`Started MIDI Clock sync with ${device.name}`);
    }
    
    // Stop MIDI Clock listening
    stopMidiClock() {
        this.clockState.enabled = false;
        this.clockState.isReceivingClock = false;
        this.clockState.isRunning = false;
        
        // Stop listening on all devices
        this.clockState.connectedDevices.forEach(device => {
            device.input.onmidimessage = null;
        });
        
        this.updateClockUI();
        this.updateClockStatus('MIDI Clock stopped');
        this.uiController.logMessage('Stopped MIDI Clock sync');
    }
    
    // Handle incoming MIDI Clock messages
    handleMidiClockMessage(message) {
        const [status, data1, data2] = message.data;
        const currentTime = performance.now();
        
        switch (status) {
            case 0xF8: // MIDI Clock (24 times per quarter note)
                this.handleClockTick(currentTime);
                break;
                
            case 0xFA: // MIDI Start
                this.handleClockStart(currentTime);
                break;
                
            case 0xFB: // MIDI Continue  
                this.handleClockContinue(currentTime);
                break;
                
            case 0xFC: // MIDI Stop
                this.handleClockStop();
                break;
                
            case 0xF2: // Song Position Pointer
                this.handleSongPosition(data1, data2);
                break;
        }
    }
    
    // Handle MIDI Clock tick (24 ppqn)
    handleClockTick(timestamp) {
        if (!this.clockState.enabled) return;
        
        this.clockState.isReceivingClock = true;
        this.clockState.clockTicks++;
        
        // Calculate BPM based on clock timing
        if (this.clockState.lastClockTime > 0) {
            const timeDiff = timestamp - this.clockState.lastClockTime;
            // 24 ticks per quarter note, so 24 ticks = 1 beat
            // BPM = 60000ms / (time per beat in ms)
            // Time per beat = 24 * timeDiff (time per tick)
            if (timeDiff > 0) {
                const timePerBeat = 24 * timeDiff;
                this.clockState.bpm = Math.round(60000 / timePerBeat);
                this.updateBpmDisplay();
            }
        }
        
        this.clockState.lastClockTime = timestamp;
        
        // Trigger beat events every 24 ticks (quarter note)
        if (this.clockState.clockTicks % 24 === 0) {
            this.onMidiClockBeat();
        }
        
        // Update status every second (roughly)
        if (this.clockState.clockTicks % 120 === 0) { // 120 ticks ≈ 1 second at 120 BPM
            this.updateClockStatus('Receiving MIDI Clock');
        }
    }
    
    // Handle MIDI Start
    handleClockStart(timestamp) {
        this.clockState.isRunning = true;
        this.clockState.clockStartTime = timestamp;
        this.clockState.clockTicks = 0;
        this.updateClockStatus('MIDI Clock Started');
        this.uiController.logMessage('MIDI Clock: Start received');
    }
    
    // Handle MIDI Continue
    handleClockContinue(timestamp) {
        this.clockState.isRunning = true;
        this.updateClockStatus('MIDI Clock Running');
        this.uiController.logMessage('MIDI Clock: Continue received');
    }
    
    // Handle MIDI Stop
    handleClockStop() {
        this.clockState.isRunning = false;
        this.updateClockStatus('MIDI Clock Stopped');
        this.uiController.logMessage('MIDI Clock: Stop received');
    }
    
    // Handle Song Position Pointer
    handleSongPosition(lsb, msb) {
        const position = lsb | (msb << 7);
        this.uiController.logMessage(`MIDI Clock: Song position ${position}`);
    }
    
    // Called on every MIDI Clock beat (quarter note)
    onMidiClockBeat() {
        if (this.clockState.onBeatCallback) {
            this.clockState.onBeatCallback(this.clockState.bpm);
        }
        
        // Trigger metronome sync if enabled
        this.syncToMidiClock();
    }
    
    // Sync Echo Mesh metronome to MIDI Clock
    syncToMidiClock() {
        if (!this.clockState.isReceivingClock || !this.clockState.isRunning) {
            this.uiController.logMessage('No MIDI Clock signal to sync to');
            return;
        }
        
        if (!this.websocketController.isConnected) {
            this.uiController.logMessage('WebSocket not connected');
            return;
        }
        
        // Start Echo Mesh metronome at the detected BPM
        this.websocketController.startMetronome(this.clockState.bpm);
        this.uiController.logMessage(`Synced metronome to MIDI Clock: ${this.clockState.bpm} BPM`);
    }
    
    // Update MIDI Clock UI
    updateClockUI() {
        if (this.elements.clockEnableButton) {
            this.elements.clockEnableButton.textContent = this.clockState.enabled ? 'Stop MIDI Clock' : 'Start MIDI Clock';
            this.elements.clockEnableButton.style.background = this.clockState.enabled ? '#f44336' : '#4caf50';
        }
    }
    
    // Update clock status display
    updateClockStatus(status) {
        if (this.elements.clockStatus) {
            this.elements.clockStatus.textContent = status;
            this.elements.clockStatus.style.color = 
                status.includes('ready') || status.includes('Receiving') || status.includes('Running') ? '#4caf50' : 
                status.includes('fail') || status.includes('error') ? '#f44336' : '#666';
        }
    }
    
    // Update BPM display
    updateBpmDisplay() {
        if (this.elements.clockBpmDisplay) {
            this.elements.clockBpmDisplay.textContent = `${this.clockState.bpm} BPM`;
        }
    }
    
    // Set callback for beat events
    setMidiClockBeatCallback(callback) {
        this.clockState.onBeatCallback = callback;
    }
    
    // Get MIDI Clock state
    getMidiClockState() {
        return { ...this.clockState };
    }
    
    // Clean up resources
    destroy() {
        this.stopProgressTracking();
        this.stopMidiClock();
        this.state.isPlaying = false;
        this.state.scheduledNotes = [];
    }
}

// Make MIDI controller globally available
window.midiController = null;