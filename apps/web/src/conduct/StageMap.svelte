<script lang="ts">
  import { GROUPS, STAGE_ASPECT, type PlayerInfo, type Pos } from '@echo/protocol';

  /**
   * The room, seen from above. Drag phones to roughly where they are;
   * click empty floor to send a wave from that spot.
   */
  let {
    players,
    waveSpeed,
    leadMs,
    onPlace,
    onWave,
  }: {
    players: PlayerInfo[];
    waveSpeed: number;
    /** phones play this long after the click; the ring waits too so you see what you hear */
    leadMs: number;
    onPlace: (id: string, pos: Pos | null) => void;
    onWave: (pos: Pos) => void;
  } = $props();

  const W = 1000;
  const H = W * STAGE_ASPECT;

  let svg: SVGSVGElement | undefined = $state();
  /** in-flight drag, so the dot follows the pointer before the server confirms */
  let drag = $state<{ id: string; pos: Pos; moved: boolean } | null>(null);
  let waves = $state<{ key: number; x: number; y: number; start: number }[]>([]);
  let now = $state(performance.now());
  let waveKey = 0;

  const placed = $derived(players.filter((p) => p.connected && (p.pos || drag?.id === p.id)));
  const unplaced = $derived(players.filter((p) => p.connected && !p.pos && drag?.id !== p.id));

  function toPos(e: PointerEvent): Pos {
    const r = svg!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }
  const clamp = (p: Pos): Pos => ({ x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)) });
  const inside = (p: Pos) => p.x >= -0.02 && p.x <= 1.02 && p.y >= -0.02 && p.y <= 1.02;

  function startDrag(e: PointerEvent, p: PlayerInfo) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag = { id: p.id, pos: p.pos ?? toPos(e), moved: false };
  }

  function moveDrag(e: PointerEvent) {
    if (!drag) return;
    drag = { ...drag, pos: toPos(e), moved: true };
  }

  function endDrag() {
    if (!drag) return;
    // dragged off the map: unplace
    onPlace(drag.id, inside(drag.pos) ? clamp(drag.pos) : null);
    drag = null;
  }

  /** a tray chip drops onto the map where you release it */
  function startFromTray(e: PointerEvent, p: PlayerInfo) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag = { id: p.id, pos: { x: -1, y: -1 }, moved: false };
  }

  function floorClick(e: PointerEvent) {
    if (drag) return;
    const pos = clamp(toPos(e));
    onWave(pos);
    waves = [...waves, { key: ++waveKey, ...pos, start: performance.now() + leadMs }];
  }

  // animate rings until they've crossed the room
  $effect(() => {
    if (!waves.length) return;
    let raf = requestAnimationFrame(function tick() {
      now = performance.now();
      const life = (1.5 / waveSpeed) * 1000;
      waves = waves.filter((w) => now - w.start < life + leadMs);
      if (waves.length) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  });

  const posOf = (p: PlayerInfo) => (drag?.id === p.id ? drag.pos : p.pos!);
  const color = (p: PlayerInfo) => (p.group !== null ? GROUPS[p.group]!.color : '#8d8ba3');
</script>

<div class="stage">
  <svg
    bind:this={svg}
    viewBox={`0 0 ${W} ${H}`}
    onpointerdown={floorClick}
    onpointermove={moveDrag}
    onpointerup={endDrag}
    role="application"
    aria-label="Stage map: drag phones to place them, click the floor to send a wave"
  >
    <defs>
      <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
        <path d="M50 0H0V50" fill="none" stroke="var(--line)" stroke-width="1" opacity="0.5" />
      </pattern>
    </defs>
    <rect width={W} height={H} rx="14" fill="url(#grid)" class="floor" />
    <text x={W / 2} y="26" class="front">front</text>

    {#each waves as w (w.key)}
      {@const r = ((now - w.start) / 1000) * waveSpeed}
      {#if r > 0}<circle cx={w.x * W} cy={w.y * H} r={r * W} class="ring" style:opacity={Math.max(0, 1 - r / 1.5)} />{/if}
    {/each}

    {#each placed as p (p.id)}
      {@const pos = posOf(p)}
      {#if pos.x >= -0.5}
        <g
          transform={`translate(${pos.x * W} ${pos.y * H})`}
          class="dev"
          class:holding={p.holding > 0}
          class:dragging={drag?.id === p.id}
          onpointerdown={(e) => startDrag(e, p)}
          role="button"
          tabindex="-1"
          aria-label={`device ${p.id.slice(0, 4)}`}
        >
          <circle r="26" fill={color(p)} class="body" />
          <text y="5" class="label">{p.seat >= 0 ? p.seat + 1 : '·'}</text>
          <text y="44" class="id">{p.id.slice(0, 4)}</text>
        </g>
      {/if}
    {/each}
  </svg>

  <div class="tray">
    {#if unplaced.length}
      <span class="muted">Drag onto the map:</span>
      {#each unplaced as p (p.id)}
        <button class="chip" onpointerdown={(e) => startFromTray(e, p)} onpointermove={moveDrag} onpointerup={endDrag}>
          <i style:background={color(p)}></i>{p.id.slice(0, 4)}
        </button>
      {/each}
    {:else if players.some((p) => p.connected)}
      <span class="muted">Click the floor to send a wave · drag a phone off the map to unplace it</span>
    {/if}
  </div>
</div>

<style>
  .stage {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  svg {
    width: 100%;
    height: auto;
    display: block;
    touch-action: none;
    user-select: none;
    cursor: crosshair;
  }

  .floor {
    fill: var(--surface);
    stroke: var(--line);
    stroke-width: 2;
  }

  .front {
    fill: var(--muted);
    font-size: 16px;
    text-anchor: middle;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  .ring {
    fill: none;
    stroke: var(--accent);
    stroke-width: 3;
    pointer-events: none;
  }

  .dev {
    cursor: grab;
  }

  .dev.dragging {
    cursor: grabbing;
  }

  .dev .body {
    stroke: var(--bg);
    stroke-width: 3;
    transition: filter 0.15s;
  }

  .dev.holding .body {
    stroke: var(--text);
    filter: drop-shadow(0 0 10px var(--accent));
  }

  .label {
    fill: #15151d;
    font-size: 17px;
    font-weight: 700;
    text-anchor: middle;
    pointer-events: none;
  }

  .id {
    fill: var(--muted);
    font-size: 13px;
    font-family: var(--mono);
    text-anchor: middle;
    pointer-events: none;
  }

  .tray {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    font-size: 13px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--surface-2);
    font-family: var(--mono);
    font-size: 12px;
    cursor: grab;
    touch-action: none;
  }

  .chip i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .muted {
    color: var(--muted);
  }
</style>
