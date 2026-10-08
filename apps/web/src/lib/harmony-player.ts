import type { Harmony, SelfInfo } from '@echo/protocol';
import { diatonicChord, planBeat, tonicMidi, voiceFor, type BeatPlan } from '@echo/music';
import type { VoiceEngine } from '@echo/voice';

/** note ids below zero never collide with the conductor's live notes; separate bands per use */
const PAD_IDS = -10_000_000;
const ARP_IDS = -20_000_000;
const WAVE_IDS = -30_000_000;
const BAND = 1_000_000;

/**
 * Plays this phone's part of the progression loop: a sustained pad on its
 * chord tone and/or its turns in the room-wide arpeggio. Called once per
 * beat with that beat's exact audio-clock time.
 */
export class HarmonyPlayer {
  #pad: { id: number; midi: number } | null = null;
  #n = 0;

  constructor(private readonly engine: VoiceEngine) {}

  #id(band: number): number {
    this.#n = (this.#n + 1) % BAND;
    return band - this.#n;
  }

  beat(h: Harmony | null, beat: number, beatsPerBar: number, beatSec: number, t: number, me: SelfInfo): BeatPlan | null {
    const plan = h ? planBeat(h, beat, beatsPerBar, me) : null;

    // pad: (re)start on each chord, or if our note changed (moved seat, key change)
    if (plan?.pad && plan.midi !== null) {
      if (plan.chordStart || !this.#pad || this.#pad.midi !== plan.midi) {
        this.releasePad(t);
        const id = this.#id(PAD_IDS);
        this.engine.noteOn(id, plan.midi, 0.6, t);
        this.#pad = { id, midi: plan.midi };
      }
    } else {
      this.releasePad(t);
    }

    // arp: this phone's turns within the beat
    if (plan && plan.midi !== null) {
      for (const f of plan.arp) {
        const id = this.#id(ARP_IDS);
        this.engine.noteOn(id, plan.midi, 0.85, t + f * beatSec);
        this.engine.noteOff(id, t + (f + plan.arpLength) * beatSec);
      }
    }
    return plan;
  }

  releasePad(t: number): void {
    if (!this.#pad) return;
    this.engine.noteOff(this.#pad.id, t);
    this.#pad = null;
  }

  /** the panic already silenced the engine; just forget */
  reset(): void {
    this.#pad = null;
  }

  get padSounding(): boolean {
    return this.#pad !== null;
  }

  /** a short note for a wave reaching this phone: its tone in the current (or first) chord */
  wave(midi: number, t: number): void {
    const id = this.#id(WAVE_IDS);
    this.engine.noteOn(id, midi, 0.9, t);
    this.engine.noteOff(id, t + 0.5);
  }
}

/** this phone's tone for a wave: the chord playing now, else the loop's first chord */
export function waveNote(h: Harmony | null, plan: BeatPlan | null, me: SelfInfo): number {
  if (plan?.midi != null) return plan.midi;
  const harmony = h ?? null;
  const step = harmony?.steps[0] ?? { degree: 1, seventh: false, bars: 1 };
  const chord = diatonicChord(harmony?.scale ?? 'major', step.degree, step.seventh);
  return voiceFor(chord, Math.max(0, me.index), tonicMidi(harmony?.key ?? 0, (harmony?.octave ?? 3) + 1));
}
