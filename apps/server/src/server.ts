import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { performance } from 'node:perf_hooks';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  ClientMessage,
  DEFAULT_METRONOME,
  DEFAULT_PATCH,
  WS_PATH,
  type PlayerInfo,
  type PlayerStats,
  type ServerMessage,
  type SharedState,
} from '@echo/protocol';
import { DEFAULT_TRANSPORT, retempo, startTransport } from '@echo/sync';
import { Allocator } from './allocator.ts';

export interface ServerOptions {
  port: number;
  host?: string;
  /** built web app to serve (apps/web/dist); omitted in dev, where Vite serves it */
  staticDir?: string;
  /** server clock; overridable for tests */
  now?: () => number;
}

interface Player {
  id: string;
  ws: WebSocket | null;
  lastSeen: number;
  remoteAddress: string;
  stats: PlayerStats | null;
  trimMs: number;
}

/** extra lead on transport start so every device sees a clean count-in */
const START_LEAD_MS = 400;
const ROSTER_INTERVAL_MS = 500;
/** a live event can't be scheduled closer than this to "now" */
const MIN_LEAD_MS = 10;
/** forget disconnected players after this long */
const PLAYER_TTL_MS = 10 * 60_000;

export function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i!.address);
}

export async function createServer(opts: ServerOptions) {
  const now = opts.now ?? (() => performance.now());

  const state: SharedState = {
    transport: { ...DEFAULT_TRANSPORT },
    playoutMs: 150,
    patch: { ...DEFAULT_PATCH },
    distribution: 'round-robin',
    metronome: { ...DEFAULT_METRONOME },
  };
  const allocator = new Allocator();
  /** last seat sent to each player, so we only send changes */
  const seats = new Map<string, string>();
  const players = new Map<string, Player>();
  const conductors = new Set<WebSocket>();

  const http = createHttpServer((req, res) => void handleHttp(req, res));
  const wss = new WebSocketServer({ server: http, path: WS_PATH, perMessageDeflate: false });

  function send(ws: WebSocket | null | undefined, msg: ServerMessage): void {
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  function everyone(): WebSocket[] {
    return [...conductors, ...[...players.values()].flatMap((p) => (p.ws ? [p.ws] : []))];
  }

  function broadcastState(): void {
    const msg = JSON.stringify({ t: 'state', state } satisfies ServerMessage);
    for (const ws of everyone()) if (ws.readyState === ws.OPEN) ws.send(msg);
  }

  function roster(): PlayerInfo[] {
    return [...players.values()].map((p) => ({
      id: p.id,
      connected: !!p.ws,
      lastSeen: p.lastSeen,
      remoteAddress: p.remoteAddress,
      stats: p.stats,
      trimMs: p.trimMs,
      holding: allocator.holding(p.id),
    }));
  }

  /** devices that can play right now: connected, tapped in, clock locked */
  function eligible(): string[] {
    return [...players.values()].filter((p) => p.ws && p.stats?.clock.ready).map((p) => p.id);
  }

  function sendTo(ids: readonly string[], msg: ServerMessage): void {
    for (const id of ids) send(players.get(id)?.ws, msg);
  }

  /** tell each player its place in the metronome rotation, when it changes */
  function updateSeats(): void {
    const order = eligible().sort();
    for (const p of players.values()) {
      if (!p.ws) { seats.delete(p.id); continue; }
      const seat = { index: order.indexOf(p.id), count: order.length };
      const key = `${seat.index}/${seat.count}`;
      if (seats.get(p.id) === key) continue;
      seats.set(p.id, key);
      send(p.ws, { t: 'seat', ...seat });
    }
  }

  const rosterTimer = setInterval(() => {
    const t = now();
    for (const [id, p] of players) if (!p.ws && t - p.lastSeen > PLAYER_TTL_MS) players.delete(id);
    updateSeats();
    if (conductors.size === 0) return;
    const msg = JSON.stringify({ t: 'roster', players: roster(), serverTime: t } satisfies ServerMessage);
    for (const ws of conductors) if (ws.readyState === ws.OPEN) ws.send(msg);
  }, ROSTER_INTERVAL_MS);

  // Detect phones that vanished without closing (screen lock, walked out of wifi range).
  const alive = new WeakSet<WebSocket>();
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.has(ws)) { ws.terminate(); continue; }
      alive.delete(ws);
      ws.ping();
    }
  }, 10_000);

  wss.on('connection', (ws, req) => {
    alive.add(ws);
    ws.on('pong', () => alive.add(ws));
    const remoteAddress = req.socket.remoteAddress?.replace(/^::ffff:/, '') ?? '?';
    let role: 'player' | 'conductor' | null = null;
    let player: Player | null = null;

    ws.on('message', (data) => {
      // Timestamp first: anything before this counts against sync accuracy.
      const s1 = now();
      try {
        handle(data.toString(), s1);
      } catch (err) {
        // never let one message take the show down
        console.error('message handler failed:', err);
      }
    });

    function handle(data: string, s1: number): void {
      let msg: ClientMessage;
      try {
        msg = ClientMessage.parse(JSON.parse(data));
      } catch {
        send(ws, { t: 'error', message: 'bad message' });
        return;
      }
      if (player) player.lastSeen = s1;

      switch (msg.t) {
        case 'ping':
          send(ws, { t: 'pong', n: msg.n, c0: msg.c0, s1, s2: now() });
          return;

        case 'hello': {
          role = msg.role;
          if (role === 'conductor') {
            conductors.add(ws);
            send(ws, { t: 'welcome', id: 'conductor', role, serverTime: now(), state });
            return;
          }
          const id = msg.id && /^[\w-]{4,64}$/.test(msg.id) ? msg.id : randomUUID();
          const existing = players.get(id);
          if (existing?.ws && existing.ws !== ws) existing.ws.close(4000, 'replaced by newer connection');
          player = { id, ws, lastSeen: s1, remoteAddress, stats: existing?.stats ?? null, trimMs: existing?.trimMs ?? 0 };
          players.set(id, player);
          seats.delete(id); // new socket: resend its seat
          send(ws, { t: 'welcome', id, role, serverTime: now(), state });
          if (player.trimMs) send(ws, { t: 'trim', ms: player.trimMs });
          return;
        }

        case 'report': {
          if (!player) return;
          const wasReady = player.stats?.clock.ready;
          player.stats = msg.stats;
          if (!wasReady && msg.stats.clock.ready) updateSeats(); // join the rotation right away
          return;
        }
      }

      if (role !== 'conductor') {
        send(ws, { t: 'error', message: `${msg.t} is conductor-only` });
        return;
      }

      switch (msg.t) {
        case 'transport':
          state.transport =
            msg.action === 'start'
              ? startTransport(state.transport, now(), state.playoutMs + START_LEAD_MS)
              : { ...state.transport, running: false };
          broadcastState();
          return;
        case 'tempo':
          state.transport = retempo(state.transport, msg.bpm, now(), state.playoutMs);
          broadcastState();
          return;
        case 'playout':
          state.playoutMs = msg.ms;
          broadcastState();
          return;
        case 'patch':
          state.patch = { ...state.patch, ...msg.patch };
          broadcastState();
          return;
        case 'distribution':
          state.distribution = msg.mode;
          broadcastState();
          return;
        case 'metronome':
          state.metronome = { ...state.metronome, ...msg.metronome };
          broadcastState();
          return;
        case 'noteOn': {
          // a re-used id means the old note is over
          const prev = allocator.noteOff(msg.note);
          if (prev) sendTo(prev.targets, { t: 'cue', at: Math.max(prev.at, s1 + MIN_LEAD_MS), cue: { kind: 'noteOff', note: msg.note } });
          const at = Math.max(msg.at ?? s1 + state.playoutMs, s1 + MIN_LEAD_MS);
          const targets = allocator.noteOn(msg.note, at, state.distribution, eligible());
          sendTo(targets, { t: 'cue', at, cue: { kind: 'noteOn', note: msg.note, midi: msg.midi, velocity: msg.velocity } });
          return;
        }
        case 'noteOff': {
          const held = allocator.noteOff(msg.note);
          if (!held) return;
          const at = Math.max(msg.at ?? s1 + state.playoutMs, s1 + MIN_LEAD_MS, held.at);
          sendTo(held.targets, { t: 'cue', at, cue: { kind: 'noteOff', note: msg.note } });
          return;
        }
        case 'panic':
          allocator.clear();
          state.transport = { ...state.transport, running: false };
          for (const p of players.values()) send(p.ws, { t: 'panic' });
          broadcastState();
          return;
        case 'trim': {
          const p = players.get(msg.id);
          if (!p) return;
          p.trimMs = msg.ms;
          send(p.ws, { t: 'trim', ms: msg.ms });
          return;
        }
        case 'cue': {
          const at = msg.at ?? s1 + state.playoutMs;
          const targets =
            msg.target === 'all'
              ? [...players.values()]
              : msg.target.flatMap((id) => players.get(id) ?? []);
          for (const p of targets) send(p.ws, { t: 'cue', at, cue: msg.cue });
          return;
        }
      }
    }

    ws.on('close', () => {
      conductors.delete(ws);
      if (player && player.ws === ws) {
        player.ws = null;
        player.lastSeen = now();
      }
    });
  });

  async function handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/api/info') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ addresses: lanAddresses(), port: opts.port }));
      return;
    }
    if (!opts.staticDir) {
      res.writeHead(404).end('not found (in dev, the web app is served by Vite)');
      return;
    }
    const rel = url.pathname === '/' ? 'index.html' : url.pathname === '/conduct' ? 'conduct.html' : url.pathname;
    const file = normalize(join(opts.staticDir, rel));
    if (!file.startsWith(normalize(opts.staticDir))) {
      res.writeHead(403).end();
      return;
    }
    try {
      if (!(await stat(file)).isFile()) throw new Error();
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end('not found');
    }
  }

  await new Promise<void>((resolve) => http.listen(opts.port, opts.host ?? '0.0.0.0', resolve));
  const address = http.address();
  const port = typeof address === 'object' && address ? address.port : opts.port;

  return {
    port,
    state,
    players,
    async close() {
      clearInterval(rosterTimer);
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};
