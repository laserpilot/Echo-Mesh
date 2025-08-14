// server.js - Node.js server code
const { performance } = require('perf_hooks');
const { randomUUID } = require('crypto');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Log incoming requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Add a simple API route to check server is responding
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// API route to get network IP addresses
app.get('/api/network-info', (req, res) => {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  const addresses = [];
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({
          interface: name,
          address: net.address,
          clientUrl: `http://${net.address}:${PORT}/client.html`
        });
      }
    }
  }
  
  res.json({ 
    port: PORT,
    addresses: addresses,
    primaryUrl: addresses.length > 0 ? addresses[0].clientUrl : `http://localhost:${PORT}/client.html`
  });
});

// Store connected clients
const clients = new Map(); // Maps WebSocket to a client object { id, ws, isController, connectedAt, lastActivity, notesPlayed }
const clientLatencies = new Map(); // Track client latencies for connection quality

// Chord progression state
let chordProgressionState = {
  isRunning: false,
  progression: null,
  bpm: 120,
  settings: {},
  interval: null,
  currentChordIndex: 0,
  startTime: null
};

// Metronome state
let metronomeState = {
  isRunning: false,
  bpm: 120,
  interval: null,
  startTime: null,
  beatCount: 0
};

// Utility function to send to a specific client
const sendToClient = (clientId, message) => {
  for (const client of clients.values()) {
    if (client.id === clientId) {
      try {
        client.ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error(`Error sending message to client ${clientId}:`, error);
        return false;
      }
    }
  }
  console.log(`Client ${clientId} not found in clients map`);
  return false;
};

// Utility function to broadcast to all clients
const broadcast = (message, excludeId = null) => {
  for (const client of clients.values()) {
    if (excludeId === null || client.id !== excludeId) {
      client.ws.send(JSON.stringify(message));
    }
  }
};

// Get all connected client IDs (excluding controllers)
const getClientIds = () => {
  return Array.from(clients.values())
    .filter(c => !c.isController)
    .map(c => c.id);
};

// Musical theory constants and functions
const MUSICAL_DATA = {
  keys: {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
    'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
  },
  
  scales: {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10]
  },
  
  chordTypes: {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    diminished: [0, 3, 6],
    augmented: [0, 4, 8],
    major7: [0, 4, 7, 11],
    minor7: [0, 3, 7, 10],
    dominant7: [0, 4, 7, 10]
  },
  
  romanNumeralChords: {
    'I': { root: 0, type: 'major' },
    'ii': { root: 1, type: 'minor' },
    'iii': { root: 2, type: 'minor' },
    'IV': { root: 3, type: 'major' },
    'V': { root: 4, type: 'major' },
    'vi': { root: 5, type: 'minor' },
    'vii°': { root: 6, type: 'diminished' },
    // Minor key variants
    'i': { root: 0, type: 'minor' },
    'ii°': { root: 1, type: 'diminished' },
    'III': { root: 2, type: 'major' },
    'iv': { root: 3, type: 'minor' },
    'v': { root: 4, type: 'minor' },
    'VI': { root: 5, type: 'major' },
    'VII': { root: 6, type: 'major' }
  },
  
  chordProgressions: {
    // Pop & Rock
    'I-V-vi-IV': ['I', 'V', 'vi', 'IV'],
    'vi-IV-I-V': ['vi', 'IV', 'I', 'V'],
    'I-vi-IV-V': ['I', 'vi', 'IV', 'V'],
    'vi-V-IV-V': ['vi', 'V', 'IV', 'V'],
    // Jazz & Blues
    'ii-V-I': ['ii', 'V', 'I'],
    'I-vi-ii-V': ['I', 'vi', 'ii', 'V'],
    'I-IV-V': ['I', 'IV', 'V'],
    'I-IV-V-IV': ['I', 'IV', 'V', 'IV'],
    // Minor & Modal
    'i-VII-VI-VII': ['i', 'VII', 'VI', 'VII'],
    'i-iv-V': ['i', 'iv', 'V'],
    'i-VI-VII': ['i', 'VI', 'VII'],
    'i-ii°-V': ['i', 'ii°', 'V'],
    // Extended
    'I-iii-vi-IV': ['I', 'iii', 'vi', 'IV'],
    'I-V-vi-iii-IV-I-IV-V': ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'],
    'vi-ii-V-I': ['vi', 'ii', 'V', 'I']
  }
};

