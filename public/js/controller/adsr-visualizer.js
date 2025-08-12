// ADSR Envelope Visualizer for Echo Mesh
export class ADSRVisualizer {
    constructor() {
        this.canvas = document.getElementById('adsrCanvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        
        // ADSR controls
        this.elements = {
            attackSlider: document.getElementById('attackSlider'),
            attackTime: document.getElementById('attackTime'),
            decaySlider: document.getElementById('decaySlider'),
            decayTime: document.getElementById('decayTime'),
            sustainSlider: document.getElementById('sustainSlider'),
            sustainLevel: document.getElementById('sustainLevel'),
            releaseSlider: document.getElementById('releaseSlider'),
            releaseTime: document.getElementById('releaseTime'),
            previewButton: document.getElementById('previewADSR')
        };
        
        this.setupEventHandlers();
        this.drawEnvelope();
    }
    
    setupEventHandlers() {
        // Sync sliders and number inputs
        if (this.elements.attackSlider && this.elements.attackTime) {
            this.elements.attackSlider.addEventListener('input', (e) => {
                this.elements.attackTime.value = e.target.value;
                this.drawEnvelope();
            });
            
            this.elements.attackTime.addEventListener('input', (e) => {
                this.elements.attackSlider.value = e.target.value;
                this.drawEnvelope();
            });
        }
        
        if (this.elements.decaySlider && this.elements.decayTime) {
            this.elements.decaySlider.addEventListener('input', (e) => {
                this.elements.decayTime.value = e.target.value;
                this.drawEnvelope();
            });
            
            this.elements.decayTime.addEventListener('input', (e) => {
                this.elements.decaySlider.value = e.target.value;
                this.drawEnvelope();
            });
        }
        
        if (this.elements.sustainSlider && this.elements.sustainLevel) {
            this.elements.sustainSlider.addEventListener('input', (e) => {
                this.elements.sustainLevel.value = e.target.value;
                this.drawEnvelope();
            });
            
            this.elements.sustainLevel.addEventListener('input', (e) => {
                this.elements.sustainSlider.value = e.target.value;
                this.drawEnvelope();
            });
        }
        
        if (this.elements.releaseSlider && this.elements.releaseTime) {
            this.elements.releaseSlider.addEventListener('input', (e) => {
                this.elements.releaseTime.value = e.target.value;
                this.drawEnvelope();
            });
            
            this.elements.releaseTime.addEventListener('input', (e) => {
                this.elements.releaseSlider.value = e.target.value;
                this.drawEnvelope();
            });
        }
        
        // Preview button
        if (this.elements.previewButton) {
            this.elements.previewButton.addEventListener('click', () => {
                this.previewEnvelope();
            });
        }
    }
    
    getADSRValues() {
        return {
            attack: parseFloat(this.elements.attackTime?.value || 0.01),
            decay: parseFloat(this.elements.decayTime?.value || 0.1),
            sustain: parseFloat(this.elements.sustainLevel?.value || 0.5),
            release: parseFloat(this.elements.releaseTime?.value || 1.0)
        };
    }
    
    drawEnvelope() {
        if (!this.ctx || !this.canvas) return;
        
        const adsr = this.getADSRValues();
        const width = this.canvas.width;
        const height = this.canvas.height;
        const margin = 20;
        const plotWidth = width - 2 * margin;
        const plotHeight = height - 2 * margin;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, width, height);
        
        // Draw grid and labels
        this.drawGrid(margin, plotWidth, plotHeight);
        
        // Calculate time points
        const sustainDuration = 1.0; // Fixed sustain duration for visualization
        const totalDuration = adsr.attack + adsr.decay + sustainDuration + adsr.release;
        
        const attackEnd = adsr.attack / totalDuration;
        const decayEnd = (adsr.attack + adsr.decay) / totalDuration;
        const sustainEnd = (adsr.attack + adsr.decay + sustainDuration) / totalDuration;
        
        // Draw envelope curve
        this.ctx.strokeStyle = '#2196F3';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        
        // Start at origin
        this.ctx.moveTo(margin, margin + plotHeight);
        
        // Attack phase
        const attackX = margin + attackEnd * plotWidth;
        this.ctx.lineTo(attackX, margin);
        
        // Decay phase
        const decayX = margin + decayEnd * plotWidth;
        const sustainY = margin + (1 - adsr.sustain) * plotHeight;
        this.ctx.lineTo(decayX, sustainY);
        
        // Sustain phase
        const sustainX = margin + sustainEnd * plotWidth;
        this.ctx.lineTo(sustainX, sustainY);
        
        // Release phase
        this.ctx.lineTo(margin + plotWidth, margin + plotHeight);
        
        this.ctx.stroke();
        
        // Draw phase labels
        this.drawPhaseLabels(margin, plotWidth, plotHeight, {
            attackEnd, decayEnd, sustainEnd, adsr
        });
    }
    
