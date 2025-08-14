// Shared constants for Echo Mesh
export const CONSTANTS = {
    // WebSocket message types
    MESSAGE_TYPES: {
        REGISTER: 'register',
        ID: 'id',
        SYNC: 'sync',
        SYNC_REPLY: 'sync-reply',
        TRIGGER_SOUND: 'triggerSound',
        SCHEDULE_NOTE: 'scheduleNote',
        METRONOME_CLICK: 'metronomeClick',
        METRONOME_STOPPED: 'metronomeStopped',
        METRONOME_STATE: 'metronomeState',
        SET_VOLUME: 'setVolume',
        STOP_METRONOME: 'stopMetronome',
        CLIENT_PLAYING_NOTE: 'clientPlayingNote',
        PANIC_STOP: 'panic_stop',
        CLIENT_GROUP_ASSIGNMENT: 'clientGroupAssignment',
        STOP_ALL_NOTES: 'stopAllNotes'
    },

    // Audio constants
    AUDIO: {
        NOTE_FREQUENCIES: {
            'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13,
            'E': 329.63, 'F': 349.23, 'F#': 369.99, 'G': 392.00,
            'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88
        },
        
        DEFAULT_ADSR: {
            attack: 0.01,
            decay: 0.1,
            sustain: 0.5,
            release: 1.0
        },
        
        DEFAULT_LFO: {
            type: 'sine',
            rate: 5,
            depth: 0,
            target: 'vibrato'
        },
        
        OSCILLATOR_TYPES: [
            'sine', 'square', 'sawtooth', 'triangle', 'filteredsawtooth',
            'organ', 'noise', 'pinknoise', 'kick', 'snare', 'hihat',
            'rain', 'wind'
        ],
        
        PENTATONIC_STEPS: [0, 2, 4, 7, 9],
        
        SAMPLE_RATE: 44100,
        
        // Master volume and compression settings
        MASTER_VOLUME: 0.7,
        COMPRESSOR_SETTINGS: {
            threshold: -24,
            knee: 30,
            ratio: 12,
            attack: 0.003,
            release: 0.25
        }
    },

    // UI constants
    UI: {
        SYNC_INTERVAL: 30000, // 30 seconds
        RECONNECT_DELAY: 3000, // 3 seconds
        REGISTRATION_TIMEOUT: 2000, // 2 seconds
        MAX_REGISTRATION_RETRIES: 3,
        CLIENT_ID_DISPLAY_LENGTH: 8,
        
        SOUND_INDICATOR_DURATION: 1000, // 1 second
        METRONOME_FLASH_DURATION: 100, // 100ms
        
        LOG_MAX_ENTRIES: 50
    },

    // Musical constants
    MUSIC: {
        DEFAULT_KEY: 'C',
        DEFAULT_BPM: 120,
        ALLOWED_NOTES_C_MAJOR: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
        
        CHORD_PROGRESSIONS: {
            'I-V-vi-IV': ['C', 'G', 'Am', 'F'],
            'vi-IV-I-V': ['Am', 'F', 'C', 'G'],
            'I-vi-IV-V': ['C', 'Am', 'F', 'G'],
            'ii-V-I': ['Dm', 'G', 'C']
        }
    },

    // Connection settings
    CONNECTION: {
        DEFAULT_WS_URL: null, // Will be set based on current location
        HEARTBEAT_INTERVAL: 30000,
        CONNECTION_TIMEOUT: 10000
    }
};