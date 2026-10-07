import { describe, expect, it } from 'vitest';
import { LiveNotes } from './live-notes.ts';
import { parseMidi } from './midi-parse.ts';

function setup() {
  const sent: { t: string; note: number; midi?: number; at?: number }[] = [];
  const notes = new LiveNotes((m) => sent.push(m), (local) => (local === undefined ? 1000 : local + 5000));
  const ons = () => sent.filter((m) => m.t === 'noteOn');
  const offs = () => sent.filter((m) => m.t === 'noteOff');
  return { notes, sent, ons, offs };
}

describe('LiveNotes', () => {
  it('press and release send a matching pair', () => {
    const { notes, ons, offs } = setup();
    notes.down(60);
    notes.up(60);
    expect(ons()).toHaveLength(1);
    expect(offs()).toHaveLength(1);
    expect(offs()[0]!.note).toBe(ons()[0]!.note);
    expect(notes.sounding.size).toBe(0);
  });

  it('ignores a second press of a held key (key repeat, two inputs)', () => {
    const { notes, ons } = setup();
    notes.down(60);
    notes.down(60);
    expect(ons()).toHaveLength(1);
  });

  it('sustain keeps released notes sounding until the pedal lifts', () => {
    const { notes, offs } = setup();
    notes.sustain(true);
    notes.down(60);
    notes.down(64);
    notes.up(60);
    notes.up(64);
    expect(offs()).toHaveLength(0);
    expect([...notes.sounding]).toEqual([60, 64]);
    notes.down(67); // still held when the pedal lifts
    notes.sustain(false);
    expect(offs()).toHaveLength(2);
    expect([...notes.sounding]).toEqual([67]);
  });

  it('re-striking a sustained note retriggers it with a new id', () => {
    const { notes, ons, offs } = setup();
    notes.sustain(true);
    notes.down(60);
    notes.up(60);
    notes.down(60);
    expect(ons()).toHaveLength(2);
    expect(offs()).toHaveLength(1);
    expect(offs()[0]!.note).toBe(ons()[0]!.note);
    expect(ons()[1]!.note).not.toBe(ons()[0]!.note);
  });

  it('stamps with the event time when given', () => {
    const { notes, ons } = setup();
    notes.down(60, 1, 123);
    expect(ons()[0]!.at).toBe(5123);
  });

  it('releaseAll ends everything, held or sustained', () => {
    const { notes, offs } = setup();
    notes.sustain(true);
    notes.down(60);
    notes.up(60);
    notes.down(62);
    notes.releaseAll();
    expect(offs()).toHaveLength(2);
    expect(notes.sounding.size).toBe(0);
    expect(notes.pedal).toBe(false);
  });

  it('reset forgets without sending', () => {
    const { notes, sent } = setup();
    notes.down(60);
    notes.reset();
    notes.up(60);
    expect(sent).toHaveLength(1);
  });
});

describe('parseMidi', () => {
  it('decodes notes, velocity and channel', () => {
    expect(parseMidi([0x93, 60, 127])).toEqual({ type: 'noteOn', channel: 3, midi: 60, velocity: 1 });
    expect(parseMidi([0x80, 60, 40])).toEqual({ type: 'noteOff', channel: 0, midi: 60 });
  });

  it('treats noteOn with velocity 0 as noteOff', () => {
    expect(parseMidi([0x90, 60, 0])).toEqual({ type: 'noteOff', channel: 0, midi: 60 });
  });

  it('decodes the sustain pedal and all-notes-off', () => {
    expect(parseMidi([0xb0, 64, 127])).toEqual({ type: 'sustain', channel: 0, on: true });
    expect(parseMidi([0xb0, 64, 0])).toEqual({ type: 'sustain', channel: 0, on: false });
    expect(parseMidi([0xb0, 123, 0])).toEqual({ type: 'allNotesOff', channel: 0 });
  });

  it('ignores clock, other CCs and junk', () => {
    expect(parseMidi([0xf8])).toBeNull();
    expect(parseMidi([0xb0, 1, 64])).toBeNull();
    expect(parseMidi([0x40])).toBeNull();
    expect(parseMidi([])).toBeNull();
  });
});
