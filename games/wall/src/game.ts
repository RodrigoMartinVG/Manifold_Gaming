import characters from '@manifold/character/assets';
import { AMMO_OF, armsTool, arsenal, ATTACK, SLOTS, weapon } from '@manifold/arms';
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
 * ITS WORDS (decision 0019). The thread goes on from the fortress's last lines: while the flame was being
 * taken back, they came over the wall; it is taken back section by section, and its gate closed before the
 * sun is up (stage 5n, decision 0031: the dawn as the shooter's thread). The shell's result says a level's
 * stars and falls: here, whether one got through without going down, and how many times one went down; and
 * its recap, the secrets found and the attackers brought down.
 */
export const WALL_WORDS = {
  es: {
    'wall.title': 'La muralla',
    'wall.tagline': 'Recuperá la muralla tramo por tramo y cerrá el portón antes del alba.',
    'wall.level.1': 'El adarve',
    'wall.level.2': 'La casa de la puerta',
    'wall.level.3': 'Las torres',
    'wall.level.4': 'El portón',
    'wall.who.keeper': 'La guardiana',
    'wall.open.1': 'Mientras recuperabas la llama, entraron por la muralla. Es suya, tramo por tramo.',
    'wall.open.2': 'Recuperala: el adarve, la casa de la puerta, las torres. Y cerrá el portón antes de que salga el sol.',
    'wall.end.1': 'El portón está cerrado, y sale el sol.',
    'wall.end.2': 'Subiste la torre, recuperaste la llama y la muralla. Fue una noche larga.',
    'wall.hud.time': 'Tiempo',
    'wall.hud.health': 'Salud',
    'wall.hud.armor': 'Armadura',
    'wall.hud.weapon': 'Arma',
    'wall.hud.keys': 'Llaves',
    'wall.weapon.stick': 'palo',
    'wall.weapon.dart': 'saeta',
    'wall.weapon.shotgun': 'escopeta',
    'wall.weapon.repeater': 'repetidora',
    'wall.weapon.bolt': 'ballesta',
    'wall.weapon.launcher': 'lanzador',
    'wall.weapon.grenade': 'granada',
    'wall.down': 'Caíste: de vuelta en tres segundos',
    'wall.out': '¡Tramo recuperado!',
    'wall.key': { by: 0, '=0': 'La llave roja', '=1': 'La llave azul', other: 'La llave amarilla' },
    'wall.health': 'Salud',
    'wall.armor': 'Armadura',
    'wall.ammo': 'Munición',
    'wall.secret': '¡Un secreto!',
    'wall.recap.secrets': { by: 0, '=0': 'Secretos: ninguno de {1}', other: 'Secretos: {0} de {1}' },
    'wall.recap.felled': { by: 0, other: 'Atacantes: {0} de {1}' },
    'shell.stars': { by: 0, '=0': 'Caíste alguna vez', other: 'Sin caer' },
    'shell.falls': { by: 0, '=0': 'Nunca caíste', one: 'Caíste una vez', other: 'Caíste {0} veces' },
  },
  en: {
    'wall.title': 'The wall',
    'wall.tagline': 'Take the wall back section by section and close its gate before dawn.',
    'wall.level.1': 'The wall walk',
    'wall.level.2': 'The gatehouse',
    'wall.level.3': 'The towers',
    'wall.level.4': 'The gate',
    'wall.who.keeper': 'The keeper',
    'wall.open.1': 'While you took back the flame, they came over the wall. It is theirs, section by section.',
    'wall.open.2': 'Take it back: the wall walk, the gatehouse, the towers. And close the gate before the sun is up.',
    'wall.end.1': 'The gate is closed, and the sun is up.',
    'wall.end.2': 'You climbed the tower, took back the flame and the wall. It was a long night.',
    'wall.hud.time': 'Time',
    'wall.hud.health': 'Health',
    'wall.hud.armor': 'Armor',
    'wall.hud.weapon': 'Weapon',
    'wall.hud.keys': 'Keys',
    'wall.weapon.stick': 'stick',
    'wall.weapon.dart': 'dart',
    'wall.weapon.shotgun': 'shotgun',
    'wall.weapon.repeater': 'repeater',
    'wall.weapon.bolt': 'crossbow',
    'wall.weapon.launcher': 'launcher',
    'wall.weapon.grenade': 'grenade',
    'wall.down': 'down: back in three seconds',
    'wall.out': 'section taken back!',
    'wall.key': { by: 0, '=0': 'the red key', '=1': 'the blue key', other: 'the yellow key' },
    'wall.health': 'health',
    'wall.armor': 'armor',
    'wall.ammo': 'ammunition',
    'wall.secret': 'a secret!',
    'wall.recap.secrets': { by: 0, '=0': 'Secrets: none of {1}', other: 'Secrets: {0} of {1}' },
    'wall.recap.felled': { by: 0, other: 'Attackers: {0} of {1}' },
    'shell.stars': { by: 0, '=0': 'Went down', other: 'Never down' },
    'shell.falls': { by: 0, '=0': 'Never down', one: 'Down once', other: 'Down {0} times' },
  },
} as const satisfies Words;

/** The keys' marks on the HUD, by color: red, blue, yellow. */
const KEY_MARKS = ['🟥', '🟦', '🟨'];

/**
 * What its HUD shows: the time, the defender's health and armor, the weapon in its hands and its
 * ammunition (stage 5n: an arsenal), the keys it has.
 */
export const wallHud: Hud = ({ world, hero, say, language }) => {
  const h = hero && hold(hero);
  if (!h) return [];
  const seconds = ((h.finish >= 0 ? h.finish : world.tick) - h.start) * STEP;
  const w = weapon(hero);
  const a = arsenal(hero);
  const ammo = w && w.kind !== 'none' ? AMMO_OF[w.kind] : undefined;
  const keys = KEY_MARKS.filter((_, k) => h.keys & (1 << k)).join('');
  return [
    { label: say('wall.hud.time'), value: timeIn(language, seconds) },
    { label: say('wall.hud.health'), value: String(Math.ceil(hero.health?.points ?? 0)) },
    ...(h.armor > 0 ? [{ label: say('wall.hud.armor'), value: String(h.armor) }] : []),
    ...(w && w.kind !== 'none'
      ? [{ label: say('wall.hud.weapon'), value: `${say(`wall.weapon.${w.kind}`)}${ammo && a ? ` ${a.ammo[ammo]}` : ''}` }]
      : []),
    ...(keys ? [{ label: say('wall.hud.keys'), value: keys }] : []),
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
    // (Stage 5n) Fighting while an attacker on its feet sees the defender; between fights, waiting.
    return hero && attackers(world).some((e) => e.watcher?.sees.includes(hero.id)) ? 'fight' : 'wait';
  },
};

/** The wall, as the shell takes it: its levels in order, each done at its way out. In first person. */
export const WALL: Game = {
  id: 'wall',
  cartridge: WALL_CARTRIDGE,
  words: WALL_WORDS,
  title: 'wall.title',
  tagline: 'wall.tagline',
  // Its four levels (stage 5n, decision 0031: levels to advance through, a key or two, secrets), the
  // night's last hours to the dawn, the pace rising with them (rules.ts: paceOf). Each with its gold time
  // (s): about 1.3 times its test's run (levels.test.ts).
  levels: [
    { id: 'walk', recipe: 'wall.level level-1\nview.camera first', name: 'wall.level.1', gold: 53 },
    { id: 'gatehouse', recipe: 'wall.level level-2\nview.camera first', name: 'wall.level.2', gold: 61 },
    { id: 'towers', recipe: 'wall.level level-3\nview.camera first', name: 'wall.level.3', gold: 60 },
    { id: 'gate', recipe: 'wall.level level-4\nview.camera first', name: 'wall.level.4', gold: 67 },
  ],
  done: (_, hero) => {
    const h = hero && hold(hero);
    if (!h || h.finish < 0) return null;
    const notes: [string, ...string[]][] = [
      ...(h.secretsHere > 0 ? [['wall.recap.secrets', String(h.secrets), String(h.secretsHere)] as [string, ...string[]]] : []),
      ['wall.recap.felled', String(h.felled), String(h.attackersHere)],
    ];
    return { steps: h.finish - h.start, stars: h.downs === 0 ? 1 : 0, falls: h.downs, notes };
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
  // Its buttons: the shot, X or a click; (stage 5n) each weapon of the arsenal by its number, 1 to 7.
  buttons: [
    { action: ATTACK, keys: ['KeyX', 'Mouse0'], pad: 5 },
    ...SLOTS.map((_, k) => ({ action: `arms.slot${k + 1}`, keys: [`Digit${k + 1}`] })),
  ],
};
