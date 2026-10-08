# Echo Mesh

**Phones as a synchronized orchestra.** Every device in the room becomes a voice, kept in time with a shared clock.

> v2 is a rewrite in progress. Working now: tight sync, a per-phone synth, MIDI and keyboard input, a progression loop, groups, and a stage map with waves.
> See [docs/PLAN.md](docs/PLAN.md). v1 lives on the `refactor-modular-architecture` branch.

## Run it

Requires Node 22+ and pnpm.

```bash
pnpm install
pnpm dev
```

- Conductor: http://localhost:5173/conduct
- Phones: scan the QR code on the conductor page (same Wi-Fi), then tap once.

Conductor controls:
- **A–K** play notes; **Z / X** change octave. "One phone each" spreads a chord across phones.
- **MIDI keyboard**: click "Enable MIDI keyboard" under the piano. This needs Chrome or Edge.
  Velocity and the sustain pedal work, and hot-plugging is picked up automatically.
- **Space** starts or stops the beat, **↑ ↓** change tempo, **Enter** flashes every phone.
- **Click** (top bar) puts a click or short note on every beat.
  - *all phones*: every phone plays every beat. Flams mean sync error.
  - *rotate*: the beat steps around the phones in turn. An uneven rhythm means sync error.
- **Loop** (top left): pick a key, scale and preset, or build chords with the *add* buttons.
  - Click a chord to change its length; **7** adds the seventh.
  - Each phone plays **one chord tone** as a *pad*, an *arp* stepping around the room, or *both*.
  - **L** starts or stops the loop. Edits land on the next bar.
- **Room** (bottom left): drag phones to where they are in the room. Click the floor to send a wave from that spot.
  The room order (left → right) decides which chord tone each phone gets and the arp order.
- **Groups**: phones tap the square in their footer to pick a color. On the conductor, click a tile's color chip to change it.
- **Esc** is panic.

Each phone lights up with the note it's playing. Each phone's sync quality and latency trim appear on its tile.

Sound is on. For a build that can't make any sound, e.g. for late-night development, use `VITE_SOUND=off pnpm dev`.

## Production-style run (one port)

```bash
pnpm build && pnpm start      # serves everything on :8787
```

## Layout

```
packages/protocol   message types + validation
packages/sync       clock sync, audio-clock mapping, transport math (pure, tested)
packages/voice      per-phone synth with a hard output ceiling (tested by offline rendering)
packages/music      scales, diatonic chords, presets, voicing, arp order, per-beat playback plan
apps/server         Node http + WebSocket server
apps/web            Svelte 5 app: phone view (/) and conductor (/conduct)
```

## Tests

```bash
pnpm test         # sync simulations + server integration (simulated phones over real sockets)
pnpm typecheck
```
