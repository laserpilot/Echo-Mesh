import { describe, expect, it } from 'vitest';
import { ClockSync, SlewedOffset, sampleFromExchange } from '../src/index.ts';
import { WIFI, deviceClock, exchange, rng } from './sim.ts';

/** error of the estimate vs truth at true time t, ms */
function errorAt(sync: ClockSync, dev: ReturnType<typeof deviceClock>, t: number): number {
  const local = dev.local(t);
  return local + sync.estimate(local).offset - t;
}

function run(seconds: number, opts: { offset: number; driftPpm: number; seed: number; net?: typeof WIFI }) {
  const dev = deviceClock(opts.offset, opts.driftPpm);
  const rand = rng(opts.seed);
  const sync = new ClockSync();
  const t0 = 10_000;
  // initial burst, then 2 Hz (matches ClockPinger defaults)
  for (let i = 0; i < 12; i++) sync.add(exchange(t0 + i * 40, dev, rand, opts.net ?? WIFI));
  for (let t = t0 + 500; t < t0 + seconds * 1000; t += 500) sync.add(exchange(t, dev, rand, opts.net ?? WIFI));
  return { sync, dev, end: t0 + seconds * 1000 };
}

describe('sampleFromExchange', () => {
  it('recovers exact offset on a symmetric path', () => {
    const s = sampleFromExchange({ c0: 100, s1: 1105, s2: 1106, c3: 111 });
    expect(s.offset).toBe(1000);
    expect(s.rtt).toBe(10);
  });
});

describe('ClockSync', () => {
  it('is ready after the initial burst and accurate to ~1ms despite stalls', () => {
    const dev = deviceClock(123_456.789, 0);
    const rand = rng(1);
    const sync = new ClockSync();
    for (let i = 0; i < 12; i++) sync.add(exchange(5000 + i * 40, dev, rand, WIFI));
    expect(sync.estimate(dev.local(5500)).ready).toBe(true);
    expect(Math.abs(errorAt(sync, dev, 5500))).toBeLessThan(2);
  });

  it('stays around a millisecond over many seeds on jittery wifi', () => {
    const errs: number[] = [];
    for (let seed = 1; seed <= 100; seed++) {
      const { sync, dev, end } = run(30, { offset: -50_000 + seed * 997, driftPpm: 0, seed });
      errs.push(Math.abs(errorAt(sync, dev, end)));
    }
    errs.sort((a, b) => a - b);
    expect(errs[Math.floor(errs.length * 0.95)]).toBeLessThan(1);
    expect(errs.at(-1)).toBeLessThan(1.5);
  });

  it('tracks clock drift (phones are commonly off by tens of ppm)', () => {
    const { sync, dev, end } = run(180, { offset: 777, driftPpm: 60, seed: 7 });
    // after 3 min at 60 ppm the clocks have walked 10.8 ms apart
    expect(Math.abs(errorAt(sync, dev, end))).toBeLessThan(1);
    // extrapolating 2 s ahead (a typical scheduling horizon) stays good too
    expect(Math.abs(errorAt(sync, dev, end + 2000))).toBeLessThan(1);
    expect(sync.estimate(dev.local(end)).driftPpm).toBeGreaterThan(-75);
    expect(sync.estimate(dev.local(end)).driftPpm).toBeLessThan(-45); // local runs fast → offset shrinks
  });

  it('cannot see path asymmetry, but reports it within the uncertainty bound', () => {
    const net = { ...WIFI, upBase: 2, downBase: 8 };
    const { sync, dev, end } = run(30, { offset: 0, driftPpm: 0, seed: 3, net });
    const err = Math.abs(errorAt(sync, dev, end));
    expect(err).toBeGreaterThan(2); // the inherent (down-up)/2 = 3ms bias
    expect(err).toBeLessThan(sync.estimate(dev.local(end)).uncertainty);
  });

  it('forgets samples outside the window', () => {
    const sync = new ClockSync({ windowMs: 5000, offsetWindowMs: 5000 });
    const dev = deviceClock(0, 0);
    const rand = rng(9);
    for (let t = 0; t < 20_000; t += 500) sync.add(exchange(t, dev, rand, WIFI));
    expect(sync.sampleCount).toBeLessThanOrEqual(11);
  });
});

describe('SlewedOffset', () => {
  it('steps the first value and big jumps, slews small ones', () => {
    const s = new SlewedOffset(5, 25);
    expect(s.update(100, 0)).toBe(100);
    expect(s.update(104, 200)).toBeCloseTo(101); // 5 ms/s * 0.2 s
    expect(s.update(104, 1200)).toBe(104);
    expect(s.update(200, 1300)).toBe(200); // step
  });
});
