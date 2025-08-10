// Client-side audio engine for Echo Mesh
import { CONSTANTS } from '../shared/constants.js';
import { AudioUtils } from '../shared/audio-utils.js';

export class ClientAudioEngine {
    constructor() {
        this.audioContext = null;
        this.masterVolume = 1.0;
        this.metronomeState = {
            isRunning: false,
            bpm: 120,
            volume: 0.3
        };
    }
    
    // Initialize audio context
    async initAudio() {
        try {
            this.audioContext = await AudioUtils.initAudioContext();
            console.log('Client audio context initialized');
            return true;
        } catch (error) {
            console.error('Client audio error:', error);
            throw error;
        }
    }
    
    // Main sound synthesis function
    async playSound(type = 'sine', customFrequency = null, playTime = 0, adsr = null, lfo = null, pan = 0) {
        if (!this.audioContext) {
            await this.initAudio();
        }
        
        const scheduledTime = playTime === 0 ? this.audioContext.currentTime : playTime;
        adsr = adsr || CONSTANTS.AUDIO.DEFAULT_ADSR;
        lfo = lfo || CONSTANTS.AUDIO.DEFAULT_LFO;
        
        try {
            let baseFrequency = customFrequency || 440;
            let oscillator;
            let isNoise = false;
            
            // Create different types of sound sources
            oscillator = await this.createOscillator(type, baseFrequency, scheduledTime);
            
            // Create gain node for ADSR envelope
            const gainNode = this.audioContext.createGain();
            const endTime = AudioUtils.applyADSR(gainNode, adsr, scheduledTime, this.audioContext);
            
            // Create compressor and limiter for safe volume levels
            const compressor = AudioUtils.createCompressor(this.audioContext, scheduledTime);
            const limiter = this.audioContext.createGain();
            const finalVolume = CONSTANTS.AUDIO.MASTER_VOLUME * this.masterVolume;
            limiter.gain.setValueAtTime(finalVolume, scheduledTime);
            
            // LFO Implementation
            if (lfo && lfo.depth > 0) {
                const lfoNodes = AudioUtils.createLFO(this.audioContext, lfo, scheduledTime, endTime);
                if (lfoNodes) {
                    if (lfo.target === 'vibrato' && oscillator.frequency) {
                        lfoNodes.gain.connect(oscillator.frequency);
                    } else if (lfo.target === 'tremolo') {
                        lfoNodes.gain.connect(gainNode.gain);
                    }
                }
            }
            
            // Panning
            const panner = this.audioContext.createStereoPanner();
            panner.pan.setValueAtTime(pan, scheduledTime);
            
            // Effects chain
            let effectsChain = gainNode;
            effectsChain = this.addEffects(effectsChain, lfo, scheduledTime);
            
            // Connect audio graph
            oscillator.connect(gainNode);
            effectsChain.connect(compressor);
            compressor.connect(panner);
            panner.connect(limiter);
            limiter.connect(this.audioContext.destination);
            
            // Start the oscillator
            this.startOscillator(oscillator, scheduledTime, endTime);
            
            return true;
        } catch (error) {
            console.error('Error playing sound:', error);
            return false;
        }
    }
    
    // Create different types of oscillators
    async createOscillator(type, frequency, scheduledTime) {
        switch (type) {
            case 'noise':
            case 'whitenoise':
                return this.createNoiseSource('white', frequency, scheduledTime);
                
            case 'pinknoise':
                return this.createNoiseSource('pink', frequency, scheduledTime);
                
            case 'organ':
                return this.createOrganSound(frequency, scheduledTime);
                
            case 'filteredsawtooth':
                return this.createFilteredSawtooth(frequency, scheduledTime);
                
            case 'kick':
                return this.createKickDrum(scheduledTime);
                
            case 'snare':
                return this.createSnareDrum(scheduledTime);
                
            case 'hihat':
                return this.createHiHat(scheduledTime);
                
            case 'rain':
            case 'wind':
                return this.createSoundEffect(type, scheduledTime);
                
            default:
                // Standard oscillator types
                const oscillator = this.audioContext.createOscillator();
                oscillator.type = type;
                oscillator.frequency.setValueAtTime(frequency, scheduledTime);
                return oscillator;
        }
    }
    
