import { describe, expect, it } from 'vitest';
import { Allocator } from '../src/allocator.ts';

const phones = ['a', 'b', 'c'];

describe('Allocator', () => {
  it('all: every device gets every note', () => {
    const a = new Allocator();
    expect(a.noteOn(1, 0, 'all', phones)).toEqual(['a', 'b', 'c']);
    expect(a.noteOff(1)?.targets).toEqual(['a', 'b', 'c']);
  });

  it('round-robin: a chord spreads one note per device', () => {
    const a = new Allocator();
    const chord = [1, 2, 3].map((n) => a.noteOn(n, 0, 'round-robin', phones)[0]);
    expect(new Set(chord).size).toBe(3);
  });

  it('round-robin: single notes rotate even when nothing is held', () => {
    const a = new Allocator();
    const seq: string[] = [];
    for (let n = 0; n < 6; n++) {
      seq.push(a.noteOn(n, 0, 'round-robin', phones)[0]!);
      a.noteOff(n);
    }
    expect(seq).toEqual(['a', 'b', 'c', 'a', 'b', 'c']);
  });

  it('round-robin: skips devices that are busy', () => {
    const a = new Allocator();
    a.noteOn(1, 0, 'round-robin', phones); // a
    a.noteOn(2, 0, 'round-robin', phones); // b
    a.noteOff(1); // a free again; cursor is at c
    expect(a.noteOn(3, 0, 'round-robin', phones)).toEqual(['c']);
    expect(a.noteOn(4, 0, 'round-robin', phones)).toEqual(['a']); // b still busy
  });

  it('round-robin: doubles up when every device is busy', () => {
    const a = new Allocator();
    for (let n = 0; n < 3; n++) a.noteOn(n, 0, 'round-robin', phones);
    expect(a.noteOn(9, 0, 'round-robin', phones)).toHaveLength(1);
    expect(a.holding('a') + a.holding('b') + a.holding('c')).toBe(4);
  });

  it('noteOff returns the start time and forgets the note', () => {
    const a = new Allocator();
    a.noteOn(5, 1234, 'all', phones);
    expect(a.noteOff(5)?.at).toBe(1234);
    expect(a.noteOff(5)).toBeNull();
  });

  it('no eligible devices: nothing is held', () => {
    const a = new Allocator();
    expect(a.noteOn(1, 0, 'round-robin', [])).toEqual([]);
    expect(a.isHeld(1)).toBe(false);
  });
});
