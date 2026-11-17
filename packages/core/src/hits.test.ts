import { beforeAll, describe, expect, test } from 'vitest';
import { quat, vec3, type Vec3 } from '@manifold/common';
import { HISTORY } from './character';
import { castHit, MOST_BACK, poseBack, rayBall, rayCapsule } from './hits';
import { actionsFor, inputProblem, normalizeInput } from './input';
import { initPhysics } from './physics';
import { VERIFIED } from './profile';
import { replayFromText, replayToText } from './replay';
import type { HitPart } from './types';
import { World } from './world';

beforeAll(initPhysics);

const X: Vec3 = [1, 0, 0];

describe('rays against shapes (stage 4c)', () => {
  test('a ball: where the ray first meets it; inside, 0; past it, or away from it, nothing', () => {
    expect(rayBall([-5, 0, 0], X, [0, 0, 0], 1, 10)).toBe(4);
    expect(rayBall([-5, 0.6, 0], X, [0, 0, 0], 1, 10)).toBeCloseTo(5 - 0.8, 12);
    expect(rayBall([-5, 1.01, 0], X, [0, 0, 0], 1, 10)).toBeNull();
    expect(rayBall([5, 0, 0], X, [0, 0, 0], 1, 10)).toBeNull();
    expect(rayBall([-5, 0, 0], X, [0, 0, 0], 1, 3.9)).toBeNull();
    expect(rayBall([0.5, 0, 0], X, [0, 0, 0], 1, 10)).toBe(0);
  });

  test('a capsule: its side, its rounded ends, along its axis; inside, 0', () => {
    const a: Vec3 = [0, -0.5, 0];
    const b: Vec3 = [0, 0.5, 0];
    // At its side, at its middle and near its end.
    expect(rayCapsule([-5, 0, 0], X, a, b, 0.3, 10)).toBeCloseTo(4.7, 12);
    expect(rayCapsule([-5, 0.4, 0], X, a, b, 0.3, 10)).toBeCloseTo(4.7, 12);
    // Over its top end: the ball there (0.1 above the end: √(0.09 − 0.01) short of its axis).
    expect(rayCapsule([-5, 0.6, 0], X, a, b, 0.3, 10)).toBeCloseTo(5 - Math.sqrt(0.08), 12);
    expect(rayCapsule([-5, 0.81, 0], X, a, b, 0.3, 10)).toBeNull();
    // Down its axis, from above: its top ball.
    expect(rayCapsule([0, 5, 0], [0, -1, 0], a, b, 0.3, 10)).toBeCloseTo(5 - 0.8, 12);
    expect(rayCapsule([0.1, 0, 0], X, a, b, 0.3, 10)).toBe(0);
  });
});

/** A floor, and characters standing on it (their default hit part: their capsule). */
function room() {
  const world = new World({ seed: 1 });
  world.createEntity({
    transform: { position: [0, -0.5, 0], rotation: quat.identity() },
    body: { type: 'fixed', shape: { kind: 'box', halfExtents: [30, 0.5, 30] } },
  });
  const character = (at: Vec3, player: number, hits?: HitPart[]) =>
    world.createEntity({
      transform: { position: at, rotation: quat.identity() },
      body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
      character: { player, ...(hits ? { hits: { walk: hits, air: hits } } : {}) },
    });
  return { world, character };
}

