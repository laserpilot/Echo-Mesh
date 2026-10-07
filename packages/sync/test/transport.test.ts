import { describe, expect, it } from 'vitest';
import {
  AudioClockMap,
  DEFAULT_TRANSPORT,
  TransportTimeline,
  beatsBetween,
  retempo,
  startTransport,
  timeOfBeat,
} from '../src/index.ts';
import { rng } from './sim.ts';

describe('transport', () => {
  it('derives beats from the anchor with no accumulation', () => {
    const t = startTransport(DEFAULT_TRANSPORT, 1000, 200); // beat 0 at 1200, 500ms/beat
    expect(beatsBetween(t, 0, 2700)).toEqual([0, 1, 2]);
    expect(timeOfBeat(t, 1_000_000)).toBe(1200 + 1_000_000 * 500);
  });

  it('does not play beats before the start', () => {
    const t = startTransport(DEFAULT_TRANSPORT, 1000, 200);
    expect(beatsBetween(t, -5000, 1200)).toEqual([]);
  });

  it('retempo lands on a whole beat at least lead away', () => {
    const t = startTransport(DEFAULT_TRANSPORT, 0, 0); // 500ms beats
    const r = retempo(t, 60, 1100, 300); // earliest 1400 → beat 3 at 1500
    expect(r.anchorBeat).toBe(3);
    expect(r.anchorTime).toBe(1500);
    expect(timeOfBeat(r, 4)).toBe(2500);
  });

  it('timeline: a device that hears about a tempo change late loses no beats and doubles none', () => {
    const tl = new TransportTimeline();
    const t = startTransport(DEFAULT_TRANSPORT, 0, 0);
    tl.apply(t);
    // device has scheduled through 1000 when the change (made at 1100) arrives
    const before = tl.beatsBetween(0, 1000);
    tl.apply(retempo(t, 60, 1100, 300));
    const after = tl.beatsBetween(1000, 5000);
    const all = [...before, ...after];
    expect(all.map((b) => b.beat)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(all.map((b) => b.time)).toEqual([0, 500, 1000, 1500, 2500, 3500, 4500]);
  });

  it('stop clears the timeline', () => {
    const tl = new TransportTimeline();
    tl.apply(startTransport(DEFAULT_TRANSPORT, 0, 0));
    tl.apply({ ...tl.current, running: false });
    expect(tl.beatsBetween(0, 10_000)).toEqual([]);
  });
});

describe('AudioClockMap', () => {
  it('maps through quantized, drifting output timestamps to well under a millisecond', () => {
    const rand = rng(42);
    const map = new AudioClockMap();
    const quantum = (128 / 48000) * 1000; // one render quantum, ms
    const ppm = 80; // audio crystal vs system clock
    const ctxAt = (perf: number) => ((perf - 3000) * (1 + ppm / 1e6)) / 1000; // ctx started at perf 3000

    for (let perf = 3500; perf < 13_500; perf += 250) {
      // reading reflects the last render callback: up to one quantum stale + a bit of noise
      const lag = rand() * quantum;
      const reportedPerf = perf + rand() * 0.3;
      map.add(ctxAt(perf - lag), reportedPerf);
    }
    const errMs = (map.toContext(14_000) - ctxAt(14_000)) * 1000;
    // a constant ~half-quantum bias is inherent; it is the same on every device of a kind
    expect(Math.abs(errMs)).toBeLessThan(quantum);
    expect(map.residual).toBeLessThan(quantum);
    expect(map.toPage(map.toContext(14_000))).toBeCloseTo(14_000, 3);
  });
});
