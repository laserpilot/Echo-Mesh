<script lang="ts">
  import { onDestroy } from 'svelte';
  import QRCode from 'qrcode';
  import { SvelteSet } from 'svelte/reactivity';
  import type { Distribution, Metronome, PlayerInfo } from '@echo/protocol';
  import { Connection } from '../lib/connection.svelte.ts';
  import { LiveNotes } from '../lib/live-notes.ts';
  import { MidiInput } from '../lib/midi.svelte.ts';
  import { Scheduler, type Fired } from '../lib/scheduler.ts';
  import DeviceTile from './DeviceTile.svelte';
  import Keyboard from './Keyboard.svelte';
  import { KEYMAP } from './keymap.ts';
  import SoundPanel from './SoundPanel.svelte';

  const conn = new Connection('conductor');
  conn.connect();

  let players = $state<PlayerInfo[]>([]);
  let beatInBar = $state(-1);
  let pulse = $state(0); // bumps on every beat/cue so tiles can flash in step
  let joinUrl = $state('');
  let qrSvg = $state('');

  conn.on('roster', (m) => (players = m.players.sort((a, b) => a.id.localeCompare(b.id))));

  const scheduler = new Scheduler(conn, null, (e: Fired) => {
    if (e.kind === 'beat') beatInBar = e.beatInBar;
    pulse++;
  });
  scheduler.start();

  const transport = $derived(conn.state.transport);
  const online = $derived(players.filter((p) => p.connected));
  const summary = $derived.by(() => {
    const synced = online.filter((p) => p.stats?.clock.ready);
    const unc = synced.map((p) => p.stats!.clock.uncertainty).sort((a, b) => a - b);
    return {
      online: online.length,
      synced: synced.length,
      worst: unc.at(-1),
      median: unc[unc.length >> 1],
      late: online.reduce((n, p) => n + (p.stats?.schedule.late ?? 0), 0),
      dropped: online.reduce((n, p) => n + (p.stats?.schedule.dropped ?? 0), 0),
    };
  });

  async function loadJoinInfo() {
    try {
      const info = (await (await fetch('/api/info')).json()) as { addresses: string[] };
      const host = info.addresses[0] ?? location.hostname;
      joinUrl = `${location.protocol}//${host}${location.port ? `:${location.port}` : ''}/`;
      qrSvg = await QRCode.toString(joinUrl, { type: 'svg', margin: 1, color: { dark: '#ecebf3', light: '#0000' } });
    } catch {
      joinUrl = `${location.origin}/`;
    }
  }
  void loadJoinInfo();

  const togglePlay = () => conn.send({ t: 'transport', action: transport.running ? 'stop' : 'start' });
  const setBpm = (bpm: number) => conn.send({ t: 'tempo', bpm: Math.round(Math.min(400, Math.max(20, bpm))) });
  const flash = () => conn.send({ t: 'cue', target: 'all', cue: { kind: 'flash' } });
  const panic = () => {
    conn.send({ t: 'panic' });
    notes.reset();
    keysDown.clear();
  };
  const setDistribution = (mode: Distribution) => conn.send({ t: 'distribution', mode });
  const setMetronome = (m: Partial<Metronome>) => conn.send({ t: 'metronome', metronome: m });
  const CLICK_SOUNDS: [Metronome['sound'], string][] = [['off', 'off'], ['click', 'click'], ['note', 'note']];
  const CLICK_WHO: [Metronome['who'], string][] = [['all', 'all phones'], ['rotate', 'rotate']];

  // ---- live playing ----
  let octave = $state(4);

  /**
   * Stamp notes here: this page is synced too, so end-to-end latency stays
   * constant. `local` is when the event really happened (a MIDI event's own
   * timestamp), so main-thread delays don't add jitter.
   */
  const stamp = (local?: number) =>
    conn.pinger.ready ? (local ?? performance.now()) + conn.pinger.offset() + conn.state.playoutMs : undefined;

  const notes = new LiveNotes((m) => conn.send(m), stamp, new SvelteSet<number>());

  /** computer key → midi it started (so an octave shift mid-hold still releases it) */
  const keysDown = new Map<string, number>();

  const midi = new MidiInput((e, ts) => {
    if (e.type === 'noteOn') notes.down(e.midi, e.velocity, ts);
    else if (e.type === 'noteOff') notes.up(e.midi, ts);
    else if (e.type === 'sustain') notes.sustain(e.on, ts);
    else notes.releaseAll(ts);
  });
  void midi.autoEnable();

  /** light the activity dot briefly on each message */
  let midiBlink = $state(false);
  $effect(() => {
    if (!midi.activity) return;
    midiBlink = true;
    const t = setTimeout(() => (midiBlink = false), 80);
    return () => clearTimeout(t);
  });

  function releaseAll() {
    notes.releaseAll();
    keysDown.clear();
  }

  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;
    const k = e.key.toLowerCase();
    const semi = KEYMAP.indexOf(k as (typeof KEYMAP)[number]);
    if (semi >= 0) {
      if (!e.repeat && !keysDown.has(k)) {
        const midi = 12 * (octave + 1) + semi;
        keysDown.set(k, midi);
        notes.down(midi);
      }
      return;
    }
    if (e.repeat) return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.key === 'Enter') flash();
    else if (e.key === 'Escape') panic();
    else if (k === 'z') octave = Math.max(0, octave - 1);
    else if (k === 'x') octave = Math.min(8, octave + 1);
    else if (e.key === 'ArrowUp') setBpm(transport.bpm + (e.shiftKey ? 10 : 1));
    else if (e.key === 'ArrowDown') setBpm(transport.bpm - (e.shiftKey ? 10 : 1));
  }

  function onKeyUp(e: KeyboardEvent) {
    const k = e.key.toLowerCase();
    const midi = keysDown.get(k);
    if (midi === undefined) return;
    keysDown.delete(k);
    notes.up(midi);
  }

  const fmt = (n: number | undefined, d = 1) => (n === undefined ? '–' : n.toFixed(d));

  onDestroy(() => {
    scheduler.stop();
    conn.close();
  });
