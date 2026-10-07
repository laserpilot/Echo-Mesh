import { DEFAULT_PATCH, type Patch } from '@echo/protocol';

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const;

/** pitch class name, octave-agnostic (C3 and C5 are both "C") */
export function noteName(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12]!;
}

export interface EngineOptions {
  /** simultaneous notes per device; the oldest is released when exceeded */
  maxVoices?: number;
  /** absolute output peak, linear (0.89 ≈ -1 dBFS) */
  ceiling?: number;
}

/** shortest attack/fade we allow, to avoid clicks */
const MIN_RAMP = 0.003;
/** fade used when stealing a voice or on panic */
const FAST_FADE = 0.015;

interface Voice {
  osc: OscillatorNode;
  filter: BiquadFilterNode;
  env: GainNode;
  start: number;
  peak: number;
  sustain: number;
  attack: number;
  decay: number;
  release: number;
  /** ctx time the release begins, once known */
  off: number | null;
  /** envelope level when the release began, and the release length */
  offLevel: number;
  releaseDur: number;
}

/**
 * Per-device synth. Uses only the standard Web Audio API, so it runs in
 * browsers and (for tests) in Node via node-web-audio-api's OfflineAudioContext.
 *
 * Signal path:
 *   voice: oscillator → low-pass → envelope ┐
 *   voice: …                                ├→ bus → soft clipper → destination
 *
 * The soft clipper is a WaveShaper, which clamps its input to [-1, 1] before
 * applying the curve, so the output can mathematically never exceed `ceiling`,
 * whatever arrives. That's the hearing/speaker safety guarantee.
 *
 * The output stage must add ZERO latency, or devices on different browsers
 * drift apart: DynamicsCompressorNode has an implementation-specific lookahead
 * (~6 ms in Chrome, ~10.7 ms in node-web-audio-api) and WaveShaper oversampling
 * adds resampling delay (and overshoots the curve). So: neither.
 */
export class VoiceEngine {
  readonly bus: GainNode;
  readonly output: AudioNode;
  patch: Patch = { ...DEFAULT_PATCH };
  readonly #voices = new Map<number, Voice>();
  readonly #maxVoices: number;

  constructor(
    readonly ctx: BaseAudioContext,
    destination: AudioNode,
    opts: EngineOptions = {},
  ) {
    this.#maxVoices = opts.maxVoices ?? 8;
    const ceiling = opts.ceiling ?? 0.89;

    this.bus = ctx.createGain();

    const clip = ctx.createWaveShaper();
    const n = 2049;
    const curve = new Float32Array(n);
    const k = 1.6; // gentle: close to linear for a single note, firm when many stack up
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = (ceiling * Math.tanh(k * x)) / Math.tanh(k);
    }
    clip.curve = curve;
    clip.oversample = 'none';

