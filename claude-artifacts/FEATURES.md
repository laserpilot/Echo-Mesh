# Echo Mesh - Feature Roadmap

###Improvements
- [x] Lets go ahead and let all tabs be open and not locked if a client isnt connected yet
- [x] Lets just add a global BPM and key to the top bar of the whole setup - this will take the place of all over BPM entries
- [x] lets think about maybe moving some of the sound controls to the tab currently called "test" i think we can maybe rethink that tab to be more sound shaping (effects, note assignments, timbre per client or group) and compose is more about how the notes and played and the timing, and spatial waves is a different control.
- [x] Move ADSR Envelope from Compose to Sound Shaping
- [x] Move LFO from Compose to Sound Shaping
- [x] Move Effects chain from Compose to Sound Shaping
- [x] Default capability is that all sound shaping controls effect ALL clients
- [x] Additional functionality should let us set the sound shaping PER CLIENT and let us safe a preset sound so you can add presets to specific clients or groups.
- [ ] Chord Assignment section currently plays scale degrees. However, on spatial waves, should allow us to press a key to play the Chord for that key for that scale - so by default pressing 1 will play an I chord, and a 2 will play a ii chord and a 3 will play a iiiº chord and so on from the master selected key. However - the key assignment dropdowns should let you assign a key to any chord of the key - so everything from I to V7 and up to V13 chords and others. We don't need inversions, just regular stacks for the key

- [X] Client connection logic needs a look - when the app loads, the controller seems to register as a client itself, so it always confusingly lists 1 client as connected, and when a client first loads client.html, it always shows a UUID ID of CONTROLL. We need to explicitly call the Controller as a Controller if it needs to show in the client list.
- [ ] On the client keyboard layout, it should always show the note that is played even though we're visually only showing a single octave - it doesnt matter if the note is C5 or C3, it should just show as a C on the single octave
- [X] Preview effects on the sound shaping tab doesnt preview on the controller - its just an unfiltered version
- [X] Effects on sound shaping tab should expose more than just dry/wet mix and effects gain, they should show the parameters per sound
- [ ] Client grouping doesnt work
- [ ] Spatial Waves needs the ability to select an octave, it ends up very low
- [ ] Whole note calculation in Advanced Chords is wrong - its 4x too fast or plays as a quarter note
- [ ] Client layouts UI in controller should be significantly reduced in size - everything is too large, especially when there are a lot of clients
- [ ] Client grouping doesn't have a way to actually set client groups, or its unclear how to assign
- [ ] Currently unclear when you change sounds and a sequence is playing, it is unclear when those sounds are properly propagated to the client. can we make a little UI that shows the current ADSR/waveform/effects on each client?
- [ ] Add a 2x3 color grid to client where a user can tap a button to self assign themself to a group. pressing the button should change the background color of the client so they can be easily identified. this will help with spatial positioning in large groups.
- [ ] Spatial Waves checkerboard pattern should have reduced contrast - hard black and white is hard to look at
- [ ] Sound Shaping page for each client should show the current sound (ADSR, waveform, effects) being played as well as the note played on that client
- [ ] Need a global start/stop in the top bar, or a sort of panic stop somewhere
- [ ] MIDI file playback works, but it gets a little crazy with density and once it is started, the clients dont seem to respect a stop message



- [] Eventually add sampler instruments like https://github.com/nbrosowsky/tonejs-instruments?tab=readme-ov-file 
- [ ] implement tonejs piano https://www.npmjs.com/package/@tonejs/piano
- [ ] 





-----OLD FEATURES BELOW THIS LINE------
## 🎵 Performance & Usability Improvements

### Visual Feedback, Status & Onboarding
- [ ] **Connection quality indicators** - show RTT/latency with color coding (green/yellow/red)
- [x] **Volume levels per client** - individual volume controls for each client
- [ ] **Activity indicators** - show which clients are currently playing sounds
- [ ] **Live visual feedback for sound design** - show ADSR envelope shape, LFO wave, etc.
- [ ] **Global status bar** - persistent display of Key, Scale, BPM.

### Quick Setup Features
- [ ] **Guided setup wizard** - step-by-step process for creating a new song.
- [ ] **Interactive onboarding tour** - guide new users through the main features.
- [x] **QR code generation** - controller shows QR code for easy client connection
- [ ] **Save/load sessions** - remember client configurations and pitch assignments

