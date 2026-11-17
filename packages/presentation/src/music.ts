import type { VariableInfo } from '@manifold/commands';
import type { Entity, World } from '@manifold/core';
import type { GamePage, Piece } from './page';

/** What the music lets people change, as data (the site's console reference reads it). */
export const MUSIC_VARIABLES = {
  music: {
    name: 'view.music',
    description:
      "How loud the game's music is, from 0 (none) to 1 (stage 5b, decision 0027): made in the browser as the sounds are, sparse, following what happens. At first half the sounds' (music accompanies; the sounds tell what happens).",
    scope: 'view',
    type: { kind: 'number', min: 0, max: 1 },
    default: 0.3,
  },
} as const satisfies Record<string, VariableInfo>;

/**
 * A voice of a theme: one note a beat at most, each a degree of the theme's scale (0 its root, the
 * scale's length an octave up) or `null`, silence; its notes go round again when they end. Each note
 * lasts `length` beats, coming in softly and dying away over them.
 */
export interface Voice {
  wave: OscillatorType;
  /** How loud it is (0 to 1). */
  gain: number;
  notes: readonly (number | null)[];
  length: number;
  /** Octaves above (or below) the root. */
  octave?: number;
}

/** A mood of a theme: its voices, playing together (none: silence). */
export interface Mood {
  voices: readonly Voice[];
}

/**
 * A GAME'S THEME (stage 5b, decision 0027): a few voices of oscillators in a scale, at a tempo, in a
 * few moods; which mood plays is the game's to say from what the presentation reads (calm while
 * climbing, quiet at the end). Data and a pure function (`notesBetween`): a test can hear it without
 * a speaker.
 */
export interface Theme {
  /** Beats a minute. */
  tempo: number;
  /** Its root, as a MIDI note (69 is the A of 440 Hz). */
  root: number;
  /** Its scale: the semitones of each degree above the root, from 0. */
  scale: readonly number[];
  moods: Readonly<Record<string, Mood>>;
  /** Which mood plays now (one of `moods`), from the world as the presentation reads it. */
  mood(world: World, hero: Entity | undefined): string;
}

/** A note to play: at which beat, how high (Hz), how long (s), how loud, with which wave. */
export interface Note {
  beat: number;
  frequency: number;
  seconds: number;
  gain: number;
  wave: OscillatorType;
}

/**
 * How high a degree of the theme's scale is (Hz), so many octaves up: a degree past the scale is the
 * next octave's (with a scale of 5, degree 7 is degree 2 an octave up). Equal temperament: 440 Hz times
 * 2 to the twelfth of the semitones from the A.
 */
export function frequencyOf(theme: Pick<Theme, 'root' | 'scale'>, degree: number, octave = 0): number {
  const n = theme.scale.length;
  const semitones = theme.scale[((degree % n) + n) % n]! + 12 * (Math.floor(degree / n) + octave);
  return 440 * Math.pow(2, (theme.root + semitones - 69) / 12);
}

/** The notes a mood plays from beat `from` up to `to` (not included), voice by voice. */
export function notesBetween(theme: Theme, mood: string, from: number, to: number): Note[] {
  const notes: Note[] = [];
  const beatSeconds = 60 / theme.tempo;
  for (const voice of theme.moods[mood]?.voices ?? [])
    for (let beat = Math.ceil(from); beat < to; beat++) {
      const degree = voice.notes[beat % voice.notes.length];
      if (degree === null || degree === undefined) continue;
      notes.push({
        beat,
        frequency: frequencyOf(theme, degree, voice.octave ?? 0),
        seconds: voice.length * beatSeconds,
        gain: voice.gain,
        wave: voice.wave,
      });
    }
  return notes;
}

/** How far ahead notes are put in the audio clock (s): a frame late or a tab in the background does not cut them. */
const AHEAD = 0.4;

/**
 * THE MUSIC, PLAYED (stage 5b): the theme's notes put in the audio clock a little ahead, each an
 * oscillator through an envelope into the mixer's music channel (`view.music`). The mood is read every
 * frame; a new one starts at the next beat, and the notes already sounding die away on their own.
 * Before the first key or click (the browser's rule) nothing plays. (For the browser tests: the mood
 * playing, `data-music`, and how many notes it played, `data-notes`.)
 */
export function mountMusic(page: GamePage, theme: Theme): Piece {
  page.mixer.volume('music', Number(MUSIC_VARIABLES.music.default));
  page.registry.declareVariable({ ...MUSIC_VARIABLES.music, onChange: (v) => page.mixer.volume('music', Number(v)) });
  const beatSeconds = 60 / theme.tempo;
  /** When beat 0 was in the audio clock, and the next beat not yet put in it. */
  let zero: number | null = null;
  let next = 0;
  let played = 0;
  let mood = '';

  const play = (context: AudioContext, out: AudioNode, note: Note, at: number) => {
    const osc = context.createOscillator();
    osc.type = note.wave;
    osc.frequency.value = note.frequency;
    const envelope = context.createGain();
    // In softly over a fifth of it (at most half a second), and away over the rest.
    const rise = Math.min(0.5, note.seconds / 5);
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(note.gain, at + rise);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + note.seconds);
    osc.connect(envelope).connect(out);
    osc.start(at);
    osc.stop(at + note.seconds + 0.05);
  };

  return {
    frame({ world }) {
      const now = theme.mood(world, page.player());
      if (now !== mood) {
        mood = now;
        page.container.dataset.music = mood;
      }
      const context = page.mixer.context;
      const out = page.mixer.channel('music');
      if (!context || !out || context.state !== 'running') return;
      if (zero === null) zero = context.currentTime + 0.1;
      const until = (context.currentTime + AHEAD - zero) / beatSeconds;
      if (until <= next) return;
      for (const note of notesBetween(theme, mood, next, until)) {
        play(context, out, note, zero + note.beat * beatSeconds);
        played++;
      }
      next = Math.ceil(until);
      page.container.dataset.notes = String(played);
    },
  };
}
