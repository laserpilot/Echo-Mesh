<script lang="ts">
  import { noteName } from '@echo/voice';
  import { KEYMAP } from './keymap.ts';

  /**
   * One-and-a-bit octave piano, playable with the mouse or the computer
   * keyboard (A W S E D F T G Y H U J K, Z / X shift octave).
   * Held state comes from the parent so computer keys and clicks agree.
   */
  let {
    octave,
    held,
    onDown,
    onUp,
  }: {
    octave: number;
    held: Set<number>;
    onDown: (midi: number) => void;
    onUp: (midi: number) => void;
  } = $props();

  const BLACK = new Set([1, 3, 6, 8, 10]);

  const base = $derived(12 * (octave + 1)); // MIDI: C4 = 60 when octave = 4
  const keys = $derived(
    KEYMAP.map((letter, i) => ({ letter, midi: base + i, black: BLACK.has(i % 12) })),
  );
  const whites = $derived(keys.filter((k) => !k.black));

  /** horizontal position of a black key, in white-key widths */
  function blackLeft(i: number): number {
    const whitesBefore = keys.slice(0, i).filter((k) => !k.black).length;
    return whitesBefore - 0.32;
  }
</script>

<div class="kb" style:--whites={whites.length}>
  {#each keys as k, i (k.midi)}
    <button
      class:black={k.black}
      class:white={!k.black}
      class:down={held.has(k.midi)}
      style:--left={k.black ? blackLeft(i) : undefined}
      onpointerdown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onDown(k.midi); }}
      onpointerup={() => onUp(k.midi)}
      onpointercancel={() => onUp(k.midi)}
      aria-label={`${noteName(k.midi)}${Math.floor(k.midi / 12) - 1}`}
    >
      <span class="letter">{k.letter.toUpperCase()}</span>
      {#if !k.black && k.midi % 12 === 0}<span class="c">C{Math.floor(k.midi / 12) - 1}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .kb {
    position: relative;
    display: flex;
    height: 130px;
    user-select: none;
    touch-action: none;
  }

  button {
    border: 0;
    padding: 0 0 8px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    gap: 2px;
    font-size: 11px;
  }

  .white {
    flex: 1;
    margin-right: 3px;
    border-radius: 0 0 8px 8px;
    background: #d9d6e6;
    color: #4b4860;
  }

  .black {
    position: absolute;
    top: 0;
    left: calc(var(--left) * (100% / var(--whites)) + 1.5px);
    width: calc(100% / var(--whites) * 0.62);
    height: 62%;
    border-radius: 0 0 6px 6px;
    background: #262433;
    color: var(--muted);
    z-index: 1;
  }

  .white.down {
    background: var(--accent);
    color: white;
  }

  .black.down {
    background: var(--accent);
    color: white;
  }

  .letter {
    font-family: var(--mono);
    font-weight: 600;
  }

  .c {
    opacity: 0.6;
  }
</style>
