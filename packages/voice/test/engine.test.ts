import { OfflineAudioContext } from 'node-web-audio-api';
import { describe, expect, it } from 'vitest';
import { VoiceEngine, midiToHz, noteName } from '../src/index.ts';

/**
 * All tests render offline into a buffer and analyse the samples.
 * Nothing here touches a sound card.
 */
const SR = 48_000;

async function render(seconds: number, play: (e: VoiceEngine) => void, opts?: ConstructorParameters<typeof VoiceEngine>[2]) {
  const ctx = new OfflineAudioContext(1, Math.round(SR * seconds), SR);
  const engine = new VoiceEngine(ctx as unknown as BaseAudioContext, ctx.destination as unknown as AudioNode, opts);
  play(engine);
  const buf = await ctx.startRendering();
  return { samples: buf.getChannelData(0), engine };
}

const idx = (t: number) => Math.round(t * SR);
const peak = (x: Float32Array, from = 0, to = x.length) => {
  let m = 0;
  for (let i = from; i < to; i++) m = Math.max(m, Math.abs(x[i]!));
  return m;
};
const firstAbove = (x: Float32Array, threshold: number) => x.findIndex((v) => Math.abs(v) > threshold);

describe('helpers', () => {
  it('midi → Hz and octave-agnostic names', () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(60)).toBeCloseTo(261.63, 2);
    expect(noteName(60)).toBe('C');
    expect(noteName(48)).toBe('C');
    expect(noteName(73)).toBe('C♯');
  });
});

describe('VoiceEngine (offline render)', () => {
  it('starts exactly when scheduled', async () => {
    const { samples } = await render(0.5, (e) => {
      e.setPatch({ attack: 0.003, wave: 'square', cutoff: 20_000 });
      e.noteOn(1, 69, 1, 0.2);
    });
    expect(peak(samples, 0, idx(0.2))).toBe(0);
    const onset = firstAbove(samples, 1e-3);
    // within the 3 ms attack ramp, i.e. it can't be early and is < 1 render quantum late
    expect(onset).toBeGreaterThanOrEqual(idx(0.2));
    expect(onset).toBeLessThan(idx(0.2) + 128);
  });

  it('two notes scheduled 1 ms apart start 1 ms apart (sample accurate)', async () => {
    const onsets: number[] = [];
    for (const t of [0.1, 0.101]) {
      const { samples } = await render(0.2, (e) => {
        e.setPatch({ attack: 0.003, wave: 'square', cutoff: 20_000 });
        e.noteOn(1, 69, 1, t);
      });
      onsets.push(firstAbove(samples, 1e-3));
    }
    expect(onsets[1]! - onsets[0]!).toBeGreaterThanOrEqual(idx(0.001) - 2);
    expect(onsets[1]! - onsets[0]!).toBeLessThanOrEqual(idx(0.001) + 2);
  });

  it('sustains while held and is silent after the release', async () => {
    const { samples } = await render(1, (e) => {
      e.setPatch({ attack: 0.01, decay: 0.05, sustain: 0.5, release: 0.1 });
      e.noteOn(1, 60, 1, 0.1);
      e.noteOff(1, 0.5);
    });
    expect(peak(samples, idx(0.3), idx(0.5))).toBeGreaterThan(0.05);
    expect(peak(samples, idx(0.62))).toBe(0);
  });

  it('releasing mid-attack does not jump up', async () => {
    // sine, no resonance: output amplitude == shaped envelope level, so we can bound it exactly
    const { samples } = await render(0.6, (e) => {
      e.setPatch({ attack: 0.2, decay: 0.1, sustain: 1, release: 0.1, wave: 'sine', cutoff: 20_000, resonance: 0, gain: 0.5 });
      e.noteOn(1, 57, 1, 0.05);
      e.noteOff(1, 0.1); // a quarter of the way up the attack
    });
    const levelAtRelease = 0.5 * (0.05 / 0.2);
    const shaped = (x: number) => (0.89 * Math.tanh(1.6 * x)) / Math.tanh(1.6);
    expect(peak(samples, idx(0.1))).toBeLessThanOrEqual(shaped(levelAtRelease) * 1.001);
    expect(peak(samples, idx(0.08), idx(0.1))).toBeGreaterThan(shaped(levelAtRelease) * 0.85); // it did ramp up
  });

  it('can never exceed the output ceiling, even with a pile of loud notes', async () => {
    const { samples } = await render(0.6, (e) => {
      e.setPatch({ wave: 'square', gain: 1, attack: 0, cutoff: 20_000, sustain: 1 });
      for (let i = 0; i < 16; i++) e.noteOn(i, 40 + i, 1, 0.05);
    }, { maxVoices: 16, ceiling: 0.89 });
    const p = peak(samples);
    expect(p).toBeLessThanOrEqual(0.89 + 1e-6);
    expect(p).toBeGreaterThan(0.5); // and it's not just silent
  });

  it('limits polyphony by stealing (fading voices first, then the oldest)', async () => {
    const { samples } = await render(0.5, (e) => {
      for (let i = 0; i < 12; i++) e.noteOn(i, 60 + i, 0.5, 0.01 + i * 0.01);
      expect(e.active).toBe(4);
    }, { maxVoices: 4 });
    expect(peak(samples, idx(0.3))).toBeGreaterThan(0);
  });

  it('retriggering a held id replaces it rather than stacking', async () => {
    // (checked before rendering: the offline context ends every source when it finishes)
    await render(0.3, (e) => {
      e.noteOn(7, 60, 1, 0.01);
      e.noteOn(7, 64, 1, 0.05);
      expect(e.active).toBe(1);
    });
  });

  it('panic silences everything within ~20 ms', async () => {
    const { samples } = await render(1, (e) => {
      e.setPatch({ sustain: 1, release: 5 });
      for (let i = 0; i < 4; i++) e.noteOn(i, 60 + i * 4, 1, 0.05);
      e.panic(0.5);
    });
    expect(peak(samples, idx(0.3), idx(0.5))).toBeGreaterThan(0.05);
    expect(peak(samples, idx(0.52))).toBe(0);
  });

  it('adds no latency: the output stage is sample-aligned with the input', async () => {
    // a note with an instant attack must produce sound on its exact start sample
    const { samples } = await render(0.2, (e) => {
      e.setPatch({ attack: 0, wave: 'square', cutoff: 20_000 });
      e.noteOn(1, 69, 1, 0.1);
    });
    const onset = firstAbove(samples, 1e-4);
    expect(onset - idx(0.1)).toBeGreaterThanOrEqual(0);
    expect(onset - idx(0.1)).toBeLessThanOrEqual(2);
  });

  it('ignores a noteOff for an unknown note', async () => {
    const { samples } = await render(0.3, (e) => e.noteOff(99, 0.1));
    expect(peak(samples)).toBe(0);
  });
});

describe('click', () => {
  it('lands on its sample, decays to silence within ~50 ms, accents are louder', async () => {
    const { samples } = await render(0.5, (e) => {
      e.click(0.1, true);
      e.click(0.3, false);
    });
    expect(peak(samples, 0, idx(0.1))).toBe(0);
    const onset = firstAbove(samples, 1e-4);
    expect(onset - idx(0.1)).toBeGreaterThanOrEqual(0);
    expect(onset - idx(0.1)).toBeLessThanOrEqual(2);
    expect(peak(samples, idx(0.16), idx(0.3))).toBe(0);
    expect(peak(samples, idx(0.1), idx(0.15))).toBeGreaterThan(peak(samples, idx(0.3), idx(0.35)));
    expect(peak(samples, idx(0.36))).toBe(0);
  });
});
