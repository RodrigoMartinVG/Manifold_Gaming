import characters from '@manifold/character/assets';
import { STEP, levelFromText, type Cartridge, type Level } from '@manifold/core';
import { KIT } from '@manifold/kit';
import kit from '@manifold/kit/assets';
import { timeIn, type Hud, type Theme, type Words } from '@manifold/presentation';
import type { Game } from '@manifold/shell';
import { createTower, runner, TOWER_ZONES } from './rules';

/** The tower's floors: text files in `games/tower/levels/`, read with its zones and the games' kit. */
const files = import.meta.glob<string>('../levels/*.level', { query: '?raw', import: 'default', eager: true });
export const TOWER_LEVELS: Readonly<Record<string, Level>> = Object.fromEntries(
  Object.entries(files).map(([path, text]) => [
    path.replace(/^.*\/(.+)\.level$/, '$1'),
    levelFromText(text, { zones: TOWER_ZONES, kit: KIT }),
  ]),
);

/** Its rules (rules.ts), with its floors. */
export const TOWER_CARTRIDGE: Cartridge = createTower(TOWER_LEVELS);

/** ITS WORDS (decision 0019). The thread's lines are a first draft: 5d writes them with the tower. */
export const TOWER_WORDS = {
  es: {
    'tower.title': 'La torre',
    'tower.tagline': 'Subí a lo alto de la torre antes de que caiga la noche.',
    'tower.floor.1': 'La entrada',
    'tower.floor.2': 'El primer piso',
    'tower.floor.3': 'El segundo piso',
    'tower.floor.4': 'La cima',
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
    'tower.floor.4': 'The top',
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
 * over it in 32, in A minor pentatonic, slow; mostly silence. On the top floor, a high bell rings with
 * the drone's two notes. Quiet once a floor is done.
 */
/** So many beats of silence. */
const rest = (beats: number): null[] => Array<null>(beats).fill(null);

export const TOWER_THEME: Theme = {
  tempo: 56,
  // A, two octaves under the 440 Hz one.
  root: 45,
  scale: [0, 3, 5, 7, 10],
  moods: {
    climb: {
      voices: [
        // The drone: the root for 16 beats, then the fourth for 16 (each fading over 12).
        { wave: 'sine', gain: 0.16, notes: [0, ...rest(15), 3, ...rest(15)], length: 12 },
        // Three notes over it in 32 beats, two octaves up.
        { wave: 'triangle', gain: 0.05, octave: 2, notes: [...rest(4), 4, ...rest(5), 2, ...rest(11), 3, ...rest(9)], length: 4 },
      ],
    },
    // The top (stage 5d), as the light goes: the same, and a high bell with the drone's two notes in 32 beats.
    top: {
      voices: [
        { wave: 'sine', gain: 0.16, notes: [0, ...rest(15), 3, ...rest(15)], length: 12 },
        { wave: 'triangle', gain: 0.05, octave: 2, notes: [...rest(4), 4, ...rest(5), 2, ...rest(11), 3, ...rest(9)], length: 4 },
        { wave: 'sine', gain: 0.03, octave: 3, notes: [7, ...rest(15), 5, ...rest(15)], length: 6 },
      ],
    },
    done: { voices: [] },
  },
  mood: (world, hero) => {
    const run = hero && runner(hero);
    if (run && run.finish >= 0) return 'done';
    // (The top floor's sky is the last light's: 19:42.)
    return (world.origin?.sky ?? 0) >= 19.6 ? 'top' : 'climb';
  },
};

/** The tower, as the shell takes it: its floors in order, done at their goal. */
export const TOWER: Game = {
  id: 'tower',
  cartridge: TOWER_CARTRIDGE,
  words: TOWER_WORDS,
  title: 'tower.title',
  tagline: 'tower.tagline',
  // Its four floors, the wall jump's four beats (decision 0029): shown, demanded, twisted, mastered;
  // each with its gold time (s), the challenge apart: about 1.3 times its test's run (floors.test.ts:
  // 6.7, 10.5, 21.7 and 23.9 s, the last two waiting for what moves, as anyone must).
  levels: [
    { id: 'floor-1', recipe: 'tower.floor floor-1', name: 'tower.floor.1', gold: 9 },
    { id: 'floor-2', recipe: 'tower.floor floor-2', name: 'tower.floor.2', gold: 14 },
    { id: 'floor-3', recipe: 'tower.floor floor-3', name: 'tower.floor.3', gold: 24 },
    { id: 'floor-4', recipe: 'tower.floor floor-4', name: 'tower.floor.4', gold: 27 },
  ],
  done: (_, hero) => {
    const run = hero && runner(hero);
    return run && run.finish >= 0 ? { steps: run.finish - run.start, stars: run.stars, falls: run.falls } : null;
  },
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
};
