import characters from '@manifold/character/assets';
import { armsTool, ATTACK, FLARE_INPUT, GUARD, noticeOf, PEBBLE_INPUT, pouch, SMOKE_INPUT } from '@manifold/arms';
import { STEP, levelFromText, type Cartridge, type Level } from '@manifold/core';
import { KIT } from '@manifold/kit';
import kit from '@manifold/kit/assets';
import weapons from '@manifold/arms/assets';
import { mountWariness, timeIn, type GamePage, type Hud, type Theme, type Words } from '@manifold/presentation';
import type { Game } from '@manifold/shell';
import { createFortress, FORTRESS_ZONES, run, standing } from './rules';

/** The fortress's levels: text files in `games/fortress/levels/`, read with its zones and the games' kit. */
const files = import.meta.glob<string>('../levels/*.level', { query: '?raw', import: 'default', eager: true });
export const FORTRESS_LEVELS: Readonly<Record<string, Level>> = Object.fromEntries(
  Object.entries(files).map(([path, text]) => [
    path.replace(/^.*\/(.+)\.level$/, '$1'),
    levelFromText(text, { zones: FORTRESS_ZONES, kit: KIT }),
  ]),
);

/** Its rules (rules.ts), with its levels. */
export const FORTRESS_CARTRIDGE: Cartridge = createFortress(FORTRESS_LEVELS);

/**
 * ITS WORDS (decision 0019). The thread goes on from the tower's last lines (the fortress lights its
 * lanterns): the tower's flame was taken there while one climbed, and is taken back at night. The shell's
 * result says a level's stars and falls; here they are whether one passed unseen, and how many times one
 * was caught.
 */
export const FORTRESS_WORDS = {
  es: {
    'fortress.title': 'La fortaleza',
    'fortress.tagline': 'Entrá de noche y recuperá la llama de la torre sin que te vean.',
    'fortress.level.1': 'La muralla',
    'fortress.level.2': 'El patio',
    'fortress.level.3': 'Los cuarteles',
    'fortress.level.4': 'La torre del homenaje',
    'fortress.who.keeper': 'La guardiana',
    'fortress.open.1': 'Mientras subías, se llevaron la llama de lo alto de la torre. Está en la fortaleza.',
    'fortress.open.2': 'La noche es tuya: un guardia ve lo que alumbra un farol. Apagalos, agachate, y que no te oigan.',
    'fortress.end.1': 'La llama vuelve a la torre.',
    'fortress.end.2': 'Al amanecer van a venir a buscarla. Habrá que defender la muralla.',
    'fortress.hud.time': 'Tiempo',
    'fortress.hud.caught': 'Atrapado',
    'fortress.hud.smoke': 'Humo',
    'fortress.hud.flare': 'Bengala',
    'fortress.hud.pebble': 'Piedritas',
    'fortress.hud.flame': 'Llama',
    'fortress.hud.yes': 'la llevás',
    'fortress.caught': 'Te atraparon: de vuelta al punto de control',
    'fortress.checkpoint': 'Punto de control',
    'fortress.flame': 'La llama: llevala hasta la salida. Alumbra, y te van a ver',
    'fortress.scroll': 'Un pergamino robado',
    'fortress.recap.scrolls': { by: 0, '=0': 'Pergaminos: ninguno de {1}', other: 'Pergaminos: {0} de {1}' },
    'fortress.recap.downs': {
      by: 0,
      '=0': 'No volteaste a nadie',
      one: 'Volteaste a un guardia',
      other: 'Volteaste a {0} guardias',
    },
    'fortress.need': 'Sin la llama no te vas',
    'shell.stars': { by: 0, '=0': 'Te vieron', other: 'Nadie te vio' },
    'shell.falls': { by: 0, '=0': 'No te atraparon', one: 'Te atraparon una vez', other: 'Te atraparon {0} veces' },
  },
  en: {
    'fortress.title': 'The fortress',
    'fortress.tagline': 'Get in at night and take back the tower’s flame unseen.',
    'fortress.level.1': 'The outer wall',
    'fortress.level.2': 'The courtyard',
    'fortress.level.3': 'The barracks',
    'fortress.level.4': 'The keep',
    'fortress.who.keeper': 'The keeper',
    'fortress.open.1': 'While you climbed, they took the flame from the top of the tower. It is in the fortress.',
    'fortress.open.2': 'The night is yours: a guard sees what a lantern lights. Put them out, crouch, and don’t be heard.',
    'fortress.end.1': 'The flame goes back to the tower.',
    'fortress.end.2': 'At dawn they will come for it. The wall will have to be held.',
    'fortress.hud.time': 'Time',
    'fortress.hud.caught': 'Caught',
    'fortress.hud.smoke': 'Smoke',
    'fortress.hud.flare': 'Flare',
    'fortress.hud.pebble': 'Pebbles',
    'fortress.hud.flame': 'Flame',
    'fortress.hud.yes': 'carried',
    'fortress.caught': 'caught: back to the checkpoint',
    'fortress.checkpoint': 'checkpoint',
    'fortress.flame': 'the flame: carry it to the way out. It gives light: they will see you',
    'fortress.scroll': 'a scroll stolen',
    'fortress.recap.scrolls': { by: 0, '=0': 'Scrolls: none of {1}', other: 'Scrolls: {0} of {1}' },
    'fortress.recap.downs': {
      by: 0,
      '=0': 'You took no one down',
      one: 'You took a guard down',
      other: 'You took {0} guards down',
    },
    'fortress.need': 'not without the flame',
    'shell.stars': { by: 0, '=0': 'Seen', other: 'Unseen' },
    'shell.falls': { by: 0, '=0': 'Never caught', one: 'Caught once', other: 'Caught {0} times' },
  },
} as const satisfies Words;