// Convert note to frequency
const noteToFrequency = (semitone, octave) => {
  return 440 * Math.pow(2, (octave - 4) + (semitone - 9) / 12);
};

// Get chord notes for a roman numeral
const getChordNotes = (romanNumeral, key = 'C', octave = 4) => {
  const keyRoot = MUSICAL_DATA.keys[key];
  const chordInfo = MUSICAL_DATA.romanNumeralChords[romanNumeral];
  
  if (!chordInfo) {
    console.error(`Unknown chord: ${romanNumeral}`);
    return [];
  }
  
  const scaleNotes = MUSICAL_DATA.scales.major; // Use major scale for chord calculation
  const chordRoot = (keyRoot + scaleNotes[chordInfo.root]) % 12;
  const chordIntervals = MUSICAL_DATA.chordTypes[chordInfo.type];
  
  return chordIntervals.map(interval => {
    const semitone = (chordRoot + interval) % 12;
    const noteOctave = octave + Math.floor((chordRoot + interval) / 12);
    return {
      semitone: semitone,
      octave: noteOctave,
      frequency: noteToFrequency(semitone, noteOctave)
    };
  });
};

// Apply arpeggiator pattern to chord notes
const applyArpeggioPattern = (chordNotes, pattern = 'chord') => {
  switch (pattern) {
    case 'up':
      return chordNotes.slice().sort((a, b) => a.frequency - b.frequency);
    case 'down':
      return chordNotes.slice().sort((a, b) => b.frequency - a.frequency);
    case 'up-down':
      const upNotes = chordNotes.slice().sort((a, b) => a.frequency - b.frequency);
      const downNotes = upNotes.slice().reverse();
      return [...upNotes, ...downNotes.slice(1)]; // Remove duplicate top note
    case 'down-up':
      const downNotes2 = chordNotes.slice().sort((a, b) => b.frequency - a.frequency);
      const upNotes2 = downNotes2.slice().reverse();
      return [...downNotes2, ...upNotes2.slice(1)]; // Remove duplicate bottom note
    case 'inside-out':
      const sorted = chordNotes.slice().sort((a, b) => a.frequency - b.frequency);
      const result = [];
      let left = 0, right = sorted.length - 1;
      let useLeft = false; // Start with highest note
      while (left <= right) {
        if (useLeft) {
          result.push(sorted[left++]);
        } else {
          result.push(sorted[right--]);
        }
        useLeft = !useLeft;
      }
      return result;
    case 'outside-in':
      const sorted2 = chordNotes.slice().sort((a, b) => a.frequency - b.frequency);
      const result2 = [];
      let left2 = 0, right2 = sorted2.length - 1;
      let useLeft2 = true; // Start with lowest note
      while (left2 <= right2) {
        if (useLeft2) {
          result2.push(sorted2[left2++]);
        } else {
          result2.push(sorted2[right2--]);
        }
        useLeft2 = !useLeft2;
      }
      return result2;
    case 'random':
      return chordNotes.slice().sort(() => Math.random() - 0.5);
    case 'chord':
    default:
      return chordNotes; // All notes together
  }
};

