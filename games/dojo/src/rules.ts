import { quat, vec3, type Vec3 } from '@manifold/common';
import {
  buildLevel,
  component,
  DEFAULT_MOVEMENT,
  GRID_COLOR,
  pressed,
  STEP,
  upAt,
  type Capabilities,
  type Cartridge,
  type Character,
  type CollisionPose,
  type Entity,
  type Event,
  type Level,
  type ModeName,
  type Movement,
  type World,
  type ZoneKinds,
} from '@manifold/core';

/** The big cube's spin at the start (a tilted axis: so it shows that it spins in 3D, not just "turns"). */
const START_SPIN: Vec3 = [0.35, 0.9, 0.15];

/** A color from the world's randomness (not too dark). */
const randomColor = (world: World) => Math.floor(world.random.between(0.25, 1) * 0xffffff) & 0xf0f0f0;

/**
 * A small cube with place, size, spin and color taken from THE WORLD'S RANDOMNESS (not Math.random).
 * It is a dynamic body: it falls, bounces and piles up (stage 1a).
 */
function randomCube(world: World) {
  const r = world.random;
  const side = r.between(0.2, 0.6);
  world.createEntity({
    transform: { position: [r.between(-6, 6), r.between(0.5, 4), r.between(-6, 6)], rotation: quat.identity() },
    body: {
      type: 'dynamic',
      shape: { kind: 'box', halfExtents: [side / 2, side / 2, side / 2] },
      angularVelocity: [r.between(-2, 2), r.between(-2, 2), r.between(-2, 2)],
    },
    appearance: { shape: 'box', size: [side, side, side], color: randomColor(world) },
  });
}

/** A copy of a movement's numbers. */
const copyMovement = (m: Movement): Movement => ({
  walk: { ...m.walk },
  air: { ...m.air },
  jump: { ...m.jump },
  glide: { ...m.glide },
  climb: { ...m.climb },
  turn: m.turn,
});

/**
 * THE DOJO'S RUNNER (stage 2a; a named component since 2.5b): what the level's loop keeps on each
 * character: where it comes back after falling (its spawn, then its last checkpoint), when it
 * started, when it reached the goal (−1: not yet), its falls and its stars.
 */
export type Runner = { spawn: Vec3; checkpoint: Vec3; start: number; finish: number; falls: number; stars: number };
const RUNNER = 'dojo.runner';
/** A character's runner, if it has one. */
export const runner = (e: Entity) => component<Runner>(e, RUNNER);

/**
 * What the mannequin's body is in each way of moving where it is not the standing capsule (stage 2e,
 * for phase 4's blows), from its animations: crouched in the air, its knees up; gliding, tilted 55°
 * forward. (The controller moves the capsule always.)
 */
const POSES: Partial<Record<ModeName, CollisionPose>> = {
  air: { shape: { kind: 'capsule', halfHeight: 0.35, radius: 0.3 }, offset: [0, 0.1, 0], rotation: quat.identity() },
  glide: {
    shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 },
    offset: [0, 0, 0],
    rotation: quat.fromDegrees([1, 0, 0], -55),
  },
};

/** A character: a capsule 1.6 m tall, and its runner for the level's loop. */
function character(world: World, player: number, at: Vec3, facing: Vec3, color: number, like?: Character) {
  world.createEntity({
    transform: { position: [...at], rotation: quat.identity() },
    body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
    // (Like another one, if given: a copy of the numbers it moves with and of what it can do.)
    character: {
      player,
      facing: [...facing],
      poses: POSES,
      ...(like ? { movement: copyMovement(like.movement), can: { ...like.can } } : {}),
    },
    // The mannequin (stage 2e: art/mannequin.py), once it loaded; the capsule meanwhile.
    appearance: { shape: 'capsule', size: [0.6, 1.6, 0.6], color, model: 'dojo.mannequin' },
    game: {
      [RUNNER]: { spawn: [...at], checkpoint: [...at], start: world.tick, finish: -1, falls: 0, stars: 0 } satisfies Runner,
    },
  });
}

/** The level's stars: zones of kind `star` (while nobody has taken them). */
const stars = (world: World) => [...world.entities.values()].filter((e) => e.sensor?.kind === 'star');

/**
 * A LEVEL (stage 2a: from its file, `dojo.level <name>`): its boxes and its zones, and player 1's
 * character where the level says.
 */
