// Effects Chain Controller for Echo Mesh
export class EffectsController {
    constructor() {
        this.effectsChain = [];
        this.effectSettings = new Map();
        
        // DOM elements
        this.elements = {
            effectsChainDisplay: document.getElementById('effectsChainDisplay'),
            clearEffectsChain: document.getElementById('clearEffectsChain'),
            bypassAllEffects: document.getElementById('bypassAllEffects')
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
            
            return `
                <div class="effect-item ${enabledClass}" data-effect-id="${effect.id}" 
                     style="display: flex; flex-direction: column; align-items: center; gap: 4px; 
                            padding: 8px 12px; background: ${effect.enabled ? '#e3f2fd' : '#f5f5f5'}; 
                            border-radius: 6px; border: 1px solid ${effect.enabled ? '#2196f3' : '#ddd'};">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 16px;">${icon}</span>
                        <span style="font-size: 12px; font-weight: bold; color: ${effect.enabled ? '#1976d2' : '#999'};">
                            ${effect.type.toUpperCase()}
                        </span>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <button class="effect-toggle" data-effect-id="${effect.id}" 
                                style="padding: 2px 6px; font-size: 10px; border: none; border-radius: 3px;
                                       background: ${effect.enabled ? '#ff9800' : '#4caf50'}; color: white;">
                            ${effect.enabled ? 'Bypass' : 'Enable'}
                        </button>
                        <button class="effect-remove" data-effect-id="${effect.id}"
                                style="padding: 2px 6px; font-size: 10px; border: none; border-radius: 3px;
                                       background: #f44336; color: white;">
                            Remove
                        </button>
                    </div>
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
}

// Make effects controller globally available
window.effectsController = null;