</script>

<!-- never leave a note stuck when focus moves away -->
<svelte:window onkeydown={onKey} onkeyup={onKeyUp} onblur={releaseAll} />

<div class="app">
  <header>
    <div class="brand">Echo Mesh</div>

    <div class="transport">
      <button class="play" class:running={transport.running} onclick={togglePlay} title="Start / stop (Space)">
        {transport.running ? '■' : '▶'}
      </button>
      <div class="bpm">
        <button onclick={() => setBpm(transport.bpm - 1)} aria-label="slower">−</button>
        <span class="mono">{transport.bpm}</span>
        <button onclick={() => setBpm(transport.bpm + 1)} aria-label="faster">+</button>
        <small>bpm</small>
      </div>
      <div class="beats">
        {#each { length: transport.beatsPerBar } as _, i}
          <span class="dot" class:on={transport.running && i === beatInBar} class:downbeat={i === 0}></span>
        {/each}
      </div>
      <button class="flash" onclick={flash} title="Flash every device (Enter)">Flash</button>
    </div>

    <div class="metro" title="Click track on the beat. 'rotate' steps the beat around the phones one at a time: uneven rhythm = sync error.">
      <small>click</small>
      <div class="seg">
        {#each CLICK_SOUNDS as [id, label] (id)}
          <button class:on={conn.state.metronome.sound === id} onclick={() => setMetronome({ sound: id })}>{label}</button>
        {/each}
      </div>
      <div class="seg">
        {#each CLICK_WHO as [id, label] (id)}
          <button
            class:on={conn.state.metronome.who === id}
            disabled={conn.state.metronome.sound === 'off'}
            onclick={() => setMetronome({ who: id })}
          >{label}</button>
        {/each}
      </div>
    </div>

    <label class="playout" title="How far ahead live events are scheduled. Lower = snappier, higher = fewer late devices.">
      <small>playout</small>
      <input
        type="range" min="40" max="500" step="10"
        value={conn.state.playoutMs}
        onchange={(e) => conn.send({ t: 'playout', ms: Number(e.currentTarget.value) })}
      />
      <span class="mono">{conn.state.playoutMs} ms</span>
    </label>

    <span class="conn {conn.status}">{conn.status === 'open' ? 'server ok' : conn.status}</span>
    <button class="panic" onclick={panic} title="Silence everything and stop (Esc)">Panic</button>
  </header>

  <section class="play-area">
    <div class="play-left">
      <div class="dist" role="radiogroup" aria-label="note distribution">
        <span class="muted">Notes go to</span>
        {#each [['round-robin', 'one phone each'], ['all', 'every phone']] as [mode, label] (mode)}
          <button
            class:on={conn.state.distribution === mode}
            role="radio"
            aria-checked={conn.state.distribution === mode}
            onclick={() => setDistribution(mode as Distribution)}
          >{label}</button>
        {/each}
        <span class="octave muted">octave <b class="mono">{octave}</b> <small>(Z / X)</small></span>
      </div>
      <Keyboard {octave} held={notes.sounding} onDown={(m) => notes.down(m)} onUp={(m) => notes.up(m)} />
      <div class="midi">
        <span class="midi-dot" class:on={midiBlink} class:ready={midi.status === 'ready'}></span>
        {#if midi.status === 'unsupported'}
          <span class="muted">MIDI needs Chrome or Edge</span>
        {:else if midi.status === 'off'}
          <button onclick={() => midi.enable()}>Enable MIDI keyboard</button>
        {:else if midi.status === 'denied'}
          <span class="muted">MIDI permission denied: allow it in the site settings</span>
        {:else if midi.inputs.length === 0}
          <span class="muted">MIDI on, no devices connected</span>
        {:else}
          <select bind:value={midi.selected} aria-label="MIDI input">
            <option value="all">All MIDI inputs ({midi.inputs.length})</option>
            {#each midi.inputs as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
          </select>
        {/if}
        {#if notes.pedal}<span class="pedal">pedal</span>{/if}
      </div>
    </div>
    <SoundPanel patch={conn.state.patch} onChange={(patch) => conn.send({ t: 'patch', patch })} />
  </section>

  <main>
    <section class="devices">
      <div class="summary">
        <div><b class="mono">{summary.online}</b> devices</div>
        <div><b class="mono">{summary.synced}</b> synced</div>
        <div title="Estimated worst-case clock error, median across devices">median <b class="mono">±{fmt(summary.median)}</b> ms</div>
        <div title="Estimated worst-case clock error, worst device">worst <b class="mono">±{fmt(summary.worst)}</b> ms</div>
        <div title="Events that arrived after their play time (late) or too late to play (dropped)">
          late <b class="mono">{summary.late}</b> · dropped <b class="mono">{summary.dropped}</b>
        </div>
      </div>

      {#if players.length === 0}
        <div class="empty">
          <p>No devices yet.</p>
          <p class="muted">Scan the code with a phone on the same Wi-Fi, or open <span class="mono">{joinUrl || '/'}</span>.</p>
        </div>
      {:else}
        <div class="grid">
          {#each players as p (p.id)}
            <DeviceTile player={p} {pulse} onTrim={(ms) => conn.send({ t: 'trim', id: p.id, ms })} />
          {/each}
        </div>
      {/if}
    </section>

    <aside>
      <div class="qr">{@html qrSvg}</div>
      <a class="mono url" href={joinUrl} target="_blank" rel="noreferrer">{joinUrl}</a>
      <p class="muted">Phones join here. Tap once to start.</p>
      <dl class="keys">
        <dt>A–K</dt><dd>play notes</dd>
        <dt>Z X</dt><dd>octave</dd>
        <dt>Space</dt><dd>start / stop beat</dd>
        <dt>Enter</dt><dd>flash all</dd>
        <dt>↑ ↓</dt><dd>tempo (⇧ ×10)</dd>
        <dt>Esc</dt><dd>panic</dd>
      </dl>
    </aside>
  </main>
</div>

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 28px;
    padding: 14px 20px;
    border-bottom: 1px solid var(--line);
    background: var(--surface);
  }

  .brand {
    font-weight: 700;
    letter-spacing: 0.01em;
  }

  .transport {
    display: flex;
    align-items: center;
    gap: 18px;
  }

  .play {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    border: 0;
    background: var(--accent);
    font-size: 17px;
  }

  .play.running {
    background: var(--surface-2);
    box-shadow: inset 0 0 0 2px var(--accent);
  }

  .bpm {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .bpm span {
    font-size: 26px;
    min-width: 3ch;
    text-align: center;
  }

  .bpm button {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: var(--surface-2);
  }

  small,
  .muted {
    color: var(--muted);
  }

  .beats {
    display: flex;
    gap: 9px;
  }

  .dot {
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: var(--surface-2);
    transition: background 0.2s;
  }

  .dot.downbeat {
    box-shadow: 0 0 0 1.5px var(--line);
  }

  .dot.on {
    background: var(--accent);
    transition: none;
  }

  .dot.on.downbeat {
    background: var(--flash);
  }

  .flash {
    padding: 10px 16px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--surface-2);
    font-weight: 600;
  }

  .flash:active {
    background: var(--flash);
    color: var(--bg);
  }

  .metro {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .seg {
    display: inline-flex;
    border: 1px solid var(--line);
    border-radius: 9px;
    overflow: hidden;
  }

  .seg button {
    padding: 6px 10px;
    border: 0;
    background: var(--surface-2);
    font-size: 13px;
  }

  .seg button + button {
    border-left: 1px solid var(--line);
  }

  .seg button.on {
    background: color-mix(in srgb, var(--accent) 35%, var(--surface-2));
  }

  .seg button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .playout {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .playout input {
    accent-color: var(--accent);
    width: 120px;
  }

  .panic {
    padding: 9px 16px;
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, var(--bad) 60%, transparent);
    background: color-mix(in srgb, var(--bad) 18%, var(--surface));
    color: var(--text);
    font-weight: 700;
  }

  .panic:active {
    background: var(--bad);
  }

  .play-area {
    display: grid;
    grid-template-columns: minmax(320px, 520px) 1fr;
    gap: 16px 32px;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--line);
  }

  .play-left {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .dist {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }

  .dist button {
    padding: 5px 11px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--surface-2);
  }

  .dist button.on {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 30%, var(--surface-2));
  }

  .octave {
    margin-left: auto;
  }

  .midi {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    min-height: 28px;
  }

  .midi button,
  .midi select {
    padding: 4px 10px;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: var(--surface-2);
    color: var(--text);
    font: inherit;
  }

  .midi-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--surface-2);
    box-shadow: inset 0 0 0 1px var(--line);
  }

  .midi-dot.ready {
    background: color-mix(in srgb, var(--ok) 35%, var(--surface-2));
  }

  .midi-dot.on {
    background: var(--ok);
  }

  .pedal {
    padding: 2px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 35%, var(--surface-2));
    font-size: 12px;
  }

  .octave b {
    color: var(--text);
  }

  @media (max-width: 900px) {
    .play-area {
      grid-template-columns: 1fr;
    }
  }

  .conn {
    margin-left: auto;
    font-size: 13px;
    color: var(--bad);
  }

  .conn.open {
    color: var(--ok);
  }

  main {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 240px;
    gap: 20px;
    padding: 20px;
  }

  .summary {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 22px;
    margin-bottom: 16px;
    color: var(--muted);
  }

  .summary b {
    color: var(--text);
    font-weight: 600;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 10px;
  }

  .empty {
    padding: 48px 0;
    text-align: center;
  }

  aside {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 16px;
    border-radius: var(--radius);
    background: var(--surface);
    align-self: start;
    text-align: center;
  }

  .qr {
    width: 100%;
  }

  .qr :global(svg) {
    width: 100%;
    height: auto;
    display: block;
  }

  .url {
    color: var(--text);
    font-size: 12px;
    word-break: break-all;
  }

  .keys {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 10px;
    margin: 6px 0 0;
    font-size: 13px;
    text-align: left;
  }

  .keys dt {
    font-family: var(--mono);
    color: var(--text);
  }

  .keys dd {
    margin: 0;
    color: var(--muted);
  }

  @media (max-width: 720px) {
    main {
      grid-template-columns: 1fr;
    }
  }
</style>
