import characters from '@manifold/character/assets';
import { armsTool, ATTACK } from '@manifold/arms';
import { STEP, levelFromText, type Cartridge, type Level } from '@manifold/core';
import { KIT } from '@manifold/kit';
import kit from '@manifold/kit/assets';
import weapons from '@manifold/arms/assets';
import { timeIn, type Hud, type Theme, type Words } from '@manifold/presentation';
import type { Game } from '@manifold/shell';
import { attackers, createWall, hold, WALL_ZONES } from './rules';

/** The wall's levels: text files in `games/wall/levels/`, read with its zones and the games' kit. */
const files = import.meta.glob<string>('../levels/*.level', { query: '?raw', import: 'default', eager: true });
export const WALL_LEVELS: Readonly<Record<string, Level>> = Object.fromEntries(
  Object.entries(files).map(([path, text]) => [
    path.replace(/^.*\/(.+)\.level$/, '$1'),
    levelFromText(text, { zones: WALL_ZONES, kit: KIT }),
  ]),
);

/** Its rules (rules.ts), with its levels. */
export const WALL_CARTRIDGE: Cartridge = createWall(WALL_LEVELS);

/**
 * ITS WORDS (decision 0019). The thread goes on from the fortress's last lines (at dawn they will come for
 * the flame): the wall is held until the sun is up. The shell's result says a level's stars and falls:
 * here, whether one held it without going down, and how many times one went down.
 */
export const WALL_WORDS = {
  es: {
    'wall.title': 'La muralla',
    'wall.tagline': 'Aguantá la muralla de la fortaleza hasta que salga el sol.',
    'wall.level.1': 'El patio',
    'wall.level.2': 'Las dos puertas',
    'wall.level.3': 'El amanecer',
    'wall.who.keeper': 'La guardiana',
    'wall.open.1': 'Ya vienen por la llama. Entran por el portón, de a varios, cada vez más rápido.',
    'wall.open.2': 'Aguantá hasta que salga el sol: con la luz se van a ir.',
    'wall.end.1': 'Sale el sol, y se van.',
    'wall.end.2': 'Subiste la torre, recuperaste la llama y la defendiste. Fue una noche larga.',
    'wall.hud.time': 'Tiempo',
    'wall.hud.wave': 'Oleada',
    'wall.hud.left': 'Quedan',
    'wall.hud.health': 'Salud',
    'wall.wave': { by: 0, other: 'Oleada {0} de {1}' },
    'wall.down': 'Caíste: de vuelta en tres segundos',
    'wall.held': '¡La muralla aguanta!',
    'shell.stars': { by: 0, '=0': 'Caíste alguna vez', other: 'Sin caer' },
    'shell.falls': { by: 0, '=0': 'Nunca caíste', one: 'Caíste una vez', other: 'Caíste {0} veces' },
  },
  en: {
    'wall.title': 'The wall',
    'wall.tagline': 'Hold the fortress’s wall until the sun is up.',
    'wall.level.1': 'The yard',
    'wall.level.2': 'The two gates',
    'wall.level.3': 'The dawn',
    'wall.who.keeper': 'The keeper',
    'wall.open.1': 'They are coming for the flame. Through the gate, several at once, quicker each time.',
    'wall.open.2': 'Hold until the sun is up: with the light they will go.',
    'wall.end.1': 'The sun is up, and they go.',
    'wall.end.2': 'You climbed the tower, took back the flame and held it. It was a long night.',
    'wall.hud.time': 'Time',
    'wall.hud.wave': 'Wave',
    'wall.hud.left': 'Left',
    'wall.hud.health': 'Health',
    'wall.wave': { by: 0, other: 'wave {0} of {1}' },
    'wall.down': 'down: back in three seconds',
    'wall.held': 'the wall holds!',
    'shell.stars': { by: 0, '=0': 'Went down', other: 'Never down' },
    'shell.falls': { by: 0, '=0': 'Never down', one: 'Down once', other: 'Down {0} times' },
  },
} as const satisfies Words;

