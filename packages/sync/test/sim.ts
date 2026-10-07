/** Deterministic network/clock simulation helpers for sync tests. */

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface NetModel {
  /** fixed one-way delays, ms */
  upBase: number;
  downBase: number;
  /** mean of exponential queueing jitter added each way, ms */
  jitterMean: number;
  /** probability a packet hits a WiFi power-save stall */
  stallProb: number;
  stallMs: [number, number];
}

export const WIFI: NetModel = { upBase: 3, downBase: 3, jitterMean: 8, stallProb: 0.1, stallMs: [40, 300] };

export function oneWay(rand: () => number, base: number, m: NetModel): number {
  let d = base - m.jitterMean * Math.log(1 - rand());
  if (rand() < m.stallProb) d += m.stallMs[0] + rand() * (m.stallMs[1] - m.stallMs[0]);
  return d;
}

/**
 * A device clock relative to "true" (server) time:
 * local = true * (1 + driftPpm/1e6) - offset
 * so serverTime - localTime ≈ offset at small true times.
 */
export function deviceClock(offset: number, driftPpm: number) {
  const k = 1 + driftPpm / 1e6;
  return {
    local: (trueT: number) => trueT * k - offset,
    trueOf: (local: number) => (local + offset) / k,
  };
}

/** produce an NTP exchange at true time `t` */
export function exchange(
  t: number,
  dev: ReturnType<typeof deviceClock>,
  rand: () => number,
  m: NetModel,
  serverProcessing = 0.2,
) {
  const up = oneWay(rand, m.upBase, m);
  const down = oneWay(rand, m.downBase, m);
  const s1 = t + up;
  const s2 = s1 + serverProcessing;
  return { c0: dev.local(t), s1, s2, c3: dev.local(s2 + down) };
}
