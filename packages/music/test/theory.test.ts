import { describe, expect, it } from 'vitest';
import { PRESETS, arpSeat, diatonicChord, letterName, romanName, stepAtBar, tonicMidi, voiceFor } from '../src/index.ts';

describe('diatonic chords', () => {
  it('major key qualities: I ii iii IV V vi vii°', () => {
    const names = [1, 2, 3, 4, 5, 6, 7].map((degree) => romanName('major', { degree, seventh: false }));
    expect(names).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
  });

  it('minor key qualities come from the minor scale (v1 got these wrong)', () => {
    const names = [1, 2, 3, 4, 5, 6, 7].map((degree) => romanName('minor', { degree, seventh: false }));
    expect(names).toEqual(['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']);
  });

  it('builds the right notes and letter names', () => {
    expect(diatonicChord('major', 6)).toEqual([9, 12, 16]); // A C E
    expect(letterName(0, 'major', { degree: 6, seventh: false })).toBe('Am');
    expect(letterName(7, 'major', { degree: 5, seventh: true })).toBe('D7'); // V7 in G
    expect(letterName(0, 'major', { degree: 1, seventh: true })).toBe('Cmaj7');
    expect(letterName(0, 'major', { degree: 7, seventh: true })).toBe('Bm7♭5');
    expect(romanName('major', { degree: 7, seventh: true })).toBe('viiø7');
    expect(romanName('major', { degree: 2, seventh: true })).toBe('ii7');
    expect(romanName('major', { degree: 1, seventh: true })).toBe('Imaj7');
  });

  it('every preset produces valid chords', () => {
    for (const p of PRESETS) for (const s of p.steps) {
      const c = diatonicChord(p.scale, s.degree, s.seventh);
      expect(c.length).toBe(s.seventh ? 4 : 3);
      expect([...c].sort((a, b) => a - b)).toEqual(c);
    }
  });
});

describe('voicing', () => {
  const am = diatonicChord('major', 6);
  const base = tonicMidi(0, 3); // C3 = 48

  it('each phone takes one chord tone, walking up', () => {
    expect([0, 1, 2].map((s) => voiceFor(am, s, base))).toEqual([57, 60, 64]);
  });

  it('extra phones double an octave up, then wrap after three octaves', () => {
    expect(voiceFor(am, 3, base)).toBe(69);
    expect(voiceFor(am, 9, base)).toBe(57);
  });
});

describe('stepAtBar', () => {
  const steps = [
    { degree: 1, seventh: false, bars: 1 },
    { degree: 5, seventh: false, bars: 2 },
    { degree: 6, seventh: false, bars: 1 },
  ];

  it('walks bars through steps and loops', () => {
    const seq = [0, 1, 2, 3, 4, 5].map((b) => stepAtBar(steps, b)!.index);
    expect(seq).toEqual([0, 1, 1, 2, 0, 1]);
  });

  it('reports when the current step instance began', () => {
    expect(stepAtBar(steps, 2)!.startBar).toBe(1);
    expect(stepAtBar(steps, 6)!.startBar).toBe(5);
  });

  it('handles negative bars and empty progressions', () => {
    expect(stepAtBar(steps, -1)!.index).toBe(2);
    expect(stepAtBar([], 0)).toBeNull();
  });
});

describe('arpSeat', () => {
  it('up, down and up-down patterns', () => {
    const run = (dir: Parameters<typeof arpSeat>[2]) => Array.from({ length: 8 }, (_, n) => arpSeat(n, 4, dir));
    expect(run('up')).toEqual([0, 1, 2, 3, 0, 1, 2, 3]);
    expect(run('down')).toEqual([3, 2, 1, 0, 3, 2, 1, 0]);
    expect(run('updown')).toEqual([0, 1, 2, 3, 2, 1, 0, 1]);
  });

  it('random is deterministic, in range, and covers everyone', () => {
    const a = Array.from({ length: 200 }, (_, n) => arpSeat(n, 5, 'random'));
    const b = Array.from({ length: 200 }, (_, n) => arpSeat(n, 5, 'random'));
    expect(a).toEqual(b);
    expect(new Set(a)).toEqual(new Set([0, 1, 2, 3, 4]));
  });

  it('degenerate counts', () => {
    expect(arpSeat(5, 1, 'updown')).toBe(0);
    expect(arpSeat(5, 0, 'up')).toBe(-1);
  });
});
