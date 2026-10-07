<script lang="ts">
  import { onDestroy } from 'svelte';
  import { AudioClock, SOUND_ENABLED } from '../lib/audio.ts';
  import { Connection } from '../lib/connection.svelte.ts';
  import { Scheduler, type Fired, type Planned } from '../lib/scheduler.ts';
  import { VoiceEngine, noteName } from '@echo/voice';

  const conn = new Connection('player');
  conn.connect();

  let joined = $state(false);
  let audio: AudioClock | null = null;
  let scheduler: Scheduler | null = null;
  let flashEl: HTMLDivElement | undefined = $state();
  let beatInBar = $state(-1);
  let beatsPerBar = $state(4);
  let reportTimer: ReturnType<typeof setInterval> | undefined;
  let engine: VoiceEngine | null = null;
  let trimMs = 0;
  /** notes this device is sounding, newest last */
  let held = $state<{ note: number; midi: number }[]>([]);
  const showing = $derived(held.at(-1));

  /** one hue per pitch class, so every phone playing an E glows the same color */
  const hue = (midi: number) => (midi % 12) * 30;

  $effect(() => {
    const patch = conn.state.patch;
    engine?.setPatch(patch);
  });

  conn.on('trim', (m) => (trimMs = m.ms));

  /** place in the metronome rotation */
  let seat = { index: -1, count: 0 };
  conn.on('seat', (m) => (seat = { index: m.index, count: m.count }));

  /** does this device sound/flash beat `beat`? */
  function mine(beat: number): boolean {
    const m = conn.state.metronome;
    if (m.sound === 'off') return false;
    if (m.who === 'all') return true;
    return seat.count > 0 && seat.index >= 0 && beat % seat.count === seat.index;
  }
  conn.on('panic', () => {
    engine?.panic();
    scheduler?.clear();
    held = [];
  });

  function playAudio(e: Fired, ctxTime: number) {
    if (!engine) return;
    // positive trim = this device's output is slow, so start it earlier
    const t = ctxTime - trimMs / 1000;
    if (e.kind === 'beat') {
      if (!mine(e.beat)) return;
      const accent = e.beatInBar === 0;
      const m = conn.state.metronome;
      if (m.sound === 'click') engine.click(t, accent);
      else if (m.sound === 'note') {
        // ids below zero never collide with the conductor's live notes
        const id = -1 - (e.beat % 1_000_000);
        const beatSec = 60 / conn.timeline.current.bpm;
        engine.noteOn(id, m.midi + (accent ? 12 : 0), accent ? 0.9 : 0.7, t);
        engine.noteOff(id, t + Math.min(beatSec * 0.5, 0.3));
      }
      return;
    }
    if (e.cue.kind === 'noteOn') engine.noteOn(e.cue.note, e.cue.midi, e.cue.velocity, t);
    else if (e.cue.kind === 'noteOff') engine.noteOff(e.cue.note, t);
  }
  let wakeLock: WakeLockSentinel | null = null;

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

  function fire(e: Planned) {
    if (import.meta.env.DEV && e.kind === 'beat') {
      probe.push({ beat: e.beat, wallMs: performance.timeOrigin + e.local });
      if (probe.length > 64) probe.shift();
    }
    if (e.kind === 'beat') {
      beatInBar = e.beatInBar;
      beatsPerBar = e.beatsPerBar;
      // with a metronome running, flash only on the beats this phone plays
      if (conn.state.metronome.sound !== 'off' && !mine(e.beat)) return;
    } else if (e.cue.kind === 'noteOff') {
      const note = e.cue.note;
      held = held.filter((h) => h.note !== note);
      return;
    } else if (e.cue.kind === 'noteOn') {
      const { note, midi } = e.cue;
      held = [...held.filter((h) => h.note !== note), { note, midi }];
    }
    const strong = e.kind === 'cue' || e.beatInBar === 0;
    const color =
      e.kind === 'beat' ? (strong ? 'var(--flash)' : 'var(--accent)')
      : e.cue.kind === 'noteOn' ? `hsl(${hue(e.cue.midi)} 85% 65%)`
      : e.cue.kind === 'flash' ? (e.cue.color ?? 'var(--flash)')
      : 'var(--flash)';
    flashEl?.animate(
      [
        { opacity: strong ? 1 : 0.55, background: color },
        { opacity: 0, background: color },
      ],
      { duration: strong ? 260 : 160, easing: 'cubic-bezier(.2,.7,.3,1)' },
    );
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
    joined = true;
    void keepAwake();
    scheduler = new Scheduler(conn, audio, fire, playAudio);
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

<main>
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
  {:else}
    <div class="beats" aria-label="beat">
      {#each { length: beatsPerBar } as _, i}
        <span class="dot" class:on={i === beatInBar} class:downbeat={i === 0}></span>
      {/each}
    </div>
  {/if}

  <footer>
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
