<script lang="ts">
  import type { Patch } from '@echo/protocol';

  let { patch, onChange }: { patch: Patch; onChange: (p: Partial<Patch>) => void } = $props();

  const WAVES: { id: Patch['wave']; path: string }[] = [
    { id: 'sine', path: 'M2 12 C 6 2, 10 2, 14 12 S 22 22, 26 12' },
    { id: 'triangle', path: 'M2 12 L8 3 L20 21 L26 12' },
    { id: 'sawtooth', path: 'M2 20 L14 4 L14 20 L26 4 L26 20' },
    { id: 'square', path: 'M2 20 L2 4 L14 4 L14 20 L26 20 L26 4' },
  ];

  // Slider positions are 0..1; these map them to musically useful ranges.
  const exp = (min: number, max: number) => ({
    to: (v: number) => min * (max / min) ** v,
    from: (x: number) => Math.log(x / min) / Math.log(max / min),
  });
  const lin = (min: number, max: number) => ({
    to: (v: number) => min + (max - min) * v,
    from: (x: number) => (x - min) / (max - min),
  });

  const CONTROLS = [
    { key: 'attack', label: 'Attack', map: exp(0.003, 4), fmt: (x: number) => secs(x) },
    { key: 'decay', label: 'Decay', map: exp(0.01, 4), fmt: (x: number) => secs(x) },
    { key: 'sustain', label: 'Sustain', map: lin(0, 1), fmt: (x: number) => `${Math.round(x * 100)}%` },
    { key: 'release', label: 'Release', map: exp(0.01, 8), fmt: (x: number) => secs(x) },
    { key: 'cutoff', label: 'Tone', map: exp(80, 18000), fmt: (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(1)}k` : `${Math.round(x)}`) },
    { key: 'resonance', label: 'Reso', map: lin(0, 20), fmt: (x: number) => x.toFixed(1) },
    { key: 'gain', label: 'Level', map: lin(0, 1), fmt: (x: number) => `${Math.round(x * 100)}%` },
  ] as const;

  function secs(x: number) {
    return x < 1 ? `${Math.round(x * 1000)}ms` : `${x.toFixed(1)}s`;
  }

  // Coalesce slider drags to ~30 messages/s.
  let pending: Partial<Patch> = {};
  let timer: ReturnType<typeof setTimeout> | null = null;
  function change(p: Partial<Patch>) {
    pending = { ...pending, ...p };
    timer ??= setTimeout(() => {
      onChange(pending);
      pending = {};
      timer = null;
    }, 33);
  }
</script>

<div class="panel">
  <div class="waves" role="radiogroup" aria-label="waveform">
    {#each WAVES as w (w.id)}
      <button class:on={patch.wave === w.id} onclick={() => onChange({ wave: w.id })} title={w.id} role="radio" aria-checked={patch.wave === w.id}>
        <svg viewBox="0 0 28 24" aria-hidden="true"><path d={w.path} /></svg>
      </button>
    {/each}
  </div>

  {#each CONTROLS as c (c.key)}
    <label class="ctl">
      <span class="lbl">{c.label}</span>
      <input
        type="range" min="0" max="1" step="0.001"
        value={c.map.from(patch[c.key])}
        oninput={(e) => change({ [c.key]: c.map.to(Number(e.currentTarget.value)) })}
      />
      <span class="val mono">{c.fmt(patch[c.key])}</span>
    </label>
  {/each}
</div>

<style>
  .panel {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 18px;
  }

  .waves {
    display: flex;
    gap: 4px;
  }

  .waves button {
    width: 40px;
    height: 34px;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: var(--surface-2);
    display: grid;
    place-items: center;
  }

  .waves button.on {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 25%, var(--surface-2));
  }

  svg {
    width: 26px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linejoin: round;
  }

  .ctl {
    display: grid;
    grid-template-columns: auto;
    gap: 2px;
    width: 92px;
    font-size: 12px;
  }

  .lbl {
    color: var(--muted);
  }

  .val {
    font-size: 11px;
  }

  input {
    width: 100%;
    accent-color: var(--accent);
  }
</style>