/** What its HUD shows: the time on this level, the times caught, what is in the pouch, and the flame once carried. */
export const fortressHud: Hud = ({ world, hero, say, language }) => {
  const r = hero && run(hero);
  if (!r) return [];
  const seconds = ((r.finish >= 0 ? r.finish : world.tick) - r.start) * STEP;
  const p = pouch(hero);
  return [
    { label: say('fortress.hud.time'), value: timeIn(language, seconds) },
    { label: say('fortress.hud.caught'), value: String(r.caught) },
    ...(p ? [{ label: say('fortress.hud.smoke'), value: String(p.smoke) }] : []),
    ...(p && (p.pebble ?? 0) > 0 ? [{ label: say('fortress.hud.pebble'), value: String(p.pebble) }] : []),
    ...(p && p.flare > 0 ? [{ label: say('fortress.hud.flare'), value: String(p.flare) }] : []),
    ...(r.relic ? [{ label: say('fortress.hud.flame'), value: say('fortress.hud.yes') }] : []),
  ];
};

/** So many beats of silence. */
const rest = (beats: number): null[] => Array<null>(beats).fill(null);

/**
 * ITS MUSIC (decision 0027): night. In D minor pentatonic, slower than the tower's dusk: a low drone and,
 * far apart, a soft pulse, twice in 16 beats (sneaking); (stage 5l) in TIERS by the most a guard on its
 * feet has noticed (the research: the music says how near one is to being found): one suspicious or
 * searching, the drone a little more often and a high note, held, now and then (wary); one alerted, the
 * drone twice as often, the pulse every four beats and a high note over it (alert); quiet once done.
 */
export const FORTRESS_THEME: Theme = {
  tempo: 48,
  // D, two octaves under the 293.7 Hz one.
  root: 38,
  scale: [0, 3, 5, 7, 10],
  moods: {
    sneak: {
      voices: [
        { wave: 'sine', gain: 0.15, notes: [0, ...rest(15), 2, ...rest(15)], length: 14 },
        { wave: 'triangle', gain: 0.04, octave: 1, notes: [0, ...rest(3), 0, ...rest(11)], length: 1 },
      ],
    },
    wary: {
      voices: [
        { wave: 'sine', gain: 0.15, notes: [0, ...rest(11), 1, ...rest(11)], length: 10 },
        { wave: 'triangle', gain: 0.04, octave: 1, notes: [0, ...rest(5)], length: 1 },
        { wave: 'sine', gain: 0.025, octave: 3, notes: [3, ...rest(23)], length: 6 },
      ],
    },
    alert: {
      voices: [
        { wave: 'sine', gain: 0.15, notes: [0, ...rest(7), 1, ...rest(7)], length: 7 },
        { wave: 'triangle', gain: 0.05, octave: 1, notes: [0, ...rest(3)], length: 1 },
        { wave: 'sine', gain: 0.03, octave: 3, notes: [4, ...rest(7), 3, ...rest(7)], length: 3 },
      ],
    },
    done: { voices: [] },
  },
  mood: (world, hero) => {
    const r = hero && run(hero);
    if (r && r.finish >= 0) return 'done';
    // The most a guard on its feet has noticed (stage 5l).
    let wary = false;
    for (const e of world.entities.values()) {
      const n = standing(e) ? noticeOf(e) : undefined;
      if (n?.state === 'alerted') return 'alert';
      if (n?.state === 'suspicious' || n?.state === 'searching') wary = true;
    }
    return wary ? 'wary' : 'sneak';
  },
};

