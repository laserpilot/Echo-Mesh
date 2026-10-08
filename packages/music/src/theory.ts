/**
 * Music theory for progressions: scales, diatonic chords, names, presets.
 * Pure functions; everything is in semitones / MIDI numbers.
 *
 * Chords are built by stacking thirds *within the chosen scale*, so the
 * quality of each degree comes out right in any mode (v1 always used the
 * major scale, which made minor-key progressions wrong).
 */

export const KEY_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] as const;

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
} as const;
export type ScaleName = keyof typeof SCALES;

export interface ChordStep {
  /** scale degree 1..7 */
  degree: number;
  /** add the diatonic 7th */
  seventh: boolean;
  /** length in bars */
  bars: number;
}

/**
 * Chord tones as semitones above the key's tonic, ascending, from stacking
 * scale thirds on `degree`. e.g. C major, degree 6 → [9, 12, 16] (A C E).
 */
export function diatonicChord(scale: ScaleName, degree: number, seventh = false): number[] {
  const s = SCALES[scale];
  const d = (((degree - 1) % 7) + 7) % 7;
  const size = seventh ? 4 : 3;
  const out: number[] = [];
  for (let k = 0; k < size; k++) {
    const i = d + 2 * k;
    out.push(s[i % 7]! + 12 * Math.floor(i / 7));
  }
  return out;
}

type Quality = 'major' | 'minor' | 'diminished' | 'augmented';

function quality(chord: readonly number[]): Quality {
  const third = chord[1]! - chord[0]!;
  const fifth = chord[2]! - chord[0]!;
  if (third === 4) return fifth === 8 ? 'augmented' : 'major';
  return fifth === 6 ? 'diminished' : 'minor';
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/** e.g. "vi", "V7", "vii°", "ii7" */
export function romanName(scale: ScaleName, step: Pick<ChordStep, 'degree' | 'seventh'>): string {
  const chord = diatonicChord(scale, step.degree, step.seventh);
  const q = quality(chord);
  let r = ROMAN[(step.degree - 1) % 7]!;
  if (q === 'minor' || q === 'diminished') r = r.toLowerCase();
  if (q === 'diminished') r += '°';
  if (q === 'augmented') r += '+';
  if (step.seventh) {
    const seventh = chord[3]! - chord[0]!;
    r += q === 'diminished' && seventh === 10 ? '7' : seventh === 11 && q === 'major' ? 'maj7' : '7';
    if (q === 'diminished' && seventh === 10) r = r.replace('°', 'ø');
  }
  return r;
}

/** e.g. "Am", "G7", "Bdim", "Cmaj7" */
export function letterName(key: number, scale: ScaleName, step: Pick<ChordStep, 'degree' | 'seventh'>): string {
  const chord = diatonicChord(scale, step.degree, step.seventh);
  const root = KEY_NAMES[(key + chord[0]!) % 12]!;
  const q = quality(chord);
  const base = q === 'minor' ? 'm' : q === 'diminished' ? 'dim' : q === 'augmented' ? 'aug' : '';
  if (!step.seventh) return root + base;
  const seventh = chord[3]! - chord[0]!;
  if (q === 'major') return root + (seventh === 11 ? 'maj7' : '7');
  if (q === 'minor') return root + 'm7';
  if (q === 'diminished') return root + (seventh === 10 ? 'm7♭5' : 'dim7');
  return root + base + '7';
}

/**
 * The note one phone plays: phones are seated in order and each takes one
 * chord tone, walking up the chord; with more phones than tones the pattern
 * repeats an octave higher (up to 3 octaves, then wraps).
 *
 * @param base MIDI note of the key's tonic in the chosen octave
 */
export function voiceFor(chord: readonly number[], seat: number, base: number): number {
  const m = chord.length;
  const octave = Math.floor(seat / m) % 3;
  return base + chord[seat % m]! + 12 * octave;
}

/** MIDI note of the tonic: key 0..11 in octave (C4 = 60) */
export function tonicMidi(key: number, octave: number): number {
  return 12 * (octave + 1) + key;
}

export interface Preset {
  name: string;
  scale: ScaleName;
  steps: ChordStep[];
}

const prog = (name: string, scale: ScaleName, degrees: number[], bars = 1): Preset => ({
  name,
  scale,
  steps: degrees.map((degree) => ({ degree, seventh: false, bars })),
});

/** Borrowed from v1's list (minor ones now built from the minor scale, as intended). */
export const PRESETS: Preset[] = [
  prog('I–V–vi–IV', 'major', [1, 5, 6, 4]),
  prog('vi–IV–I–V', 'major', [6, 4, 1, 5]),
  prog('I–vi–IV–V', 'major', [1, 6, 4, 5]),
  prog('I–IV–V–IV', 'major', [1, 4, 5, 4]),
  { name: 'ii–V–I (7ths)', scale: 'major', steps: [
    { degree: 2, seventh: true, bars: 1 },
    { degree: 5, seventh: true, bars: 1 },
    { degree: 1, seventh: true, bars: 2 },
  ] },
  prog('I–vi–ii–V', 'major', [1, 6, 2, 5]),
  prog('I–iii–vi–IV', 'major', [1, 3, 6, 4]),
  prog('vi–ii–V–I', 'major', [6, 2, 5, 1]),
  prog('i–VII–VI–VII', 'minor', [1, 7, 6, 7]),
  prog('i–VI–III–VII', 'minor', [1, 6, 3, 7]),
  prog('i–iv–v', 'minor', [1, 4, 5]),
  prog('i–VI–VII', 'minor', [1, 6, 7]),
  prog('Dorian i–IV', 'dorian', [1, 4], 2),
  prog('Mixolydian I–♭VII–IV', 'mixolydian', [1, 7, 4]),
];

/**
 * Which step plays during `bar` (bars counted from the progression's start,
 * looping), and the bar that step instance began on.
 */
export function stepAtBar(steps: readonly ChordStep[], bar: number): { index: number; startBar: number } | null {
  const total = steps.reduce((n, s) => n + s.bars, 0);
  if (total === 0) return null;
  const pos = ((bar % total) + total) % total;
  let acc = 0;
  for (let i = 0; i < steps.length; i++) {
    const bars = steps[i]!.bars;
    if (pos < acc + bars) return { index: i, startBar: bar - (pos - acc) };
    acc += bars;
  }
  return null;
}

export type ArpDirection = 'up' | 'down' | 'updown' | 'random';

/**
 * Which seat plays arp step `n` (0, 1, 2, …) when `count` phones take turns.
 * Deterministic, so every phone agrees without talking to each other.
 */
export function arpSeat(n: number, count: number, direction: ArpDirection): number {
  if (count <= 0) return -1;
  if (count === 1) return 0;
  const i = ((n % count) + count) % count;
  switch (direction) {
    case 'up':
      return i;
    case 'down':
      return count - 1 - i;
    case 'updown': {
      const period = 2 * count - 2;
      const p = ((n % period) + period) % period;
      return p < count ? p : period - p;
    }
    case 'random': {
      // integer hash of n: same on every device; nudged so it rarely repeats a seat back-to-back
      const h = (k: number) => {
        let x = (k + 0x9e3779b9) | 0;
        x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
        x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
        return ((x ^ (x >>> 16)) >>> 0) % count;
      };
      const prev = n > 0 ? h(n - 1) : -1;
      const cur = h(n);
      return cur === prev ? (cur + 1) % count : cur;
    }
  }
}