// Start chord progression playback
const startChordProgression = (progressionName, bpm = 120, settings = {}, lfo = null, effects = null) => {
  console.log(`Starting chord progression: ${progressionName} at ${bpm} BPM`);
  
  // Stop any existing progression
  stopChordProgression();
  
  const progression = MUSICAL_DATA.chordProgressions[progressionName];
  if (!progression) {
    console.error(`Unknown chord progression: ${progressionName}`);
    return false;
  }
  
  // Set up state
  chordProgressionState = {
    isRunning: true,
    progression: progression,
    progressionName: progressionName,
    bpm: bpm,
    settings: {
      key: settings.key || 'C',
      octave: settings.octave || 4,
      chordDuration: settings.chordDuration || 'whole',
      chordDurationMs: settings.chordDurationMs || 4000,
      arpeggio: settings.arpeggio || 'chord',
      subdivision: settings.subdivision || '8n',
      swing: settings.swing || 0,
      velocity: settings.velocity || 'even',
      clientOffset: settings.clientOffset || 0,
      noteDuration: settings.noteDuration || 'sustain',
      humanization: settings.humanization || 0,
      ...settings
    },
    lfo: lfo,
    effects: effects,
    currentChordIndex: 0,
    startTime: performance.now(),
    interval: null
  };
  
  // Use the calculated chord duration in milliseconds
  const chordDurationMs = chordProgressionState.settings.chordDurationMs;
  
  // Play first chord immediately
  playCurrentChord();
  
  // Set up interval for subsequent chords
  chordProgressionState.interval = setInterval(() => {
    chordProgressionState.currentChordIndex = 
      (chordProgressionState.currentChordIndex + 1) % chordProgressionState.progression.length;
    playCurrentChord();
  }, chordDurationMs);
  
  return true;
};

// Apply swing timing to note timings
const applySwingTiming = (baseTime, index, swingAmount, subdivision) => {
  if (swingAmount === 0) return baseTime;
  
  // Swing affects every second note (the off-beats)
  if (index % 2 === 1) {
    const swingDelay = (swingAmount / 100) * (subdivision === '16n' ? 62.5 : 125); // Adjust for subdivision
    return baseTime + swingDelay;
  }
  return baseTime;
};

// Apply velocity curve to note velocity
const applyVelocityCurve = (index, totalNotes, curve) => {
  const position = index / (totalNotes - 1); // 0 to 1
  
  switch (curve) {
    case 'crescendo':
      return 0.3 + (position * 0.7); // 0.3 to 1.0
    case 'diminuendo':
      return 1.0 - (position * 0.7); // 1.0 to 0.3
    case 'accent-first':
      return index === 0 ? 1.0 : 0.6;
    case 'accent-last':
      return index === totalNotes - 1 ? 1.0 : 0.6;
    case 'accent-downbeat':
      return index % 4 === 0 ? 1.0 : 0.6; // Accent every 4th note
    case 'alternate':
      return index % 2 === 0 ? 0.9 : 0.5; // Alternate between strong and weak
    case 'random':
      return 0.4 + (Math.random() * 0.6); // Random between 0.4 and 1.0
    case 'wave':
      return 0.5 + 0.4 * Math.sin(position * Math.PI * 2); // Sine wave pattern
    case 'even':
    default:
      return 0.8; // Constant velocity
  }
};

// Apply humanization (random timing and velocity variations)
const applyHumanization = (baseTime, baseVelocity, humanizationAmount) => {
  if (humanizationAmount === 0) return { time: baseTime, velocity: baseVelocity };
  
  const timingVariation = (Math.random() - 0.5) * 2 * (humanizationAmount / 100) * 50; // ±50ms max
  const velocityVariation = (Math.random() - 0.5) * 2 * (humanizationAmount / 100) * 0.2; // ±0.2 max
  
  return {
    time: baseTime + timingVariation,
    velocity: Math.max(0.1, Math.min(1.0, baseVelocity + velocityVariation))
  };
};

