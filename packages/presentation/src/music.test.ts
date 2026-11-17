import { describe, expect, test } from 'vitest';
import { frequencyOf, notesBetween, type Theme } from './music';

const THEME: Theme = {
  tempo: 60,
  root: 69,
  // A minor pentatonic: A, C, D, E, G.
  scale: [0, 3, 5, 7, 10],
  moods: {
    calm: {
      voices: [
        { wave: 'sine', gain: 0.2, notes: [0, null, null, null], length: 4, octave: -1 },
        { wave: 'triangle', gain: 0.1, notes: [null, 2, null, 4, null, null, 7, null], length: 2 },
      ],
    },
    quiet: { voices: [] },
  },
  mood: () => 'calm',
};

describe('the music (stage 5b)', () => {
  test('a degree of the scale, in Hz: the root is 440, a degree past the scale is the next octave’s, equal temperament', () => {
    expect(frequencyOf(THEME, 0)).toBe(440);
    expect(frequencyOf(THEME, 5)).toBe(880);
    expect(frequencyOf(THEME, 0, -1)).toBe(220);
    // C, three semitones up: 440 · 2^(3/12).
    expect(frequencyOf(THEME, 1)).toBeCloseTo(523.2511, 3);
    expect(frequencyOf(THEME, 7)).toBeCloseTo(2 * frequencyOf(THEME, 2), 9);
    expect(frequencyOf(THEME, -1)).toBeCloseTo(frequencyOf(THEME, 4) / 2, 9);
  });

  test('what a mood plays between two beats: each voice’s notes, round and round, each as long as it says', () => {
    const notes = notesBetween(THEME, 'calm', 0, 8);
    expect(notes.map((n) => [n.beat, Math.round(n.frequency)])).toEqual([
      [0, 220],
      [4, 220],
      [1, 587],
      // G (degree 4), and D an octave up (degree 7: 5 + 2).
      [3, 784],
      [6, 1175],
    ]);
    expect(notes[0]!.seconds).toBe(4);
    expect(notes[2]!.seconds).toBe(2);
    // The same beats again, the same notes: a test can hear it without a speaker.
    expect(notesBetween(THEME, 'calm', 8, 16).map((n) => n.beat - 8)).toEqual(notes.map((n) => n.beat));
    // A beat not whole starts at the next one; the end is not included.
    expect(notesBetween(THEME, 'calm', 0.5, 4).map((n) => n.beat)).toEqual([1, 3]);
  });

  test('a mood with no voices, or one it does not have, is silence', () => {
    expect(notesBetween(THEME, 'quiet', 0, 100)).toEqual([]);
    expect(notesBetween(THEME, 'nowhere', 0, 100)).toEqual([]);
  });
});