function buildDojoLevel(world: World, level: Level) {
  buildLevel(world, level);
  // Its stars are seen (stage 2c): a small gold cube that spins, in each `star` zone. (A zone with a
  // spin and no body: the world turns it, without trigonometry.)
  for (const star of stars(world)) {
    star.appearance = { shape: 'box', size: [0.4, 0.4, 0.4], color: 0xf0c040 };
    star.spin = { angularVelocity: [0.4, 2, 0.3] };
  }
  character(world, 1, level.spawn, level.facing, 0x93d9c9);
}

/**
 * THE DOJO'S ZONES, and what each one carries (stage 3b): its levels are read with them, so a zone of
 * another kind, or a current without its flow, is an error with its line (before, a `chekpoint` was
 * read, and did nothing).
 */
export const DOJO_ZONES: ZoneKinds = {
  checkpoint: {},
  fall: {},
  star: {},
  goal: {},
  /** It carries whoever is in it along its `flow` (m/s, x y z, in the world's axes). */
  current: { flow: 3 },
};

/**
 * CURRENTS (stage 3b): a character in a `current` zone, standing in it, is carried along its flow, on
 * every step it is there. One more contribution to its movement (stage 2b's `carry`): walking against
 * it, it advances less; across it, it drifts. It takes hold through the feet, as water at the ankles
 * does: in the air, jumping over it, nothing holds on to it (at first it carried a jump too, from a
 * zone 5 m tall, and the author found it strange: over the water, without touching it, it pushed). A
 * wind, which would push in the air, would be another kind of zone. (What the physics moves is not
 * carried yet: that is the fluids', in the idea bank.)
 */
function currents(world: World) {
  for (const zone of world.entities.values()) {
    if (zone.sensor?.kind !== 'current') continue;
    const flow = zone.sensor.params.flow as Vec3;
    for (const id of zone.sensor.inside) {
      const c = world.entities.get(id)?.character;
      if (c?.grounded) c.carry = vec3.add(c.carry, flow);
    }
  }
}

/**
 * A LEVEL'S LOOP (stage 2a), with its zones: the engine says who came into which one, and what it
 * means is the Dojo's.
 * - `checkpoint`: a character comes back here from now on, if it falls;
 * - `fall` (the void under the floor): a character goes back to its checkpoint; a cube or a ball is gone
 *   (a platform, which the program moves, is not);
 * - `star` (stage 2c): whoever gets there first takes it, and it is gone;
 * - `goal`: the time it took (from when it started), how many times it fell and its stars, once.
 * What it keeps lives in the character's runner (`dojo.runner`): it is the world's, so it is hashed, it
 * travels in snapshots, and a replay plays it the same.
 */
function levelLoop(world: World, events: readonly Event[]) {
  const notice = (player: number, text: string) => world.emit({ type: 'notice', text, player });
  for (const ev of events) {
    if (ev.type !== 'sensorEntered') continue;
    const zone = world.entities.get(ev.sensor);
    const e = world.entities.get(ev.entity);
    if (!zone?.sensor || !zone.transform || !e) continue;
    const run = runner(e);
    const player = e.character?.player;
    switch (zone.sensor.kind) {
      case 'fall':
        // What the physics moves (a cube, a ball) is gone; what the program moves (a platform) is not
        // the void's (closing phase 2: before, a platform whose center dipped into it was deleted).
        if (!e.character) {
          if (e.body?.type === 'dynamic') world.removeEntity(e.id);
        } else if (run && player !== undefined) {
          world.place(e, run.checkpoint);
          run.falls++;
          notice(player, 'you fell: back to the checkpoint');
        }
        break;
      case 'checkpoint':
        if (run && player !== undefined && !vec3.equals(run.checkpoint, zone.transform.position)) {
          run.checkpoint = [...zone.transform.position];
          notice(player, 'checkpoint');
        }
        break;
      case 'star':
        if (run && player !== undefined) {
          world.removeEntity(zone.id);
          run.stars++;
          notice(player, `a star (${run.stars} taken, ${stars(world).length} left)`);
        }
        break;
      case 'goal':
        if (run && player !== undefined && run.finish < 0) {
          run.finish = world.tick;
          const seconds = ((run.finish - run.start) * STEP).toFixed(2);
          notice(
            player,
            `the goal: ${seconds} s, ${run.falls === 1 ? '1 fall' : `${run.falls} falls`}, ${run.stars === 1 ? '1 star' : `${run.stars} stars`}`,
          );
        }
        break;
    }
  }
}

