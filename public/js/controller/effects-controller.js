// Effects Chain Controller for Echo Mesh
export class EffectsController {
    constructor() {
        this.effectsChain = [];
        this.effectSettings = new Map();
        
        // DOM elements
        this.elements = {
            effectsChainDisplay: document.getElementById('effectsChainDisplay'),
            clearEffectsChain: document.getElementById('clearEffectsChain'),
            bypassAllEffects: document.getElementById('bypassAllEffects'),
            previewEffectsChain: document.getElementById('previewEffectsChain')
        };
        
        // Default effect parameters
        this.defaultEffectParams = {
            reverb: { roomSize: 0.3, damping: 0.5, wetGain: 0.2 },
            delay: { delayTime: 0.25, feedback: 0.3, wetGain: 0.2 },
            distortion: { amount: 0.3, tone: 0.5 },
            chorus: { rate: 1.5, depth: 0.3, wetGain: 0.3 },
            filter: { frequency: 1000, resonance: 1, type: 'lowpass' },
            compressor: { threshold: -24, ratio: 3, attack: 0.01, release: 0.1 },
            eq: { lowGain: 0, midGain: 0, highGain: 0, lowFreq: 320, highFreq: 3200 },
            phaser: { rate: 0.5, depth: 1, feedback: 0.7 }
        };
        
        this.setupEventHandlers();
        this.updateEffectsDisplay();
    }
    
