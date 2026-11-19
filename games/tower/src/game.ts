import characters from '@manifold/character/assets';
import { STEP } from '@manifold/core';
import kit from '@manifold/kit/assets';
import { timeIn, type Hud, type Theme, type Voice, type Words } from '@manifold/presentation';
import type { Game } from '@manifold/shell';
import { mountFinale } from './finale';
import { runner } from './rules';
import { TOWER_CARTRIDGE, TOWER_LEVEL_LIST, towerDone } from './cartridge';

/** ITS WORDS (decision 0019). The thread's lines are a first draft: 5d writes them with the tower. */
export const TOWER_WORDS = {
  es: {
    'tower.title': 'La torre',
    'tower.tagline': 'Subí a lo alto de la torre antes de que caiga la noche.',
    'tower.floor.1': 'La entrada',
    'tower.floor.2': 'El primer piso',
    'tower.floor.3': 'El segundo piso',
    'tower.floor.4': 'El tercer piso',
    'tower.floor.5': 'El cuarto piso',
    'tower.floor.6': 'La cima',
    'tower.who.keeper': 'La guardiana',
    'tower.open.1': 'El sol ya toca las colinas. Arriba de la torre se ve toda la tierra de la ciudadela.',
    'tower.open.2': 'Si querés verla con la última luz, subí ahora.',
    'tower.end.1': 'Llegaste con lo último del día.',
    'tower.end.2': 'Allá, la fortaleza prende sus faroles. Esta noche va a ser larga.',
    'tower.hud.time': 'Tiempo',
    'tower.hud.falls': 'Caídas',
    'tower.hud.stars': 'Estrellas',
    'tower.fell': 'Te caíste: de vuelta al punto de control',
    'tower.checkpoint': 'Punto de control',
    'tower.star': {
      by: 1,
      '=0': { by: 0, one: 'Una estrella: la última, y era la única', other: 'Una estrella: la última, ya son {0}' },
      one: { by: 0, one: 'Una estrella: {0} tomada, queda {1}', other: 'Una estrella: {0} tomadas, queda {1}' },
      other: { by: 0, one: 'Una estrella: {0} tomada, quedan {1}', other: 'Una estrella: {0} tomadas, quedan {1}' },
    },
  },
  en: {
    'tower.title': 'The tower',
    'tower.tagline': 'Climb to the top of the tower before night falls.',
    'tower.floor.1': 'The entrance',
    'tower.floor.2': 'The first floor',
    'tower.floor.3': 'The second floor',
    'tower.floor.4': 'The third floor',
    'tower.floor.5': 'The fourth floor',
    'tower.floor.6': 'The top',
    'tower.who.keeper': 'The keeper',
    'tower.open.1': 'The sun already touches the hills. From the top of the tower you see all the citadel’s land.',
    'tower.open.2': 'If you want to see it in the last light, climb now.',
    'tower.end.1': 'You made it with the last of the day.',
    'tower.end.2': 'Over there, the fortress lights its lanterns. Tonight will be long.',
    'tower.hud.time': 'Time',
    'tower.hud.falls': 'Falls',
    'tower.hud.stars': 'Stars',
    'tower.fell': 'you fell: back to the checkpoint',
    'tower.checkpoint': 'checkpoint',
    'tower.star': {
      by: 1,
      '=0': { by: 0, one: 'a star: the last, and the only one', other: 'a star: the last, {0} in all' },
      other: 'a star: {0} taken, {1} left',
    },
  },
} as const satisfies Words;

/** What its HUD shows: the time on this floor, its falls, the stars found. */
export const towerHud: Hud = ({ world, hero, say, language }) => {
  const run = hero && runner(hero);
  if (!run) return [];
  const seconds = ((run.finish >= 0 ? run.finish : world.tick) - run.start) * STEP;
  return [
    { label: say('tower.hud.time'), value: timeIn(language, seconds) },
    { label: say('tower.hud.falls'), value: String(run.falls) },
    { label: say('tower.hud.stars'), value: String(run.stars) },
  ];
};

/**
 * ITS MUSIC (decision 0027): a theme at dusk. A low drone that changes every 16 beats and three notes
 * over it in 32, in A minor pentatonic, slow; mostly silence. (Stage 5p, decision 0031: "music that adds a
 * layer per floor and resolves at the top") Each floor up adds a layer, on the beats the others already
 * sound (it grows richer, not busier: at most a beat in five begins a note): a low pulse, a high line, a
 * second voice; on the top, a high bell. Done on the top, it resolves: the root, its fifth and its octave,
 * held. Quiet once a lower floor is done.
 */
/** So many beats of silence. */
const rest = (beats: number): null[] => Array<null>(beats).fill(null);

