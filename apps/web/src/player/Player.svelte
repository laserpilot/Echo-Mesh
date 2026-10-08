<script lang="ts">
  import { onDestroy } from 'svelte';
  import { GROUPS, stageDistance, type Cue, type SelfInfo } from '@echo/protocol';
  import { planBeat, type BeatPlan } from '@echo/music';
  import { beatAt } from '@echo/sync';
  import { VoiceEngine, noteName } from '@echo/voice';
  import { AudioClock, SOUND_ENABLED } from '../lib/audio.ts';
  import { Connection } from '../lib/connection.svelte.ts';
  import { HarmonyPlayer, waveNote } from '../lib/harmony-player.ts';
  import { Scheduler, type Fired, type Planned } from '../lib/scheduler.ts';

  const conn = new Connection('player');
  conn.connect();

  let joined = $state(false);
  let audio: AudioClock | null = null;
  let scheduler: Scheduler | null = null;
  let engine: VoiceEngine | null = null;
  let harmonyPlayer: HarmonyPlayer | null = null;
  let flashEl: HTMLDivElement | undefined = $state();
  let beatInBar = $state(-1);
  let beatsPerBar = $state(4);
  let reportTimer: ReturnType<typeof setInterval> | undefined;
  let wakeLock: WakeLockSentinel | null = null;
  let picking = $state(false);

  /** everything the server tells this phone about itself */
  let me = $state<SelfInfo>({ index: -1, count: 0, group: null, pos: null, trimMs: 0 });
  conn.on('self', ({ t: _t, ...info }) => (me = info));
  const groupColor = $derived(me.group !== null ? GROUPS[me.group]!.color : null);

  /** live notes this device is sounding, newest last */
  let held = $state<{ note: number; midi: number }[]>([]);
  const showing = $derived(held.at(-1));
  /** the progression as this phone sees it, updated every beat */
  let chord = $state<BeatPlan | null>(null);
  let padOn = $state(false);

  /** one hue per pitch class, so every phone playing an E glows the same color */
  const hue = (midi: number) => (midi % 12) * 30;
  const beatSec = () => 60 / conn.timeline.current.bpm;

  $effect(() => {
    const patch = conn.state.patch;
    engine?.setPatch(patch);
  });

  // transport stopped: let the pad go
  $effect(() => {
    if (!conn.state.transport.running && audio) {
      harmonyPlayer?.releasePad(audio.ctx.currentTime);
      padOn = false;
      chord = null;
    }
  });

  conn.on('panic', () => {
    engine?.panic();
    harmonyPlayer?.reset();
    scheduler?.clear();
    held = [];
    chord = null;
    padOn = false;
  });

  /** does this device sound/flash metronome beat `beat`? */
  function metronomeMine(beat: number): boolean {
    const m = conn.state.metronome;
    if (m.sound === 'off') return false;
    if (m.who === 'all') return true;
    return me.count > 0 && me.index >= 0 && beat % me.count === me.index;
  }

  /** a wave reaches this phone later the farther it is from the origin; unplaced phones sit it out */
  function adjustCue(at: number, cue: Cue): number | null {
    if (cue.kind !== 'wave') return at;
    if (!me.pos) return null;
    return at + (stageDistance(me.pos, cue) / cue.speed) * 1000;
  }

  function playAudio(e: Fired, ctxTime: number) {
    if (!engine || !harmonyPlayer) return;
    // positive trim = this device's output is slow, so start it earlier
    const t = ctxTime - me.trimMs / 1000;
    if (e.kind === 'beat') {
      harmonyPlayer.beat(conn.harmony.at(e.beat), e.beat, e.beatsPerBar, beatSec(), t, me);
      if (!metronomeMine(e.beat)) return;
      const accent = e.beatInBar === 0;
      const m = conn.state.metronome;
      if (m.sound === 'click') engine.click(t, accent);
      else if (m.sound === 'note') {
        const id = -1 - (e.beat % 1_000_000);
        engine.noteOn(id, m.midi + (accent ? 12 : 0), accent ? 0.9 : 0.7, t);
        engine.noteOff(id, t + Math.min(beatSec() * 0.5, 0.3));
      }
      return;
    }
    if (e.cue.kind === 'noteOn') engine.noteOn(e.cue.note, e.cue.midi, e.cue.velocity, t);
    else if (e.cue.kind === 'noteOff') engine.noteOff(e.cue.note, t);
    else if (e.cue.kind === 'wave') harmonyPlayer.wave(waveMidi(e.at), t);
  }

  function waveMidi(at: number): number {
    const tr = conn.timeline.current;
    const beat = Math.floor(beatAt(tr, at));
    const h = conn.harmony.at(beat) ?? conn.harmony.latest;
    const plan = tr.running && h ? planBeat(h, beat, tr.beatsPerBar, me) : null;
    return waveNote(h, plan, me);
  }

  const sync = $derived.by(() => {
    if (conn.status === 'replaced') return { label: 'opened in another tab', tone: 'bad' };
    if (conn.status !== 'open') return { label: conn.status === 'connecting' ? 'connecting…' : 'offline', tone: 'bad' };
    const c = conn.clock;
    if (!c?.ready) return { label: 'syncing…', tone: 'warn' };
    const tone = c.uncertainty < 5 ? 'ok' : c.uncertainty < 20 ? 'warn' : 'bad';
    return { label: `in sync ±${c.uncertainty.toFixed(1)} ms`, tone };
  });

  // Dev-only probe: tabs on one machine share a wall clock, so comparing
  // timeOrigin + local target across tabs measures real end-to-end sync.
  const probe: { beat: number; wallMs: number }[] = [];
  if (import.meta.env.DEV) (window as unknown as { __echoProbe: typeof probe }).__echoProbe = probe;

  function flash(color: string, strength = 1, ms = 260) {
    flashEl?.animate(
      [
        { opacity: strength, background: color },
        { opacity: 0, background: color },
      ],
      { duration: ms, easing: 'cubic-bezier(.2,.7,.3,1)' },
    );
  }

  function fire(e: Planned) {
    if (e.kind === 'beat') {
      if (import.meta.env.DEV) {
        probe.push({ beat: e.beat, wallMs: performance.timeOrigin + e.local });
        if (probe.length > 64) probe.shift();
      }
      beatInBar = e.beatInBar;
      beatsPerBar = e.beatsPerBar;
      const h = conn.harmony.at(e.beat);
      chord = h ? planBeat(h, e.beat, e.beatsPerBar, me) : null;
      padOn = !!(chord?.pad && chord.midi !== null);
      // arp turns: flash in this phone's color on each of them
      if (chord?.midi != null) {
        const c = groupColor ?? `hsl(${hue(chord.midi)} 85% 65%)`;
        for (const f of chord.arp) setTimeout(() => flash(c, 0.9, 200), f * beatSec() * 1000);
      }
      if (conn.state.metronome.sound !== 'off' && metronomeMine(e.beat) && !chord) {
        flash(e.beatInBar === 0 ? 'var(--flash)' : 'var(--accent)', e.beatInBar === 0 ? 1 : 0.55, 160);
      }
      return;
    }
    const cue = e.cue;
    if (cue.kind === 'noteOff') {
      held = held.filter((h) => h.note !== cue.note);
    } else if (cue.kind === 'noteOn') {
      held = [...held.filter((h) => h.note !== cue.note), { note: cue.note, midi: cue.midi }];
      flash(`hsl(${hue(cue.midi)} 85% 65%)`);
    } else if (cue.kind === 'wave') {
      flash(groupColor ?? 'var(--flash)', 1, 420);
    } else {
      flash(cue.color ?? 'var(--flash)');
    }
  }

  function pickGroup(group: number | null) {
    conn.send({ t: 'group', group });
    picking = false;
  }

  async function keepAwake() {
    try {
      wakeLock = await navigator.wakeLock?.request('screen');
    } catch {
      // needs HTTPS on most phones; fine to skip on plain-http LAN
    }
  }

  async function join() {
    // Everything here must run inside the tap: browsers only unlock audio from a user gesture.
    // iOS: play through the ringer/silent switch like a music app would
    const session = (navigator as { audioSession?: { type: string } }).audioSession;
    if (session && SOUND_ENABLED) session.type = 'playback';
    audio = new AudioClock();
    await audio.resume();
    engine = new VoiceEngine(audio.ctx, audio.master);
    engine.setPatch(conn.state.patch);
    harmonyPlayer = new HarmonyPlayer(engine);
    joined = true;
    void keepAwake();
    scheduler = new Scheduler(conn, audio, fire, playAudio, adjustCue);
    scheduler.start();
    reportTimer = setInterval(report, 1000);
  }

  function report() {
    const c = conn.pinger.estimate();
    conn.send({
      t: 'report',
      stats: {
        clock: {
          ready: c.ready,
          offset: c.offset,
          uncertainty: Number.isFinite(c.uncertainty) ? c.uncertainty : 9999,
          minRtt: Number.isFinite(c.minRtt) ? c.minRtt : 9999,
          driftPpm: c.driftPpm,
          samples: c.samples,
        },
        audio: audio?.status() ?? null,
        schedule: { ...scheduler!.stats },
        visible: document.visibilityState === 'visible',
        ua: navigator.userAgent.slice(0, 200),
      },
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && joined) {
      void audio?.resume();
      void keepAwake();
    }
  });

  onDestroy(() => {
    scheduler?.stop();
    clearInterval(reportTimer);
    void wakeLock?.release();
    audio?.close();
    conn.close();
  });
