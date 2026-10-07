# Echo Mesh

**Phones as a synchronized orchestra.** Every device in the room becomes a voice, kept in time with a shared clock.

> v2 is a rewrite in progress. The timing core and a per-phone synth work; MIDI input and spatial waves come next.
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
apps/server         Node http + WebSocket server
apps/web            Svelte 5 app: phone view (/) and conductor (/conduct)
```

## Tests

```bash
pnpm test         # sync simulations + server integration (simulated phones over real sockets)
pnpm typecheck
```