/** The layers, from the first floor's up (each floor plays those up to its own). */
const LAYERS: readonly Voice[] = [
  // The drone: the root for 16 beats, then the fourth for 16 (each fading over 12).
  { wave: 'sine', gain: 0.16, notes: [0, ...rest(15), 3, ...rest(15)], length: 12 },
  // Three notes over it in 32 beats, two octaves up.
  { wave: 'triangle', gain: 0.05, octave: 2, notes: [...rest(4), 4, ...rest(5), 2, ...rest(11), 3, ...rest(9)], length: 4 },
  // (5p) A low pulse with the drone, an octave under.
  { wave: 'sine', gain: 0.07, octave: -1, notes: [0, ...rest(15), 3, ...rest(15)], length: 6 },
  // (5p) A high line on the three notes' beats.
  { wave: 'sine', gain: 0.025, octave: 3, notes: [...rest(4), 2, ...rest(17), 4, ...rest(9)], length: 3 },
  // (5p) A second voice, and a note of its own near the end of the 32.
  { wave: 'triangle', gain: 0.035, octave: 1, notes: [...rest(10), 3, ...rest(17), 1, ...rest(3)], length: 5 },
];
/** The top's bell (stage 5d), as the light goes: the drone's two notes in 32 beats, high. */
const BELL: Voice = { wave: 'sine', gain: 0.03, octave: 3, notes: [7, ...rest(15), 5, ...rest(15)], length: 6 };

/** Each floor's sky (its hour), from the first's: the mood a floor plays is the layers up to its own. */
const FLOOR_SKIES = [18.6, 19.0, 19.35, 19.45, 19.55, 19.7];

export const TOWER_THEME: Theme = {
  tempo: 56,
  // A, two octaves under the 440 Hz one.
  root: 45,
  scale: [0, 3, 5, 7, 10],
  moods: {
    'floor-1': { voices: LAYERS.slice(0, 1) },
    'floor-2': { voices: LAYERS.slice(0, 2) },
    'floor-3': { voices: LAYERS.slice(0, 3) },
    'floor-4': { voices: LAYERS.slice(0, 4) },
    'floor-5': { voices: LAYERS.slice(0, 5) },
    top: { voices: [...LAYERS, BELL] },
    // (5p) The top done: the root, its fifth an octave up and the octave over that, held, once in 32 beats.
    resolve: {
      voices: [
        { wave: 'sine', gain: 0.16, notes: [0, ...rest(31)], length: 24 },
        { wave: 'triangle', gain: 0.05, octave: 1, notes: [3, ...rest(31)], length: 20 },
        { wave: 'sine', gain: 0.035, octave: 2, notes: [0, ...rest(31)], length: 16 },
      ],
    },
    done: { voices: [] },
  },
  mood: (world, hero) => {
    const run = hero && runner(hero);
    const sky = world.origin?.sky ?? 0;
    // (Which floor: the last whose hour this one's has reached.)
    const floor = FLOOR_SKIES.filter((s) => sky >= s - 0.01).length || 1;
    if (run && run.finish >= 0) return floor === FLOOR_SKIES.length ? 'resolve' : 'done';
    return floor === FLOOR_SKIES.length ? 'top' : `floor-${floor}`;
  },
};

/** The tower, as the shell takes it: its floors in order, done at their goal. */
export const TOWER: Game = {
  id: 'tower',
  cartridge: TOWER_CARTRIDGE,
  words: TOWER_WORDS,
  title: 'tower.title',
  tagline: 'tower.tagline',
  // Its floors (stage 5d: the wall jump's four beats, decision 0029; six since 5p, decision 0031, each one
  // idea taught, developed, twisted and concluded: the jump, the wall jump, what moves, what turns, hands,
  // and everything at the top), each with its gold time (s), the challenge apart: about 1.3 times its test's
  // run (floors.test.ts: 15.6, 17.5, 45.7, 19, 13.7 and 32.1 s; the third waiting for what moves, as anyone must).
  // The camera steady (after phase 5): it goes along with the climber without turning by itself, so the
  // direction held for a run up a wall and the jump off it stays the same (`view.camera`, camera.ts).
  levels: TOWER_LEVEL_LIST,
  done: towerDone,
  thread: {
    opening: [
      { who: 'tower.who.keeper', say: 'tower.open.1' },
      { who: 'tower.who.keeper', say: 'tower.open.2' },
    ],
    ending: [
      { who: 'tower.who.keeper', say: 'tower.end.1' },
      { who: 'tower.who.keeper', say: 'tower.end.2' },
    ],
  },
  credits: [kit, characters],
  music: TOWER_THEME,
  hud: towerHud,
  // (Stage 5p) The summit reached: the camera pulls out over the land at sunset.
  pieces: [mountFinale],
};
