import { describe, expect, it } from 'vitest';
import { DEFAULT_HARMONY, type Harmony } from '@echo/protocol';
import { DEFAULT_TRANSPORT, startTransport } from '@echo/sync';
import { editHarmony, nextBarBeat } from '../src/harmony.ts';

// 120 bpm, 4/4: beat 0 at t=0, 500 ms per beat, 2 s per bar
const running = startTransport(DEFAULT_TRANSPORT, 0, 0);
const playing: Harmony = { ...DEFAULT_HARMONY, playing: true };

describe('nextBarBeat', () => {
  it('rounds up to the next bar line', () => {
    expect(nextBarBeat(running, 0)).toBe(0);
    expect(nextBarBeat(running, 600)).toBe(4);
    expect(nextBarBeat(running, 2000)).toBe(4);
    expect(nextBarBeat(running, 2100)).toBe(8);
  });

  it('never lands before the start', () => {
    expect(nextBarBeat(running, -5000)).toBe(0);
  });
});

describe('editHarmony', () => {
  it('stopped transport: applies now, from the top', () => {
    const h = editHarmony(playing, { key: 7 }, DEFAULT_TRANSPORT, 1000);
    expect(h).toMatchObject({ key: 7, anchorBeat: 0, fromBeat: 0 });
  });

  it('new steps restart the loop on the next bar', () => {
    const h = editHarmony(playing, { steps: [{ degree: 2, seventh: true, bars: 1 }] }, running, 2100);
    expect(h).toMatchObject({ anchorBeat: 8, fromBeat: 8 });
  });

  it('other edits land on the next bar but keep the loop position', () => {
    const h = editHarmony({ ...playing, anchorBeat: 4 }, { key: 2 }, running, 2100);
    expect(h).toMatchObject({ key: 2, anchorBeat: 4, fromBeat: 8 });
  });

  it('starting playback anchors on the next bar', () => {
    const h = editHarmony(DEFAULT_HARMONY, { playing: true }, running, 2100);
    expect(h).toMatchObject({ playing: true, anchorBeat: 8, fromBeat: 8 });
  });

  it('stopping lands on the next beat', () => {
    const h = editHarmony(playing, { playing: false }, running, 2100);
    expect(h).toMatchObject({ playing: false, fromBeat: 5 });
  });

  it('merges partial arp settings', () => {
    const h = editHarmony(playing, { arp: { rate: 4 } as Harmony['arp'] }, running, 0);
    expect(h.arp).toEqual({ rate: 4, direction: 'up' });
  });
});