/** A ball at a place, with its size and color from the world's randomness: it falls from there. */
function ball(world: World, position: Vec3, velocity: Vec3 = [0, 0, 0]) {
  const diameter = world.random.between(0.3, 0.7);
  world.createEntity({
    transform: { position: [...position], rotation: quat.identity() },
    // A little angular damping: Rapier has no rolling resistance, and without it the ball would roll
    // until it fell off the floor's edge.
    body: {
      type: 'dynamic',
      shape: { kind: 'ball', radius: diameter / 2 },
      restitution: 0.5,
      angularDamping: 0.8,
      linearVelocity: [...velocity],
    },
    appearance: { shape: 'sphere', size: [diameter, diameter, diameter], color: randomColor(world) },
  });
}

/** Each player's color: the first one's is the course's; the others', from this list. */
const PLAYER_COLORS = [0x4a9fd8, 0xd86a4a, 0x7ac25a, 0xc25ab8, 0xd8c04a];

/**
 * In a level with characters (the course), every player who comes into the match (stage 1e:
 * `players.join`) gets one, next to the first one's; whoever leaves loses it. Player 1's belongs to
 * the level: it is there from the start, and it stays.
 */
function joinedPlayers(world: World) {
  const characters = [...world.entities.values()].filter((e) => e.character);
  const first = characters.find((e) => e.character!.player === 1);
  if (!first) return;
  // Next to where the first one started, each one 1.2 m further to the right.
  const spawn = runner(first)?.spawn ?? [0, 1, 6];
  for (const p of world.players)
    if (p !== 1 && !characters.some((e) => e.character!.player === p))
      character(
        world,
        p,
        [spawn[0] + 1.2 * (p - 1), spawn[1], spawn[2]],
        first.character!.facing,
        PLAYER_COLORS[(p - 2) % PLAYER_COLORS.length]!,
        // It moves like the first one, and can do what it can (whatever `dojo.air`, `dojo.climb`… made of it).
        first.character!,
      );
  for (const e of characters) if (e.character!.player !== 1 && !world.players.has(e.character!.player)) world.removeEntity(e.id);
}

/**
 * THE DOJO'S CARTRIDGE: the first game, the engine's lab. A floor, a big cube that spins (a
 * kinematic body: it pushes what it touches), small cubes that fall from the world's randomness, and
 * balls on demand. Or a level, which brings its whole ground (stage 3b: before, the floor and the big
 * cube were built in every room, and the circuit's first jump had that floor under it). It tests what matters: that a game, from OUTSIDE the engine, puts things in a
 * world that the simulation runs (with its physics) and the presentation draws.
 *
 * What the Dojo lets people change it DECLARES (decision 0010), each thing with its scope:
 * - `dojo.cubes` is STARTUP: how many cubes there are when the world is born (changing it restarts it);
 * - `dojo.spin` is WORLD: the big cube's spin, which changes at a given step;
 * - `dojo.spawn x y z` is a WORLD action: a ball that falls from there, at a given step.
 * - `dojo.throw` is a PLAYER's button (stage 1d): the character throws a ball forward. The core does
 *   not know it: the Dojo declares it, reads it on every step, and its page says which key presses it.
 * (And the engine's `seed` and `physics.gravity`, which the Dojo lets people touch too.)
 *
 * The Dojo's rules do not touch the screen (this file runs the same in tests): what is seen is
 * decided by `index.ts`.
 */