    this.bus.connect(clip).connect(destination);
    this.output = clip;
  }

  setPatch(patch: Partial<Patch>): void {
    this.patch = { ...this.patch, ...patch };
  }

  get active(): number {
    return this.#voices.size;
  }

  noteOn(id: number, midi: number, velocity: number, when: number): void {
    when = Math.max(when, this.ctx.currentTime);
    const existing = this.#voices.get(id);
    if (existing) this.#kill(id, existing, when);
    while (this.#voices.size >= this.#maxVoices) {
      // steal: voices already fading out first, then the oldest
      const [oldId, victim] = [...this.#voices.entries()].sort(
        (a, b) => Number(b[1].off !== null) - Number(a[1].off !== null) || a[1].start - b[1].start,
      )[0]!;
      this.#kill(oldId, victim, when);
    }

    const p = this.patch;
    const osc = this.ctx.createOscillator();
    osc.type = p.wave;
    osc.frequency.value = midiToHz(midi);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = p.cutoff;
    filter.Q.value = p.resonance;

    const env = this.ctx.createGain();
    env.gain.value = 0; // never start from the default of 1, whatever the automation does
    const v: Voice = {
      osc, filter, env,
      start: when,
      peak: Math.max(0, Math.min(1, velocity)) * p.gain,
      sustain: p.sustain,
      attack: Math.max(MIN_RAMP, p.attack),
      decay: Math.max(MIN_RAMP, p.decay),
      release: Math.max(MIN_RAMP, p.release),
      off: null,
      offLevel: 0,
      releaseDur: 0,
    };

    const g = env.gain;
    g.setValueAtTime(0, when);
    g.linearRampToValueAtTime(v.peak, when + v.attack);
    g.linearRampToValueAtTime(v.peak * v.sustain, when + v.attack + v.decay);

    osc.connect(filter).connect(env).connect(this.bus);
    osc.start(when);
    osc.onended = () => {
      env.disconnect();
      if (this.#voices.get(id) === v) this.#voices.delete(id);
    };
    this.#voices.set(id, v);
  }

  noteOff(id: number, when: number): void {
    const v = this.#voices.get(id);
    if (!v || v.off !== null) return;
    this.#fade(v, Math.max(when, this.ctx.currentTime, v.start), v.release);
  }

  /**
   * A short metronome tick: a sine blip with a fast exponential decay. Its
   * attack is 1 ms, so where it lands in time is unambiguous to the ear.
   */
  click(when: number, accent = false, level = 0.5): void {
    when = Math.max(when, this.ctx.currentTime);
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = accent ? 2000 : 1400;
    const env = this.ctx.createGain();
    env.gain.value = 0;
    const g = env.gain;
    g.setValueAtTime(0, when);
    g.linearRampToValueAtTime(level * (accent ? 1 : 0.7), when + 0.001);
    g.exponentialRampToValueAtTime(0.0005, when + 0.045);
    g.linearRampToValueAtTime(0, when + 0.05);
    osc.connect(env).connect(this.bus);
    osc.start(when);
    osc.stop(when + 0.055);
    osc.onended = () => env.disconnect();
  }

  /** silence everything, fast but click-free */
  panic(when = this.ctx.currentTime): void {
    for (const [id, v] of this.#voices) this.#kill(id, v, when);
  }

  /** envelope level at time t, as scheduled (piecewise linear, including any release) */
  static levelAt(v: Omit<Voice, 'osc' | 'filter' | 'env' | 'release'>, t: number): number {
    if (v.off !== null && t >= v.off) {
      return v.releaseDur > 0 ? v.offLevel * Math.max(0, 1 - (t - v.off) / v.releaseDur) : 0;
    }
    const dt = t - v.start;
    if (dt <= 0) return 0;
    if (dt < v.attack) return (v.peak * dt) / v.attack;
    if (dt < v.attack + v.decay) return v.peak + ((v.peak * v.sustain - v.peak) * (dt - v.attack)) / v.decay;
    return v.peak * v.sustain;
  }

  /** fast fade and forget the id immediately (stealing, retrigger, panic) */
  #kill(id: number, v: Voice, when: number): void {
    this.#voices.delete(id);
    // never extend a fade that would already finish sooner
    const endsAt = v.off !== null ? v.off + v.releaseDur : Infinity;
    if (endsAt <= when + FAST_FADE) return;
    this.#fade(v, Math.max(when, v.start), FAST_FADE);
  }

  #fade(v: Voice, when: number, duration: number): void {
    const level = VoiceEngine.levelAt(v, when);
    const g = v.env.gain;
    g.cancelScheduledValues(when);
    // Continue whatever ramp was in progress exactly up to `when` (no jump)…
    g.linearRampToValueAtTime(level, when);
    // …then fall to zero, which ends cleanly so the oscillator can stop.
    g.linearRampToValueAtTime(0, when + duration);
    v.off = when;
    v.offLevel = level;
    v.releaseDur = duration;
    v.osc.stop(when + duration + 0.01);
  }
}
