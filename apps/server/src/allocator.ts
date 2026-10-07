import type { Distribution } from '@echo/protocol';

interface Held {
  targets: string[];
  /** server time the note starts; its noteOff can never be earlier */
  at: number;
}

/**
 * Decides which devices play each live note, and remembers so the matching
 * noteOff goes to the same devices.
 *
 * - all: every device plays every note (a big unison).
 * - round-robin: one device per note, preferring devices that aren't already
 *   holding a note, so a chord spreads out across the room — one voice per phone.
 */
export class Allocator {
  readonly #held = new Map<number, Held>();
  #cursor = 0;

  noteOn(note: number, at: number, mode: Distribution, eligible: readonly string[]): string[] {
    if (eligible.length === 0) return [];
    const ids = [...eligible].sort();
    let targets: string[];
    if (mode === 'all') {
      targets = ids;
    } else {
      const busy = new Set([...this.#held.values()].flatMap((h) => h.targets));
      const start = this.#cursor % ids.length;
      let pick = -1;
      for (let i = 0; i < ids.length; i++) {
        const j = (start + i) % ids.length;
        if (!busy.has(ids[j]!)) { pick = j; break; }
      }
      if (pick < 0) pick = start; // everyone busy: double up on the next in turn
      targets = [ids[pick]!];
      this.#cursor = pick + 1;
    }
    this.#held.set(note, { targets, at });
    return targets;
  }

  /** the devices holding `note` and when it started, forgetting it */
  noteOff(note: number): Held | null {
    const h = this.#held.get(note) ?? null;
    this.#held.delete(note);
    return h;
  }

  isHeld(note: number): boolean {
    return this.#held.has(note);
  }

  holding(id: string): number {
    let n = 0;
    for (const h of this.#held.values()) if (h.targets.includes(id)) n++;
    return n;
  }

  clear(): void {
    this.#held.clear();
  }
}
