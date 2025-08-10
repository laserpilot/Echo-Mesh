# Echo Mesh 🌊

**A distributed mobile orchestra using web audio synthesis**

Echo Mesh transforms mobile phones into a spatial audio network, creating immersive soundscapes where each device becomes an instrument in a distributed orchestra. Play music that ripples across space, trigger waves of sound, and turn any room into a concert hall.

![Echo Mesh Demo](https://img.shields.io/badge/status-active-brightgreen) ![Node.js](https://img.shields.io/badge/node.js-20+-green) ![Web Audio](https://img.shields.io/badge/Web%20Audio%20API-supported-blue) ![MIDI](https://img.shields.io/badge/Web%20MIDI%20API-supported-purple)

## 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/laserpilot/Echo-Mesh.git
cd Echo-Mesh
npm install

# Start the server
npm start

# Controller: http://localhost:3000/controller.html
# Mobile clients: http://localhost:3000/client.html
```

## ✨ Features

### 🌊 **Spatial Wave Propagation**
- **Interactive Canvas**: Click to trigger expanding sound waves
- **Wave Types**: Circular ripples, spirals, directional beams
- **Collision Detection**: Waves trigger devices as they pass through
- **Drag & Drop**: Reposition devices in virtual 2D space
- **Pattern Presets**: Orbital waves, spiral bursts, pulse sequences

### 🎹 **Live MIDI Keyboard Integration**
- **USB MIDI Support**: Connect any MIDI keyboard to your controller
- **Broadcast Mode**: Traditional synthesizer (all devices play every note)
- **Distributed Mode**: Spatial polyphony across devices
- **Smart Distribution**: Automatic note allocation based on device count
  - 2 devices: Alternating notes for stereo effects
  - 4+ devices: Distributed polyphony across zones
- **Visual Feedback**: Real-time keyboard showing note assignments

### 🎵 **Advanced Musical Features**
- **Chord Progressions**: I-V-vi-IV and custom progressions
- **Step Sequencer**: 16-step pattern sequencer with swing
- **ADSR Envelopes**: Attack, decay, sustain, release controls  
- **Effects Chain**: Reverb, delay, filters with LFO modulation
- **Multiple Waveforms**: Sine, square, sawtooth, triangle, noise
- **Client Grouping**: Organize devices into orchestral sections

### 🎛️ **Performance Tools**
- **Real-time Control**: Live performance interface
- **MIDI File Playback**: Upload and play MIDI files across the network
- **Metronome**: Built-in click track for synchronization
- **Looping**: Automated pattern playback with multiple modes
- **Recording**: Session capture and playback (coming soon)

### 📱 **Mobile-First Design**
- **QR Code Setup**: Instant client connection via QR scan
- **Touch Optimized**: Responsive interface for all screen sizes
- **Battery Conscious**: Efficient audio processing
- **Offline Resilient**: Automatic reconnection handling
- **Screen Wake Lock**: Keep devices active during performances

## 🏗️ Architecture

```
Controller (laptop/desktop)     Mobile Clients (phones/tablets)
┌─────────────────────────┐    ┌─────────────────────────┐
│  🎹 MIDI Keyboard       │    │  🔊 Web Audio           │
│  🌊 Wave Propagation    │◄──►│  📱 Touch Interface     │
│  🎵 Chord Progressions  │    │  🔗 WebSocket Client    │
│  📊 Visualization       │    │  🎚️ Local Controls      │
└─────────────────────────┘    └─────────────────────────┘
             │                              │
             └──────── WebSocket ───────────┘
                   Real-time sync
```

## 🎮 How to Use

### Basic Setup
1. **Start Server**: Run `npm start` on your controller computer
2. **Connect Devices**: Scan QR code or visit the client URL on mobile devices  
3. **Test System**: Use individual device controls to verify connections
4. **Create Music**: Choose your performance mode and start playing!

### Spatial Wave Performance
1. Navigate to **🌊 Spatial Waves** section
2. Drag device icons to position them in virtual space
3. Click anywhere on canvas to trigger expanding waves
4. Watch as waves hit devices and trigger harmonized notes
5. Experiment with wave types and speed controls

### MIDI Keyboard Performance  
1. Connect USB MIDI keyboard to controller computer
2. Go to **🎭 Perform** section → **🎹 Live MIDI Keyboard**
3. Choose **Broadcast** (all devices) or **Distributed** (spatial) mode
4. Play keyboard and watch notes distribute across your device orchestra
5. Use the visual keyboard to see real-time note assignments

### Advanced Workflows
- **Chord Progressions**: Set up I-V-vi-IV progressions in Compose section
- **Device Groups**: Organize clients into sections (strings, brass, etc.)
- **Effects Chains**: Add reverb, delay, and filters with LFO modulation
- **Step Sequencer**: Program 16-step patterns with swing and velocity curves

## 🔧 Technical Requirements

### Server (Controller)
- **Node.js**: 16+ recommended
- **Operating System**: macOS, Windows, Linux
- **Network**: Local WiFi network
- **Optional**: USB MIDI keyboard for live performance

### Clients (Mobile Devices)
- **Browser**: Chrome, Safari, Firefox (Web Audio API support)
- **Network**: Same WiFi as server
- **Permissions**: Microphone access (for audio context initialization)

### Network Setup
- All devices must be on the same WiFi network
- Firewall may need port 3000 opened
- Router should support WebSocket connections

## 🛠️ Development

```bash
# Development with auto-restart
npm run dev

# Project structure
├── server.js              # WebSocket server & API
├── public/
│   ├── controller.html     # Main controller interface  
│   ├── client.html         # Mobile client interface
│   ├── css/               # Stylesheets
│   └── js/shared/         # Shared utilities
├── FEATURES.md            # Feature roadmap
└── package.json           # Dependencies
```

### API Endpoints
- `GET /api/ping` - Server health check
- `GET /api/network-info` - Available IP addresses  
- `GET /api/trigger/:id/:sound` - Trigger sound on specific client
- `GET /api/note/:id/:sound/:frequency` - Play frequency on client
- `GET /api/sequence/:sound/:delay` - Sequential playback across clients

### WebSocket Events
```javascript
// Client → Server
{ type: 'register', userAgent: '...' }

// Server → Client  
{ type: 'id', id: 'client-uuid' }
{ type: 'triggerSound', sound: 'sine', frequency: 440 }
{ type: 'triggerNote', noteId: 'unique-id', sustain: true }
{ type: 'stopNote', noteId: 'unique-id' }
```

## 🎯 Use Cases

### 🎭 **Live Performance**
- Electronic music performances with spatial audio
- Sound installations in galleries or events
- Interactive concerts where audience devices participate
- Experimental music exploration and composition

### 🏫 **Education** 
- Teaching harmony and chord progressions
- Demonstrating wave propagation and physics of sound
- Collaborative music creation in classrooms
- STEM education combining programming and music

### 🔬 **Research**
- Studying spatial audio perception
- Network latency and synchronization research  
- Human-computer interaction in musical contexts
- Distributed systems and real-time communication

### 🎉 **Entertainment**
- Party games and interactive experiences
- Ambient soundscapes for gatherings
- Collaborative jam sessions
- Sound art and experimental installations

## 🤝 Contributing

We welcome contributions! Areas where help is needed:

- **🎵 Audio Features**: New synthesis methods, effects, filters
- **📱 Mobile UX**: Touch interfaces, gesture controls
- **🌐 Networking**: Latency optimization, mesh networking
- **🎨 Visualization**: Enhanced graphics, 3D spatial views
- **🔧 Platform Support**: iOS Safari quirks, Android compatibility
- **📖 Documentation**: Tutorials, API documentation

See [FEATURES.md](FEATURES.md) for the complete roadmap.

## 🐛 Troubleshooting

### Common Issues

**Clients won't connect**
- Ensure all devices are on same WiFi network
- Check firewall settings (port 3000)  
- Try accessing via IP address instead of localhost

**Audio not working on mobile**
- Tap screen to enable audio context (browser requirement)
- Check device volume and mute settings
- Ensure browser supports Web Audio API

**MIDI keyboard not detected**  
- Chrome/Edge required for Web MIDI API
- Check USB connection and keyboard power
- Grant MIDI permissions when prompted

**High latency/audio glitches**
- Close other apps consuming network/CPU
- Use 5GHz WiFi if available  
- Reduce number of simultaneous effects

### Performance Tips
- Keep client count under 20 for optimal performance
- Use ethernet connection for controller if possible
- Close unnecessary browser tabs on mobile devices
- Enable "Do Not Disturb" to prevent interruptions

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

Built with ❤️ using Web Audio API, WebSockets, and Node.js.

## 🙏 Acknowledgments

- **Web Audio API** - For making browser-based synthesis possible
- **WebSocket Protocol** - For real-time client-server communication  
- **Tone.js** - MIDI file parsing and audio utilities
- **QRious** - QR code generation for easy mobile connection

---

**Echo Mesh** - *Where sound travels through space and time* 🌊🎵