    // Create noise source with optional filtering
    createNoiseSource(noiseType, frequency, scheduledTime) {
        const noiseBuffer = AudioUtils.createNoiseBuffer(this.audioContext, noiseType);
        const source = this.audioContext.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        
        // Add filter to simulate frequency
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(frequency, scheduledTime);
        filter.Q.setValueAtTime(10, scheduledTime);
        
        source.connect(filter);
        return filter;
    }
    
    // Create organ-like sound with harmonics
    createOrganSound(frequency, scheduledTime) {
        const fundamental = this.audioContext.createOscillator();
        const harmonic2 = this.audioContext.createOscillator();
        const harmonic3 = this.audioContext.createOscillator();
        const harmonic4 = this.audioContext.createOscillator();
        
        [fundamental, harmonic2, harmonic3, harmonic4].forEach(osc => osc.type = 'sine');
        
        fundamental.frequency.setValueAtTime(frequency, scheduledTime);
        harmonic2.frequency.setValueAtTime(frequency * 2, scheduledTime);
        harmonic3.frequency.setValueAtTime(frequency * 3, scheduledTime);
        harmonic4.frequency.setValueAtTime(frequency * 4, scheduledTime);
        
        const mixer = this.audioContext.createGain();
        const gains = [0.8, 0.3, 0.15, 0.05];
        
        [fundamental, harmonic2, harmonic3, harmonic4].forEach((osc, i) => {
            const gain = this.audioContext.createGain();
            gain.gain.setValueAtTime(gains[i], scheduledTime);
            osc.connect(gain);
            gain.connect(mixer);
        });
        
        // Store oscillators for cleanup
        mixer._organOscillators = [fundamental, harmonic2, harmonic3, harmonic4];
        return mixer;
    }
    
    // Create filtered sawtooth
    createFilteredSawtooth(frequency, scheduledTime) {
        const oscillator = this.audioContext.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(frequency, scheduledTime);
        
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(frequency * 2, scheduledTime);
        filter.Q.setValueAtTime(5, scheduledTime);
        
        oscillator.connect(filter);
        return filter;
    }
    
    // Create kick drum
    createKickDrum(scheduledTime) {
        const oscillator = this.audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(60, scheduledTime);
        oscillator.frequency.exponentialRampToValueAtTime(0.01, scheduledTime + 0.5);
        
        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(1, scheduledTime);
        gain.gain.exponentialRampToValueAtTime(0.01, scheduledTime + 0.5);
        
        oscillator.connect(gain);
        return gain;
    }
    
    // Create snare drum
    createSnareDrum(scheduledTime) {
        const toneOsc = this.audioContext.createOscillator();
        toneOsc.type = 'square';
        toneOsc.frequency.setValueAtTime(200, scheduledTime);
        
        const noiseBuffer = AudioUtils.createNoiseBuffer(this.audioContext, 'white', 0.2);
        const noiseSource = this.audioContext.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1000, scheduledTime);
        
        const mixer = this.audioContext.createGain();
        const toneGain = this.audioContext.createGain();
        const noiseGain = this.audioContext.createGain();
        
        toneGain.gain.setValueAtTime(0.5, scheduledTime);
        noiseGain.gain.setValueAtTime(0.8, scheduledTime);
        
        toneOsc.connect(toneGain);
        noiseSource.connect(filter);
        filter.connect(noiseGain);
        
        toneGain.connect(mixer);
        noiseGain.connect(mixer);
        
