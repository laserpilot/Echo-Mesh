# Mobile Orchestra Refactoring Plan

## Current State
- **controller.html**: 5,121 lines (massive monolithic file)
- **client.html**: 1,200 lines (large but manageable)
- All CSS and JavaScript embedded in HTML files
- Difficult to maintain, debug, and extend

## Refactoring Goals
1. **Separation of Concerns**: Extract CSS, JavaScript, and HTML into focused files
2. **Modularity**: Create reusable, testable modules
3. **Maintainability**: Make code easier to understand and modify
4. **Reusability**: Share common code between controller and client
5. **Scalability**: Enable easier addition of new features

## Phase 1: CSS Extraction ✅
Create dedicated stylesheets:
- `public/css/shared.css` - Common styles (buttons, indicators, layouts)
- `public/css/controller.css` - Controller-specific styles
- `public/css/client.css` - Client-specific styles

## Phase 2: JavaScript Module Structure ✅
### Shared Modules
- `public/js/shared/audio-utils.js` - Common audio synthesis functions
- `public/js/shared/websocket-base.js` - Base WebSocket functionality
- `public/js/shared/constants.js` - Shared constants and configurations
- `public/js/shared/message-types.js` - WebSocket message definitions

### Controller Modules
- `public/js/controller/websocket-controller.js` - WebSocket server management
- `public/js/controller/audio-controller.js` - Audio synthesis and effects
- `public/js/controller/ui-controller.js` - UI state management
- `public/js/controller/chord-controller.js` - Chord progression logic
- `public/js/controller/pattern-controller.js` - Pattern sequencing
- `public/js/controller/client-manager.js` - Client tracking and distribution
- `public/js/controller/metronome-controller.js` - Metronome functionality

### Client Modules
- `public/js/client/websocket-client.js` - WebSocket client connection
- `public/js/client/audio-engine.js` - Client sound synthesis
- `public/js/client/piano-keyboard.js` - Piano interface component
- `public/js/client/sync-manager.js` - Time synchronization

## Phase 3: HTML Refactoring ⏳
- Update controller.html to use external CSS and JS modules
- Update client.html to use external CSS and JS modules
- Implement proper module loading
- Add error handling and fallbacks

## Phase 4: Configuration Management
- `public/js/config/audio-config.js` - Audio settings, frequencies, effects
- `public/js/config/ui-config.js` - UI layout, colors, dimensions
- `public/js/config/chord-progressions.js` - Musical configurations

## Phase 5: Testing and Optimization
- Add basic error handling
- Test module loading and functionality
- Optimize for mobile performance
- Document new architecture

## Benefits After Refactoring
- **Easier maintenance**: Find and modify specific functionality quickly
- **Better debugging**: Isolated modules are easier to troubleshoot  
- **Code reuse**: Shared components between controller and client
- **Team collaboration**: Multiple developers can work on different modules
- **Performance**: Better caching of separate files
- **Testing**: Individual modules can be tested in isolation

## Implementation Notes
- Use ES6 modules where supported, with fallback for older browsers
- Maintain backward compatibility during transition
- Keep the same WebSocket message protocol
- Preserve all existing functionality during refactoring
- Add progressive enhancement for better user experience

## Progress Tracking
- [✅] Phase 1: CSS Extraction
- [✅] Phase 2: JavaScript Module Structure (Complete)
  - [✅] Shared modules (constants, audio-utils, websocket-base)
  - [✅] Client modules (all complete)
  - [✅] Controller modules (metronome, chord, client-manager, ui, websocket, pattern, audio)
- [⏳] Phase 3: HTML Refactoring (In Progress)
- [⏳] Phase 4: Configuration Management
- [⏳] Phase 5: Testing and Optimization

## Completed Modules
### Shared
- ✅ constants.js
- ✅ audio-utils.js  
- ✅ websocket-base.js

### Client
- ✅ client-app.js
- ✅ websocket-client.js
- ✅ audio-engine.js
- ✅ piano-keyboard.js
- ✅ sync-manager.js

### Controller
- ✅ controller-app.js (updated with all modules)
- ✅ websocket-controller.js
- ✅ ui-controller.js
- ✅ metronome-controller.js
- ✅ chord-controller.js
- ✅ client-manager.js
- ✅ pattern-controller.js
- ✅ audio-controller.js

## Next Steps
1. Update controller.html to remove old JavaScript and use modules only
2. Test the modular controller interface
3. Phase 4: Configuration Management
4. Phase 5: Testing and Optimization