// Play the current chord in the progression
const playCurrentChord = () => {
  if (!chordProgressionState.isRunning) return;
  
  const currentChord = chordProgressionState.progression[chordProgressionState.currentChordIndex];
  const settings = chordProgressionState.settings;
  const { key, octave, arpeggio, swing, velocity, humanization, subdivision, adsr } = settings;
  
  // Get chord notes
  const chordNotes = getChordNotes(currentChord, key, octave);
  if (chordNotes.length === 0) return;
  
  // Apply arpeggiator pattern
  const arpeggioNotes = applyArpeggioPattern(chordNotes, arpeggio);
  
  // Get connected clients (excluding controllers)
  const clientIds = getClientIds();
  if (clientIds.length === 0) {
    console.log('No clients to play chord on');
    return;
  }
  
  console.log(`Playing chord ${currentChord} with ${arpeggioNotes.length} notes across ${clientIds.length} clients`);
  
  // Calculate base note interval from subdivision
  const baseInterval = subdivision === '16n' ? 125 : subdivision === '8n' ? 250 : 500; // ms
  
  // Distribute notes across clients
  if (arpeggio === 'chord') {
    // Play all notes simultaneously, distributed across clients
    arpeggioNotes.forEach((note, index) => {
      const clientId = clientIds[index % clientIds.length];
      const baseTime = performance.now() + 50; // Small delay for network
      const baseVelocity = applyVelocityCurve(index, arpeggioNotes.length, velocity);
      const { time, velocity: finalVelocity } = applyHumanization(baseTime, baseVelocity, humanization);
      
      const message = {
        type: 'scheduleNote',
        sound: 'sine',
        frequency: note.frequency,
        playTime: time,
        adsr: { 
          attack: adsr?.attack || 0.01, 
          decay: adsr?.decay || 0.1, 
          sustain: (adsr?.sustain || 0.5) * finalVelocity, 
          release: adsr?.release || 1.0 
        },
        lfo: chordProgressionState.lfo || { type: 'sine', rate: 5, depth: 0, target: 'vibrato' },
        pan: 0,
        velocity: finalVelocity
      };
      
      // Add effects if provided
      if (chordProgressionState.effects) {
        message.effects = chordProgressionState.effects;
      }
      
      sendToClient(clientId, message);
    });
  } else {
    // Play arpeggio with advanced timing
    arpeggioNotes.forEach((note, index) => {
      const clientId = clientIds[index % clientIds.length];
      const baseTime = performance.now() + 50 + (index * baseInterval);
      const swingTime = applySwingTiming(baseTime, index, swing, subdivision);
      const baseVelocity = applyVelocityCurve(index, arpeggioNotes.length, velocity);
      const { time: finalTime, velocity: finalVelocity } = applyHumanization(swingTime, baseVelocity, humanization);
      
      const message = {
        type: 'scheduleNote',
        sound: 'sine',
        frequency: note.frequency,
        playTime: finalTime,
        adsr: { 
          attack: adsr?.attack || 0.01, 
          decay: adsr?.decay || 0.1, 
          sustain: (adsr?.sustain || 0.3) * finalVelocity, 
          release: adsr?.release || 0.5 
        },
        lfo: chordProgressionState.lfo || { type: 'sine', rate: 5, depth: 0, target: 'vibrato' },
        pan: 0,
        velocity: finalVelocity
      };
      
      // Add effects if provided
      if (chordProgressionState.effects) {
        message.effects = chordProgressionState.effects;
      }
      
      sendToClient(clientId, message);
    });
  }
  
  // Broadcast current chord to controllers for UI updates
  broadcast({
    type: 'chordProgressionUpdate',
    currentChord: chordProgressionState.currentChordIndex,
    chord: currentChord
  });
};

// Stop chord progression playback
const stopChordProgression = () => {
  if (chordProgressionState.interval) {
    clearInterval(chordProgressionState.interval);
    chordProgressionState.interval = null;
  }
  
  chordProgressionState.isRunning = false;
  chordProgressionState.currentChordIndex = 0;
  
  console.log('Chord progression stopped');
};

// Pause chord progression playback
const pauseChordProgression = () => {
  if (chordProgressionState.interval) {
    clearInterval(chordProgressionState.interval);
    chordProgressionState.interval = null;
  }
  
  chordProgressionState.isRunning = false;
  console.log('Chord progression paused');
};

// Resume chord progression playback
const resumeChordProgression = () => {
  if (!chordProgressionState.progression) {
    console.error('Cannot resume: no chord progression loaded');
    return false;
  }
  
  chordProgressionState.isRunning = true;
  const chordDurationMs = chordProgressionState.settings.chordDurationMs;
  
  // Resume from current position
  chordProgressionState.interval = setInterval(() => {
    chordProgressionState.currentChordIndex = 
      (chordProgressionState.currentChordIndex + 1) % chordProgressionState.progression.length;
    playCurrentChord();
  }, chordDurationMs);
  
  console.log('Chord progression resumed');
  return true;
};

