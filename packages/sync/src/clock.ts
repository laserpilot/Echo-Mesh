import { evalLine, weightedLinearFit, type Line } from './fit.ts';

/** real crystals are within ~±100 ppm; anything beyond is noise */
const MAX_DRIFT = 200e-6;

/**
 * One NTP-style exchange. All values in milliseconds.
 *  c0: client send time (client clock)
 *  s1: server receive time (server clock)
 *  s2: server send time (server clock)
 *  c3: client receive time (client clock)
 */
export interface Exchange {
  c0: number;
  s1: number;
  s2: number;
  c3: number;
}

export interface Sample {
  /** client time at the midpoint of the exchange */
  at: number;
  /** network round trip, excluding server processing */
  rtt: number;
  /** serverTime - clientTime */
  offset: number;
}

export interface ClockEstimate {
  ready: boolean;
  /** serverTime - clientTime, evaluated at the time asked for */
  offset: number;
  /** drift of client vs server clock, parts per million */
  driftPpm: number;
  /** best (lowest) round-trip time currently in the window */
  minRtt: number;
  /**
   * Rough error bound in ms: half the best RTT (worst-case path asymmetry)
   * plus fit residual. True error on a symmetric LAN is usually much smaller.
   */
  uncertainty: number;
  samples: number;
}

export interface ClockSyncOptions {
  /** history kept for estimating drift, ms */
  windowMs?: number;
  /** recent history used for the offset itself, ms */
  offsetWindowMs?: number;
  /**
   * RTT excess (ms over the best seen) at which a sample's weight falls to 1/e.
   * Smaller = trust only the very best exchanges.
   */
  qualityMs?: number;
  /** only estimate drift once samples span this long, ms */
  driftMinSpanMs?: number;
  /** minimum samples before the estimate is considered ready */
  minSamples?: number;
}

export function sampleFromExchange({ c0, s1, s2, c3 }: Exchange): Sample {
  return {
    at: (c0 + c3) / 2,
    rtt: Math.max(0, c3 - c0 - (s2 - s1)),
    offset: (s1 - c0 + (s2 - c3)) / 2,
  };
}

/**
 * Estimates the offset (and drift) between a local clock and the server clock
 * from repeated ping exchanges.
 *
 * Network delay on WiFi is noisy and mostly one-sided (packets get delayed,
 * never sped up), so the lowest-RTT exchanges carry the most accurate offsets:
 * a sample's offset error is at most (rtt - trueMinRtt)/2. Samples are
 * weighted by how close their RTT is to the best seen.
 *
 * Two time scales, as in NTP: drift (crystal rate difference, tens of ppm) is
 * fitted over minutes, where it's measurable; the offset is a weighted mean of
 * recent samples, each corrected for drift. Fitting both from a short window
 * lets noise masquerade as drift and extrapolation amplifies it.
 */
export class ClockSync {
  readonly #windowMs: number;
  readonly #offsetWindowMs: number;
  readonly #qualityMs: number;
  readonly #driftMinSpanMs: number;
  readonly #minSamples: number;
  #samples: Sample[] = [];
  #line: Line | null = null;
  #minRtt = Infinity;

  constructor(opts: ClockSyncOptions = {}) {
    this.#windowMs = opts.windowMs ?? 300_000;
    this.#offsetWindowMs = opts.offsetWindowMs ?? 30_000;
    this.#qualityMs = opts.qualityMs ?? 2;
    this.#driftMinSpanMs = opts.driftMinSpanMs ?? 60_000;
    this.#minSamples = opts.minSamples ?? 5;
  }

  get sampleCount(): number {
    return this.#samples.length;
  }

  add(exchange: Exchange): Sample {
    const sample = sampleFromExchange(exchange);
    this.#samples.push(sample);
    const cutoff = sample.at - this.#windowMs;
    while (this.#samples.length && this.#samples[0]!.at < cutoff) this.#samples.shift();
    this.#refit();
    return sample;
  }

  reset(): void {
    this.#samples = [];
    this.#line = null;
    this.#minRtt = Infinity;
  }

  #weigh(samples: readonly Sample[]) {
    let minRtt = Infinity;
    for (const s of samples) minRtt = Math.min(minRtt, s.rtt);
    return {
      minRtt,
      points: samples.map((s) => ({ x: s.at, y: s.offset, w: Math.exp(-(s.rtt - minRtt) / this.#qualityMs) })),
    };
  }

  #refit(): void {
    const now = this.#samples.at(-1)!.at;
    const slope = weightedLinearFit(this.#weigh(this.#samples).points, now, {
      minSpan: this.#driftMinSpanMs,
      maxSlope: MAX_DRIFT,
    }).slope;

    const recent = this.#samples.filter((s) => s.at >= now - this.#offsetWindowMs);
    const { minRtt, points } = this.#weigh(recent);
    let sw = 0, sy = 0;
    for (const p of points) {
      sw += p.w;
      sy += p.w * (p.y + slope * (now - p.x));
    }
    const offset = sy / sw;
    let ss = 0;
    for (const p of points) ss += p.w * (p.y + slope * (now - p.x) - offset) ** 2;

    this.#minRtt = minRtt;
    this.#line = { intercept: offset, slope, x0: now, residual: Math.sqrt(ss / sw) };
  }

  estimate(localNow: number): ClockEstimate {
    const line = this.#line;
    if (!line) {
      return { ready: false, offset: 0, driftPpm: 0, minRtt: Infinity, uncertainty: Infinity, samples: 0 };
    }
    return {
      ready: this.#samples.length >= this.#minSamples,
      offset: evalLine(line, localNow),
      driftPpm: line.slope * 1e6,
      minRtt: this.#minRtt,
      uncertainty: this.#minRtt / 2 + line.residual,
      samples: this.#samples.length,
    };
  }
}

/**
 * Turns a jumpy offset estimate into a continuous clock. Small corrections are
 * slewed in gradually so scheduled events never jump; large ones (first sync,
 * device wake from sleep) are applied immediately.
 */
export class SlewedOffset {
  #current: number | null = null;
  #lastAt = 0;

  constructor(
    /** max correction rate, ms per second */
    private readonly maxSlewPerSec = 5,
    /** corrections bigger than this are stepped, ms */
    private readonly stepThreshold = 25,
  ) {}

  update(target: number, localNow: number): number {
    if (this.#current === null || Math.abs(target - this.#current) > this.stepThreshold) {
      this.#current = target;
    } else {
      const maxStep = (this.maxSlewPerSec * Math.max(0, localNow - this.#lastAt)) / 1000;
      const delta = target - this.#current;
      this.#current += Math.max(-maxStep, Math.min(maxStep, delta));
    }
    this.#lastAt = localNow;
    return this.#current;
  }

  get value(): number {
    return this.#current ?? 0;
  }
}