    drawGrid(margin, plotWidth, plotHeight) {
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1;
        
        // Horizontal grid lines
        for (let i = 0; i <= 4; i++) {
            const y = margin + (i * plotHeight / 4);
            this.ctx.beginPath();
            this.ctx.moveTo(margin, y);
            this.ctx.lineTo(margin + plotWidth, y);
            this.ctx.stroke();
            
            // Amplitude labels
            if (i > 0 && i < 4) {
                this.ctx.fillStyle = '#666';
                this.ctx.font = '10px Arial';
                this.ctx.textAlign = 'right';
                this.ctx.fillText(`${(1 - i/4).toFixed(1)}`, margin - 5, y + 3);
            }
        }
        
        // Vertical grid lines
        for (let i = 0; i <= 8; i++) {
            const x = margin + (i * plotWidth / 8);
            this.ctx.beginPath();
            this.ctx.moveTo(x, margin);
            this.ctx.lineTo(x, margin + plotHeight);
            this.ctx.stroke();
        }
        
        // Axis labels
        this.ctx.fillStyle = '#333';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Time', margin + plotWidth/2, margin + plotHeight + 15);
        
        this.ctx.save();
        this.ctx.translate(10, margin + plotHeight/2);
        this.ctx.rotate(-Math.PI/2);
        this.ctx.fillText('Amplitude', 0, 0);
        this.ctx.restore();
    }
    
    drawPhaseLabels(margin, plotWidth, plotHeight, phases) {
        this.ctx.fillStyle = '#666';
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'center';
        
        // Attack label
        const attackMidX = margin + (phases.attackEnd / 2) * plotWidth;
        this.ctx.fillText('A', attackMidX, margin + plotHeight + 30);
        
        // Decay label
        const decayMidX = margin + ((phases.attackEnd + phases.decayEnd) / 2) * plotWidth;
        this.ctx.fillText('D', decayMidX, margin + plotHeight + 30);
        
        // Sustain label
        const sustainMidX = margin + ((phases.decayEnd + phases.sustainEnd) / 2) * plotWidth;
        this.ctx.fillText('S', sustainMidX, margin + plotHeight + 30);
        
        // Release label
        const releaseMidX = margin + ((phases.sustainEnd + 1) / 2) * plotWidth;
        this.ctx.fillText('R', releaseMidX, margin + plotHeight + 30);
        
        // Values
        this.ctx.font = '8px Arial';
        this.ctx.fillStyle = '#999';
        this.ctx.fillText(`${phases.adsr.attack}s`, attackMidX, margin + plotHeight + 42);
        this.ctx.fillText(`${phases.adsr.decay}s`, decayMidX, margin + plotHeight + 42);
        this.ctx.fillText(`${phases.adsr.sustain}`, sustainMidX, margin + plotHeight + 42);
        this.ctx.fillText(`${phases.adsr.release}s`, releaseMidX, margin + plotHeight + 42);
    }
    
    previewEnvelope() {
        // Create a simple audio preview using Web Audio API
        if (!window.AudioContext && !window.webkitAudioContext) {
            console.log('Web Audio API not supported');
            return;
        }
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        const adsr = this.getADSRValues();
        
        // Create oscillator and gain node
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        // Set up ADSR envelope
        const now = audioCtx.currentTime;
        const sustainDuration = 0.5; // Preview sustain duration
        
        // Start at 0
        gainNode.gain.setValueAtTime(0, now);
        
        // Attack
        gainNode.gain.linearRampToValueAtTime(0.3, now + adsr.attack);
        
        // Decay
        gainNode.gain.linearRampToValueAtTime(0.3 * adsr.sustain, now + adsr.attack + adsr.decay);
        
        // Sustain (hold the value)
        gainNode.gain.setValueAtTime(0.3 * adsr.sustain, now + adsr.attack + adsr.decay + sustainDuration);
        
        // Release
        gainNode.gain.linearRampToValueAtTime(0, now + adsr.attack + adsr.decay + sustainDuration + adsr.release);
        
        // Play tone
        oscillator.frequency.setValueAtTime(440, now); // A4 note
        oscillator.start(now);
        oscillator.stop(now + adsr.attack + adsr.decay + sustainDuration + adsr.release);
        
        // Visual feedback
        if (this.elements.previewButton) {
            const originalText = this.elements.previewButton.textContent;
            this.elements.previewButton.textContent = 'Playing...';
            this.elements.previewButton.disabled = true;
            
            setTimeout(() => {
                this.elements.previewButton.textContent = originalText;
                this.elements.previewButton.disabled = false;
            }, (adsr.attack + adsr.decay + sustainDuration + adsr.release) * 1000);
        }
    }
}

// Make ADSR visualizer globally available
window.adsrVisualizer = null;