/** What its HUD shows: the time, the wave and its attackers left, the defender's health. */
export const wallHud: Hud = ({ world, hero, say, language }) => {
  const h = hero && hold(hero);
  if (!h) return [];
  const seconds = ((h.finish >= 0 ? h.finish : world.tick) - h.start) * STEP;
  return [
    { label: say('wall.hud.time'), value: timeIn(language, seconds) },
    { label: say('wall.hud.wave'), value: `${h.wave}/${h.waves}` },
    { label: say('wall.hud.left'), value: String(attackers(world).length) },
    { label: say('wall.hud.health'), value: String(Math.ceil(hero.health?.points ?? 0)) },
  ];
};

/** So many beats of silence. */
const rest = (beats: number): null[] => Array<null>(beats).fill(null);

/**
 * ITS MUSIC (decision 0027): the hours before dawn, in E minor pentatonic. Between waves, a low drone and
 * a soft call every 16 beats (waiting); while a wave is in, a steady pulse every four beats under the
 * drone, and the call answered (fighting); quiet once a level is held.
 */
export const WALL_THEME: Theme = {
  tempo: 72,
  // E, two octaves under the 329.6 Hz one.
  root: 40,
  scale: [0, 3, 5, 7, 10],
  moods: {
    wait: {
      voices: [
        { wave: 'sine', gain: 0.15, notes: [0, ...rest(15)], length: 14 },
        { wave: 'triangle', gain: 0.04, octave: 2, notes: [...rest(8), 2, ...rest(7)], length: 3 },
      ],
    },
    fight: {
      voices: [
        { wave: 'sine', gain: 0.15, notes: [0, ...rest(7), 3, ...rest(7)], length: 7 },
        { wave: 'square', gain: 0.025, octave: 1, notes: [0, ...rest(3)], length: 1 },
        { wave: 'triangle', gain: 0.04, octave: 2, notes: [...rest(8), 2, ...rest(3), 4, ...rest(3)], length: 3 },
      ],
    },
    done: { voices: [] },
  },
  mood: (world, hero) => {
    const h = hero && hold(hero);
    if (h && h.finish >= 0) return 'done';
    return attackers(world).length > 0 ? 'fight' : 'wait';
  },
};

/** The wall, as the shell takes it: its levels in order, held when their last wave is down. In first person. */
export const WALL: Game = {
  id: 'wall',
  cartridge: WALL_CARTRIDGE,
  words: WALL_WORDS,
  title: 'wall.title',
  tagline: 'wall.tagline',
  // Its three levels, the night's last hours to the dawn, the pace rising with them (rules.ts: paceOf).
  // Each with its gold time (s): about 1.3 times its test's run (levels.test.ts: 21.1, 31.3 and 36.5 s,
  // most of it the waves' own pauses, which no one shortens).
  levels: [
    { id: 'yard', recipe: 'wall.level level-1\nview.camera first', name: 'wall.level.1', gold: 28 },
    { id: 'gates', recipe: 'wall.level level-2\nview.camera first', name: 'wall.level.2', gold: 41 },
    { id: 'dawn', recipe: 'wall.level level-3\nview.camera first', name: 'wall.level.3', gold: 48 },
  ],
  done: (_, hero) => {
    const h = hero && hold(hero);
    return h && h.finish >= 0 ? { steps: h.finish - h.start, stars: h.downs === 0 ? 1 : 0, falls: h.downs } : null;
  },
  thread: {
    opening: [
      { who: 'wall.who.keeper', say: 'wall.open.1' },
      { who: 'wall.who.keeper', say: 'wall.open.2' },
    ],
    ending: [
      { who: 'wall.who.keeper', say: 'wall.end.1' },
      { who: 'wall.who.keeper', say: 'wall.end.2' },
    ],
  },
  credits: [kit, characters, weapons],
  music: WALL_THEME,
  hud: wallHud,
  tools: armsTool,
  buttons: [{ action: ATTACK, keys: ['KeyX', 'Mouse0'], pad: 5 }],
};
