import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { WS_PATH, type ClientMessage, type Cue, type ServerMessage, type SharedState } from '@echo/protocol';
import { ClockPinger, TransportTimeline } from '@echo/sync';
import { createServer } from '../src/server.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** exponential jitter plus occasional power-save stalls, like a phone on wifi */
function wifiDelay(mean: number): number {
  let d = 1 - mean * Math.log(1 - Math.random());
  if (Math.random() < 0.08) d += 30 + Math.random() * 120;
  return d;
}

/**
 * Delays like a jittery link but never reorders, as TCP guarantees:
 * each message is delivered no earlier than the one before it.
 */
function orderedLink(jitterMean: number) {
  // A FIFO drained by one timer: separate timers can fire out of order when
  // their due times round to the same millisecond.
  const queue: { at: number; fn: () => void }[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  const drain = () => {
    timer = null;
    while (queue.length && queue[0]!.at <= performance.now()) queue.shift()!.fn();
    if (queue.length) timer = setTimeout(drain, Math.max(0, queue[0]!.at - performance.now()));
  };
  return (fn: () => void) => {
    const at = Math.max(performance.now() + wifiDelay(jitterMean), queue.at(-1)?.at ?? 0);
    queue.push({ at, fn });
    timer ??= setTimeout(drain, Math.max(0, queue[0]!.at - performance.now()));
  };
}

/**
 * A fake phone: its own clock (offset from the server's by `trueOffset`),
 * and a network that delays both directions independently.
 */
class SimPhone {
  readonly ws: WebSocket;
  readonly pinger: ClockPinger;
  readonly timeline = new TransportTimeline();
  readonly cues: { at: number; receivedLocal: number; cue: Cue }[] = [];
  panics = 0;
  trimMs = 0;
  seat: { index: number; count: number } | null = null;
  state: SharedState | null = null;
  id = '';

  constructor(
    url: string,
    readonly trueOffset: number,
    readonly role: 'player' | 'conductor' = 'player',
    jitterMean = 4,
  ) {
    this.ws = new WebSocket(url);
    const up = orderedLink(jitterMean);
    const down = orderedLink(jitterMean);
    const send = (m: ClientMessage) => up(() => this.ws.send(JSON.stringify(m)));
    this.pinger = new ClockPinger({ now: () => this.now(), send: (n, c0) => send({ t: 'ping', n, c0 }) });
    this.send = send;
    this.ws.on('message', (data) => {
      down(() => this.#onMessage(JSON.parse(data.toString()) as ServerMessage));
    });
  }

  send: (m: ClientMessage) => void;

  /** local clock: server clock minus trueOffset */
  now(): number {
    return performance.now() - this.trueOffset;
  }

  async open(): Promise<void> {
    await new Promise((r) => this.ws.once('open', r));
    this.send({ t: 'hello', role: this.role });
    this.pinger.start();
  }

  #onMessage(m: ServerMessage): void {
    switch (m.t) {
      case 'welcome':
        this.id = m.id;
        this.state = m.state;
        this.timeline.apply(m.state.transport);
        break;
      case 'pong':
        this.pinger.handlePong(m);
        break;
      case 'state':
        this.state = m.state;
        this.timeline.apply(m.state.transport);
        break;
      case 'cue':
        this.cues.push({ at: m.at, receivedLocal: this.now(), cue: m.cue });
        break;
      case 'panic':
        this.panics++;
        break;
      case 'trim':
        this.trimMs = m.ms;
        break;
      case 'seat':
        this.seat = { index: m.index, count: m.count };
        break;
    }
  }

  /** tell the server we're tapped in and locked, like a real phone's 1 Hz report */
  report(): void {
    const c = this.pinger.estimate();
    this.send({
      t: 'report',
      stats: {
        clock: { ready: c.ready, offset: c.offset, uncertainty: c.uncertainty, minRtt: c.minRtt, driftPpm: c.driftPpm, samples: c.samples },
        audio: null,
        schedule: { scheduled: 0, late: 0, dropped: 0, worstLateMs: 0 },
        visible: true,
        ua: 'sim',
      },
    });
  }

  notes(kind: 'noteOn' | 'noteOff') {
    return this.cues.filter((c) => c.cue.kind === kind);
  }

  /** when (in TRUE server time) this phone would fire an event planned for server time `at` */
  trueFireTime(at: number): number {
    const local = this.pinger.toLocal(at);
    return local + this.trueOffset;
  }

  close(): void {
    this.pinger.stop();
    this.ws.close();
  }
}

describe('sync over real websockets', () => {
  let server: Awaited<ReturnType<typeof createServer>>;
  let url: string;
  const phones: SimPhone[] = [];
  let conductor: SimPhone;

  beforeAll(async () => {
    server = await createServer({ port: 0, host: '127.0.0.1' });
    url = `ws://127.0.0.1:${server.port}${WS_PATH}`;
    // wildly different clocks — phones' performance.now() starts at page load
    for (const off of [-3_600_000, -12_345.6, 0, 987.3, 42_000_000, 5]) phones.push(new SimPhone(url, off));
    conductor = new SimPhone(url, 77_777, 'conductor');
    await Promise.all([...phones, conductor].map((p) => p.open()));
    await sleep(4000); // initial burst + several steady-state pings
  }, 10_000);

  afterAll(async () => {
    for (const p of [...phones, conductor]) p.close();
    await server.close();
  });

  it('every device converges on the server clock', () => {
    for (const p of phones) {
      const est = p.pinger.estimate();
      expect(est.ready).toBe(true);
      // Node timers add up to ~1ms of their own jitter on top of the simulated network.
      expect(Math.abs(est.offset - p.trueOffset)).toBeLessThan(3);
    }
  });

  it('devices fire the same beat within a few ms of each other', () => {
    const target = performance.now() + 1000;
    const fires = phones.map((p) => p.trueFireTime(target));
    const spread = Math.max(...fires) - Math.min(...fires);
    if (process.env.SYNC_REPORT) {
      const errs = phones.map((p) => (p.pinger.estimate().offset - p.trueOffset).toFixed(2));
      console.log(`offset errors (ms): ${errs.join(', ')}\nfiring spread across ${phones.length} devices: ${spread.toFixed(2)} ms`);
    }
    expect(spread).toBeLessThan(5);
  });

  it('transport start reaches everyone and all agree on beat times', async () => {
    conductor.send({ t: 'transport', action: 'start' });
    await sleep(600);
    const t = server.state.transport;
    expect(t.running).toBe(true);
    for (const p of phones) {
      expect(p.timeline.current).toEqual(t);
      const beats = p.timeline.beatsBetween(t.anchorTime, t.anchorTime + 2000);
      expect(beats.map((b) => b.beat)).toEqual([0, 1, 2, 3]);
    }
  });

  it('cues arrive before their play time (playout delay covers the network)', async () => {
    conductor.send({ t: 'cue', target: 'all', cue: { kind: 'flash' } });
    await sleep(800);
    for (const p of phones) {
      const cue = p.cues.at(-1)!;
      expect(cue).toBeDefined();
      const leadMs = p.pinger.toLocal(cue.at) - cue.receivedLocal;
      // stalls can eat into it, but the median phone should have plenty of margin
      expect(leadMs).toBeGreaterThan(-200);
    }
    const leads = phones.map((p) => p.pinger.toLocal(p.cues.at(-1)!.at) - p.cues.at(-1)!.receivedLocal).sort((a, b) => a - b);
    expect(leads[leads.length >> 1]).toBeGreaterThan(50);
  });

  it('cues survive disconnected players on the roster', async () => {
    const leaver = new SimPhone(url, 0);
    await leaver.open();
    await sleep(200);
    leaver.close();
    await sleep(200);
    expect(server.players.get(leaver.id)?.ws).toBeNull();
    const before = phones[0]!.cues.length;
    conductor.send({ t: 'cue', target: 'all', cue: { kind: 'flash' } });
    conductor.send({ t: 'cue', target: [leaver.id, phones[0]!.id], cue: { kind: 'flash' } });
    await sleep(500);
    expect(phones[0]!.cues.length).toBe(before + 2);
  });

  describe('live notes', () => {
    beforeAll(async () => {
      for (const p of phones) p.report();
      await sleep(300);
    });

    it('round-robin spreads a chord one note per device, and noteOffs follow their notes', async () => {
      conductor.send({ t: 'distribution', mode: 'round-robin' });
      const chord = [60, 64, 67];
      chord.forEach((midi, i) => conductor.send({ t: 'noteOn', note: 100 + i, midi, velocity: 0.8 }));
      await sleep(400);
      const holders = chord.map((_, i) => phones.filter((p) => p.notes('noteOn').some((c) => c.cue.kind === 'noteOn' && c.cue.note === 100 + i)));
      for (const h of holders) expect(h).toHaveLength(1);
      expect(new Set(holders.map((h) => h[0])).size).toBe(3);

      chord.forEach((_, i) => conductor.send({ t: 'noteOff', note: 100 + i }));
      await sleep(400);
      holders.forEach((h, i) => {
        const on = h[0]!.notes('noteOn').find((c) => c.cue.kind === 'noteOn' && c.cue.note === 100 + i)!;
        const off = h[0]!.notes('noteOff').find((c) => c.cue.kind === 'noteOff' && c.cue.note === 100 + i)!;
        expect(off).toBeDefined();
        expect(off.at).toBeGreaterThanOrEqual(on.at);
        // nobody else got that noteOff
        expect(phones.filter((p) => p.notes('noteOff').some((c) => c.cue.kind === 'noteOff' && c.cue.note === 100 + i))).toHaveLength(1);
      });
    });

    it('all: every device plays', async () => {
      conductor.send({ t: 'distribution', mode: 'all' });
      await sleep(100);
      conductor.send({ t: 'noteOn', note: 200, midi: 72, velocity: 1 });
      await sleep(400);
      for (const p of phones) expect(p.notes('noteOn').some((c) => c.cue.kind === 'noteOn' && c.cue.note === 200)).toBe(true);
      conductor.send({ t: 'noteOff', note: 200 });
    });

    it('conductor-stamped times are honoured (constant latency)', async () => {
      const at = conductor.pinger.serverNow() + 300;
      conductor.send({ t: 'noteOn', note: 300, midi: 60, velocity: 1, at });
      await sleep(400);
      const got = phones[0]!.notes('noteOn').find((c) => c.cue.kind === 'noteOn' && c.cue.note === 300)!;
      expect(Math.abs(got.at - at)).toBeLessThan(0.001);
      conductor.send({ t: 'noteOff', note: 300 });
    });

    it('panic reaches every device immediately and stops the transport', async () => {
      conductor.send({ t: 'transport', action: 'start' });
      await sleep(200);
      conductor.send({ t: 'panic' });
      await sleep(400);
      for (const p of phones) expect(p.panics).toBeGreaterThan(0);
      expect(server.state.transport.running).toBe(false);
    });

    it('trim reaches the device and survives a reconnect', async () => {
      const p = new SimPhone(url, 0);
      await p.open();
      await sleep(200);
      conductor.send({ t: 'trim', id: p.id, ms: 42 });
      await sleep(300);
      expect(p.trimMs).toBe(42);
      p.close();
      const again = new SimPhone(url, 0);
      await new Promise((r) => again.ws.once('open', r));
      again.send({ t: 'hello', role: 'player', id: p.id });
      await sleep(400);
      expect(again.trimMs).toBe(42);
      again.close();
    });

    it('every synced phone gets a distinct seat in the metronome rotation', async () => {
      await sleep(700);
      const seats = phones.map((p) => p.seat);
      for (const s of seats) expect(s?.count).toBe(phones.length);
      expect(new Set(seats.map((s) => s?.index)).size).toBe(phones.length);
      expect(seats.every((s) => s!.index >= 0)).toBe(true);
    });

    it('metronome settings are shared state', async () => {
      conductor.send({ t: 'metronome', metronome: { who: 'rotate', sound: 'note' } });
      await sleep(300);
      expect(phones[0]!.state?.metronome).toEqual({ sound: 'note', who: 'rotate', midi: 72 });
    });

    it('players cannot play notes', async () => {
      const before = phones[1]!.notes('noteOn').length;
      phones[0]!.send({ t: 'noteOn', note: 999, midi: 60, velocity: 1 });
      await sleep(300);
      expect(phones[1]!.notes('noteOn').length).toBe(before);
    });
  });

  it('rejects conductor commands from players', async () => {
    const before = server.state.playoutMs;
    phones[0]!.send({ t: 'playout', ms: 999 });
    await sleep(300);
    expect(server.state.playoutMs).toBe(before);
  });

  it('a reconnecting player keeps its id', async () => {
    const p = new SimPhone(url, 0);
    await p.open();
    await sleep(200);
    const id = p.id;
    p.close();
    const again = new SimPhone(url, 0);
    again.ws.once('open', () => again.send({ t: 'hello', role: 'player', id }));
    await new Promise((r) => again.ws.once('open', r));
    await sleep(200);
    expect(again.id).toBe(id);
    expect(server.players.get(id)?.ws).not.toBeNull();
    again.close();
  });
});
