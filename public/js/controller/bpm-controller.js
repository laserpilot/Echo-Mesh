// Master BPM Controller for Echo Mesh
export class BPMController {
    constructor(metronomeController, chordController) {
        this.metronomeController = metronomeController;
        this.chordController = chordController;
        
        this.masterBpm = 120;
        this.tapTimes = [];
        this.maxTapTimes = 8;
        
        // DOM elements (now using global controls)
        this.elements = {
            masterBpm: document.getElementById('globalBpm'),
            masterBpmSlider: document.getElementById('globalBpmSlider'),
            masterBpmValue: document.getElementById('globalBpmValue'),
            tapBpmButton: document.getElementById('tapBpmButton'),
            sequencerBpm: document.getElementById('sequencerBpm'),
            chordDuration: document.getElementById('chordDuration')
        };
        
        this.setupEventHandlers();
        this.updateAllBpmControls();
    }
    
    setupEventHandlers() {
        // Master BPM number input
        if (this.elements.masterBpm) {
            this.elements.masterBpm.addEventListener('input', (e) => {
                this.setBPM(parseInt(e.target.value));
            });
        }
        
        // Master BPM slider
        if (this.elements.masterBpmSlider) {
            this.elements.masterBpmSlider.addEventListener('input', (e) => {
                this.setBPM(parseInt(e.target.value));
            });
        }
        
        // Tap BPM button
        if (this.elements.tapBpmButton) {
            this.elements.tapBpmButton.addEventListener('click', () => {
                this.tapBPM();
            });
        }
        
        // Sync other BPM controls to master when they change
        
        if (this.elements.sequencerBpm) {
            this.elements.sequencerBpm.addEventListener('input', (e) => {
                this.setBPM(parseInt(e.target.value));
            });
        }
    }
    
    setBPM(bpm) {
        if (isNaN(bpm) || bpm < 60 || bpm > 200) return;
        
        this.masterBpm = bpm;
        this.updateAllBpmControls();
        this.propagateBPMToControllers();
    }
    
    updateAllBpmControls() {
        // Update master controls
        if (this.elements.masterBpm) {
            this.elements.masterBpm.value = this.masterBpm;
        }
        if (this.elements.masterBpmSlider) {
            this.elements.masterBpmSlider.value = this.masterBpm;
        }
        if (this.elements.masterBpmValue) {
            this.elements.masterBpmValue.textContent = `${this.masterBpm} BPM`;
        }
        
        // Update other BPM controls
        if (this.elements.sequencerBpm) {
            this.elements.sequencerBpm.value = this.masterBpm;
        }
        
        // Note: Chord duration is now handled by musical note values
        // The chord controller will calculate actual milliseconds based on BPM
        // No need to update chordDuration element here as it's now musical notation
    }
    
    propagateBPMToControllers() {
        // Update metronome if it exists and is running
        if (this.metronomeController && this.metronomeController.state?.isRunning) {
            // Restart metronome with new BPM
            this.metronomeController.stop();
            setTimeout(() => {
                this.metronomeController.start();
            }, 50);
        }
        
        // Update chord controller BPM
        if (this.chordController) {
            this.chordController.state.bpm = this.masterBpm;
            
            // Update chord duration display with new BPM
            if (typeof this.chordController.updateChordDurationDisplay === 'function') {
                this.chordController.updateChordDurationDisplay();
            }
            
            // If chord progression is running, restart with new tempo
            if (this.chordController.state.isRunning) {
                this.chordController.stop();
                setTimeout(() => {
                    this.chordController.start();
                }, 100);
            }
        }
    }
    
    tapBPM() {
        const now = Date.now();
        this.tapTimes.push(now);
        
        // Keep only recent taps (last maxTapTimes)
        if (this.tapTimes.length > this.maxTapTimes) {
            this.tapTimes.shift();
        }
        
        // Need at least 2 taps to calculate BPM
        if (this.tapTimes.length < 2) {
            this.updateTapButtonFeedback(1);
            return;
        }
        
        // Calculate average interval between taps
        const intervals = [];
        for (let i = 1; i < this.tapTimes.length; i++) {
            intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
        }
        
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const calculatedBPM = Math.round(60000 / avgInterval);
        
        // Only accept reasonable BPM values
        if (calculatedBPM >= 60 && calculatedBPM <= 200) {
            this.setBPM(calculatedBPM);
        }
        
        this.updateTapButtonFeedback(this.tapTimes.length);
        
        // Clear taps after 3 seconds of inactivity
        setTimeout(() => {
            if (this.tapTimes.length > 0 && Date.now() - this.tapTimes[this.tapTimes.length - 1] > 3000) {
                this.tapTimes = [];
                this.resetTapButtonFeedback();
            }
        }, 3000);
    }
    
    updateTapButtonFeedback(tapCount) {
        if (this.elements.tapBpmButton) {
            this.elements.tapBpmButton.textContent = `Tap (${tapCount})`;
            this.elements.tapBpmButton.style.backgroundColor = '#4CAF50';
        }
    }
    
    resetTapButtonFeedback() {
        if (this.elements.tapBpmButton) {
            this.elements.tapBpmButton.textContent = 'Tap BPM';
            this.elements.tapBpmButton.style.backgroundColor = '#FF9800';
        }
    }
    
    // Get current BPM
    getBPM() {
        return this.masterBpm;
    }
    
    // Convert BPM to chord duration in milliseconds
    bpmToChordDuration(bpm = null) {
        const useBpm = bpm || this.masterBpm;
        return Math.round(60000 / useBpm);
    }
    
    // Convert chord duration to BPM
    chordDurationToBpm(duration) {
        return Math.round(60000 / duration);
    }
}

// Make BPM controller globally available
window.bpmController = null;