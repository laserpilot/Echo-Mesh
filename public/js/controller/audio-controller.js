// Audio effects and LFO controller for Echo Mesh
export class AudioController {
    constructor(websocketController, uiController) {
        this.websocketController = websocketController;
        this.uiController = uiController;
        
        // Effects chain state
        this.effectsChain = [];
        
        // LFO state
        this.lfoState = {
            enabled: false,
            rate: 5,
            depth: 0,
            type: 'sine',
            target: 'vibrato',
            animationId: null
        };
        
        // Effect definitions
        this.effectDefinitions = {
            reverb: {
                name: 'Reverb',
                icon: '🏛️',
                parameters: {
                    roomSize: { min: 0, max: 1, default: 0.5, label: 'Room Size' },
                    decay: { min: 0.1, max: 10, default: 2, label: 'Decay Time (s)' },
                    wetness: { min: 0, max: 1, default: 0.3, label: 'Wet Level' }
                }
            },
            delay: {
                name: 'Delay',
                icon: '⏰',
                parameters: {
                    time: { min: 0.01, max: 1, default: 0.25, label: 'Delay Time (s)' },
                    feedback: { min: 0, max: 0.95, default: 0.3, label: 'Feedback' },
                    wetness: { min: 0, max: 1, default: 0.3, label: 'Wet Level' }
                }
            },
            distortion: {
                name: 'Distortion',
                icon: '🔥',
                parameters: {
                    amount: { min: 0, max: 50, default: 5, label: 'Drive Amount' },
                    curve: { min: 0, max: 100, default: 50, label: 'Curve Shape' },
                    oversample: { options: ['none', '2x', '4x'], default: '2x', label: 'Oversampling' }
                }
            },
            chorus: {
                name: 'Chorus',
                icon: '🌊',
                parameters: {
                    rate: { min: 0.1, max: 10, default: 1.5, label: 'Rate (Hz)' },
                    depth: { min: 0, max: 1, default: 0.35, label: 'Depth' },
                    delay: { min: 0.001, max: 0.05, default: 0.025, label: 'Delay (s)' }
                }
            },
            filter: {
                name: 'Filter',
                icon: '🎚️',
                parameters: {
                    type: { options: ['lowpass', 'highpass', 'bandpass', 'notch'], default: 'lowpass', label: 'Filter Type' },
                    frequency: { min: 20, max: 20000, default: 2000, label: 'Cutoff Frequency (Hz)' },
                    resonance: { min: 0.1, max: 30, default: 1, label: 'Resonance' }
                }
            },
            compressor: {
                name: 'Compressor',
                icon: '📦',
                parameters: {
                    threshold: { min: -60, max: 0, default: -24, label: 'Threshold (dB)' },
                    ratio: { min: 1, max: 20, default: 3, label: 'Ratio' },
                    attack: { min: 0, max: 1, default: 0.003, label: 'Attack (s)' },
                    release: { min: 0, max: 1, default: 0.25, label: 'Release (s)' }
                }
            },
            eq: {
                name: 'EQ',
                icon: '📊',
                parameters: {
                    lowGain: { min: -12, max: 12, default: 0, label: 'Low Gain (dB)' },
                    midGain: { min: -12, max: 12, default: 0, label: 'Mid Gain (dB)' },
                    highGain: { min: -12, max: 12, default: 0, label: 'High Gain (dB)' },
                    midFreq: { min: 200, max: 5000, default: 1000, label: 'Mid Frequency (Hz)' }
                }
            },
            phaser: {
                name: 'Phaser',
                icon: '🌀',
                parameters: {
                    rate: { min: 0.1, max: 10, default: 0.5, label: 'Rate (Hz)' },
                    depth: { min: 0, max: 1, default: 0.5, label: 'Depth' },
                    stages: { min: 2, max: 8, default: 4, label: 'Stages' }
                }
            }
        };
        
        this.setupElements();
        this.setupEventHandlers();
        this.setupGlobalFunctions();
    }
    
