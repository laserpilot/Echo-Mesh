import type { Harmony } from '@echo/protocol';
import { arpSeat, diatonicChord, letterName, romanName, stepAtBar, tonicMidi, voiceFor } from './theory.ts';

export interface BeatPlan {
  stepIndex: number;
  roman: string;
  letter: string;
  /** this phone's note in the current chord (null if it has no seat) */
  midi: number | null;
  /** first beat of a chord: (re)start the pad */
  chordStart: boolean;
  pad: boolean;
  /** arp notes this phone plays during the beat, as fractions of a beat (0 = on the beat) */
  arp: number[];
  /** length of one arp note, in beats */
  arpLength: number;
}

/**
 * What one phone plays on one beat of the progression. Deterministic: every
 * phone runs this with the same harmony and transport, so they agree without
 * talking to each other.
 */
export function planBeat(
  h: Harmony,
  beat: number,
  beatsPerBar: number,
  seat: { index: number; count: number },
): BeatPlan | null {
  if (!h.playing || beat < h.anchorBeat || h.steps.length === 0) return null;
  const rel = beat - h.anchorBeat;
  const bar = Math.floor(rel / beatsPerBar);
  const at = stepAtBar(h.steps, bar);
  if (!at) return null;
  const step = h.steps[at.index]!;
  const chord = diatonicChord(h.scale, step.degree, step.seventh);
  const hasSeat = seat.index >= 0 && seat.count > 0;

  const arp: number[] = [];
  if (hasSeat && (h.pattern === 'arp' || h.pattern === 'both')) {
    for (let k = 0; k < h.arp.rate; k++) {
      if (arpSeat(rel * h.arp.rate + k, seat.count, h.arp.direction) === seat.index) arp.push(k / h.arp.rate);
    }
  }

  return {
    stepIndex: at.index,
    roman: romanName(h.scale, step),
    letter: letterName(h.key, h.scale, step),
    midi: hasSeat ? voiceFor(chord, seat.index, tonicMidi(h.key, h.octave)) : null,
    chordStart: rel === at.startBar * beatsPerBar,
    pad: hasSeat && (h.pattern === 'pad' || h.pattern === 'both'),
    arp,
    // a touch shorter than the gap to this phone's next turn keeps notes distinct
    arpLength: Math.max(1 / h.arp.rate, Math.min(seat.count / h.arp.rate, 2)) * 0.9,
  };
}

/**
 * A phone's view of the harmony over time. A change applies from its
 * `fromBeat` (the next bar); beats before that still use the previous version.
 */
export class HarmonyTimeline {
  #versions: Harmony[] = [];

  apply(h: Harmony): void {
    // keep the newest version that's already in effect, drop anything it supersedes
    this.#versions = [...this.#versions.filter((v) => v.fromBeat < h.fromBeat).slice(-1), h];
  }

  at(beat: number): Harmony | null {
    for (let i = this.#versions.length - 1; i >= 0; i--) {
      if (this.#versions[i]!.fromBeat <= beat) return this.#versions[i]!;
    }
    return null;
  }

  /** the newest version, for display */
  get latest(): Harmony | null {
    return this.#versions.at(-1) ?? null;
  }
}