    setupEventHandlers() {
        // Effect add buttons
        document.querySelectorAll('.effect-add-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const effectType = e.target.getAttribute('data-effect');
                this.addEffect(effectType);
            });
        });
        
        // Clear effects chain button
        if (this.elements.clearEffectsChain) {
            this.elements.clearEffectsChain.addEventListener('click', () => {
                this.clearEffectsChain();
            });
        }
        
        // Bypass all effects button
        if (this.elements.bypassAllEffects) {
            this.elements.bypassAllEffects.addEventListener('click', () => {
                this.toggleBypassAll();
            });
        }
        
        // Preview effects chain button
        if (this.elements.previewEffectsChain) {
            this.elements.previewEffectsChain.addEventListener('click', () => {
                this.previewEffectsChain();
            });
        }
    }
    
    addEffect(effectType) {
        if (!this.defaultEffectParams[effectType]) {
            console.error(`Unknown effect type: ${effectType}`);
            return;
        }
        
        const effectId = `${effectType}_${Date.now()}`;
        const effect = {
            id: effectId,
            type: effectType,
            enabled: true,
            parameters: { ...this.defaultEffectParams[effectType] }
        };
        
        this.effectsChain.push(effect);
        this.effectSettings.set(effectId, effect);
        this.updateEffectsDisplay();
        
        console.log(`Added ${effectType} effect to chain`);
    }
    
    removeEffect(effectId) {
        this.effectsChain = this.effectsChain.filter(effect => effect.id !== effectId);
        this.effectSettings.delete(effectId);
        this.updateEffectsDisplay();
    }
    
    toggleEffect(effectId) {
        const effect = this.effectSettings.get(effectId);
        if (effect) {
            effect.enabled = !effect.enabled;
            this.updateEffectsDisplay();
        }
    }
    
    clearEffectsChain() {
        this.effectsChain = [];
        this.effectSettings.clear();
        this.updateEffectsDisplay();
        console.log('Effects chain cleared');
    }
    
    toggleBypassAll() {
        const allEnabled = this.effectsChain.every(effect => effect.enabled);
        
        this.effectsChain.forEach(effect => {
            effect.enabled = !allEnabled;
        });
        
        this.updateEffectsDisplay();
        console.log(`All effects ${allEnabled ? 'bypassed' : 'enabled'}`);
    }
    
    updateEffectsDisplay() {
        if (!this.elements.effectsChainDisplay) return;
        
        if (this.effectsChain.length === 0) {
            this.elements.effectsChainDisplay.innerHTML = `
                <div class="effects-placeholder">No effects active - Add effects below</div>
            `;
            return;
        }
        
        this.elements.effectsChainDisplay.innerHTML = this.effectsChain.map((effect, index) => {
            const icon = this.getEffectIcon(effect.type);
            const enabledClass = effect.enabled ? 'enabled' : 'disabled';
            const parameterControls = this.generateParameterControls(effect);
            
            return `
                <div class="effect-item ${enabledClass}" data-effect-id="${effect.id}" 
                     style="display: flex; flex-direction: column; gap: 8px; 
                            padding: 12px; background: ${effect.enabled ? '#e3f2fd' : '#f5f5f5'}; 
                            border-radius: 8px; border: 1px solid ${effect.enabled ? '#2196f3' : '#ddd'};
                            margin-bottom: 12px; min-width: 250px;">
                    
                    <!-- Effect Header -->
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 18px;">${icon}</span>
                            <span style="font-size: 14px; font-weight: bold; color: ${effect.enabled ? '#1976d2' : '#999'};">
                                ${effect.type.toUpperCase()}
                            </span>
                        </div>
                        <div style="display: flex; gap: 6px;">
                            <button class="effect-toggle" data-effect-id="${effect.id}" 
                                    style="padding: 4px 8px; font-size: 11px; border: none; border-radius: 4px;
                                           background: ${effect.enabled ? '#ff9800' : '#4caf50'}; color: white;">
                                ${effect.enabled ? 'Bypass' : 'Enable'}
                            </button>
                            <button class="effect-remove" data-effect-id="${effect.id}"
                                    style="padding: 4px 8px; font-size: 11px; border: none; border-radius: 4px;
                                           background: #f44336; color: white;">
                                Remove
                            </button>
                        </div>
                    </div>
                    
                    <!-- Effect Parameters -->
                    ${effect.enabled ? `
                        <div class="effect-parameters" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; 
                                                             background: rgba(255,255,255,0.3); padding: 8px; border-radius: 4px;">
                            ${parameterControls}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
        
        // Add event listeners to new buttons
        this.elements.effectsChainDisplay.querySelectorAll('.effect-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const effectId = e.target.getAttribute('data-effect-id');
                this.toggleEffect(effectId);
            });
        });
        
        this.elements.effectsChainDisplay.querySelectorAll('.effect-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const effectId = e.target.getAttribute('data-effect-id');
                this.removeEffect(effectId);
            });
        });
        
        // Add event listeners to parameter controls
        this.elements.effectsChainDisplay.querySelectorAll('.param-control').forEach(control => {
            control.addEventListener('input', (e) => {
                const effectId = e.target.getAttribute('data-effect-id');
                const paramName = e.target.getAttribute('data-param');
                const value = parseFloat(e.target.value);
                this.updateEffectParameter(effectId, paramName, value);
                
                // Update value display
                const valueDisplay = e.target.parentElement.querySelector('.param-value');
                if (valueDisplay) {
                    valueDisplay.textContent = this.formatParameterValue(paramName, value);
                }
            });
        });
    }
    
    // Generate parameter controls for an effect
    generateParameterControls(effect) {
        const params = effect.parameters;
        const effectId = effect.id;
        
        const parameterDefinitions = this.getParameterDefinitions(effect.type);
        
        return Object.entries(parameterDefinitions).map(([paramName, def]) => {
            const value = params[paramName] !== undefined ? params[paramName] : def.default;
            const displayValue = this.formatParameterValue(paramName, value);
            
            return `
                <div style="display: flex; flex-direction: column; gap: 2px;">
                    <label style="font-size: 11px; font-weight: bold; color: #333;">${def.label}</label>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <input type="range" 
                               class="param-control" 
                               data-effect-id="${effectId}" 
                               data-param="${paramName}"
                               min="${def.min}" 
                               max="${def.max}" 
                               step="${def.step}" 
                               value="${value}"
                               style="flex: 1; height: 4px;">
                        <span class="param-value" style="font-size: 10px; min-width: 35px; text-align: right;">${displayValue}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Get parameter definitions for each effect type
    getParameterDefinitions(effectType) {
        const definitions = {
            reverb: {
                roomSize: { label: 'Room', min: 0.1, max: 1.0, step: 0.01, default: 0.3 },
                damping: { label: 'Damp', min: 0.0, max: 1.0, step: 0.01, default: 0.5 },
                wetGain: { label: 'Wet', min: 0.0, max: 1.0, step: 0.01, default: 0.2 }
            },
            delay: {
                delayTime: { label: 'Time', min: 0.01, max: 1.0, step: 0.01, default: 0.25 },
                feedback: { label: 'Feedback', min: 0.0, max: 0.9, step: 0.01, default: 0.3 },
                wetGain: { label: 'Wet', min: 0.0, max: 1.0, step: 0.01, default: 0.2 }
            },
            distortion: {
                amount: { label: 'Amount', min: 0.0, max: 1.0, step: 0.01, default: 0.3 },
                tone: { label: 'Tone', min: 0.0, max: 1.0, step: 0.01, default: 0.5 }
            },
            chorus: {
                rate: { label: 'Rate', min: 0.1, max: 10.0, step: 0.1, default: 1.5 },
                depth: { label: 'Depth', min: 0.0, max: 1.0, step: 0.01, default: 0.3 },
                wetGain: { label: 'Wet', min: 0.0, max: 1.0, step: 0.01, default: 0.3 }
            },
            filter: {
                frequency: { label: 'Freq', min: 80, max: 8000, step: 10, default: 1000 },
                resonance: { label: 'Q', min: 0.1, max: 20, step: 0.1, default: 1 },
                type: { label: 'Type', min: 0, max: 3, step: 1, default: 0 } // 0=lowpass, 1=highpass, 2=bandpass, 3=notch
            },
            compressor: {
                threshold: { label: 'Thresh', min: -60, max: 0, step: 1, default: -24 },
                ratio: { label: 'Ratio', min: 1, max: 20, step: 0.1, default: 3 },
                attack: { label: 'Attack', min: 0.001, max: 0.1, step: 0.001, default: 0.01 },
                release: { label: 'Release', min: 0.01, max: 1.0, step: 0.01, default: 0.1 }
            },
            eq: {
                lowGain: { label: 'Low', min: -12, max: 12, step: 0.1, default: 0 },
                midGain: { label: 'Mid', min: -12, max: 12, step: 0.1, default: 0 },
                highGain: { label: 'High', min: -12, max: 12, step: 0.1, default: 0 }
            },
            phaser: {
                rate: { label: 'Rate', min: 0.1, max: 10.0, step: 0.1, default: 0.5 },
                depth: { label: 'Depth', min: 0.0, max: 1.0, step: 0.01, default: 1.0 },
                feedback: { label: 'Feedback', min: 0.0, max: 0.9, step: 0.01, default: 0.7 }
            }
        };
        
        return definitions[effectType] || {};
    }
    
    // Format parameter values for display
    formatParameterValue(paramName, value) {
        if (paramName === 'frequency') {
            return value >= 1000 ? `${(value/1000).toFixed(1)}k` : `${Math.round(value)}`;
        } else if (paramName === 'delayTime') {
            return `${(value * 1000).toFixed(0)}ms`;
        } else if (paramName === 'threshold') {
            return `${value.toFixed(0)}dB`;
        } else if (paramName === 'ratio') {
            return `${value.toFixed(1)}:1`;
        } else if (paramName.includes('Gain') || paramName.includes('gain')) {
            return value >= 0 ? `+${value.toFixed(1)}dB` : `${value.toFixed(1)}dB`;
        } else if (paramName === 'type') {
            const types = ['LP', 'HP', 'BP', 'Notch'];
            return types[Math.round(value)] || 'LP';
        } else if (paramName.includes('wet') || paramName.includes('Wet')) {
            return `${Math.round(value * 100)}%`;
        } else {
            return value.toFixed(2);
        }
    }
    
    // Update effect parameter
    updateEffectParameter(effectId, paramName, value) {
        const effect = this.effectSettings.get(effectId);
        if (effect) {
            effect.parameters[paramName] = value;
            console.log(`Updated ${effect.type} ${paramName}: ${value}`);
        }
    }
    
    getEffectIcon(effectType) {
        const icons = {
            reverb: '🏛️',
            delay: '⏰',
            distortion: '🔥',
            chorus: '🌊',
            filter: '🎚️',
            compressor: '📦',
            eq: '📊',
            phaser: '🌀'
        };
        return icons[effectType] || '🎵';
    }
    
    // Get current effects for sending to clients
    getActiveEffects() {
        return this.effectsChain
            .filter(effect => effect.enabled)
            .map(effect => ({
                type: effect.type,
                parameters: effect.parameters
            }));
    }
    
    // Apply effects to audio message
    applyEffectsToMessage(message) {
        const activeEffects = this.getActiveEffects();
        if (activeEffects.length > 0) {
            message.effects = activeEffects;
        }
        return message;
    }
    
    // Preview effects chain with local audio
    previewEffectsChain() {
        // Create a temporary Web Audio context for preview
        if (!window.AudioContext && !window.webkitAudioContext) {
            console.warn('Web Audio API not supported');
            return;
        }
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const duration = 2.0; // 2 second preview
        
        try {
            // Create oscillator for preview tone
            const oscillator = audioContext.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.value = 440; // A4
            
            // Create gain node for input
            const inputGain = audioContext.createGain();
            inputGain.gain.value = 0.3;
            
            // Connect oscillator to input gain
            oscillator.connect(inputGain);
            
            // Apply effects chain - this will return the final output node of the chain
            let outputNode = this.createEffectsChain(audioContext, inputGain);
            
            // Connect final output to destination
            outputNode.connect(audioContext.destination);
            
            // Play preview
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration);
            
            // Clean up after preview
            setTimeout(() => {
                audioContext.close();
            }, duration * 1000 + 100);
            
            console.log('Playing effects chain preview...', `${this.effectsChain.length} effects active`);
            
        } catch (error) {
            console.error('Failed to preview effects:', error);
            audioContext.close();
        }
    }
    
    // Create effects chain for Web Audio context
    createEffectsChain(audioContext, inputNode) {
        let currentNode = inputNode;
        let effectsApplied = 0;
        
        // Apply each effect in the chain
        this.effectsChain.forEach(effect => {
            if (!effect.enabled) return;
            
            try {
                const newNode = this.createEffect(audioContext, effect, currentNode);
                if (newNode && newNode !== currentNode) {
                    currentNode = newNode;
                    effectsApplied++;
                    console.log(`Applied effect: ${effect.type}`);
                }
            } catch (error) {
                console.warn(`Failed to create effect ${effect.type}:`, error);
            }
        });
        
        console.log(`Effects chain created: ${effectsApplied} effects applied`);
        return currentNode;
    }
    
    // Create a specific effect node
    createEffect(audioContext, effect, inputNode) {
        const params = effect.parameters;
        
        switch (effect.type) {
            case 'reverb':
                return this.createReverbEffect(audioContext, inputNode, params);
                
            case 'delay':
                return this.createDelayEffect(audioContext, inputNode, params);
                
            case 'filter':
                return this.createFilterEffect(audioContext, inputNode, params);
                
            case 'distortion':
                return this.createDistortionEffect(audioContext, inputNode, params);
                
            case 'compressor':
                return this.createCompressorEffect(audioContext, inputNode, params);
                
            case 'eq':
                return this.createEQEffect(audioContext, inputNode, params);
                
            default:
                console.warn(`Effect ${effect.type} not implemented for preview`);
                return inputNode;
        }
    }
    
    // Create reverb effect (simplified)
    createReverbEffect(audioContext, inputNode, params) {
        const convolver = audioContext.createConvolver();
        const wetGain = audioContext.createGain();
        const dryGain = audioContext.createGain();
        const output = audioContext.createGain();
        
        // Create simple impulse response
        const sampleRate = audioContext.sampleRate;
        const length = sampleRate * (params.roomSize || 0.3);
        const impulse = audioContext.createBuffer(2, length, sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
            }
        }
        
        convolver.buffer = impulse;
        
        wetGain.gain.value = params.wetGain || 0.2;
        dryGain.gain.value = 1 - (params.wetGain || 0.2);
        
        inputNode.connect(convolver);
        inputNode.connect(dryGain);
        convolver.connect(wetGain);
        wetGain.connect(output);
        dryGain.connect(output);
        
        return output;
    }
    
    // Create delay effect
    createDelayEffect(audioContext, inputNode, params) {
        const delay = audioContext.createDelay();
        const feedback = audioContext.createGain();
        const wetGain = audioContext.createGain();
        const dryGain = audioContext.createGain();
        const output = audioContext.createGain();
        
        delay.delayTime.value = params.delayTime || 0.25;
        feedback.gain.value = params.feedback || 0.3;
        wetGain.gain.value = params.wetGain || 0.2;
        dryGain.gain.value = 1 - (params.wetGain || 0.2);
        
        inputNode.connect(delay);
        inputNode.connect(dryGain);
        delay.connect(feedback);
        delay.connect(wetGain);
        feedback.connect(delay);
        wetGain.connect(output);
        dryGain.connect(output);
        
        return output;
    }
    
    // Create filter effect
    createFilterEffect(audioContext, inputNode, params) {
        const filter = audioContext.createBiquadFilter();
        filter.type = params.type || 'lowpass';
        filter.frequency.value = params.frequency || 1000;
        filter.Q.value = params.resonance || 1;
        
        inputNode.connect(filter);
        return filter;
    }
    
    // Create distortion effect (simplified)
    createDistortionEffect(audioContext, inputNode, params) {
        const waveshaper = audioContext.createWaveShaper();
        const amount = params.amount || 0.3;
        const samples = 44100;
        const curve = new Float32Array(samples);
        
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = (3 + amount) * x * 20 * Math.PI / 180 / (Math.PI + amount * Math.abs(x));
        }
        
        waveshaper.curve = curve;
        waveshaper.oversample = '4x';
        
        inputNode.connect(waveshaper);
        return waveshaper;
    }
    
    // Create compressor effect
    createCompressorEffect(audioContext, inputNode, params) {
        const compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = params.threshold || -24;
        compressor.knee.value = 30;
        compressor.ratio.value = params.ratio || 3;
        compressor.attack.value = params.attack || 0.01;
        compressor.release.value = params.release || 0.1;
        
        inputNode.connect(compressor);
        return compressor;
    }
    
    // Create EQ effect (3-band)
    createEQEffect(audioContext, inputNode, params) {
        const lowShelf = audioContext.createBiquadFilter();
        const midPeaking = audioContext.createBiquadFilter();
        const highShelf = audioContext.createBiquadFilter();
        
        lowShelf.type = 'lowshelf';
        lowShelf.frequency.value = params.lowFreq || 320;
        lowShelf.gain.value = params.lowGain || 0;
        
        midPeaking.type = 'peaking';
        midPeaking.frequency.value = 1000;
        midPeaking.Q.value = 1;
        midPeaking.gain.value = params.midGain || 0;
        
        highShelf.type = 'highshelf';
        highShelf.frequency.value = params.highFreq || 3200;
        highShelf.gain.value = params.highGain || 0;
        
        inputNode.connect(lowShelf);
        lowShelf.connect(midPeaking);
        midPeaking.connect(highShelf);
        
        return highShelf;
    }
}

// Make effects controller globally available
window.effectsController = null;