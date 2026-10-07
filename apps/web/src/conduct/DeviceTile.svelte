<script lang="ts">
  import type { PlayerInfo } from '@echo/protocol';

  let { player, pulse, onTrim }: { player: PlayerInfo; pulse: number; onTrim: (ms: number) => void } = $props();

  let el: HTMLDivElement | undefined = $state();

  const s = $derived(player.stats);
  const health = $derived.by((): { tone: 'ok' | 'warn' | 'bad'; why: string } => {
    if (!player.connected) return { tone: 'bad', why: 'disconnected' };
    if (!s) return { tone: 'warn', why: 'waiting for tap' };
    if (!s.clock.ready) return { tone: 'warn', why: 'syncing' };
    if (!s.visible) return { tone: 'warn', why: 'screen off / backgrounded' };
    if (s.audio?.state !== 'running') return { tone: 'warn', why: `audio ${s.audio?.state ?? 'not started'}` };
    if (s.clock.uncertainty > 20) return { tone: 'bad', why: 'poor network' };
    if (s.clock.uncertainty > 5) return { tone: 'warn', why: 'noisy network' };
    return { tone: 'ok', why: 'locked' };
  });

  // flash in step with the conductor's own beat, so a glance shows who's alive
  $effect(() => {
    if (pulse && player.connected) {
      el?.animate([{ borderColor: 'var(--accent)' }, { borderColor: 'var(--line)' }], { duration: 220 });
    }
  });

  const short = (n: number, d = 1) => (n >= 9999 ? '–' : n.toFixed(d));
  const device = $derived.by(() => {
    const ua = s?.ua ?? '';
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    if (/Android/.test(ua)) return 'Android';
    if (/Mac OS X/.test(ua)) return 'Mac';
    if (/Windows/.test(ua)) return 'Windows';
    return ua ? 'browser' : '';
  });
</script>

<div class="tile {health.tone}" class:gone={!player.connected} class:holding={player.holding > 0} bind:this={el} title={`${player.id}\n${player.remoteAddress}\n${s?.ua ?? ''}`}>
  <div class="head">
    <i></i>
    <span class="mono id">{player.id.slice(0, 4)}</span>
    <span class="device">{device}</span>
  </div>
  {#if s?.clock.ready}
    <div class="big mono">±{short(s.clock.uncertainty)}<small>ms</small></div>
    <div class="row mono">
      <span title="best round-trip time">rtt {short(s.clock.minRtt)}</span>
      <span title="clock drift vs server">{short(s.clock.driftPpm, 0)} ppm</span>
    </div>
    <div class="row mono">
      <span title="audio output latency reported by the browser">
        out {s.audio ? short(s.audio.outputLatency + s.audio.baseLatency, 0) : '–'}ms
      </span>
      <span title="late / dropped events" class:alert={s.schedule.dropped > 0}>
        {s.schedule.late}/{s.schedule.dropped}
      </span>
    </div>
  {/if}
  <div class="foot">
    <span class="why">{player.holding > 0 ? `♪ playing ${player.holding}` : health.why}</span>
    {#if player.connected}
      <span class="trim" title="Output latency trim: + plays earlier (for slow speakers, e.g. Bluetooth)">
        <button onclick={() => onTrim(player.trimMs - 5)} aria-label="trim later">−</button>
        <span class="mono">{player.trimMs > 0 ? '+' : ''}{player.trimMs}</span>
        <button onclick={() => onTrim(player.trimMs + 5)} aria-label="trim earlier">+</button>
      </span>
    {/if}
  </div>
</div>

<style>
  .tile {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--surface);
    font-size: 12px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .tile.gone {
    opacity: 0.45;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .head i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .ok .head i { background: var(--ok); }
  .warn .head i { background: var(--warn); }
  .bad .head i { background: var(--bad); }

  .id {
    font-weight: 600;
    font-size: 13px;
  }

  .device {
    margin-left: auto;
    color: var(--muted);
  }

  .big {
    font-size: 20px;
    line-height: 1.2;
  }

  .big small {
    font-size: 11px;
    color: var(--muted);
    margin-left: 2px;
  }

  .row {
    display: flex;
    justify-content: space-between;
    color: var(--muted);
  }

  .alert {
    color: var(--bad);
  }

  .tile.holding {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent), 0 0 18px color-mix(in srgb, var(--accent) 35%, transparent);
  }

  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .why {
    color: var(--muted);
  }

  .holding .why {
    color: var(--text);
  }

  .trim {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: var(--muted);
  }

  .trim button {
    width: 18px;
    height: 18px;
    padding: 0;
    line-height: 1;
    border-radius: 5px;
    border: 1px solid var(--line);
    background: var(--surface-2);
    font-size: 12px;
  }
</style>
