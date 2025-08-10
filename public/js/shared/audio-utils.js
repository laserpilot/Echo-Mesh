// Shared audio utilities for Echo Mesh
import { CONSTANTS } from './constants.js';

export class AudioUtils {
    
    // Create reverb impulse response buffer
    static createReverbBuffer(audioContext, reverbTime, decay) {
        const sampleRate = audioContext.sampleRate;
        const length = sampleRate * reverbTime;
        const impulse = audioContext.createBuffer(2, length, sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                const n = length - i;
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
            }
        }
        
        return impulse;
    }
    
    // Create noise buffers
    static createNoiseBuffer(audioContext, type = 'white', duration = 2) {
        const bufferSize = audioContext.sampleRate * duration;
        const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        
        if (type === 'white') {
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
        } else if (type === 'pink') {
            // Pink noise generation using simple filtering
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                output[i] *= 0.11;
                b6 = white * 0.115926;
            }
        }
        
        return noiseBuffer;
    }
    
    // Create specialized sound buffers
    static createSoundBuffer(audioContext, type, duration = 2) {
        const bufferSize = audioContext.sampleRate * duration;
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const output = buffer.getChannelData(0);
        
        switch (type) {
            case 'rain':
                for (let i = 0; i < bufferSize; i++) {
                    const white = Math.random() * 2 - 1;
                    const filtered = white * Math.exp(-i / bufferSize * 3);
                    output[i] = filtered * 0.3;
                }
                break;
                
            case 'wind':
                for (let i = 0; i < bufferSize; i++) {
                    const t = i / audioContext.sampleRate;
                    const lowFreq = Math.sin(t * Math.PI * 0.5) * 0.3;
                    const noise = (Math.random() * 2 - 1) * 0.2;
                    output[i] = lowFreq + noise;
                }
                break;
                
            case 'hihat':
                const hihatDuration = 0.1;
                const hihatSize = audioContext.sampleRate * hihatDuration;
                for (let i = 0; i < Math.min(hihatSize, bufferSize); i++) {
                    output[i] = (Math.random() * 2 - 1) * Math.exp(-i / hihatSize * 5);
                }
                break;
        }
        
        return buffer;
    }
    
    // Calculate frequency from client ID for consistent pitch assignment
    static getClientFrequency(clientId, baseFrequency = 220) {
        if (!clientId) return baseFrequency;
        
        const clientHash = clientId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const step = CONSTANTS.AUDIO.PENTATONIC_STEPS[clientHash % CONSTANTS.AUDIO.PENTATONIC_STEPS.length];
        return baseFrequency * Math.pow(2, step / 12);
    }
    
    // Find note name from frequency
    static findNoteFromFrequency(frequency, tolerance = 10) {
        let closestNote = null;
        let smallestDiff = Infinity;
        
        Object.entries(CONSTANTS.AUDIO.NOTE_FREQUENCIES).forEach(([note, freq]) => {
            const diff = Math.abs(frequency - freq);
            if (diff < smallestDiff) {
                smallestDiff = diff;
                closestNote = note;
            }
        });
        
        return smallestDiff < tolerance ? closestNote : null;
    }
    
    // Initialize or resume audio context
    static async initAudioContext() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            
            return audioContext;
        } catch (error) {
            console.error('Error initializing AudioContext:', error);
            throw error;
        }
    }
    
    // Create and configure compressor for safe audio levels
    static createCompressor(audioContext, scheduledTime = 0) {
        const compressor = audioContext.createDynamicsCompressor();
        const settings = CONSTANTS.AUDIO.COMPRESSOR_SETTINGS;
        
        compressor.threshold.setValueAtTime(settings.threshold, scheduledTime);
        compressor.knee.setValueAtTime(settings.knee, scheduledTime);
        compressor.ratio.setValueAtTime(settings.ratio, scheduledTime);
        compressor.attack.setValueAtTime(settings.attack, scheduledTime);
        compressor.release.setValueAtTime(settings.release, scheduledTime);
        
        return compressor;
    }
    
    // Apply ADSR envelope to a gain node
    static applyADSR(gainNode, adsr, scheduledTime = 0, audioContext) {
        const currentTime = scheduledTime || audioContext.currentTime;
        
        gainNode.gain.setValueAtTime(0, currentTime);
        gainNode.gain.linearRampToValueAtTime(1.0, currentTime + adsr.attack);
        gainNode.gain.linearRampToValueAtTime(adsr.sustain, currentTime + adsr.attack + adsr.decay);
        
        const releaseStartTime = currentTime + adsr.attack + adsr.decay;
        gainNode.gain.setValueAtTime(adsr.sustain, releaseStartTime);
        gainNode.gain.linearRampToValueAtTime(0, releaseStartTime + adsr.release);
        
        return releaseStartTime + adsr.release; // Return the end time
    }
    
    // Create LFO (Low Frequency Oscillator)
    static createLFO(audioContext, lfo, scheduledTime, endTime) {
        if (!lfo || lfo.depth <= 0) return null;
        
        const lfoNode = audioContext.createOscillator();
        const lfoGain = audioContext.createGain();
        
        lfoNode.type = lfo.type || 'sine';
        lfoNode.frequency.setValueAtTime(lfo.rate || 5, scheduledTime);
        lfoGain.gain.setValueAtTime(lfo.depth, scheduledTime);
        
        lfoNode.connect(lfoGain);
        lfoNode.start(scheduledTime);
        lfoNode.stop(endTime);
        
        return { oscillator: lfoNode, gain: lfoGain };
    }
}