</script>

<main style:--group={groupColor ?? 'transparent'} class:grouped={groupColor !== null}>
  <div class="tint"></div>
  <div class="flash" bind:this={flashEl}></div>

  {#if !joined}
    <button class="join" onclick={join}>
      <span class="ring"></span>
      <span class="join-label">Tap to join</span>
    </button>
    <p class="hint">Turn your screen brightness up and keep this page open.</p>
  {:else if showing}
    <div class="note" style:--h={hue(showing.midi)}>
      <span class="glow"></span>
      <span class="name">{noteName(showing.midi)}</span>
      {#if held.length > 1}<span class="more">+{held.length - 1}</span>{/if}
    </div>
  {:else if chord && chord.midi !== null}
    <div class="note" class:dim={!padOn} style:--h={hue(chord.midi)}>
      <span class="glow"></span>
      <span class="chord">{chord.roman} · {chord.letter}</span>
      <span class="name">{noteName(chord.midi)}</span>
    </div>
  {:else}
    <div class="beats" aria-label="beat">
      {#each { length: beatsPerBar } as _, i}
        <span class="dot" class:on={i === beatInBar} class:downbeat={i === 0}></span>
      {/each}
    </div>
  {/if}

  {#if picking}
    <div class="picker" role="dialog" aria-label="Pick your color">
      <p>Pick your color</p>
      <div class="swatches">
        {#each GROUPS as g, i (g.name)}
          <button style:background={g.color} class:on={me.group === i} onclick={() => pickGroup(i)} aria-label={g.name}></button>
        {/each}
      </div>
      <button class="clear" onclick={() => pickGroup(null)}>No color</button>
    </div>
  {/if}

  <footer>
    {#if joined}
      <button class="swatch" onclick={() => (picking = !picking)} aria-label="Pick your color" style:background={groupColor ?? 'var(--surface-2)'}></button>
    {/if}
    <span class="status {sync.tone}"><i></i>{sync.label}</span>
    {#if conn.id}<span class="mono id">{conn.id.slice(0, 4)}</span>{/if}
    {#if !SOUND_ENABLED}<span class="muted">silent build</span>{/if}
  </footer>
</main>

<style>
  main {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
  }

  .tint {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .grouped .tint {
    background: radial-gradient(circle at 50% 120%, color-mix(in srgb, var(--group) 40%, transparent), transparent 70%);
  }

  .note.dim .glow {
    opacity: 0.35;
  }

  .note.dim .name {
    opacity: 0.6;
  }

  .chord {
    position: absolute;
    top: 22%;
    font-size: 20px;
    letter-spacing: 0.04em;
    color: var(--muted);
  }

  .picker {
    position: absolute;
    inset: auto 16px 64px;
    padding: 18px;
    border-radius: 18px;
    background: var(--surface);
    box-shadow: 0 10px 40px rgb(0 0 0 / 0.5);
    text-align: center;
    z-index: 2;
  }

  .picker p {
    margin: 0 0 12px;
    font-weight: 600;
  }

  .swatches {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .swatches button {
    aspect-ratio: 1.4;
    border-radius: 14px;
    border: 3px solid transparent;
  }

  .swatches button.on {
    border-color: var(--text);
  }

  .clear {
    margin-top: 12px;
    padding: 8px 14px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--surface-2);
  }

  .swatch {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    border: 2px solid var(--line);
  }

  .flash {
    position: absolute;
    inset: 0;
    opacity: 0;
    pointer-events: none;
  }

  .join {
    position: relative;
    width: min(64vw, 280px);
    aspect-ratio: 1;
    border-radius: 50%;
    border: 0;
    background: radial-gradient(circle at 50% 40%, #2a2450, var(--surface) 70%);
    display: grid;
    place-items: center;
  }

  .ring {
    position: absolute;
    inset: -10px;
    border-radius: 50%;
    border: 2px solid var(--accent);
    animation: breathe 2.4s ease-in-out infinite;
  }

  .join-label {
    font-size: 1.4rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .hint {
    position: absolute;
    bottom: 22%;
    margin: 0 24px;
    text-align: center;
    color: var(--muted);
  }

  @keyframes breathe {
    50% { transform: scale(1.06); opacity: 0.5; }
  }

  .note {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
  }

  .glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 45%, hsl(var(--h) 85% 55% / 0.55), transparent 70%);
  }

  .name {
    position: relative;
    font-size: min(44vw, 260px);
    font-weight: 700;
    line-height: 1;
    color: hsl(var(--h) 90% 82%);
  }

  .more {
    position: absolute;
    top: 30%;
    right: 18%;
    font-size: 22px;
    color: var(--muted);
  }

  .beats {
    display: flex;
    gap: 22px;
  }

  .dot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--surface-2);
    transition: background 0.25s, transform 0.25s;
  }

  .dot.downbeat {
    box-shadow: 0 0 0 2px var(--line);
  }

  .dot.on {
    background: var(--accent);
    transform: scale(1.35);
    transition: none;
  }

  .dot.on.downbeat {
    background: var(--flash);
  }

  footer {
    position: absolute;
    bottom: max(16px, env(safe-area-inset-bottom));
    left: 16px;
    right: 16px;
    display: flex;
    gap: 14px;
    justify-content: center;
    align-items: center;
    font-size: 13px;
    color: var(--muted);
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: var(--text);
  }

  .status i {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: currentColor;
  }

  .status.ok i { color: var(--ok); }
  .status.warn i { color: var(--warn); }
  .status.bad i { color: var(--bad); }

  .id {
    color: var(--muted);
  }
</style>