## 🎼 Musical Enhancements

### Performance Tools
- [ ] **Metronome/click track** - built-in metronome that all clients can hear. metronome can also be played out of each client device to determine sync variance.
- [ ] **Chord progressions** - predefined chord sequences (I-V-vi-IV, etc.)
- [ ] **Undo/Redo for composition** - allow undoing changes to progressions, patterns, etc.
- [ ] **Rhythm patterns** - preset drum-like patterns distributed across clients
- [ ] **Key change function** - transpose entire orchestra up/down

### Sound Library
- [ ] **More waveforms and synth options** - add noise, filtered sawtooth, organ-like sounds
- [ ] **Add effects** - add the range of options with th Tone.effect module like reverb 
- [ ] **Percussion sounds** - kick, snare, hi-hat samples for rhythm sections
- [ ] **Sound effects** - rain, wind, ambient textures for experimental music
- [ ] **Safe volume limit** - make sure the very end of the client chain has a safe volume limiter on it so it doesn't blow out headphones

## 🎛️ Control & Organization

### Interface & Workflow Redesign
- [ ] **Restructure controller UI** - create a more logical and less overwhelming layout.
  - [ ] Consider a step-by-step workflow: Setup → Compose → Perform.
  - [ ] Use sidebar navigation with collapsible sections for better organization.
  - [ ] Break up the 'Compose' view into logical tabs (e.g., Harmony, Sound Design, Arrangement).
- [ ] **Improve user guidance and feedback**
  - [ ] Add tooltips `(?)` for complex musical/technical terms.
  - [ ] Use actionable 'empty states' to guide users (e.g., "No clients connected. Scan the QR code to join.").

### Client Management
- [ ] **Modular presets** - save/load individual components like chord progressions, effect chains, or rhythm patterns.
- [ ] **Mute/solo controls** - mute individual clients or solo specific ones
- [x] **Set volume per client** - default to full volume
- [x] **Client naming** - let users give friendly names to their devices
- [ ] **Position memory** - remember panning positions for reconnected clients
- [ ] Ability to "push" a specific sound type to a client per client - by default we can tell all devices to use the same sound/timbre, but the client configuration page should let us pick, per client, the waveform, ADSR, volume, and effect

### Advanced Features
- [ ] **Conductor mode** - simplified interface for live conducting gestures
- [ ] **Keyboard shortcuts** - for live performance actions (play/stop, pattern switching).
- [ ] **COnnection to local midi playback** allow timing or note control from something like Ableton Live or other music performance

## 📱 Mobile-Specific Improvements

### Device Optimization
- [ ] **Screen wake lock** - keep mobile screens on during performances (partially implemented)
- [ ] **Fullscreen mode** - hide browser UI for cleaner performance interface
- [ ] Show a piano keyboard graphic on client where it will light up the notes that are currently being played. allow client to only press keys that are in the current key of the song.

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
1. **Controller UI reorganization** - address current usability confusion
2. **Guided setup wizard** - massive improvement for new user onboarding.
3. **Connection quality indicators** - essential for performance reliability
4. **Mute/solo controls** - essential for managing a performance.

### Medium Priority (Performance Enhancers)
1. **Metronome/click track** - crucial for synchronized performance
2. **Undo/Redo for composition** - encourages experimentation.
3. **Keyboard shortcuts** - major workflow boost for power users.
4. **Modular presets** - allows for creative mixing and matching.
5. **More waveforms** - expands creative possibilities

### Low Priority (Nice to Have)
1. **Live visual feedback for sound design** - helpful but not critical for function.
2. **Global status bar** - good quality-of-life, but can be worked around.
3. **Offline mode** - edge case handling
4. **Conductor mode** - specialized interface

## 🧠 Brainstorm / Backlog

- **Recording capability** - record live performance to an internal format for playback.
- **Export to audio file** - post-performance feature to save a .wav or .mp3.
- **Multiple controllers** - allow more than one person to control the orchestra.
- **Client grouping** - organization for larger orchestras (e.g., "strings", "percussion").

## 📝 Notes

- Mark items as complete with `[x]` when implemented
- Mark partially implemented items with `[~]`
- Add sub-tasks or implementation notes under each item as needed
- Consider breaking complex features into smaller, testable chunks
- Review and prioritize based on actual usage patterns