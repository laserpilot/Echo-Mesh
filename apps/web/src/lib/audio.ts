import { AudioClockMap } from '@echo/sync';

/**
 * Hard silence switch, fixed at build time. Sound is on unless built/served
 * with VITE_SOUND=off, in which case the audio graph is never connected to
 * the speakers: everything (clock mapping, scheduling) still runs for real
 * but no sound can come out. Handy for late-night development.
 */
export const SOUND_ENABLED = import.meta.env.VITE_SOUND !== 'off';

export interface AudioStatus {
  state: string;
  sampleRate: number;
  baseLatency: number;
  outputLatency: number;
  mapResidual: number;
  mapDriftPpm: number;
}

/**
 * Owns the AudioContext and keeps a page-clock → audio-clock mapping fresh.
 * Must be started from a user gesture (browser autoplay rules).
 */
export class AudioClock {
  readonly ctx: AudioContext;
  /** everything audible connects here; it only reaches the speakers if SOUND_ENABLED */
  readonly master: GainNode;
  readonly map = new AudioClockMap();
  #timer: ReturnType<typeof setInterval>;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.master = this.ctx.createGain();
    if (SOUND_ENABLED) this.master.connect(this.ctx.destination);
    this.#timer = setInterval(() => this.#sample(), 100);
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  #lastCtxTime = 0;
  #stalledSince: number | null = null;

  /** the audio clock isn't advancing (no output device, OS suspended it, …) */
  get stalled(): boolean {
    return this.#stalledSince !== null && performance.now() - this.#stalledSince > 500;
  }

  #sample(): void {
    if (this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    if (t === this.#lastCtxTime) this.#stalledSince ??= performance.now();
    else this.#stalledSince = null;
    this.#lastCtxTime = t;

    if (typeof this.ctx.getOutputTimestamp === 'function') {
      const ts = this.ctx.getOutputTimestamp();
      // Some browsers return zeros until real output has started; fall through then.
      if (ts.contextTime && ts.performanceTime) {
        this.map.add(ts.contextTime, ts.performanceTime);
        return;
      }
    }
    // Fallback: currentTime is the next render block; subtract reported output latency.
    this.map.add(this.ctx.currentTime - (this.ctx.outputLatency || this.ctx.baseLatency || 0), performance.now());
  }

  /** page time (performance.now ms) → AudioContext time (s) */
  toContext(localMs: number): number {
    return this.map.toContext(localMs);
  }

  status(): AudioStatus {
    return {
      state: this.stalled ? 'stalled' : this.ctx.state,
      sampleRate: this.ctx.sampleRate,
      baseLatency: (this.ctx.baseLatency ?? 0) * 1000,
      outputLatency: (this.ctx.outputLatency ?? 0) * 1000,
      mapResidual: Number.isFinite(this.map.residual) ? this.map.residual : -1,
      mapDriftPpm: this.map.driftPpm,
    };
  }

  close(): void {
    clearInterval(this.#timer);
    void this.ctx.close();
  }
}
