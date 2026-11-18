import { quat, sinCosDegrees, vec3, type Vec3 } from '@manifold/common';
import { characterParts } from '@manifold/character';
import { component, type Entity, type World } from '@manifold/core';
import { WARY, type Wary } from './stealth';
import { WEAPON, type Weapon, type WeaponKind } from './weapons';

/** The guard's brain's name (stage 4e's `dojo.guard`, the games' since 5e): what its entities say, and its host's table. */
export const GUARD_BRAIN = 'arms.guard';

/**
 * A GUARD (stage 4e, decision 0023): a bot, a character of a player of its own (100, 101…: the session
 * takes its inputs as anyone's), the mannequin in dark red, with health, a stick, eyes (a watcher on its
 * body, looking where it looks: it sees by the light, 3d) and a brain, `arms.guard` (brain.ts), that
 * keeps to a route: the one named, or the level's nearest to where it stands.
 */
export const GUARD = Object.freeze({
  health: 100,
  color: 0x8a3a3a,
  firstPlayer: 100,
  range: 12,
  degrees: 100,
  threshold: 0.3,
  /** Down, it is back on its feet ten seconds later (stage 4g: a dummy, three). */
  back: 600,
});

/**
 * HOW A GUARD WITH A DART OR A BOLT FIGHTS (stage 4g; stage 4.5a made it each room's data): how long it
 * takes to see you before its first shot (steps; at once if you just hit it), how often it shoots
 * (steps), how much of the way to you its aim goes each step (1: dead on), and how far it shoots (m).
 * A room changes them from its recipe, with `dojo.guards.see` and the rest: world values, which enter
 * at a step, so replays have them. A guard that was never told fights as `GUNNER` says, and a new one
 * fights as the guards already there.
 *
 * Why these: the first numbers, half a second to see and one shot a second dead on, brought a player
 * down in the arena's open in a second and a half, over and over (the author found no time to play).
 * An aim that goes 15% of the way each step catches one who stands still; one who keeps moving it
 * trails, at a walk by v·Δt·(1 − k)/k ≈ 0.42 m (about the body's width), and misses more often than
 * not. Measured in the arena's open over 30 s, before and after: standing still, down 6 times (half
 * the time down) and then once, at 4.8 s; going side to side, 17 darts of 18 struck and then 4 of 19.
 */
export type Gunner = { see: number; every: number; aim: number; range: number };
export const GUNNER: Readonly<Gunner> = Object.freeze({ see: 60, every: 90, aim: 0.15, range: 18 });
export const GUNNER_KEY = 'arms.gunner';
export const gunnerOf = (e: Entity): Readonly<Gunner> => component<Gunner>(e, GUNNER_KEY) ?? GUNNER;
export const guardsOf = (world: World) => [...world.entities.values()].filter((e) => e.brain?.name === GUARD_BRAIN);

export function guard(
  world: World,
  at: Vec3,
  facing: Vec3,
  route: string | null = null,
  kind: WeaponKind = 'stick',
  /** (Stage 5e) Its wariness, if its game makes it wary (stealth.ts). */
  wary?: Wary,
): Entity {
  const guards = guardsOf(world);
  // (A new guard fights as those already there, if a room told them how: stage 4.5a.)
  const like = guards[0];
  const told = like && component<Gunner>(like, GUNNER_KEY);
  const player = GUARD.firstPlayer + Math.max(-1, ...guards.map((e) => e.character!.player - GUARD.firstPlayer)) + 1;
  const parts = characterParts({ player, facing, color: GUARD.color });
  const nearest = (): string | null => {
    let best: string | null = null;
    let distance = Infinity;
    for (const e of world.entities.values())
      if (e.route && e.name) {
        const d = vec3.length(vec3.sub(e.route.points[0]!, at));
        if (d < distance) {
          distance = d;
          best = e.name;
        }
      }
    return best;
  };
  let name = 'guard';
  for (let k = 2; world.named(name); k++) name = `guard_${k}`;
  return world.createEntity({
    name,
    transform: { position: [...at], rotation: quat.identity() },
    body: parts.body,
    character: parts.character,
    appearance: parts.appearance,
    health: { most: like?.health?.most ?? GUARD.health },
    watcher: { range: GUARD.range, cone: sinCosDegrees(GUARD.degrees / 2)[1], threshold: GUARD.threshold },
    brain: { name: GUARD_BRAIN, route: route ?? nearest() },
    game: {
      [WEAPON]: { kind, ready: 0, strike: 0, struck: [] } satisfies Weapon,
      ...(told ? { [GUNNER_KEY]: { ...told } satisfies Gunner } : {}),
      ...(wary ? { [WARY]: { ...wary } satisfies Wary } : {}),
    },
  });
}
