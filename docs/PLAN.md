# Echo Mesh v2 — plan

A rewrite of v1 (kept on the `refactor-modular-architecture` branch). Goals:

- **Performative, not menus.** A performer should be able to drive it mid-show without hunting.
  Every screen answers "what do I do next?"
- **Tight sync is the product.** Everything else is built on a shared clock.
- **LAN first, hosted later.** Keep the server thin and swappable (Durable Objects / PartyKit later).
- **Live performance and installation first.** Core features: spatial waves, MIDI keyboard, note distribution.

## Architecture

```
packages/protocol   wire types + zod validation (one source of truth for every message)
packages/sync       pure timing math: clock sync, audio-clock mapping, transport, ping loop
packages/voice      per-device synth (standard WebAudio only — runs in browsers and in Node tests)
packages/music      music theory + the per-beat "what does this phone play" plan
apps/server         Node http + ws; authoritative session state; serves the built web app
apps/web            Svelte 5 + Vite; /  = phone (player), /conduct = conductor
```

### Timing model

1. **Clock sync (NTP-style).** Devices ping at 2 Hz after a 12-ping burst. Samples are weighted by
   how close their RTT is to the best seen (`exp(-(rtt-min)/2ms)`): low-RTT exchanges have
   near-symmetric paths, so their offsets are near-exact. Drift (crystal rate difference) is fitted
   over 5 minutes; the offset comes from the last 30 s, drift-corrected. Small corrections are
   slewed (≤5 ms/s) so scheduled events never jump.
2. **Audio clock mapping.** `AudioContext.getOutputTimestamp()` pairs the speaker-output sample
   with page time; a fitted line maps page time → context time, so audio is scheduled to *exit the
   speaker* at the target instant.
3. **Shared transport.** The server broadcasts an anchor (`bpm`, `anchorTime`, `anchorBeat`); every
   device derives beat times itself. No per-beat messages, no accumulated jitter. Tempo changes land
   on a future whole beat so everyone switches together.
4. **Playout delay.** Live events (MIDI, wave hits) are stamped `now + playoutMs` (default 150 ms) so
   they arrive before they're due; devices commit events 120 ms ahead in a lookahead scheduler.

### Measured so far

| setting | result |
| --- | --- |
| simulation, harsh phone WiFi (8 ms exp. jitter, 10% stalls up to 300 ms), 100 seeds | p95 clock error < 1 ms, max < 1.5 ms |
| simulation, 60 ppm drift, 3 min | < 1 ms error, drift recovered within ±15 ppm |
| integration: 6 simulated phones over real WebSockets with injected jitter | 0.6–1.1 ms firing spread |
| real Chrome, 3 tabs, localhost | 0.05 ms firing spread |

| first real phone (iPhone, iOS 18.7, home WiFi) | 7 ms best RTT, ±4.5 ms worst-case bound; audio map residual 0.15 ms, 12.3 ms reported output latency |

**Still to measure:** many phones at once, different WiFi, and actual acoustic output (needs sound).

### Voice

- Signal path per device: `oscillator → low-pass → ADSR envelope → bus → tanh soft-clipper → speakers`.
- The clipper is a WaveShaper, which clamps its input, so the output **cannot** exceed the ceiling
  (0.89 ≈ -1 dBFS) however many notes stack up.
- **Zero-latency output stage.** No `DynamicsCompressorNode` (its lookahead delay differs per browser
  engine: ~6 ms in Chrome, 10.7 ms measured in node-web-audio-api), and no WaveShaper oversampling
  (adds resampler delay and overshoots the curve). A per-engine delay would show up as sync error
  between Safari and Chrome phones.
- Verified silently by rendering into OfflineAudioContext buffers, both in Node and in Chrome's engine:
  onset within 1 sample of the target, peak exactly at the ceiling, release and panic reach true silence.

### Live notes

- The conductor stamps each note `serverNow + playoutMs` itself, so latency stays constant.
  The server only clamps it to the future.
- The server allocates notes and remembers where each one went, so its noteOff follows it.
  - `all`: every phone plays every note.
  - `round-robin`: one phone per note, preferring idle phones, so a chord spreads across the room.