    // Set up DOM elements
    setupElements() {
        this.elements = {
            // Effects chain
            effectsChainDisplay: document.getElementById('effectsChainDisplay'),
            clearEffectsChain: document.getElementById('clearEffectsChain'),
            bypassAllEffects: document.getElementById('bypassAllEffects'),
            effectParametersPanel: document.getElementById('effectParametersPanel'),
            currentEffectTitle: document.getElementById('currentEffectTitle'),
            effectParametersContent: document.getElementById('effectParametersContent'),
            
            // Global effects controls
            effectsWetDry: document.getElementById('effectsWetDry'),
            effectsWetDryValue: document.getElementById('effectsWetDryValue'),
            effectsGain: document.getElementById('effectsGain'),
            effectsGainValue: document.getElementById('effectsGainValue'),
            
            // LFO controls
            lfoEnabled: document.getElementById('lfoEnabled'),
            lfoType: document.getElementById('lfoType'),
            lfoRate: document.getElementById('lfoRate'),
            lfoDepth: document.getElementById('lfoDepth'),
            lfoTarget: document.getElementById('lfoTarget'),
            lfoVisualization: document.getElementById('lfoVisualization'),
            lfoIndicator: document.getElementById('lfoIndicator')
        };
    }
    
    // Set up event handlers
    setupEventHandlers() {
        // Effects chain controls
        this.elements.clearEffectsChain?.addEventListener('click', () => {
            this.clearEffectsChain();
        });
        
        this.elements.bypassAllEffects?.addEventListener('click', () => {
            this.bypassAllEffects();
        });
        
        // Global effects controls
        this.elements.effectsWetDry?.addEventListener('input', (e) => {
            if (this.elements.effectsWetDryValue) {
                this.elements.effectsWetDryValue.textContent = `${e.target.value}%`;
            }
        });
        
        this.elements.effectsGain?.addEventListener('input', (e) => {
            if (this.elements.effectsGainValue) {
                this.elements.effectsGainValue.textContent = `${e.target.value}%`;
            }
        });
        
        // Effects library buttons
        document.querySelectorAll('.effect-add-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const effectType = e.target.getAttribute('data-effect');
                this.addEffect(effectType);
            });
        });
        
        // LFO controls
        this.elements.lfoEnabled?.addEventListener('change', () => {
            this.updateLFOState();
        });
        
        this.elements.lfoType?.addEventListener('change', () => {
            this.updateLFOState();
        });
        
        this.elements.lfoRate?.addEventListener('input', () => {
            this.updateLFOState();
        });
        
        this.elements.lfoDepth?.addEventListener('input', () => {
            this.updateLFOState();
        });
        
        this.elements.lfoTarget?.addEventListener('change', () => {
            this.updateLFOState();
        });
    }
    
    // Set up global functions for HTML onclick handlers
    setupGlobalFunctions() {
        window.removeEffect = (effectId) => this.removeEffect(effectId);
        window.toggleEffectBypass = (effectId) => this.toggleEffectBypass(effectId);
        window.updateEffectParameter = (effectId, paramKey, value) => this.updateEffectParameter(effectId, paramKey, value);
    }
    
    // Add effect to chain
    addEffect(effectType) {
        const effectDef = this.effectDefinitions[effectType];
        if (!effectDef) return;
        
        const effectId = `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const effectInstance = {
            id: effectId,
            type: effectType,
            name: effectDef.name,
            icon: effectDef.icon,
            bypassed: false,
            parameters: {}
        };
        
        // Initialize parameters with default values
        Object.entries(effectDef.parameters).forEach(([key, param]) => {
            effectInstance.parameters[key] = param.default;
        });
        
        this.effectsChain.push(effectInstance);
        this.updateEffectsChainDisplay();
        this.uiController.logMessage(`Added ${effectDef.name} to effects chain`);
    }
    
    // Remove effect from chain
    removeEffect(effectId) {
        const index = this.effectsChain.findIndex(e => e.id === effectId);
        if (index > -1) {
            const effect = this.effectsChain[index];
            this.effectsChain.splice(index, 1);
            this.updateEffectsChainDisplay();
            this.uiController.logMessage(`Removed ${effect.name} from effects chain`);
            
            // Close parameter panel if this effect was being edited
            if (this.elements.effectParametersPanel && 
                this.elements.effectParametersPanel.style.display !== 'none' && 
                this.elements.effectParametersPanel.dataset.effectId === effectId) {
                this.elements.effectParametersPanel.style.display = 'none';
            }
        }
    }
    
    // Toggle effect bypass
    toggleEffectBypass(effectId) {
        const effect = this.effectsChain.find(e => e.id === effectId);
        if (effect) {
            effect.bypassed = !effect.bypassed;
            this.updateEffectsChainDisplay();
            this.uiController.logMessage(`${effect.bypassed ? 'Bypassed' : 'Enabled'} ${effect.name}`);
        }
    }
    
    // Edit effect parameters
    editEffect(effectId) {
        const effect = this.effectsChain.find(e => e.id === effectId);
        if (!effect) return;
        
        if (!this.elements.effectParametersPanel || !this.elements.currentEffectTitle || !this.elements.effectParametersContent) {
            return;
        }
        
        this.elements.currentEffectTitle.textContent = `${effect.icon} ${effect.name} Parameters`;
        this.elements.effectParametersPanel.dataset.effectId = effectId;
        
        // Build parameter controls
        const effectDef = this.effectDefinitions[effect.type];
        this.elements.effectParametersContent.innerHTML = '';
        
        Object.entries(effectDef.parameters).forEach(([paramKey, paramDef]) => {
            const paramDiv = document.createElement('div');
            paramDiv.className = 'effect-parameter';
            
            if (paramDef.options) {
                // Dropdown for options
                paramDiv.innerHTML = `
                    <label>${paramDef.label}:</label>
                    <select onchange="updateEffectParameter('${effectId}', '${paramKey}', this.value)">
                        ${paramDef.options.map(opt => 
                            `<option value="${opt}" ${effect.parameters[paramKey] === opt ? 'selected' : ''}>${opt}</option>`
                        ).join('')}
                    </select>
                    <span>${effect.parameters[paramKey]}</span>
                `;
            } else {
                // Slider + number input
                paramDiv.innerHTML = `
                    <label>${paramDef.label}:</label>
                    <input type="range" min="${paramDef.min}" max="${paramDef.max}" 
                           step="${(paramDef.max - paramDef.min) / 100}" value="${effect.parameters[paramKey]}"
                           oninput="updateEffectParameter('${effectId}', '${paramKey}', this.value); this.nextElementSibling.value = this.value">
                    <input type="number" min="${paramDef.min}" max="${paramDef.max}" 
                           step="${(paramDef.max - paramDef.min) / 100}" value="${effect.parameters[paramKey]}"
                           onchange="updateEffectParameter('${effectId}', '${paramKey}', this.value); this.previousElementSibling.value = this.value">
                `;
            }
            
            this.elements.effectParametersContent.appendChild(paramDiv);
        });
        
        this.elements.effectParametersPanel.style.display = 'block';
        
        // Update visual state
        document.querySelectorAll('.effect-chain-item').forEach(item => {
            item.classList.toggle('editing', item.dataset.effectId === effectId);
        });
    }
    
    // Update effect parameter
    updateEffectParameter(effectId, paramKey, value) {
        const effect = this.effectsChain.find(e => e.id === effectId);
        if (effect) {
            effect.parameters[paramKey] = parseFloat(value) || value;
            this.uiController.logMessage(`Updated ${effect.name} ${paramKey}: ${value}`);
        }
    }
    
    // Update effects chain display
    updateEffectsChainDisplay() {
        if (!this.elements.effectsChainDisplay) return;
        
        if (this.effectsChain.length === 0) {
            this.elements.effectsChainDisplay.innerHTML = '<div class="effects-placeholder">No effects active - Add effects below</div>';
            return;
        }
        
        this.elements.effectsChainDisplay.innerHTML = '';
        this.effectsChain.forEach(effect => {
            const effectElement = document.createElement('div');
            effectElement.className = `effect-chain-item ${effect.bypassed ? 'bypassed' : ''}`;
            effectElement.dataset.effectId = effect.id;
            effectElement.innerHTML = `
                <span>${effect.icon} ${effect.name}</span>
                <div class="effect-controls">
                    <button class="bypass-btn" onclick="toggleEffectBypass('${effect.id}')" title="Bypass">
                        ${effect.bypassed ? 'ON' : 'BYP'}
                    </button>
                    <button class="remove-btn" onclick="removeEffect('${effect.id}')" title="Remove">×</button>
                </div>
            `;
            
            effectElement.addEventListener('click', (e) => {
                if (!e.target.classList.contains('bypass-btn') && !e.target.classList.contains('remove-btn')) {
                    this.editEffect(effect.id);
                }
            });
            
            this.elements.effectsChainDisplay.appendChild(effectElement);
        });
    }
    
    // Clear all effects
    clearEffectsChain() {
        this.effectsChain = [];
        this.updateEffectsChainDisplay();
        if (this.elements.effectParametersPanel) {
            this.elements.effectParametersPanel.style.display = 'none';
        }
        this.uiController.logMessage('Cleared all effects from chain');
    }
    
    // Bypass/enable all effects
    bypassAllEffects() {
        const allBypassed = this.effectsChain.every(e => e.bypassed);
        this.effectsChain.forEach(effect => {
            effect.bypassed = !allBypassed;
        });
        this.updateEffectsChainDisplay();
        this.uiController.logMessage(`${allBypassed ? 'Enabled' : 'Bypassed'} all effects`);
    }
    
    // Update LFO state
    updateLFOState() {
        this.lfoState.enabled = this.elements.lfoEnabled?.checked || false;
        this.lfoState.rate = parseFloat(this.elements.lfoRate?.value || '5');
        this.lfoState.depth = parseFloat(this.elements.lfoDepth?.value || '0');
        this.lfoState.type = this.elements.lfoType?.value || 'sine';
        this.lfoState.target = this.elements.lfoTarget?.value || 'vibrato';
        
        this.updateLFOVisualization();
    }
    
    // Update LFO visualization
    updateLFOVisualization() {
        if (!this.elements.lfoIndicator) return;
        
        const enabled = this.lfoState.enabled;
        
        if (enabled && this.lfoState.depth > 0) {
            const rate = this.lfoState.rate;
            this.elements.lfoIndicator.style.animationDuration = `${2 / rate}s`;
            this.elements.lfoIndicator.classList.add('animated');
        } else {
            this.elements.lfoIndicator.classList.remove('animated');
            this.elements.lfoIndicator.style.left = '0';
        }
    }
    
    // Get current effects configuration for sending to clients
    getEffectsConfig() {
        return {
            chain: this.effectsChain.filter(e => !e.bypassed),
            wetDry: parseFloat(this.elements.effectsWetDry?.value || '50') / 100,
            gain: parseFloat(this.elements.effectsGain?.value || '100') / 100
        };
    }
    
    // Get current LFO configuration for sending to clients
    getLFOConfig() {
        return {
            enabled: this.lfoState.enabled,
            type: this.lfoState.type,
            rate: this.lfoState.rate,
            depth: this.lfoState.depth,
            target: this.lfoState.target
        };
    }
    
    // Get available effect types
    getAvailableEffects() {
        return Object.keys(this.effectDefinitions);
    }
    
    // Get effects chain
    getEffectsChain() {
        return [...this.effectsChain];
    }
    
    // Get LFO state
    getLFOState() {
        return { ...this.lfoState };
    }
}