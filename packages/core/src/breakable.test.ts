import { beforeAll, describe, expect, test } from 'vitest';
import { quat, type Vec3 } from '@manifold/common';
import { stateHash } from './hash';
import { buildLevel, levelFromText, levelToText } from './level';
import { initPhysics } from './physics';
import { World } from './world';

beforeAll(initPhysics);

/** A floor, and a box that a hit of 0.3 J breaks; a ball (r 0.2 m: 0.0335 kg) dropped on it from a height. */
function drop(height: number) {
  const world = new World({ seed: 1 });
  buildLevel(
    world,
    levelFromText('# Manifold level 5\nbox 0 -0.5 0  5 0.5 5\nbox 0 0.25 0  0.25 0.25 0.25  breaks 0.3  name crate\n'),
  );
  const crate = world.named('crate')!;
  const ball = world.createEntity({
    transform: { position: [0, 0.5 + 0.2 + height, 0], rotation: quat.identity() },
    body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.2 } },
  });
  const broke: { energy: number; seed: number; by: number; at: Vec3 }[] = [];
  for (let i = 0; i < 120; i++) {
    world.step();
    for (const ev of world.stepEvents) if (ev.type === 'broke') broke.push(ev);
  }
  return { world, crate, ball, broke };
}

describe('what breaks (stage 3e)', () => {
  test('a hit above its threshold breaks it, one below does not: the energy, half the mass times the speed squared', () => {
    // From 0.5 m: m g h = 0.0335 × 9.81 × 0.5 = 0.16 J, under 0.3: it holds.
    const low = drop(0.5);
    expect(low.broke).toEqual([]);
    expect(low.world.named('crate')).toBe(low.crate);
    low.world.dispose();
    // From 2 m: 0.66 J (as the ball came, the step before it touched): it breaks.
    const high = drop(2);
    expect(high.broke).toHaveLength(1);
    expect(high.broke[0]!.energy).toBeGreaterThan(0.3);
    expect(high.broke[0]!.energy).toBeCloseTo((4 / 3) * Math.PI * 0.2 ** 3 * 9.81 * 2, 1);
    expect(high.broke[0]!.by).toBe(high.ball.id);
    high.world.dispose();
  });

  test('broken, it is gone but for a few large pieces the physics moves, in the world and in its hash', () => {
    const { world, crate, broke } = drop(2);
    expect(world.entities.has(crate.id)).toBe(false);
    const pieces = [...world.entities.values()].filter((e) => e.body?.type === 'dynamic' && e.body.shape.kind === 'box');
    // Its largest side, 0.5 m: one piece per 0.2 m (rounded), 2 at least: 2 or 3; a third of its side each.
    expect(pieces.length).toBe(Math.max(2, Math.round(0.5 / 0.2)));
    for (const p of pieces) expect(p.body!.shape).toEqual({ kind: 'box', halfExtents: [0.5 / 3 / 2, 0.5 / 3 / 2, 0.5 / 3 / 2] });
    // They fell, and rest on the floor.
    for (const p of pieces) expect(p.transform!.position[1]).toBeLessThan(0.3);
    expect(broke[0]!.at).toEqual([0, 0.25, 0]);
    world.dispose();
  });

  test('the same world breaks the same way: the same pieces, the same seed, the same hash (a snapshot before the hit too)', () => {
    const a = drop(2);
    const b = drop(2);
    expect(b.broke[0]!.seed).toBe(a.broke[0]!.seed);
    expect(stateHash(b.world)).toBe(stateHash(a.world));
    a.world.dispose();
    b.world.dispose();
    // From a snapshot a few steps before the hit.
    const world = new World({ seed: 1 });
    buildLevel(world, levelFromText('# Manifold level 5\nbox 0 -0.5 0  5 0.5 5\nbox 0 0.25 0  0.25 0.25 0.25  breaks 0.3\n'));
    world.createEntity({
      transform: { position: [0, 2.7, 0], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.2 } },
    });
    for (let i = 0; i < 20; i++) world.step();
    const back = World.restore(world.snapshot());
    for (let i = 0; i < 100; i++) {
      world.step();
      back.step();
    }
    expect(stateHash(back)).toBe(stateHash(world));
    world.dispose();
    back.dispose();
  });

  test('a lamp that breaks gives no light, stays (dark, broken) and stops colliding; the watcher that saw by it loses its character', () => {
    const world = new World({ seed: 1 });
    buildLevel(
      world,
      levelFromText(
        '# Manifold level 5\nambient 0.05\nbox 0 -0.5 0  8 0.5 8\nlamp 0 1.5 0  4 1  breaks 0.2  name lamp\nwatcher 0 2 -7  15 90 0.3  rotate y 180  name eye\n',
      ),
    );
    const hero = world.createEntity({
      transform: { position: [0, 0.82, 1.5], rotation: quat.identity() },
      body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
      character: { player: 1 },
    });
    for (let i = 0; i < 20; i++) world.step();
    const eye = world.named('eye')!;
    expect(eye.watcher!.sees).toEqual([hero.id]);
    // A ball thrown at the lamp, 6 m/s: 0.5 × 0.0335 × 36 = 0.6 J.
    world.createEntity({
      transform: { position: [0, 1.5, -1.5], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.2 }, linearVelocity: [0, 0.6, 6] },
    });
    const events: string[] = [];
    for (let i = 0; i < 40; i++) {
      world.step();
      for (const ev of world.stepEvents) if (ev.type === 'broke' || ev.type === 'lost') events.push(ev.type);
    }
    const lamp = world.named('lamp')!;
    expect(lamp.breakable!.broken).toBe(true);
    expect(lamp.lamp!.on).toBe(false);
    expect(lamp.body).toBeUndefined();
    expect(hero.character!.light).toBeCloseTo(0.05, 12);
    expect(events).toEqual(['broke', 'lost']);
    world.dispose();
  });

  test('format 5: what breaks, read and written back the same; its energy, 0 or more', () => {
    const text =
      '# Manifold level 5\nbox 0 0.5 0  0.5 0.5 0.5  breaks 3\nlamp 0 2 0  4 1  breaks 0.4  model dojo.lamp  name lamp\n';
    const level = levelFromText(text);
    expect(level.boxes[0]!.breaks).toBe(3);
    expect(level.lamps[0]).toMatchObject({ breaks: 0.4, model: 'dojo.lamp' });
    expect(levelFromText(levelToText(level))).toEqual(level);
    expect(() => levelFromText('# Manifold level 5\nbox 0 0 0  1 1 1  breaks -1\n')).toThrow(
      /line 2: what breaks it is an energy, 0 or more/,
    );
    expect(() => levelFromText('# Manifold level 4\nbox 0 0 0  1 1 1  breaks 1\n')).toThrow(/line 2: "breaks" is format 5/);
  });
});
