// Piano keyboard component for client interface
import { CONSTANTS } from '../shared/constants.js';
import { AudioUtils } from '../shared/audio-utils.js';

export class PianoKeyboard {
    constructor(containerElement, audioEngine, websocketClient) {
        this.container = containerElement;
        this.audioEngine = audioEngine;
        this.websocketClient = websocketClient;
        this.currentKey = 'C';
        this.allowedNotes = CONSTANTS.MUSIC.ALLOWED_NOTES_C_MAJOR;
        this.playingNotes = new Set();
        this.keys = [];
        
        this.createKeyboard();
        this.setupEventListeners();
    }
    
    // Create piano keyboard elements
    createKeyboard() {
        this.container.innerHTML = '';
        const keyNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        keyNames.forEach(note => {
            const key = document.createElement('button');
            key.className = `piano-key ${note.includes('#') ? 'black' : 'white'}`;
            key.textContent = note;
            key.dataset.note = note;
            
            // Check if note is allowed in current key (C Major: only white keys)
            const isAllowed = !note.includes('#'); // C Major has no sharps/flats
            if (!isAllowed) {
                key.classList.add('disabled');
            }
            
            this.keys.push(key);
            this.container.appendChild(key);
        });
    }
    
    // Set up event listeners for piano keys
    setupEventListeners() {
        this.keys.forEach(key => {
            const note = key.dataset.note;
            
            // Mouse events
            key.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.playKeyNote(note, key);
            });
            
            key.addEventListener('mouseup', (e) => {
                e.preventDefault();
                this.stopKeyNote(note, key);
            });
            
            key.addEventListener('mouseleave', (e) => {
                e.preventDefault();
                this.stopKeyNote(note, key);
            });
            
            // Touch events for mobile
            key.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.playKeyNote(note, key);
            });
            
            key.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.stopKeyNote(note, key);
            });
            
            key.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                this.stopKeyNote(note, key);
            });
        });
        
        // Prevent context menu on long press
        this.container.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        // Handle keyboard input
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardInput(e, true);
        });
        
        document.addEventListener('keyup', (e) => {
            this.handleKeyboardInput(e, false);
        });
    }
    
    // Handle computer keyboard input for piano playing
    handleKeyboardInput(event, isKeyDown) {
        // Map computer keyboard keys to piano notes
        const keyMap = {
            'KeyA': 'C',
            'KeyW': 'C#',
            'KeyS': 'D',
            'KeyE': 'D#',
            'KeyD': 'E',
            'KeyF': 'F',
            'KeyT': 'F#',
            'KeyG': 'G',
            'KeyY': 'G#',
            'KeyH': 'A',
            'KeyU': 'A#',
            'KeyJ': 'B'
        };
        
        const note = keyMap[event.code];
        if (!note) return;
        
        event.preventDefault();
        
        const keyElement = this.container.querySelector(`[data-note="${note}"]`);
        if (!keyElement || keyElement.classList.contains('disabled')) return;
        
        if (isKeyDown && !this.playingNotes.has(note)) {
            this.playKeyNote(note, keyElement);
        } else if (!isKeyDown && this.playingNotes.has(note)) {
            this.stopKeyNote(note, keyElement);
        }
    }
    
    // Play a note when key is pressed
    async playKeyNote(note, keyElement) {
        if (keyElement.classList.contains('disabled')) return;
        if (this.playingNotes.has(note)) return; // Prevent duplicate playing
        
        keyElement.classList.add('pressed');
        this.playingNotes.add(note);
        
        const frequency = CONSTANTS.AUDIO.NOTE_FREQUENCIES[note];
        
        // Play sound locally
        try {
            await this.audioEngine.playSound('sine', frequency, 0, {
                attack: 0.01,
                decay: 0.1,
                sustain: 0.8,
                release: 0.3
            });
        } catch (error) {
            console.error('Error playing note locally:', error);
        }
        
        // Notify server of activity
        if (this.websocketClient && this.websocketClient.isConnected) {
            this.websocketClient.sendMessage(CONSTANTS.MESSAGE_TYPES.CLIENT_PLAYING_NOTE, {
                note: note,
                frequency: frequency
            });
        }
        
        console.log(`Playing note: ${note} (${frequency}Hz)`);
    }
    
    // Stop playing a note when key is released
    stopKeyNote(note, keyElement) {
        keyElement.classList.remove('pressed');
        this.playingNotes.delete(note);
    }
    
    // Highlight a note being played (from server)
    highlightPlayingNote(note, duration = 500) {
        const keyElement = this.container.querySelector(`[data-note="${note}"]`);
        if (keyElement) {
            keyElement.classList.add('playing');
            setTimeout(() => {
                keyElement.classList.remove('playing');
            }, duration);
        }
    }
    
    // Update keyboard for different musical scales
    updateKeyboardForScale(key = 'C') {
        this.currentKey = key;
        
        // For now, keeping it simple with C Major (white keys only)
        this.allowedNotes = CONSTANTS.MUSIC.ALLOWED_NOTES_C_MAJOR;
        
        // Update keyboard visual state
        this.keys.forEach(keyEl => {
            const note = keyEl.dataset.note;
            if (note.includes('#')) {
                keyEl.classList.add('disabled');
            } else {
                keyEl.classList.remove('disabled');
            }
        });
        
        console.log(`Keyboard set to ${key} Major (white keys only)`);
    }
    
    // Get currently pressed notes
    getCurrentlyPlayingNotes() {
        return Array.from(this.playingNotes);
    }
    
    // Force release all notes (emergency stop)
    releaseAllNotes() {
        this.keys.forEach(key => {
            const note = key.dataset.note;
            if (this.playingNotes.has(note)) {
                this.stopKeyNote(note, key);
            }
        });
        this.playingNotes.clear();
    }
    
    // Enable/disable the entire keyboard
    setEnabled(enabled) {
        this.keys.forEach(key => {
            if (enabled) {
                key.classList.remove('disabled');
                // Re-apply scale restrictions
                const note = key.dataset.note;
                if (note.includes('#')) {
                    key.classList.add('disabled');
                }
            } else {
                key.classList.add('disabled');
            }
        });
    }
    
    // Get frequency for a note
    getNoteFrequency(note) {
        return CONSTANTS.AUDIO.NOTE_FREQUENCIES[note] || 440;
    }
}