- Panic is its own message (never a scheduled cue, so it can't be dropped for lateness). It also stops the transport.
- Per-device trim (± ms, conductor tile) shifts that phone's audio earlier or later for slow outputs.
  It is stored server-side and survives reconnects.

### Metronome (listening test)

- A click or short note on the shared transport. It is computed locally on every phone, so there are no per-beat messages.
- `who: all`: every phone on every beat.
- `who: rotate`: the server gives each synced phone a seat, and the phone plays beats where `beat % count === seat`.
  Rotation is the most revealing listening test, because sync error becomes an audibly uneven rhythm.
- The click is a 1 ms-attack sine blip, so its position in time is unambiguous.

## Phases

- [x] **0. Timing core**: sync, transport, scheduler, conductor "sync lab", silent visual flashes
- [ ] **0.5 Real-device validation**
  - [x] First phone on LAN: works, numbers above.
  - Several phones at once.
  - Film several phones flashing with slow-mo video (silent test).
  - Later, with sound: mic recording of clicks, to measure output latency per device model.
- [x] **1. Voice** (built and verified silently; awaiting a first listen)
  - Plain-WebAudio synth scheduled at audio-clock time, with the safety ceiling.
  - Live notes from the conductor's computer keyboard and on-screen piano, with all / round-robin distribution.
  - Panic, per-device trim, and `navigator.audioSession = 'playback'` (iOS ringer switch).
  - Not built: Tone.js samplers. They can plug into the same bus later.
- [x] **2a. Groups**: six colors. Phones self-assign from a 2×3 grid; the conductor can override from the tile.
  The phone shows its color. Each device gets a single `self` message (seat, group, position, trim).
- [x] **2b. Progression loop**: key, scale, presets borrowed from v1 (minor keys fixed), editable chord chips,
  pad / arp / both. Phones compute their own notes per beat from shared state: no per-note messages.
  Edits land on the next bar. Each phone plays one chord tone, walking up the chord in room order;
  extra phones double an octave up. The arp steps through phones in room order (↑ ↓ ↕ random).
- [ ] **2c. Session model**: phones display their current patch; per-group patches; save/load sessions;
  persist groups and positions across server restarts (currently lost on restart).
- [x] **3. MIDI keyboard + distribution** (spatial allocation waits for phase 4 positions)
  - Web MIDI on the conductor (Chrome/Edge), hot-plug, input picker, activity light.
  - Velocity and sustain pedal (CC64); all-notes-off (CC120/123) releases everything.
  - Keyboard, mouse and MIDI share one `LiveNotes` state machine (unit tested).
  - Notes are stamped from the MIDI event's own timestamp, so main-thread delays don't add jitter.
  - Not built: MIDI clock in/out, channel → group routing (after phase 2 groups).
- [x] **4. Stage map + waves**
  - Drag devices onto a top-down room map. Placed devices define the room order (left → right).
  - Click the floor to send a wave: one message. Each phone adds `distance / speed` and plays its
    chord tone (or its tone in the loop's first chord when the loop is stopped).
  - Measured in Chrome: hits landed within ~3 ms of expected (playout + distance ÷ speed).
  - Next: wave shapes (line sweeps, spirals), waves on the beat, and spatial live-note allocation.
- [ ] **5. Performance UX**: one-screen performance view, scenes/presets, panic, save/load
- [ ] **6. Installation mode**: unattended operation, auto-rejoin, wake lock (needs HTTPS), kiosk
- [ ] **7. Hosted**: internet deployment, rooms, audience QR join

## Dev rules

- Sound is on by default. `VITE_SOUND=off` builds a version that physically can't reach the speakers.
- Prefer verifying audio by offline rendering and numbers; ask before triggering audible playback from automation.
- `pnpm test` must stay green; timing changes need a simulation test.
- In dev, `window.__echoProbe` on a player tab records each beat's planned wall-clock time.
  Comparing it across tabs on one machine measures real end-to-end sync.

## Known gaps / notes

- Server state is in memory only; a restart stops the transport (devices reconnect and keep their ids).
- Wake Lock needs HTTPS on phones. Plain-http LAN will let screens sleep, so use mkcert or hosted for installs.
- Bluetooth output latency isn't reported by browsers, so it needs the per-device trim.
- The Playwright-driven Chrome has no working audio output: its audio clock stalls. Tiles correctly
  say "audio stalled" there; real browsers are fine.
- v1's music theory (progressions, chord builder) is still on the old branch; port it in phase 3.
