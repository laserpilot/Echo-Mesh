# Mobile Orchestra - Feature Roadmap

## 🎵 Performance & Usability Improvements

### Visual Feedback & Status
- [ ] **Connection quality indicators** - show RTT/latency with color coding (green/yellow/red)
- [ ] **Battery level warning** - mobile clients show battery status to prevent mid-performance dropouts
- [ ] **Volume levels per client** - individual volume controls for each client
- [ ] **Activity indicators** - show which clients are currently playing sounds

### Quick Setup Features
- [ ] **QR code generation** - controller shows QR code for easy client connection
- [ ] **Auto-discovery** - broadcast server IP on local network for easier mobile connection
- [ ] **Setup wizard** - guided setup for new users
- [ ] **Save/load sessions** - remember client configurations and pitch assignments

## 🎼 Musical Enhancements

### Performance Tools
- [ ] **Metronome/click track** - built-in metronome that all clients can hear
- [ ] **Chord progressions** - predefined chord sequences (I-V-vi-IV, etc.)
- [ ] **Rhythm patterns** - preset drum-like patterns distributed across clients
- [ ] **Key change function** - transpose entire orchestra up/down

### Sound Library
- [ ] **More waveforms** - add noise, filtered sawtooth, organ-like sounds
- [ ] **Percussion sounds** - kick, snare, hi-hat samples for rhythm sections
- [ ] **Sound effects** - rain, wind, ambient textures for experimental music

## 🎛️ Control & Organization

### Client Management
- [ ] **Client grouping** - organize clients into sections (strings, brass, percussion)
- [ ] **Mute/solo controls** - mute individual clients or solo specific ones
- [ ] **Client naming** - let users give friendly names to their devices
- [ ] **Position memory** - remember panning positions for reconnected clients

### Advanced Features
- [ ] **Recording capability** - record the mixed output for playback
- [ ] **Export to audio file** - save performances as WAV/MP3
- [ ] **Multiple controllers** - allow multiple people to control different aspects
- [ ] **Conductor mode** - simplified interface for live conducting gestures

## 📱 Mobile-Specific Improvements

### Device Optimization
- [ ] **Screen wake lock** - keep mobile screens on during performances (partially implemented)
- [ ] **Fullscreen mode** - hide browser UI for cleaner performance interface
- [ ] **Orientation lock** - prevent accidental rotation during performance
- [ ] **Haptic feedback** - subtle vibration when sounds are triggered

## 🔧 Technical Enhancements

### Reliability & Performance
- [ ] **Automatic reconnection** - seamless reconnection if client disconnects (partially implemented)
- [ ] **Offline mode** - basic functionality when server is unreachable
- [ ] **Performance monitoring** - track timing accuracy and connection quality
- [ ] **Graceful degradation** - reduce features if network performance is poor

### Code Architecture
- [ ] **Refactor server.js** - split into separate client and controller handlers if complexity grows
- [ ] **Module system** - break functionality into reusable modules
- [ ] **Configuration files** - externalize settings and presets
- [ ] **Testing framework** - add automated tests for core functionality

## 🚀 Priority Recommendations

### High Priority (Quick Wins)
1. **QR code generation** - immediate setup improvement
2. **Connection quality indicators** - essential for performance reliability
3. **Client naming** - basic usability improvement
4. **Volume controls** - essential for live performance balance

### Medium Priority (Performance Enhancers)
1. **Metronome/click track** - crucial for synchronized performance
2. **Client grouping** - organization for larger orchestras
3. **Recording capability** - valuable for practice and documentation
4. **More waveforms** - expands creative possibilities

### Low Priority (Nice to Have)
1. **Export to audio file** - post-performance feature
2. **Multiple controllers** - advanced use case
3. **Offline mode** - edge case handling
4. **Conductor mode** - specialized interface

## 📝 Notes

- Mark items as complete with `[x]` when implemented
- Add sub-tasks or implementation notes under each item as needed
- Consider breaking complex features into smaller, testable chunks
- Review and prioritize based on actual usage patterns