describe('the history of poses (stage 4c, decision 0022)', () => {
  test('each character keeps its last 16 poses, the oldest first, the newest as this step ended', () => {
    const { world, character } = room();
    const runner = character([0, 1, 0], 1);
    const where: Vec3[] = [];
    for (let i = 0; i < 40; i++) {
      world.inputs.set(1, { move: [1, 0, 0] });
      world.step();
      where.push([...runner.transform!.position]);
    }
    const h = runner.character!.history;
    expect(h).toHaveLength(HISTORY);
    expect(h.at(-1)!.position).toEqual(where.at(-1));
    expect(poseBack(runner, 5)!.position).toEqual(where.at(-6));
    expect(poseBack(runner, 15)!.position).toEqual(where.at(-16));
    // More than it keeps: as far as it keeps.
    expect(poseBack(runner, 40)).toBe(h[0]);
    expect(h.at(-1)!.mode).toBe('walk');
    world.dispose();
  });

  test('a shot at where a runner was 10 steps ago: looking back 10, it hits; looking at now, it misses; at now, it hits now', () => {
    const { world, character } = room();
    const runner = character([0, 1, 0], 1);
    const shooter = character([0, 1, 10], 2);
    for (let i = 0; i < 90; i++) {
      world.inputs.set(1, { move: i > 30 ? [1, 0, 0] : [0, 0, 0] });
      world.step();
    }
    // Running at 4.5 m/s along +X: 10 steps, 75 cm.
    const then = poseBack(runner, 10)!.position;
    const now = runner.transform!.position;
    expect(now[0] - then[0]).toBeCloseTo(0.75, 1);
    const at = (target: Vec3) => {
      const from = shooter.transform!.position;
      const to = vec3.sub(target, from);
      return { from, direction: vec3.normalize(to), reach: vec3.length(to) + 2 };
    };
    const old = at(then);
    expect(castHit(world, old.from, old.direction, old.reach, { back: 10, skip: shooter.id })).toMatchObject({
      kind: 'character',
      entity: runner.id,
      part: 'body',
    });
    expect(castHit(world, old.from, old.direction, old.reach, { back: 0, skip: shooter.id })).toBeNull();
    const current = at(now);
    expect(castHit(world, current.from, current.direction, current.reach, { skip: shooter.id })).toMatchObject({
      entity: runner.id,
    });
    // Its own body is left out: aimed at itself from inside, nothing.
    expect(castHit(world, shooter.transform!.position, [0, 0, -1], 1, { skip: shooter.id })).toBeNull();
    world.dispose();
  });

  test('its parts, by name: the head, the body; a wall in between, as it is now, stops the shot first; more than 15 back is 15', () => {
    const { world, character } = room();
    const parts: HitPart[] = [
      { name: 'head', shape: { kind: 'ball', radius: 0.15 }, offset: [0, 0.6, 0], rotation: quat.identity() },
      {
        name: 'body',
        shape: { kind: 'capsule', halfHeight: 0.35, radius: 0.28 },
        offset: [0, -0.05, 0],
        rotation: quat.identity(),
      },
    ];
    const target = character([0, 1, 0], 1, parts);
    for (let i = 0; i < 30; i++) world.step();
    const y = target.transform!.position[1];
    expect(castHit(world, [-5, y + 0.6, 0], X, 10)).toMatchObject({ kind: 'character', part: 'head' });
    expect(castHit(world, [-5, y, 0], X, 10)).toMatchObject({ kind: 'character', part: 'body' });
    // A strike: a ball of 0.2 swept past above the head (0.15 + 0.2 reaches it, 0.32 above its center).
    expect(castHit(world, [-5, y + 0.92, 0], X, 10, { radius: 0.2 })).toMatchObject({ part: 'head' });
    expect(castHit(world, [-5, y + 0.92, 0], X, 10)).toBeNull();
    // A wall between: it is hit.
    world.createEntity({
      transform: { position: [-2, 1, 0], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [0.1, 1, 1] } },
    });
    world.step();
    expect(castHit(world, [-5, y, 0], X, 10)).toMatchObject({ kind: 'world', distance: expect.closeTo(2.9, 5) });
    expect(MOST_BACK).toBe(15);
    expect(poseBack(target, 99)).toBe(poseBack(target, 15));
    world.dispose();
  });

  test('a snapshot keeps the history: the restored world judges a shot looking back as the one it came from', () => {
    const { world, character } = room();
    const runner = character([0, 1, 0], 1);
    for (let i = 0; i < 60; i++) {
      world.inputs.set(1, { move: [0, 0, 1] });
      world.step();
    }
    const copy = World.restore(world.snapshot());
    const then = poseBack(runner, 12)!.position;
    const shot = [[-5, then[1], then[2]] as Vec3, X, 10, { back: 12 }] as const;
    const a = castHit(world, ...shot);
    const b = castHit(copy, ...shot);
    expect(a).toMatchObject({ kind: 'character', entity: runner.id });
    expect(b).toEqual(a);
    world.dispose();
    copy.dispose();
  });
});

describe('a count, an input (stage 4c, decision 0022)', () => {
  const actions = actionsFor([
    { name: 'test.shoot', kind: 'button', description: '' },
    { name: 'test.back', kind: 'count', max: 15, description: '' },
  ]);

  test('a whole number from 0 to its most: rounded and clamped as it enters; another kind of value, refused', () => {
    expect(normalizeInput({ 'test.back': 7.4 }, actions)).toEqual({ 'test.back': 7 });
    expect(normalizeInput({ 'test.back': 40 }, actions)).toEqual({ 'test.back': 15 });
    expect(normalizeInput({ 'test.back': -3 }, actions)).toEqual({});
    expect(inputProblem({ 'test.back': 4 }, actions)).toBeNull();
    expect(inputProblem({ 'test.back': 4.5 }, actions)).toMatch(/whole number from 0 to 15/);
    expect(inputProblem({ 'test.back': 16 }, actions)).toMatch(/whole number from 0 to 15/);
    expect(inputProblem({ 'test.back': true }, actions)).toMatch(/is a count/);
  });

  test('in a replay, written as its number and read back the same', () => {
    const text = replayToText({
      game: 'test',
      profile: VERIFIED,
      birth: '',
      changes: [],
      inputs: [{ step: 3, player: 1, input: { 'test.shoot': true, 'test.back': 9 } }],
      end: { step: 10, hash: 1 },
    });
    expect(text).toMatch(/^input 3 1 test\.shoot test\.back 9$/m);
    expect(replayFromText(text).inputs[0]!.input).toEqual({ 'test.shoot': true, 'test.back': 9 });
  });
});