        // Store sources for cleanup
        mixer._snareSources = [toneOsc, noiseSource];
        return mixer;
    }
    
    // Create hi-hat
    createHiHat(scheduledTime) {
        const buffer = AudioUtils.createSoundBuffer(this.audioContext, 'hihat');
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        
        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(7000, scheduledTime);
        
        source.connect(filter);
        return filter;
    }
    
    // Create sound effects (rain, wind)
    createSoundEffect(type, scheduledTime) {
        const buffer = AudioUtils.createSoundBuffer(this.audioContext, type);
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        return source;
    }
    
    // Add effects to the audio chain
    addEffects(inputNode, lfo, scheduledTime) {
        let effectsChain = inputNode;
        
        // Add reverb
        if (lfo && lfo.target === 'reverb' && lfo.depth > 0) {
            const convolver = this.audioContext.createConvolver();
            const reverbTime = lfo.depth / 100;
            const reverbBuffer = AudioUtils.createReverbBuffer(this.audioContext, reverbTime, 0.3);
            convolver.buffer = reverbBuffer;
            
            const dryGain = this.audioContext.createGain();
            const wetGain = this.audioContext.createGain();
            const mixer = this.audioContext.createGain();
            
            dryGain.gain.setValueAtTime(0.7, scheduledTime);
            wetGain.gain.setValueAtTime(0.3, scheduledTime);
            
            effectsChain.connect(dryGain);
            effectsChain.connect(convolver);
            convolver.connect(wetGain);
            
            dryGain.connect(mixer);
            wetGain.connect(mixer);
            
            effectsChain = mixer;
        }
        
        // Add delay
        if (lfo && lfo.target === 'delay' && lfo.depth > 0) {
            const delay = this.audioContext.createDelay(1.0);
            const delayTime = lfo.rate / 10;
            const feedback = this.audioContext.createGain();
            const mixer = this.audioContext.createGain();
            
            delay.delayTime.setValueAtTime(delayTime, scheduledTime);
            feedback.gain.setValueAtTime(lfo.depth / 100, scheduledTime);
            
            effectsChain.connect(mixer);
            effectsChain.connect(delay);
            delay.connect(feedback);
            feedback.connect(delay);
            delay.connect(mixer);
            
            effectsChain = mixer;
        }
        
        return effectsChain;
    }
    
    // Start oscillator with cleanup handling
    startOscillator(oscillator, scheduledTime, endTime) {
        if (oscillator._organOscillators) {
            // Start all organ oscillators
            oscillator._organOscillators.forEach(osc => {
                osc.start(scheduledTime);
                osc.stop(endTime);
            });
        } else if (oscillator._snareSources) {
            // Start snare sources
            oscillator._snareSources.forEach(source => {
                source.start(scheduledTime);
                source.stop(scheduledTime + 0.2);
            });
        } else if (oscillator.start) {
            oscillator.start(scheduledTime);
            if (oscillator.stop) {
                oscillator.stop(endTime);
            }
        }
    }
    
    // Play metronome click
    async playMetronomeClick(isDownbeat = false, playTime = 0) {
        if (!this.audioContext) return false;
        
        try {
            const scheduledTime = playTime === 0 ? this.audioContext.currentTime : playTime;
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.frequency.setValueAtTime(isDownbeat ? 1000 : 800, scheduledTime);
            oscillator.type = 'square';
            
            gainNode.gain.setValueAtTime(0, scheduledTime);
            gainNode.gain.linearRampToValueAtTime(this.metronomeState.volume, scheduledTime + 0.001);
            gainNode.gain.exponentialRampToValueAtTime(0.001, scheduledTime + 0.1);
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.start(scheduledTime);
            oscillator.stop(scheduledTime + 0.1);
            
            return true;
        } catch (error) {
            console.error('Error playing metronome:', error);
            return false;
        }
    }
    
    // Set master volume
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
    }
    
    // Update metronome state
    updateMetronomeState(state) {
        this.metronomeState = { ...this.metronomeState, ...state };
    }
}