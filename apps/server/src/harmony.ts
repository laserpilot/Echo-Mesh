import type { Harmony, HarmonySettings, Transport } from '@echo/protocol';
import { beatAt } from '@echo/sync';

/** first bar line at or after `serverTime` (bars count from beat 0) */
export function nextBarBeat(t: Transport, serverTime: number): number {
  const b = Math.max(t.startBeat, beatAt(t, serverTime));
  return Math.ceil(b / t.beatsPerBar - 1e-9) * t.beatsPerBar + 0; // + 0: no -0
}

/**
 * Apply an edit to the progression loop so every phone switches together.
 *
 * - Transport stopped: applies immediately, progression starts at beat 0.
 * - New steps, or starting playback: the loop restarts on the next bar.
 * - Other edits (key, pattern, …): take effect on the next bar, loop position kept.
 * - Stopping: on the next beat, so it doesn't feel laggy.
 *
 * @param earliest server time by which every phone will have heard about it
 */
export function editHarmony(cur: Harmony, edit: Partial<HarmonySettings>, t: Transport, earliest: number): Harmony {
  const next = { ...cur, ...edit, arp: { ...cur.arp, ...edit.arp } };
  if (!t.running) return { ...next, anchorBeat: 0, fromBeat: 0 };

  const bar = nextBarBeat(t, earliest);
  const starting = next.playing && !cur.playing;
  if (!next.playing && cur.playing) {
    return { ...next, fromBeat: Math.ceil(Math.max(t.startBeat, beatAt(t, earliest)) - 1e-9) };
  }
  if (starting || edit.steps) return { ...next, anchorBeat: bar, fromBeat: bar };
  return { ...next, fromBeat: bar };
}

/** after the transport (re)starts at beat 0, a playing loop starts with it */
export function onTransportStart(h: Harmony): Harmony {
  return { ...h, anchorBeat: 0, fromBeat: 0 };
}
