/** Decoded MIDI channel messages we care about. */
export type MidiEvent =
  | { type: 'noteOn'; channel: number; midi: number; velocity: number }
  | { type: 'noteOff'; channel: number; midi: number }
  | { type: 'sustain'; channel: number; on: boolean }
  | { type: 'allNotesOff'; channel: number };

/**
 * Parse one MIDI message. Returns null for anything we ignore (clock,
 * active sensing, other CCs, sysex…).
 * Velocity is 0..1. A noteOn with velocity 0 is a noteOff, per the MIDI spec.
 */
export function parseMidi(data: ArrayLike<number>): MidiEvent | null {
  const status = data[0];
  if (status === undefined || status < 0x80 || status >= 0xf0) return null;
  const kind = status & 0xf0;
  const channel = status & 0x0f;
  const d1 = data[1] ?? 0;
  const d2 = data[2] ?? 0;
  switch (kind) {
    case 0x90:
      return d2 > 0
        ? { type: 'noteOn', channel, midi: d1, velocity: d2 / 127 }
        : { type: 'noteOff', channel, midi: d1 };
    case 0x80:
      return { type: 'noteOff', channel, midi: d1 };
    case 0xb0:
      if (d1 === 64) return { type: 'sustain', channel, on: d2 >= 64 };
      if (d1 === 120 || d1 === 123) return { type: 'allNotesOff', channel };
      return null;
    default:
      return null;
  }
}
