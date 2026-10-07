import type { Cue } from '@echo/protocol';
import type { AudioClock } from './audio.ts';
import type { Connection } from './connection.svelte.ts';

export type Fired =
  | { kind: 'beat'; at: number; beat: number; beatInBar: number; beatsPerBar: number }
  | { kind: 'cue'; at: number; cue: Cue };

/** a planned event, with its target in every clock we care about */
export type Planned = Fired & { local: number; ctxTime: number | null };

export interface ScheduleStats {
  scheduled: number;
  late: number;
  dropped: number;
  worstLateMs: number;
}

/** how far ahead events are committed (must be < the server's playout delay) */
const HORIZON_MS = 120;
const TICK_MS = 20;
/** an event this late still plays (slightly late beats beat missing beats) */
const DROP_AFTER_MS = 60;

/**
 * Lookahead scheduler ("a tale of two clocks"): a coarse timer commits events
 * a little ahead of time, each one pinned to an exact target. Audio uses the
 * AudioContext clock (sample-accurate); visuals fire on the closest frame.
 */
export class Scheduler {
  readonly stats: ScheduleStats = { scheduled: 0, late: 0, dropped: 0, worstLateMs: 0 };
  #through = -Infinity; // server time we've committed beats up to
  #cues: { at: number; cue: Cue }[] = [];
  #visual: Planned[] = [];
  #timer: ReturnType<typeof setInterval> | null = null;
  #raf = 0;
  #off: (() => void)[] = [];

  constructor(
    private readonly conn: Connection,
    private readonly audio: AudioClock | null,
    private readonly onFire: (e: Planned) => void,
    private readonly onAudio?: (e: Fired, ctxTime: number) => void,
  ) {}

  start(): void {
    this.#off.push(
      this.conn.on('cue', (m) => this.#cues.push({ at: m.at, cue: m.cue })),
      this.conn.on('state', (m) => {
        if (!m.state.transport.running) this.#visual = this.#visual.filter((p) => p.kind !== 'beat');
      }),
    );
    this.#timer = setInterval(() => this.#tick(), TICK_MS);
    const frame = () => {
      this.#frame();
      this.#raf = requestAnimationFrame(frame);
    };
    this.#raf = requestAnimationFrame(frame);
  }

  /** drop everything queued (panic) */
  clear(): void {
    this.#cues = [];
    this.#visual = [];
  }

  stop(): void {
    if (this.#timer) clearInterval(this.#timer);
    cancelAnimationFrame(this.#raf);
    this.#off.forEach((f) => f());
    this.#off = [];
  }

  #tick(): void {
    if (!this.conn.pinger.ready) return;
    const now = this.conn.serverNow();
    const until = now + HORIZON_MS;
    // On join, beats that already passed were never ours to play: don't count them late.
    if (this.#through === -Infinity) this.#through = now;

    // Beats we slept through (backgrounded tab) are counted, not replayed in a burst.
    const from = Math.max(this.#through, now - DROP_AFTER_MS);
    const t = this.conn.timeline.current;
    for (const { beat, time } of this.conn.timeline.beatsBetween(from, until)) {
      this.#plan({ kind: 'beat', at: time, beat, beatInBar: beat % t.beatsPerBar, beatsPerBar: t.beatsPerBar }, now);
    }
    this.#through = until;

    if (this.#cues.length) {
      const due = this.#cues.filter((c) => c.at < until);
      this.#cues = this.#cues.filter((c) => c.at >= until);
      for (const c of due) this.#plan({ kind: 'cue', at: c.at, cue: c.cue }, now);
    }
  }

  #plan(e: Fired, serverNow: number): void {
    const lateMs = serverNow - e.at;
    if (lateMs > DROP_AFTER_MS) {
      this.stats.dropped++;
      return;
    }
    if (lateMs > 0) {
      this.stats.late++;
      this.stats.worstLateMs = Math.max(this.stats.worstLateMs, lateMs);
    }
    this.stats.scheduled++;
    const local = this.conn.toLocal(e.at);
    const ctxTime = this.audio?.map.ready ? this.audio.toContext(local) : null;
    if (ctxTime !== null) this.onAudio?.(e, ctxTime);
    this.#visual.push({ ...e, local, ctxTime });
  }

  #lastFrame = 0;
  #frame(): void {
    const now = performance.now();
    const frameMs = this.#lastFrame ? Math.min(now - this.#lastFrame, 50) : 16.7;
    this.#lastFrame = now;
    if (!this.#visual.length) return;
    // fire on the frame whose display time is nearest the target
    const due = this.#visual.filter((p) => p.local <= now + frameMs / 2);
    if (!due.length) return;
    this.#visual = this.#visual.filter((p) => p.local > now + frameMs / 2);
    for (const p of due) this.onFire(p);
  }
}
