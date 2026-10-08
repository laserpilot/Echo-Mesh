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

/** Six section colors (a 2×3 grid on the phone). Index = group id. */
export const GROUPS = [
  { name: 'red', color: '#ff5c6c' },
  { name: 'orange', color: '#ff9f43' },
  { name: 'yellow', color: '#ffd84d' },
  { name: 'green', color: '#3ddc97' },
  { name: 'blue', color: '#4da3ff' },
  { name: 'purple', color: '#b07cff' },
] as const;
const groupId = z.number().int().min(0).max(GROUPS.length - 1).nullable();

/** room depth ÷ width, as drawn on the stage map */
export const STAGE_ASPECT = 0.62;

/** distance on the stage in widths (y is scaled by the aspect, so rings are round) */
export function stageDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, (a.y - b.y) * STAGE_ASPECT);
}

/** position on the stage map, 0..1 on both axes (x: left→right, y: front→back) */
export const PosSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
export type Pos = z.infer<typeof PosSchema>;

export const ChordStepSchema = z.object({
  degree: z.number().int().min(1).max(7),
  seventh: z.boolean(),
  bars: z.number().int().min(1).max(8),
});

/**
 * A progression loop. Phones compute their own notes from this and the
 * transport, like the metronome: no per-note messages.
 */
export const HarmonySchema = z.object({
  /** tonic pitch class, C = 0 */
  key: z.number().int().min(0).max(11),
  scale: z.enum(['major', 'minor', 'dorian', 'mixolydian']),
  /** octave of the tonic for the lowest voice (C4 = middle C) */
  octave: z.number().int().min(1).max(6),
  steps: z.array(ChordStepSchema).max(16),
  pattern: z.enum(['pad', 'arp', 'both']),
  arp: z.object({
    /** notes per beat across the whole room */
    rate: z.number().int().min(1).max(4),
    direction: z.enum(['up', 'down', 'updown', 'random']),
  }),
  playing: z.boolean(),
});
export type HarmonySettings = z.infer<typeof HarmonySchema>;

/** what the server broadcasts: settings plus when they take effect */
export interface Harmony extends HarmonySettings {
  /** beat on which steps[0] starts */
  anchorBeat: number;
  /** beat from which this version applies (changes land on the next bar) */
  fromBeat: number;
}

export const DEFAULT_HARMONY: Harmony = {
  key: 0,
  scale: 'major',
  octave: 3,
  steps: [1, 5, 6, 4].map((degree) => ({ degree, seventh: false, bars: 1 })),
  pattern: 'pad',
  arp: { rate: 2, direction: 'up' },
  playing: false,
  anchorBeat: 0,
  fromBeat: 0,
};

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
  /**
   * A ripple from a point on the stage map. Each phone plays when the ring
   * reaches it: at + distance / speed. One message for the whole room.
   */
  z.object({
    kind: z.literal('wave'),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    /** map units per second (1 = crosses the room in ~1 s) */
    speed: z.number().min(0.05).max(20),
  }),
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
  /** pick a section color; players set their own, the conductor passes `id` */
  z.object({ t: z.literal('group'), group: groupId, id: z.string().max(64).optional() }),

  // conductor only
  z.object({ t: z.literal('transport'), action: z.enum(['start', 'stop']) }),
  z.object({ t: z.literal('tempo'), bpm: z.number().min(20).max(400) }),
  z.object({ t: z.literal('playout'), ms: z.number().min(20).max(2000) }),
  z.object({ t: z.literal('patch'), patch: PatchSchema.partial() }),
  z.object({ t: z.literal('distribution'), mode: Distribution }),
  z.object({ t: z.literal('metronome'), metronome: MetronomeSchema.partial() }),
  /** edit the progression loop; changes land on the next bar */
  z.object({ t: z.literal('harmony'), harmony: HarmonySchema.partial() }),
  /** place a device on the stage map (null = unplace) */
  z.object({ t: z.literal('place'), id: z.string().max(64), pos: PosSchema.nullable() }),
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
  harmony: Harmony;
}

/** everything about one device that only that device needs */
export interface SelfInfo {
  /** place in the room order (voices, arps, metronome rotation); -1 = not playing */
  index: number;
  count: number;
  group: number | null;
  pos: Pos | null;
  trimMs: number;
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
  group: number | null;
  pos: Pos | null;
  /** seat in the room order, -1 if not playing */
  seat: number;
}

export type ServerMessage =
  | { t: 'welcome'; id: string; role: Role; serverTime: number; state: SharedState }
  | { t: 'pong'; n: number; c0: number; s1: number; s2: number }
  | { t: 'state'; state: SharedState }
  | { t: 'roster'; players: PlayerInfo[]; serverTime: number }
  | { t: 'cue'; at: number; cue: Cue }
  | { t: 'panic' }
  | ({ t: 'self' } & SelfInfo)
  | { t: 'error'; message: string };

export const WS_PATH = '/ws';
export const DEFAULT_PORT = 8787;
