import { STEP, type World } from '@manifold/core';
import { openDialog, timeIn, type GamePage, type Hud, type Piece, type Words } from '@manifold/presentation';
import { charge, chargeOf, runner } from './rules';

/**
 * THE DOJO'S WORDS (stage 3i, decision 0019): what its notices say (the world sends their keys and
 * numbers), its HUD and the box at the goal, in Spanish (the site's) and in English (the console's).
 */
export const DOJO_WORDS = {
  es: {
    'dojo.seen': 'El vigía te ve',
    'dojo.lost': 'El vigía te perdió',
    'dojo.fell': 'Te caíste: de vuelta al punto de control',
    'dojo.checkpoint': 'Punto de control',
    // Whole sentences for each form of the numbers (decision 0019, after the tutorial's pass: "1 tomadas").
    'dojo.star': {
      by: 1,
      '=0': { by: 0, one: 'Una estrella: la última, y era la única', other: 'Una estrella: la última, ya son {0}' },
      one: { by: 0, one: 'Una estrella: {0} tomada, queda {1}', other: 'Una estrella: {0} tomadas, queda {1}' },
      other: { by: 0, one: 'Una estrella: {0} tomada, quedan {1}', other: 'Una estrella: {0} tomadas, quedan {1}' },
    },
    'dojo.goal': {
      by: 1,
      one: {
        by: 2,
        one: 'La meta: {0:2} s, {1} caída, {2} estrella',
        other: 'La meta: {0:2} s, {1} caída, {2} estrellas',
      },
      other: {
        by: 2,
        one: 'La meta: {0:2} s, {1} caídas, {2} estrella',
        other: 'La meta: {0:2} s, {1} caídas, {2} estrellas',
      },
    },
    'dojo.hud.time': 'Tiempo',
    'dojo.hud.falls': 'Caídas',
    'dojo.hud.stars': 'Estrellas',
    'dojo.hud.of': '{0} de {1}',
    'dojo.hud.charge': 'Fuerza',
    'dojo.goal.title': '¡Llegaste!',
    'dojo.goal.line': 'Tiempo {0} · caídas {1} · estrellas {2} de {3}',
    'dojo.goal.again': 'Otra vez',
    'dojo.goal.stay': 'Quedarme',
  },
  en: {
    'dojo.seen': 'the watcher sees you',
    'dojo.lost': 'the watcher lost you',
    'dojo.fell': 'you fell: back to the checkpoint',
    'dojo.checkpoint': 'checkpoint',
    'dojo.star': {
      by: 1,
      '=0': { by: 0, one: 'a star: the last, and the only one', other: 'a star: the last, {0} in all' },
      other: 'a star: {0} taken, {1} left',
    },
    'dojo.goal': {
      by: 1,
      one: { by: 2, one: 'the goal: {0:2} s, {1} fall, {2} star', other: 'the goal: {0:2} s, {1} fall, {2} stars' },
      other: { by: 2, one: 'the goal: {0:2} s, {1} falls, {2} star', other: 'the goal: {0:2} s, {1} falls, {2} stars' },
    },
    'dojo.hud.time': 'Time',
    'dojo.hud.falls': 'Falls',
    'dojo.hud.stars': 'Stars',
    'dojo.hud.of': '{0} of {1}',
    'dojo.hud.charge': 'Strength',
    'dojo.goal.title': 'You made it!',
    'dojo.goal.line': 'Time {0} · falls {1} · stars {2} of {3}',
    'dojo.goal.again': 'Again',
    'dojo.goal.stay': 'Stay',
  },
} as const satisfies Words;

/** Whether the world has a goal (a level with a loop to run: the course, the circuit). */
const hasGoal = (world: World) => [...world.entities.values()].some((e) => e.sensor?.kind === 'goal');
/** How many stars are left in the world. */
const starsLeft = (world: World) => [...world.entities.values()].filter((e) => e.sensor?.kind === 'star').length;

/**
 * THE DOJO'S HUD: in a level with a goal, the time since the character started (stopped at the goal),
 * its falls, and its stars (taken, of all there were), from its runner, which is the world's. And, in
 * any level, while the throw is held (stage 4b), how charged it is: ten marks, filled as it charges.
 */
export const dojoHud: Hud = ({ world, hero, say, language }) => {
  const held = hero ? charge(hero) : undefined;
  const filled = held && held.steps > 0 ? Math.round(10 * chargeOf(held.steps)) : -1;
  const strength = filled >= 0 ? [{ label: say('dojo.hud.charge'), value: '▮'.repeat(filled) + '▯'.repeat(10 - filled) }] : [];
  const run = hero && runner(hero);
  if (!run || !hasGoal(world)) return strength;
  const seconds = ((run.finish >= 0 ? run.finish : world.tick) - run.start) * STEP;
  const total = run.stars + starsLeft(world);
  return [
    { label: say('dojo.hud.time'), value: timeIn(language, seconds) },
    { label: say('dojo.hud.falls'), value: String(run.falls) },
    ...(total > 0 ? [{ label: say('dojo.hud.stars'), value: say('dojo.hud.of', [run.stars, total]) }] : []),
    ...strength,
  ];
};

/**
 * AT THE GOAL, a dialogue box: the time, the falls, the stars; "again" starts the level over,
 * "stay" closes it. (The world sent the notice: the time, falls, stars taken and left.)
 */
export function dojoGoal(page: GamePage): Piece {
  return {
    event(ev) {
      if (ev.type !== 'notice' || ev.say !== 'dojo.goal' || ev.player !== page.me) return;
      const [seconds = 0, falls = 0, stars = 0, left = 0] = ev.values ?? [];
      openDialog(page, {
        title: page.words('dojo.goal.title'),
        lines: [page.words('dojo.goal.line', [timeIn(page.language, seconds), falls, stars, stars + left])],
        buttons: [{ label: page.words('dojo.goal.again'), then: () => page.restart() }, { label: page.words('dojo.goal.stay') }],
      });
    },
  };
}
