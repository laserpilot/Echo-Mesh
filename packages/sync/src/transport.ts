/**
 * Shared musical time. Instead of the server ticking every beat over the
 * network, everyone receives the same anchor and derives beat times locally —
 * no per-beat messages, no accumulated interval jitter.
 *
 * Beat `b` happens at server time: anchorTime + (b - anchorBeat) * 60000 / bpm
 */
export interface Transport {
  running: boolean;
  bpm: number;
  /** server time (ms) at which `anchorBeat` falls */
  anchorTime: number;
  anchorBeat: number;
  /** first beat that sounds after a start (lets a retempo keep the count) */
  startBeat: number;
  beatsPerBar: number;
}

export const DEFAULT_TRANSPORT: Transport = {
  running: false,
  bpm: 120,
  anchorTime: 0,
  anchorBeat: 0,
  startBeat: 0,
  beatsPerBar: 4,
};

export function beatDuration(t: Transport): number {
  return 60_000 / t.bpm;
}

export function timeOfBeat(t: Transport, beat: number): number {
  return t.anchorTime + (beat - t.anchorBeat) * beatDuration(t);
}

/** fractional beat position at a server time */
export function beatAt(t: Transport, time: number): number {
  return t.anchorBeat + (time - t.anchorTime) / beatDuration(t);
}

/** integer beats b with from <= timeOfBeat(b) < to */
export function beatsBetween(t: Transport, from: number, to: number): number[] {
  if (!t.running || to <= from) return [];
  const out: number[] = [];
  for (let b = Math.ceil(beatAt(t, from) - 1e-9) + 0; timeOfBeat(t, b) < to; b++) {
    if (b >= t.startBeat) out.push(b);
  }
  return out;
}

/** start so that beat 0 lands `leadMs` from now */
export function startTransport(t: Transport, serverNow: number, leadMs: number): Transport {
  return { ...t, running: true, anchorBeat: 0, startBeat: 0, anchorTime: serverNow + leadMs };
}

/**
 * Change tempo without a hiccup: the new tempo takes effect on the first
 * whole beat that's at least `leadMs` away, so every device (which may hear
 * about the change up to `leadMs` late) switches on the same beat.
 */
export function retempo(t: Transport, bpm: number, serverNow: number, leadMs: number): Transport {
  if (!t.running) return { ...t, bpm };
  const beat = Math.max(t.anchorBeat, Math.ceil(beatAt(t, serverNow + leadMs)));
  return { ...t, bpm, anchorBeat: beat, anchorTime: timeOfBeat(t, beat) };
}

/**
 * A device's view of the transport over time. When a tempo change arrives,
 * beats before the change point must still use the old tempo (they may not
 * have been scheduled yet), so we keep the previous segment around.
 */
export class TransportTimeline {
  #segments: Transport[] = [];

  get current(): Transport {
    return this.#segments.at(-1) ?? DEFAULT_TRANSPORT;
  }

  apply(next: Transport): void {
    const prev = this.#segments.at(-1);
    const continues =
      prev?.running && next.running && next.startBeat === prev.startBeat && next.anchorTime >= prev.anchorTime;
    this.#segments = continues ? [prev, next] : [next];
  }

  beatsBetween(from: number, to: number): { beat: number; time: number }[] {
    const out: { beat: number; time: number }[] = [];
    this.#segments.forEach((seg, i) => {
      const start = i === 0 ? from : Math.max(from, seg.anchorTime);
      const end = this.#segments[i + 1]?.anchorTime ?? Infinity;
      for (const beat of beatsBetween(seg, start, Math.min(to, end))) {
        out.push({ beat, time: timeOfBeat(seg, beat) });
      }
    });
    return out;
  }
}