// Validate client ID format (basic UUID validation)
const isValidClientId = (id) => {
  if (!id || typeof id !== 'string') return false;
  // Basic UUID format check
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const controllerRegex = /^controller-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id) || controllerRegex.test(id);
};

// Metronome functions
const startMetronome = (bpm = 120) => {
  if (metronomeState.isRunning) {
    stopMetronome();
  }
  
  metronomeState.bpm = bpm;
  metronomeState.isRunning = true;
  metronomeState.startTime = performance.now();
  metronomeState.beatCount = 0;
  
  const beatInterval = 60000 / bpm; // milliseconds per beat
  
  metronomeState.interval = setInterval(() => {
    metronomeState.beatCount++;
    const currentTime = performance.now();
    
    // Send metronome click to all clients
    broadcast({
      type: 'metronomeClick',
      beatNumber: metronomeState.beatCount,
      serverTime: currentTime,
      bpm: metronomeState.bpm,
      isDownbeat: metronomeState.beatCount % 4 === 1
    });
    
    console.log(`Metronome beat ${metronomeState.beatCount} at ${bpm} BPM`);
  }, beatInterval);
  
  console.log(`Metronome started at ${bpm} BPM`);
};

const stopMetronome = () => {
  if (metronomeState.interval) {
    clearInterval(metronomeState.interval);
    metronomeState.interval = null;
  }
  metronomeState.isRunning = false;
  metronomeState.beatCount = 0;
  
  // Notify all clients that metronome stopped
  broadcast({
    type: 'metronomeStopped'
  });
  
  console.log('Metronome stopped');
};

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  // When a client connects, it can either be new or reconnecting with an ID.
  // We will wait for its first message.

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`Received message:`, data);

      // The first message from a client MUST be 'register'
      if (data.type === 'register') {
        let clientId = data.id;
        let isNew = false;
        let isController = false;

        // Check if this is a controller (sends null ID)
        if (clientId === null) {
          clientId = 'controller-' + randomUUID();
          isController = true;
          isNew = true;
        } else if (!clientId || clientId === 'CONTROLL' || !isValidClientId(clientId) || ![...clients.values()].some(c => c.id === clientId)) {
          // If the client has no ID, invalid ID (including 'CONTROLL'), or its ID is not in our list, it's a new client.
          clientId = randomUUID();
          isNew = true;
          console.log('Generated new client ID due to invalid or missing stored ID');
        }

        const client = { 
          id: clientId, 
          ws: ws, 
          isController: isController,
          connectedAt: new Date(),
          lastActivity: new Date(),
          notesPlayed: 0
        };
        clients.set(ws, client);

        console.log(`${isController ? 'Controller' : 'Client'} registered with ID ${clientId} (${clients.size} total connected, ${getClientIds().length} clients). New: ${isNew}`);

        // Send the client its definitive ID
        ws.send(JSON.stringify({
          type: 'id',
          id: clientId
        }));

        // Send current metronome state to new client
        if (!isController) {
          ws.send(JSON.stringify({
            type: 'metronomeState',
            isRunning: metronomeState.isRunning,
            bpm: metronomeState.bpm,
            beatCount: metronomeState.beatCount
          }));
        }

        // Only notify about client connections, not controller connections
        if (!isController) {
          broadcast({
            type: 'clientConnected',
            id: clientId
          }, clientId);
        }

        // Remove the register listener and add the general message handler
        ws.removeListener('message', ws.listeners('message')[0]);
        ws.on('message', createMessageHandler(clientId));

      } else {
        // If the first message isn't register, ask them to register.
        ws.send(JSON.stringify({ type: 'error', message: 'Please register first.' }));
      }

    } catch (e) {
      console.log(`Invalid message from connecting client:`, e.message);
    }
  });

  ws.on('close', () => {
    const client = clients.get(ws);
    if (client) {
      console.log(`${client.isController ? 'Controller' : 'Client'} ${client.id} disconnected`);
      // Only notify about client disconnections, not controller disconnections
      if (!client.isController) {
        broadcast({
          type: 'clientDisconnected',
          id: client.id
        });
      }
      clients.delete(ws);
    }
  });

  ws.on('error', (error) => {
    const client = clients.get(ws);
    console.error(`WebSocket error for client ${client ? client.id : 'unknown'}:`, error);
  });
});

