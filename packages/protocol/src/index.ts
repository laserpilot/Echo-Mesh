import { z } from 'zod';

/**
 * Wire protocol. JSON over a single WebSocket at /ws.
 *
 * All `at`/time fields are SERVER clock milliseconds unless named otherwise.
 * Devices convert to their own clocks using the sync estimate.
 */

export const Role = z.enum(['player', 'conductor']);
export type Role = z.infer<typeof Role>;

export const TransportSchema = z.object({
  running: z.boolean(),
  bpm: z.number().min(20).max(400),
  anchorTime: z.number(),
  anchorBeat: z.number().int(),
  startBeat: z.number().int(),
  beatsPerBar: z.number().int().min(1).max(16),
});

export const PlayerStatsSchema = z.object({
  clock: z.object({
    ready: z.boolean(),
    offset: z.number(),
    uncertainty: z.number(),
    minRtt: z.number(),
    driftPpm: z.number(),
    samples: z.number(),
  }),
  audio: z
    .object({
      state: z.string(),
      sampleRate: z.number(),
      baseLatency: z.number(),
      outputLatency: z.number(),
      mapResidual: z.number(),
      mapDriftPpm: z.number(),
    })
    .nullable(),
  schedule: z.object({
    scheduled: z.number(),
    late: z.number(),
    dropped: z.number(),
    worstLateMs: z.number(),
  }),
  visible: z.boolean(),
  ua: z.string().max(200),
});
export type PlayerStats = z.infer<typeof PlayerStatsSchema>;

/** A playable sound. Times in seconds. */
export const PatchSchema = z.object({
  wave: z.enum(['sine', 'triangle', 'sawtooth', 'square']),
  attack: z.number().min(0).max(10),
  decay: z.number().min(0).max(10),
  sustain: z.number().min(0).max(1),
  release: z.number().min(0.005).max(20),
  /** low-pass cutoff, Hz */
  cutoff: z.number().min(20).max(20_000),
  /** filter Q */
  resonance: z.number().min(0).max(30),
  /** 0..1, before the output limiter */
  gain: z.number().min(0).max(1),
});
export type Patch = z.infer<typeof PatchSchema>;

export const DEFAULT_PATCH: Patch = {
  wave: 'triangle',
  attack: 0.01,
  decay: 0.25,
  sustain: 0.6,
  release: 0.6,
  cutoff: 4000,
  resonance: 1,
  gain: 0.5,
};

/**
 * A click track on the shared transport. Every device already knows every beat
 * time, so this needs no per-beat messages.
 *  - who=all: every phone on every beat (flams reveal sync error)
 *  - who=rotate: beats step around the phones in turn (uneven rhythm reveals it)
 */
export const MetronomeSchema = z.object({
  sound: z.enum(['off', 'click', 'note']),
  who: z.enum(['all', 'rotate']),
  /** pitch for sound=note; the downbeat plays an octave up */
  midi: z.number().int().min(0).max(127),
});
export type Metronome = z.infer<typeof MetronomeSchema>;

export const DEFAULT_METRONOME: Metronome = { sound: 'click', who: 'all', midi: 72 };

/** how live notes are spread across devices */
export const Distribution = z.enum(['all', 'round-robin']);
export type Distribution = z.infer<typeof Distribution>;

const midi = z.number().int().min(0).max(127);
/** conductor-chosen id pairing a noteOn with its noteOff */
const noteId = z.number().int();

/** Something a device should do at a precise moment. */
export const CueSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('flash'), color: z.string().max(32).optional() }),
  z.object({ kind: z.literal('noteOn'), note: noteId, midi, velocity: z.number().min(0).max(1) }),
  z.object({ kind: z.literal('noteOff'), note: noteId }),
]);
export type Cue = z.infer<typeof CueSchema>;

export const Target = z.union([z.literal('all'), z.array(z.string()).max(512)]);
export type Target = z.infer<typeof Target>;

// ---------- device → server ----------

export const ClientMessage = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('hello'),
    role: Role,
    /** stable device id from local storage; server assigns one if missing */
    id: z.string().max(64).optional(),
  }),
  z.object({ t: z.literal('ping'), n: z.number(), c0: z.number() }),
  z.object({ t: z.literal('report'), stats: PlayerStatsSchema }),

  // conductor only
  z.object({ t: z.literal('transport'), action: z.enum(['start', 'stop']) }),
  z.object({ t: z.literal('tempo'), bpm: z.number().min(20).max(400) }),
  z.object({ t: z.literal('playout'), ms: z.number().min(20).max(2000) }),
  z.object({ t: z.literal('patch'), patch: PatchSchema.partial() }),
  z.object({ t: z.literal('distribution'), mode: Distribution }),
  z.object({ t: z.literal('metronome'), metronome: MetronomeSchema.partial() }),
  /** live notes; `at` is stamped by the conductor (it is synced too) so latency stays constant */
  z.object({ t: z.literal('noteOn'), note: noteId, midi, velocity: z.number().min(0).max(1), at: z.number().optional() }),
  z.object({ t: z.literal('noteOff'), note: noteId, at: z.number().optional() }),
  /** silence everything now */
  z.object({ t: z.literal('panic') }),
  /** per-device output latency correction, ms (positive = play earlier) */
  z.object({ t: z.literal('trim'), id: z.string(), ms: z.number().min(-200).max(500) }),
  z.object({
    t: z.literal('cue'),
    /** server time; omit to play `playoutMs` after the server receives it */
    at: z.number().optional(),
    target: Target,
    cue: CueSchema,
  }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

// ---------- server → device ----------

export type Transport = z.infer<typeof TransportSchema>;

export interface SharedState {
  transport: Transport;
  /** how far ahead of "now" live events are stamped, ms */
  playoutMs: number;
  patch: Patch;
  distribution: Distribution;
  metronome: Metronome;
}

export interface PlayerInfo {
  id: string;
  connected: boolean;
  /** server time of the last message */
  lastSeen: number;
  remoteAddress: string;
  stats: PlayerStats | null;
  trimMs: number;
  /** notes this device is holding right now */
  holding: number;
}

export type ServerMessage =
  | { t: 'welcome'; id: string; role: Role; serverTime: number; state: SharedState }
  | { t: 'pong'; n: number; c0: number; s1: number; s2: number }
  | { t: 'state'; state: SharedState }
  | { t: 'roster'; players: PlayerInfo[]; serverTime: number }
  | { t: 'cue'; at: number; cue: Cue }
  | { t: 'panic' }
  | { t: 'trim'; ms: number }
  /** this device's place in the rotation; index -1 = not playing (not tapped in / not synced) */
  | { t: 'seat'; index: number; count: number }
  | { t: 'error'; message: string };

export const WS_PATH = '/ws';
export const DEFAULT_PORT = 8787;