export function createDojo(levels: Readonly<Record<string, Level>>): Cartridge {
  return {
    id: 'dojo',
    title: 'Dojo',
    inputs: [{ name: 'dojo.throw', kind: 'button', description: 'the character throws a ball forward' }],
    // A lab: in a match, everybody may change the world (another game may let only its host).
    mayChange: () => true,

    onDeclare(registry) {
      registry.declareVariable({
        name: 'dojo.cubes',
        description:
          "Small cubes at the start, at places taken from the world's randomness: with the same seed, always the same ones.",
        scope: 'startup',
        type: { kind: 'integer', min: 0, max: 200 },
        default: 0,
      });
      registry.declareVariable({
        name: 'dojo.level',
        description:
          'What the room is: `empty` (a floor and the big cube), or a level from `games/dojo/levels/`, which brings its whole ground, like `course`: a small classic level with a character to drive (WASD or the arrows, Space to jump, Shift to run), checkpoints and a goal.',
        scope: 'startup',
        type: { kind: 'option', options: ['empty', ...Object.keys(levels)] },
        default: 'empty',
      });
      // What the characters can do besides walking and jumping (stage 2c): on and off, live, for all.
      const capability = (name: string, key: keyof Capabilities, description: string) =>
        registry.declareVariable({
          name,
          description,
          scope: 'world',
          type: { kind: 'boolean' },
          default: false,
          onWorld(world, value) {
            for (const e of world.entities.values()) if (e.character) e.character.can[key] = value === true;
          },
        });
      capability(
        'dojo.climb',
        'climb',
        'Pushing against a wall, the characters climb it; jumping from it, they leap off (stage 2c).',
      );
      capability(
        'dojo.glide',
        'glide',
        'Holding the jump while falling, the characters glide: they fall slowly, and steer more (stage 2c).',
      );
      capability('dojo.doublejump', 'doubleJump', 'One more jump in the air, pressing jump again (stage 2c).');
      registry.declareVariable({
        name: 'dojo.air',
        description:
          "How much a character can steer in the air, in m/s² (stage 2b). 14 is a platformer's; 0, none at all, like real physics (once in the air, there is nothing to push against); 50, as much as on the ground. It changes at a step, for every character.",
        scope: 'world',
        type: { kind: 'number', min: 0, max: 60 },
        default: DEFAULT_MOVEMENT.air.control,
        onWorld(world, value) {
          for (const e of world.entities.values()) if (e.character) e.character.movement.air.control = Number(value);
        },
      });
      registry.declareVariable({
        name: 'dojo.spin',
        description: 'How the big cube spins (in the Dojo without a level): radians per second around each axis (x y z).',
        scope: 'world',
        type: { kind: 'vector' },
        default: START_SPIN,
        onWorld(world, value) {
          // The big cube, by its name (stage 3b; before, by being the world's first entity, which in a
          // room with a level is the level's first box).
          const cube = world.named('cube');
          if (cube?.spin) cube.spin.angularVelocity = [...(value as Vec3)];
        },
      });
      registry.declareCommand({
        name: 'dojo.goto',
        description:
          "Puts player 1's character at (x, y, z), stopped: to explore a level (stage 2c). A world action: it enters at a step, and the replay has it.",
        args: [{ name: 'x y z', type: { kind: 'vector' } }],
        onWorld(world, [place]) {
          const hero = [...world.entities.values()].find((e) => e.character?.player === 1);
          if (hero) world.place(hero, place as Vec3);
        },
      });
      registry.declareCommand({
        name: 'dojo.spawn',
        description: "Drops a ball from (x, y, z), with its size and color taken from the world's randomness.",
        args: [{ name: 'x y z', type: { kind: 'vector' } }],
        onWorld(world, [place]) {
          ball(world, place as Vec3);
        },
      });
    },

    beforeStep(world) {
      currents(world);
    },

    onStep(world, events) {
      joinedPlayers(world);
      levelLoop(world, events);
      // Each press throws one ball (held, it does not throw more): from the chest, forward and up a little.
      for (const e of world.entities.values()) {
        if (!e.character || !e.transform || !pressed(world, e.character.player, 'dojo.throw')) continue;
        const up = upAt(world, e.transform.position);
        const from = vec3.add(e.transform.position, vec3.add(vec3.scale(e.character.facing, 0.75), vec3.scale(up, 0.4)));
        ball(world, from, vec3.add(vec3.scale(e.character.facing, 9), vec3.scale(up, 2.5)));
      }
    },

    onStart(world, registry) {
      const level = levels[String(registry.value('dojo.level'))];
      if (level) buildDojoLevel(world, level);
      else {
        // Without a level: the big cube, the one `dojo.spin` turns, and the floor, 20 m square with its
        // top at y = 0, drawn as a grid (stage 3b: before, the stage drew the grid, under any level).
        world.createEntity({
          name: 'cube',
          transform: { position: [0, 1, 0], rotation: quat.identity() },
          spin: { angularVelocity: [...START_SPIN] },
          body: { type: 'kinematic', shape: { kind: 'box', halfExtents: [0.5, 0.5, 0.5] } },
          appearance: { shape: 'box', size: [1, 1, 1], color: 0xe0a040 },
        });
        world.createEntity({
          name: 'floor',
          transform: { position: [0, -0.5, 0], rotation: quat.identity() },
          body: { type: 'fixed', shape: { kind: 'box', halfExtents: [10, 0.5, 10] } },
          appearance: { shape: 'grid', size: [20, 1, 20], color: GRID_COLOR },
        });
      }
      const cubes = Number(registry.value('dojo.cubes'));
      for (let i = 0; i < cubes; i++) randomCube(world);
    },
  };
}