const createMessageHandler = (clientId) => (message) => {
  try {
    const data = JSON.parse(message.toString());
    console.log(`Received message from client ${clientId}:`, data);

    // Handle different message types
    switch (data.type) {
      case 'getClients':
        // Send the client list to the requester
        sendToClient(clientId, {
          type: 'clientList',
          clients: getClientIds()
        });
        break;

      case 'triggerSound':
        // Handle both old format (single clientId) and new format (clients array)
        if (data.clientId) {
          // Legacy format: {clientId: "...", sound: "..."}
          const message = {
            type: 'triggerSound',
            sound: data.sound,
            frequency: data.frequency
          };
          
          // Add LFO and effects if provided
          if (data.lfo) message.lfo = data.lfo;
          if (data.effects) message.effects = data.effects;
          
          sendToClient(data.clientId, message);
        } else if (data.clients && Array.isArray(data.clients)) {
          // New format: {clients: ["...", "..."], sound: "..."}
          console.log(`Triggering sound ${data.sound} on ${data.clients.length} specific clients`);
          data.clients.forEach(clientId => {
            const message = {
              type: 'triggerSound',
              sound: data.sound,
              frequency: data.frequency
            };
            
            // Add LFO and effects if provided
            if (data.lfo) message.lfo = data.lfo;
            if (data.effects) message.effects = data.effects;
            
            sendToClient(clientId, message);
          });
        }
        break;

      case 'scheduleNote':
        // Handle both old format (single clientId) and new format (clients array)
        if (data.clientId) {
          // Legacy format: {clientId: "...", ...}
          const message = {
            type: 'scheduleNote',
            sound: data.sound,
            frequency: data.frequency,
            playTime: data.playTime,
            adsr: data.adsr,
            lfo: data.lfo,
            pan: data.pan
          };
          
          // Add effects if provided
          if (data.effects) message.effects = data.effects;
          
          sendToClient(data.clientId, message);
        } else if (data.clients && Array.isArray(data.clients)) {
          // New format: {clients: ["...", "..."], ...}
          console.log(`Scheduling note ${data.sound} for ${data.clients.length} specific clients`);
          data.clients.forEach(clientId => {
            const message = {
              type: 'scheduleNote',
              sound: data.sound,
              frequency: data.frequency,
              playTime: data.playTime,
              adsr: data.adsr,
              lfo: data.lfo,
              pan: data.pan
            };
            
            // Add effects if provided
            if (data.effects) message.effects = data.effects;
            
            sendToClient(clientId, message);
          });
        }
        break;

      case 'sync':
        // Immediately reply with the original t0 and the current server time
        const syncReply = {
          type: 'sync-reply',
          t0: data.t0,
          serverTime: performance.now()
        };
        sendToClient(clientId, syncReply);
        
        // Calculate and store latency for connection quality
        if (data.t0) {
          const rtt = performance.now() - data.t0;
          clientLatencies.set(clientId, rtt);
          
          // Broadcast latency info to controllers
          broadcast({
            type: 'clientLatency',
            clientId: clientId,
            latency: Math.round(rtt)
          }, clientId);
        }
        break;

      case 'startMetronome':
        if (data.bpm && data.bpm > 0) {
          startMetronome(data.bpm);
        } else {
          startMetronome();
        }
        break;

      case 'stopMetronome':
        stopMetronome();
        break;

      case 'getMetronomeState':
        sendToClient(clientId, {
          type: 'metronomeState',
          isRunning: metronomeState.isRunning,
          bpm: metronomeState.bpm,
          beatCount: metronomeState.beatCount
        });
        break;

      case 'setClientVolume':
        // Forward volume control to specific client
        if (data.clientId && data.volume !== undefined) {
          sendToClient(data.clientId, {
            type: 'setVolume',
            volume: data.volume
          });
          console.log(`Volume set to ${Math.round(data.volume * 100)}% for client ${data.clientId}`);
        }
        break;

      case 'disconnectClient':
        // Disconnect a specific client
        if (data.clientId) {
          for (const [ws, client] of clients.entries()) {
            if (client.id === data.clientId && !client.isController) {
              console.log(`Forcibly disconnecting client ${data.clientId}`);
              ws.close(1000, 'Disconnected by administrator');
              break;
            }
          }
        }
        break;

      case 'triggerSoundAll':
        // Trigger sound on all clients
        const allClientIds = getClientIds();
        console.log(`Triggering sound ${data.sound} on all ${allClientIds.length} clients`);
        allClientIds.forEach(id => {
          const message = {
            type: 'triggerSound',
            sound: data.sound,
            frequency: data.frequency
          };
          
          // Add LFO and effects if provided
          if (data.lfo) message.lfo = data.lfo;
          if (data.effects) message.effects = data.effects;
          
          sendToClient(id, message);
        });
        break;

      case 'playSequence':
        // Play sequence with delay across specified clients
        if (data.clients && Array.isArray(data.clients)) {
          const delay = data.delay || 500;
          console.log(`Playing sequence with ${delay}ms delay across ${data.clients.length} clients`);
          data.clients.forEach((clientId, index) => {
            setTimeout(() => {
              sendToClient(clientId, {
                type: 'triggerSound',
                sound: data.sound,
                frequency: data.frequency
              });
            }, index * delay);
          });
        }
        break;

      case 'playReverseSequence':
        // Play reverse sequence with delay across specified clients
        if (data.clients && Array.isArray(data.clients)) {
          const delay = data.delay || 500;
          const reversedClients = [...data.clients].reverse();
          console.log(`Playing reverse sequence with ${delay}ms delay across ${reversedClients.length} clients`);
          reversedClients.forEach((clientId, index) => {
            setTimeout(() => {
              sendToClient(clientId, {
                type: 'triggerSound',
                sound: data.sound,
                frequency: data.frequency
              });
            }, index * delay);
          });
        }
        break;

      case 'startChordProgression':
        // Handle chord progression start with full server-side logic
        const success = startChordProgression(data.progression, data.bpm, data.settings, data.lfo, data.effects);
        
        if (success) {
          // Broadcast to controllers for UI updates
          broadcast({
            type: 'chordProgressionStarted',
            progression: data.progression,
            bpm: data.bpm,
            settings: data.settings
          });
        } else {
          console.error(`Failed to start chord progression: ${data.progression}`);
        }
        break;

      case 'stopChordProgression':
        // Handle chord progression stop
        stopChordProgression();
        
        // Broadcast to controllers for UI updates
        broadcast({
          type: 'chordProgressionStopped'
        });
        break;

      case 'pauseChordProgression':
        // Handle chord progression pause
        pauseChordProgression();
        
        // Broadcast to controllers for UI updates
        broadcast({
          type: 'chordProgressionPaused'
        });
        break;

      case 'resumeChordProgression':
        // Handle chord progression resume
        const resumeSuccess = resumeChordProgression();
        
        if (resumeSuccess) {
          // Broadcast to controllers for UI updates
          broadcast({
            type: 'chordProgressionResumed'
          });
        }
        break;

      case 'setVolume':
        // Set volume for specific clients
        if (data.clients && Array.isArray(data.clients)) {
          data.clients.forEach(clientId => {
            sendToClient(clientId, {
              type: 'setVolume',
              volume: data.volume
            });
          });
          console.log(`Volume set to ${Math.round(data.volume * 100)}% for ${data.clients.length} clients`);
        }
        break;

      case 'setMasterVolume':
        // Set master volume for all clients
        const allClients = getClientIds();
        allClients.forEach(id => {
          sendToClient(id, {
            type: 'setVolume',
            volume: data.volume
          });
        });
        console.log(`Master volume set to ${Math.round(data.volume * 100)}% for all clients`);
        break;

      case 'requestClients':
        // Send the client list to the requester (alternative to getClients)
        sendToClient(clientId, {
          type: 'clientsUpdate',
          clients: getClientIds().map(id => ({ id: id }))
        });
        break;

      case 'clientPlayingNote':
        // Track when clients are playing notes for activity monitoring
        const client = Array.from(clients.values()).find(c => c.id === clientId);
        if (client && !client.isController) {
          client.lastActivity = new Date();
          client.notesPlayed++;
          
          // Broadcast activity to controllers
          broadcast({
            type: 'clientActivity',
            clientId: clientId,
            isActive: true,
            notesPlayed: client.notesPlayed
          }, clientId);
          
          // Auto-reset activity after 2 seconds
          setTimeout(() => {
            broadcast({
              type: 'clientActivity',
              clientId: clientId,
              isActive: false
            }, clientId);
          }, 2000);
        }
        break;

      case 'clientGroupAssignment':
        // Handle client self-assignment to group
        console.log(`Client ${clientId} assigned to group ${data.groupNumber} with color ${data.groupColor}`);
        
        // Store the group assignment
        const client = Array.from(clients.values()).find(c => c.id === clientId);
        if (client) {
          client.groupNumber = data.groupNumber;
          client.groupColor = data.groupColor;
        }
        
        // Broadcast to all controllers (not clients)
        broadcast({
          type: 'clientGroupAssignment',
          clientId: clientId,
          groupNumber: data.groupNumber,
          groupColor: data.groupColor,
          timestamp: Date.now()
        }, clientId); // Exclude the assigning client from broadcast
        break;

      default:
        console.log(`Unknown message type from ${clientId}: ${data.type}`);
    }
  } catch (e) {
    console.log(`Invalid message from client ${clientId}:`, e.message);
  }
};

