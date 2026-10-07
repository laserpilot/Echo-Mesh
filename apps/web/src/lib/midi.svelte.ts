import { parseMidi, type MidiEvent } from './midi-parse.ts';

export interface MidiPort {
  id: string;
  name: string;
}

/**
 * Web MIDI input with hot-plugging. Chrome and Edge only (Safari and Firefox
 * don't ship Web MIDI). Every connected input is listened to; `selected`
 * narrows it to one.
 */
export class MidiInput {
  readonly supported = typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
  status = $state<'unsupported' | 'off' | 'denied' | 'ready'>('off');
  inputs = $state<MidiPort[]>([]);
  selected = $state<string>('all');
  /** bumps on every message, for an activity light */
  activity = $state(0);

  #access: MIDIAccess | null = null;

  /** `timeStamp` is the event's arrival time on the performance.now() clock */
  constructor(private readonly onEvent: (e: MidiEvent, timeStamp: number) => void) {
    if (!this.supported) this.status = 'unsupported';
  }

  /** enable without a prompt if the user already granted access before */
  async autoEnable(): Promise<void> {
    if (!this.supported) return;
    try {
      const p = await navigator.permissions.query({ name: 'midi' as PermissionName });
      if (p.state === 'granted') await this.enable();
    } catch {
      // permissions API doesn't know 'midi' here; wait for the button
    }
  }

  async enable(): Promise<void> {
    if (!this.supported || this.#access) return;
    try {
      this.#access = await navigator.requestMIDIAccess({ sysex: false });
    } catch {
      this.status = 'denied';
      return;
    }
    this.status = 'ready';
    this.#access.onstatechange = () => this.#refresh();
    this.#refresh();
  }

  #refresh(): void {
    const access = this.#access;
    if (!access) return;
    const ports: MidiPort[] = [];
    access.inputs.forEach((input) => {
      if (input.state !== 'connected') return;
      ports.push({ id: input.id, name: input.name ?? 'MIDI input' });
      input.onmidimessage = (e) => {
        if (!e.data || (this.selected !== 'all' && this.selected !== input.id)) return;
        const ev = parseMidi(e.data);
        if (!ev) return;
        this.activity++;
        this.onEvent(ev, e.timeStamp);
      };
    });
    this.inputs = ports;
    if (this.selected !== 'all' && !ports.some((p) => p.id === this.selected)) this.selected = 'all';
  }
}
