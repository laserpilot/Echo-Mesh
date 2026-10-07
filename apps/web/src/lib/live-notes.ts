import type { ClientMessage } from '@echo/protocol';

type NoteMessage = Extract<ClientMessage, { t: 'noteOn' | 'noteOff' }>;

/**
 * The conductor's playing state, shared by every input (computer keys, mouse,
 * MIDI). Turns key presses + sustain pedal into noteOn/noteOff messages.
 *
 * - A key held down sounds until released.
 * - With the pedal down, released keys keep sounding until the pedal lifts.
 * - Striking a note that's already sounding re-triggers it (new note id).
 */
export class LiveNotes {
  /** midi → id of the note currently sounding for it */
  readonly #ids = new Map<number, number>();
  /** keys physically held */
  readonly #down = new Set<number>();
  #pedal = false;
  #next = Math.floor(Math.random() * 1e6) * 1000;

  constructor(
    private readonly send: (m: NoteMessage) => void,
    /** server time for an event that happened at `localTime` (performance.now), or undefined if unsynced */
    private readonly stamp: (localTime?: number) => number | undefined,
    /** notes currently sounding, for display; mutated in place (pass a SvelteSet) */
    readonly sounding: Set<number> = new Set(),
  ) {}

  get pedal(): boolean {
    return this.#pedal;
  }

  down(midi: number, velocity = 0.8, localTime?: number): void {
    const at = this.stamp(localTime);
    const old = this.#ids.get(midi);
    if (old !== undefined) {
      if (this.#down.has(midi)) return; // key repeat / two inputs: already held
      this.send({ t: 'noteOff', note: old, at }); // re-strike a sustained note
    }
    const note = ++this.#next;
    this.#ids.set(midi, note);
    this.#down.add(midi);
    this.sounding.add(midi);
    this.send({ t: 'noteOn', note, midi, velocity, at });
  }

  up(midi: number, localTime?: number): void {
    if (!this.#down.delete(midi)) return;
    if (!this.#pedal) this.#off(midi, this.stamp(localTime));
  }

  sustain(on: boolean, localTime?: number): void {
    this.#pedal = on;
    if (on) return;
    const at = this.stamp(localTime);
    for (const midi of [...this.#ids.keys()]) if (!this.#down.has(midi)) this.#off(midi, at);
  }

  /** release everything (window lost focus, MIDI all-notes-off) */
  releaseAll(localTime?: number): void {
    const at = this.stamp(localTime);
    this.#down.clear();
    this.#pedal = false;
    for (const midi of [...this.#ids.keys()]) this.#off(midi, at);
  }

  /** forget everything without sending (the server already silenced it: panic) */
  reset(): void {
    this.#ids.clear();
    this.#down.clear();
    this.#pedal = false;
    this.sounding.clear();
  }

  #off(midi: number, at: number | undefined): void {
    const note = this.#ids.get(midi);
    if (note === undefined) return;
    this.#ids.delete(midi);
    this.sounding.delete(midi);
    this.send({ t: 'noteOff', note, at });
  }
}
