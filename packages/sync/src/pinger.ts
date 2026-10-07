import { ClockSync, SlewedOffset, type ClockEstimate, type ClockSyncOptions } from './clock.ts';

export interface PingerOptions extends ClockSyncOptions {
  /** local monotonic clock, ms (performance.now in browsers) */
  now: () => number;
  send: (n: number, c0: number) => void;
  /** pings in the initial burst and their spacing */
  burstCount?: number;
  burstSpacingMs?: number;
  /** steady-state ping period */
  intervalMs?: number;
}

/**
 * Drives the ping exchange and exposes a smoothed server clock.
 * Transport-agnostic: give it `send`, feed it pongs.
 */
export class ClockPinger {
  readonly clock: ClockSync;
  readonly #opts: Required<Pick<PingerOptions, 'burstCount' | 'burstSpacingMs' | 'intervalMs'>> & PingerOptions;
  readonly #slew = new SlewedOffset();
  readonly #outstanding = new Map<number, number>();
  #n = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #listeners = new Set<(e: ClockEstimate) => void>();

  constructor(opts: PingerOptions) {
    this.#opts = { burstCount: 12, burstSpacingMs: 40, intervalMs: 500, ...opts };
    this.clock = new ClockSync(opts);
  }

  start(): void {
    this.stop();
    this.#burst(this.#opts.burstCount);
  }

  stop(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    this.#outstanding.clear();
  }

  /** forget history and re-burst — call after reconnects or the device waking up */
  resync(): void {
    this.clock.reset();
    this.start();
  }

  #burst(remaining: number): void {
    this.#ping();
    const delay = remaining > 1 ? this.#opts.burstSpacingMs : this.#opts.intervalMs;
    this.#timer = setTimeout(() => this.#burst(Math.max(1, remaining - 1)), delay);
  }

  #ping(): void {
    const n = ++this.#n;
    const c0 = this.#opts.now();
    // forget pings that never came back
    for (const [k, t] of this.#outstanding) if (c0 - t > 5000) this.#outstanding.delete(k);
    this.#outstanding.set(n, c0);
    this.#opts.send(n, c0);
  }

  handlePong(p: { n: number; c0: number; s1: number; s2: number }): void {
    const c3 = this.#opts.now();
    if (this.#outstanding.get(p.n) !== p.c0) return; // stale or foreign
    this.#outstanding.delete(p.n);
    this.clock.add({ c0: p.c0, s1: p.s1, s2: p.s2, c3 });
    const est = this.clock.estimate(c3);
    this.#slew.update(est.offset, c3);
    for (const fn of this.#listeners) fn(est);
  }

  onUpdate(fn: (e: ClockEstimate) => void): () => void {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  get ready(): boolean {
    return this.clock.estimate(this.#opts.now()).ready;
  }

  estimate(): ClockEstimate {
    return this.clock.estimate(this.#opts.now());
  }

  /** current offset (server - local), slewed so it never jumps by small amounts */
  offset(localNow = this.#opts.now()): number {
    return this.#slew.update(this.clock.estimate(localNow).offset, localNow);
  }

  serverNow(): number {
    const local = this.#opts.now();
    return local + this.offset(local);
  }

  toLocal(serverTime: number): number {
    return serverTime - this.offset();
  }
}