/**
 * (Stage 5l) HOW EXPOSED, HOW NOTICED, on its page: its guards' signs (what each noticed, the world's),
 * where a searching one will look, the light gem (how lit the intruder is for a guard's eyes: its light,
 * crouched less, over what a guard needs to see at all) and the rings of the intruder's noise.
 */
const wariness = (page: GamePage) =>
  mountWariness(page, {
    noticed: (e) => noticeOf(e),
    exposure: (hero) => {
      const c = hero.character;
      if (!c) return null;
      return (c.light * (c.mode === 'crouch' ? c.movement.crouch.seen : 1)) / GUARD.threshold;
    },
  });

/** The fortress, as the shell takes it: its levels in order, done at their way out. */
export const FORTRESS: Game = {
  id: 'fortress',
  cartridge: FORTRESS_CARTRIDGE,
  words: FORTRESS_WORDS,
  title: 'fortress.title',
  tagline: 'fortress.tagline',
  // Its four levels (stage 5m, decision 0031: longer, with more than one way, places to watch from, scrolls
  // off the safe way): the outer wall (the dark, a pebble), the courtyard (a blow from behind), the
  // barracks (waiting while a round goes by), the keep (the flame carried out). Each with its gold time
  // (s): about 1.3 times its test's run, unseen (levels.test.ts), as anyone who knows it could.
  levels: [
    { id: 'wall', recipe: 'fortress.level level-1', name: 'fortress.level.1', gold: 32 },
    { id: 'yard', recipe: 'fortress.level level-2', name: 'fortress.level.2', gold: 28 },
    { id: 'barracks', recipe: 'fortress.level level-3', name: 'fortress.level.3', gold: 59 },
    { id: 'keep', recipe: 'fortress.level level-4', name: 'fortress.level.4', gold: 60 },
  ],
  done: (_, hero) => {
    const r = hero && run(hero);
    if (!r || r.finish < 0) return null;
    // (Stage 5m) Its recap: the scrolls taken of those the level has (if it has any), the guards taken down.
    const notes: [string, ...string[]][] = [
      ...(r.scrollsHere > 0
        ? [['fortress.recap.scrolls', String(r.scrolls), String(r.scrollsHere)] as [string, ...string[]]]
        : []),
      ['fortress.recap.downs', String(r.downs)],
    ];
    return { steps: r.finish - r.start, stars: r.seen === 0 ? 1 : 0, falls: r.caught, notes };
  },
  thread: {
    opening: [
      { who: 'fortress.who.keeper', say: 'fortress.open.1' },
      { who: 'fortress.who.keeper', say: 'fortress.open.2' },
    ],
    ending: [
      { who: 'fortress.who.keeper', say: 'fortress.end.1' },
      { who: 'fortress.who.keeper', say: 'fortress.end.2' },
    ],
  },
  credits: [kit, characters, weapons],
  music: FORTRESS_THEME,
  hud: fortressHud,
  pieces: [wariness],
  // What each one has in its hands (stage 5g: the games' weapons, their models): the stick.
  tools: armsTool,
  // Its buttons: the stick, X or a click (as the Dojo's); smoke, F; a flare, Z; (5l) a pebble, Q.
  buttons: [
    { action: ATTACK, keys: ['KeyX', 'Mouse0'], pad: 5 },
    { action: SMOKE_INPUT, keys: ['KeyF'], pad: 2 },
    { action: FLARE_INPUT, keys: ['KeyZ'] },
    { action: PEBBLE_INPUT, keys: ['KeyQ'], pad: 3 },
  ],
};
