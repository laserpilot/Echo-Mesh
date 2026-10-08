import { describe, expect, it } from 'vitest';
import { DEFAULT_HARMONY, type Harmony } from '@echo/protocol';
import { HarmonyTimeline, planBeat } from '../src/index.ts';

const h = (over: Partial<Harmony> = {}): Harmony => ({ ...DEFAULT_HARMONY, playing: true, ...over });
const seat = (index: number, count = 3) => ({ index, count });

describe('planBeat', () => {
  it('nothing when stopped or before the anchor', () => {
    expect(planBeat(h({ playing: false }), 0, 4, seat(0))).toBeNull();
    expect(planBeat(h({ anchorBeat: 8 }), 7, 4, seat(0))).toBeNull();
  });

  it('walks the progression one chord per bar (I–V–vi–IV in C)', () => {
    const letters = [0, 4, 8, 12, 16].map((b) => planBeat(h(), b, 4, seat(0))!.letter);
    expect(letters).toEqual(['C', 'G', 'Am', 'F', 'C']);
  });

  it('each phone takes one chord tone', () => {
    const notes = [0, 1, 2].map((i) => planBeat(h(), 8, 4, seat(i))!.midi); // Am, tonic C3 = 48
    expect(notes).toEqual([57, 60, 64]);
  });

  it('marks chord starts only on the first beat of each chord', () => {
    const starts = [0, 1, 2, 3, 4].map((b) => planBeat(h(), b, 4, seat(0))!.chordStart);
    expect(starts).toEqual([true, false, false, false, true]);
    const two = h({ steps: [{ degree: 1, seventh: false, bars: 2 }] });
    expect([0, 4, 8].map((b) => planBeat(two, b, 4, seat(0))!.chordStart)).toEqual([true, false, true]);
  });

  it('the arp steps around the room: every sub-beat is played by exactly one phone', () => {
    const harm = h({ pattern: 'arp', arp: { rate: 2, direction: 'up' } });
    for (let beat = 0; beat < 8; beat++) {
      const hits = [0, 1, 2].flatMap((i) => planBeat(harm, beat, 4, seat(i))!.arp.map((f) => ({ i, f })));
      expect(hits.map((x) => x.f).sort()).toEqual([0, 0.5]);
    }
    expect(planBeat(harm, 0, 4, seat(0))!.arp).toEqual([0]);
    expect(planBeat(harm, 0, 4, seat(1))!.arp).toEqual([0.5]);
    expect(planBeat(harm, 1, 4, seat(2))!.arp).toEqual([0]);
  });

  it('pattern selects pad, arp or both', () => {
    expect(planBeat(h({ pattern: 'pad' }), 0, 4, seat(0))).toMatchObject({ pad: true, arp: [] });
    expect(planBeat(h({ pattern: 'arp' }), 0, 4, seat(0))!.pad).toBe(false);
    expect(planBeat(h({ pattern: 'both' }), 0, 4, seat(0))).toMatchObject({ pad: true, arp: [0] });
  });

  it('a phone without a seat knows the chord but plays nothing', () => {
    const p = planBeat(h({ pattern: 'both' }), 0, 4, { index: -1, count: 3 })!;
    expect(p.letter).toBe('C');
    expect(p).toMatchObject({ midi: null, pad: false, arp: [] });
  });
});

describe('HarmonyTimeline', () => {
  it('a change applies from its fromBeat; earlier beats keep the old version', () => {
    const tl = new HarmonyTimeline();
    tl.apply(h({ key: 0, fromBeat: 0 }));
    tl.apply(h({ key: 7, fromBeat: 8 }));
    expect(tl.at(7)!.key).toBe(0);
    expect(tl.at(8)!.key).toBe(7);
    expect(tl.latest!.key).toBe(7);
  });

  it('a newer change for the same bar replaces the pending one', () => {
    const tl = new HarmonyTimeline();
    tl.apply(h({ key: 0, fromBeat: 0 }));
    tl.apply(h({ key: 7, fromBeat: 8 }));
    tl.apply(h({ key: 2, fromBeat: 8 }));
    expect(tl.at(8)!.key).toBe(2);
    expect(tl.at(4)!.key).toBe(0);
  });
});