// API routes for triggering sounds via HTTP (as alternative to WebSocket)
app.get('/api/trigger/:id/:sound', (req, res) => {
  const clientId = req.params.id; // Don't parse as int, keep as UUID string
  const sound = req.params.sound;
  
  console.log(`HTTP request to trigger ${sound} on client ${clientId}`);
  
  const success = sendToClient(clientId, {
    type: 'triggerSound',
    sound: sound
  });
  
  res.json({ success, message: success ? 'Sound triggered' : 'Client not found' });
});

// API route for triggering a specific frequency note
app.get('/api/note/:id/:sound/:frequency', (req, res) => {
  const clientId = req.params.id; // Don't parse as int, keep as UUID string
  const sound = req.params.sound;
  const frequency = parseFloat(req.params.frequency);
  
  console.log(`HTTP request to trigger ${sound} note at ${frequency}Hz on client ${clientId}`);
  
  const success = sendToClient(clientId, {
    type: 'triggerSound',
    sound: sound,
    frequency: frequency
  });
  
  res.json({ 
    success, 
    message: success ? `Note triggered at ${frequency}Hz` : 'Client not found' 
  });
});

app.get('/api/sequence/:sound/:delay', (req, res) => {
  const sound = req.params.sound;
  const delay = parseInt(req.params.delay);
  const clientIds = getClientIds().sort(); // Sort UUIDs alphabetically instead of numerically
  
  console.log(`HTTP request to play sequence with ${sound} sound and ${delay}ms delay`);
  
  clientIds.forEach((clientId, index) => {
    setTimeout(() => {
      sendToClient(clientId, {
        type: 'triggerSound',
        sound: sound
      });
    }, index * delay);
  });
  
  res.json({ success: true, clients: clientIds.length });
});

app.get('/api/clients', (req, res) => {
  res.json({ 
    clients: getClientIds(),
    count: clients.size
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log(`Open http://localhost:${PORT}/client.html for client page`);
  console.log(`Open http://localhost:${PORT}/controller.html for controller page`);
  
  // Print local IP addresses for easy connection
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  
  console.log('\nAvailable IP addresses to connect from other devices:');
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`http://${net.address}:${PORT}/client.html`);
      }
    }
  }
});