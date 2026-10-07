import { DEFAULT_METRONOME, DEFAULT_PATCH, DEFAULT_PORT, WS_PATH, type ClientMessage, type Role, type ServerMessage, type SharedState } from '@echo/protocol';
import { ClockPinger, DEFAULT_TRANSPORT, TransportTimeline, type ClockEstimate } from '@echo/sync';

type Handler<T extends ServerMessage['t']> = (m: Extract<ServerMessage, { t: T }>) => void;

// Per tab, not per browser: sessionStorage survives reloads (so a phone that
// refreshes keeps its identity) but two tabs on one machine are two devices.
const ID_KEY = 'echo-mesh:device-id';

function wsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  // In dev, Vite serves the page and the Node server runs alongside on its own
  // port. Connect to it directly rather than through Vite's proxy, which would
  // add an extra hop of jitter to every ping.
  const host = import.meta.env.DEV ? `${location.hostname}:${DEFAULT_PORT}` : location.host;
  return `${proto}://${host}${WS_PATH}`;
}

/**
 * One WebSocket to the server, with auto-reconnect, clock sync, and the
 * shared transport timeline. Reactive fields are Svelte 5 state.
 */
export class Connection {
  status = $state<'connecting' | 'open' | 'closed' | 'replaced'>('connecting');
  id = $state<string | null>(null);
  state = $state<SharedState>({
    transport: DEFAULT_TRANSPORT,
    playoutMs: 150,
    patch: DEFAULT_PATCH,
    distribution: 'round-robin',
    metronome: DEFAULT_METRONOME,
  });
  clock = $state<ClockEstimate | null>(null);

  readonly pinger: ClockPinger;
  readonly timeline = new TransportTimeline();
  #ws: WebSocket | null = null;
  #handlers = new Map<string, Set<(m: ServerMessage) => void>>();
  #retryMs = 500;
  #closed = false;

  constructor(readonly role: Role) {
    this.pinger = new ClockPinger({
      now: () => performance.now(),
      send: (n, c0) => this.send({ t: 'ping', n, c0 }),
    });
    this.pinger.onUpdate((e) => (this.clock = e));

    // After a phone sleeps, its clock relationship may have jumped; start fresh.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.status === 'open') this.pinger.resync();
    });
  }

  connect(): void {
    this.#closed = false;
    this.status = 'connecting';
    const ws = new WebSocket(wsUrl());
    this.#ws = ws;

    ws.onopen = () => {
      this.#retryMs = 500;
      this.status = 'open';
      let stored: string | undefined;
      try { stored = sessionStorage.getItem(ID_KEY) ?? undefined; } catch { /* private mode */ }
      this.send({ t: 'hello', role: this.role, id: this.role === 'player' ? stored : undefined });
      this.pinger.resync();
    };

    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data as string) as ServerMessage;
      // Pongs are timing-critical: handle before anything else touches the main thread.
      if (m.t === 'pong') return this.pinger.handlePong(m);
      if (m.t === 'welcome') {
        this.id = m.id;
        if (m.role === 'player') try { sessionStorage.setItem(ID_KEY, m.id); } catch { /* ignore */ }
      }
      if (m.t === 'welcome' || m.t === 'state') {
        this.state = m.state;
        this.timeline.apply(m.state.transport);
      }
      this.#handlers.get(m.t)?.forEach((fn) => fn(m));
    };

    ws.onclose = (ev) => {
      this.pinger.stop();
      // 4000: the same device id connected again elsewhere; don't fight it.
      this.status = ev.code === 4000 ? 'replaced' : 'closed';
      if (this.#closed || ev.code === 4000) return;
      setTimeout(() => this.connect(), this.#retryMs);
      this.#retryMs = Math.min(this.#retryMs * 2, 5000);
    };
  }

  close(): void {
    this.#closed = true;
    this.#ws?.close();
  }

  send(msg: ClientMessage): void {
    if (this.#ws?.readyState === WebSocket.OPEN) this.#ws.send(JSON.stringify(msg));
  }

  on<T extends ServerMessage['t']>(type: T, fn: Handler<T>): () => void {
    const set = this.#handlers.get(type) ?? new Set();
    set.add(fn as (m: ServerMessage) => void);
    this.#handlers.set(type, set);
    return () => set.delete(fn as (m: ServerMessage) => void);
  }

  serverNow(): number {
    return this.pinger.serverNow();
  }

  /** server time → this page's performance.now() */
  toLocal(serverTime: number): number {
    return this.pinger.toLocal(serverTime);
  }
}
