<script lang="ts">
  import type { Harmony, HarmonySettings } from '@echo/protocol';
  import { KEY_NAMES, PRESETS, letterName, romanName, type ChordStep } from '@echo/music';

  /**
   * The progression loop. Every edit goes to the server, which lands it on the
   * next bar so the whole room changes together.
   */
  let {
    harmony,
    current,
    onChange,
  }: {
    harmony: Harmony;
    /** index of the step sounding now, or -1 */
    current: number;
    onChange: (h: Partial<HarmonySettings>) => void;
  } = $props();

  const setSteps = (steps: ChordStep[]) => onChange({ steps });
  const BARS = [1, 2, 4];
  const RATES: [number, string][] = [[1, '♩'], [2, '♪'], [3, '3'], [4, '♬']];
  const DIRS: [Harmony['arp']['direction'], string][] = [['up', '↑'], ['down', '↓'], ['updown', '↕'], ['random', '?']];
  const PATTERNS: [Harmony['pattern'], string][] = [['pad', 'pad'], ['arp', 'arp'], ['both', 'both']];

  function cycleBars(i: number) {
    const s = harmony.steps[i]!;
    const next = BARS[(BARS.indexOf(s.bars) + 1) % BARS.length]!;
    setSteps(harmony.steps.map((x, j) => (j === i ? { ...x, bars: next } : x)));
  }
  const toggleSeventh = (i: number) =>
    setSteps(harmony.steps.map((x, j) => (j === i ? { ...x, seventh: !x.seventh } : x)));
  const remove = (i: number) => setSteps(harmony.steps.filter((_, j) => j !== i));
  const add = (degree: number) =>
    harmony.steps.length < 16 && setSteps([...harmony.steps, { degree, seventh: false, bars: 1 }]);

  function loadPreset(name: string) {
    const p = PRESETS.find((x) => x.name === name);
    if (p) onChange({ scale: p.scale, steps: p.steps.map((s) => ({ ...s })) });
  }
</script>

<div class="loop">
  <div class="row">
    <button
      class="go"
      class:on={harmony.playing}
      onclick={() => onChange({ playing: !harmony.playing })}
      title="Start / stop the loop (L). Changes land on the next bar."
    >{harmony.playing ? '■ Loop' : '▶ Loop'}</button>

    <select value={harmony.key} onchange={(e) => onChange({ key: Number(e.currentTarget.value) })} aria-label="key">
      {#each KEY_NAMES as k, i (k)}<option value={i}>{k}</option>{/each}
    </select>
    <select value={harmony.scale} onchange={(e) => onChange({ scale: e.currentTarget.value as Harmony['scale'] })} aria-label="scale">
      <option value="major">major</option>
      <option value="minor">minor</option>
      <option value="dorian">dorian</option>
      <option value="mixolydian">mixolydian</option>
    </select>
    <select value="" onchange={(e) => { loadPreset(e.currentTarget.value); e.currentTarget.value = ''; }} aria-label="preset">
      <option value="" disabled>presets…</option>
      {#each PRESETS as p (p.name)}<option value={p.name}>{p.name}</option>{/each}
    </select>

    <span class="oct">
      <small>oct</small>
      <button onclick={() => onChange({ octave: Math.max(1, harmony.octave - 1) })} aria-label="octave down">−</button>
      <span class="mono">{harmony.octave}</span>
      <button onclick={() => onChange({ octave: Math.min(6, harmony.octave + 1) })} aria-label="octave up">+</button>
    </span>
  </div>

  <div class="steps">
    {#each harmony.steps as s, i (i)}
      <div class="chip" class:now={harmony.playing && i === current}>
        <button class="name" onclick={() => cycleBars(i)} title="Click: change length">
          <b>{romanName(harmony.scale, s)}</b>
          <small>{letterName(harmony.key, harmony.scale, s)}</small>
          <span class="bars">{'▮'.repeat(s.bars)}</span>
        </button>
        <div class="chip-tools">
          <button class:on={s.seventh} onclick={() => toggleSeventh(i)} title="add the 7th">7</button>
          <button onclick={() => remove(i)} aria-label="remove chord">×</button>
        </div>
      </div>
    {/each}
    {#if harmony.steps.length === 0}<span class="muted">Add chords below or pick a preset.</span>{/if}
  </div>

  <div class="row">
    <span class="muted add-label">add</span>
    {#each [1, 2, 3, 4, 5, 6, 7] as d (d)}
      <button class="add" onclick={() => add(d)}>{romanName(harmony.scale, { degree: d, seventh: false })}</button>
    {/each}
  </div>

  <div class="row">
    <div class="seg">
      {#each PATTERNS as [id, label] (id)}
        <button class:on={harmony.pattern === id} onclick={() => onChange({ pattern: id })}>{label}</button>
      {/each}
    </div>
    <div class="seg" class:off={harmony.pattern === 'pad'} title="arp notes per beat, across the whole room">
      {#each RATES as [rate, label] (rate)}
        <button class:on={harmony.arp.rate === rate} onclick={() => onChange({ arp: { ...harmony.arp, rate } })}>{label}</button>
      {/each}
    </div>
    <div class="seg" class:off={harmony.pattern === 'pad'} title="arp order through the room (left → right on the map)">
      {#each DIRS as [direction, label] (direction)}
        <button class:on={harmony.arp.direction === direction} onclick={() => onChange({ arp: { ...harmony.arp, direction } })}>{label}</button>
      {/each}
    </div>
  </div>
</div>

<style>
  .loop {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
  }

  button,
  select {
    padding: 5px 9px;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: var(--surface-2);
    color: var(--text);
    font: inherit;
    font-size: 13px;
  }

  .go {
    padding: 7px 14px;
    font-weight: 700;
    background: var(--accent);
    border-color: var(--accent);
  }

  .go.on {
    background: var(--surface-2);
    box-shadow: inset 0 0 0 2px var(--accent);
  }

  .oct {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .oct button {
    padding: 1px 7px;
  }

  small,
  .muted {
    color: var(--muted);
  }

  .steps {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-height: 58px;
    align-items: stretch;
  }

  .chip {
    display: flex;
    flex-direction: column;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--surface-2);
    overflow: hidden;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .chip.now {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent), 0 0 16px color-mix(in srgb, var(--accent) 40%, transparent);
  }

  .chip .name {
    border: 0;
    border-radius: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 6px 12px 4px;
    background: transparent;
  }

  .chip .name b {
    font-size: 16px;
  }

  .bars {
    font-size: 8px;
    letter-spacing: 1px;
    color: var(--accent);
  }

  .chip-tools {
    display: flex;
    border-top: 1px solid var(--line);
  }

  .chip-tools button {
    flex: 1;
    border: 0;
    border-radius: 0;
    padding: 2px 6px;
    background: transparent;
    font-size: 11px;
    color: var(--muted);
  }

  .chip-tools button + button {
    border-left: 1px solid var(--line);
  }

  .chip-tools button.on {
    color: var(--text);
    background: color-mix(in srgb, var(--accent) 30%, transparent);
  }

  .add-label {
    font-size: 12px;
  }

  .add {
    padding: 3px 8px;
  }

  .seg {
    display: inline-flex;
    border: 1px solid var(--line);
    border-radius: 9px;
    overflow: hidden;
  }

  .seg.off {
    opacity: 0.4;
  }

  .seg button {
    border: 0;
    border-radius: 0;
    min-width: 34px;
  }

  .seg button + button {
    border-left: 1px solid var(--line);
  }

  .seg button.on {
    background: color-mix(in srgb, var(--accent) 35%, var(--surface-2));
  }
</style>
