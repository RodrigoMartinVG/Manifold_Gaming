import { beforeAll, describe, expect, test } from 'vitest';
import { quat, type Vec3 } from '@manifold/common';
import { buildLevel, levelFromText } from './level';
import { initPhysics } from './physics';
import { hitRadius, STEP_HEARD, STRIDE } from './sound';
import type { Event } from './types';
import { World } from './world';

beforeAll(initPhysics);

type Sound = Extract<Event, { type: 'sound' }>;

/** A world from a level, and every sound of each step. */
function world(level: string) {
  const w = new World({ seed: 1 });
  buildLevel(w, levelFromText(`# Manifold level 5\n${level}\n`));
  const sounds: Sound[] = [];
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      w.step();
      for (const ev of w.stepEvents) if (ev.type === 'sound') sounds.push(ev);
    }
  };
  return { w, step, sounds };
}

const hero = (w: World, at: Vec3) =>
  w.createEntity({
    transform: { position: at, rotation: quat.identity() },
    body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
    character: { player: 1 },
  });

describe('what is heard (stage 3f)', () => {
  test('a step every stride walked, on what it stands on: metal heard farther than wood, a run farther than a walk', () => {
    // Three floors side by side, along x: wood, stone, metal.
    const { w, step, sounds } = world(
      'box -6 -0.5 0  2 0.5 20  material wood\nbox -2 -0.5 0  2 0.5 20\nbox 2 -0.5 0  2 0.5 20  material metal',
    );
    const walkers = [hero(w, [-6, 0.82, 15]), hero(w, [2, 0.82, 15])];
    walkers[1]!.character!.player = 2;
    step(20);
    sounds.length = 0;
    // Both walk 60 steps (4.5 m/s: 4.5 m), the one on metal running for the last 30.
    for (let i = 0; i < 60; i++) {
      w.inputs.set(1, { move: [0, 0, -1] });
      w.inputs.set(2, { move: [0, 0, -1], run: i >= 30 });
      step();
    }
    const steps = (id: number) => sounds.filter((s) => s.sound === 'step' && s.source === id);
    const onWood = steps(walkers[0]!.id);
    const onMetal = steps(walkers[1]!.id);
    // 4.5 m in strides of 0.8: 5 or 6 (the first one sooner: it starts half a stride in, after landing).
    expect(onWood.length).toBeGreaterThanOrEqual(Math.floor(4.4 / STRIDE));
    // On wood, all of them; at walking speed, heard as far as a step on wood is (the first, while it got
    // going, a little less).
    expect(onWood.every((s) => s.surface === 'wood')).toBe(true);
    expect(onWood.at(-1)!.radius).toBeCloseTo(STEP_HEARD.wood!, 2);
    expect(onMetal[0]!.surface).toBe('metal');
    expect(onMetal[1]!.radius).toBeCloseTo(STEP_HEARD.metal!, 4);
    // Running (7.5 m/s): heard 7.5 / 4.5 as far, and more often.
    expect(onMetal.at(-1)!.radius).toBeCloseTo(STEP_HEARD.metal! * (7.5 / 4.5), 1);
    expect(onMetal.length).toBeGreaterThan(onWood.length);
    // Where the feet are.
    expect(onWood[0]!.at[1]).toBeCloseTo(0.02, 1);
    w.dispose();
  });

  test('a landing, by how fast it came down; standing still, nothing', () => {
    const { w, step, sounds } = world('box 0 -0.5 0  5 0.5 5');
    hero(w, [0, 3, 0]);
    step(80);
    const lands = sounds.filter((s) => s.sound === 'land');
    expect(lands).toHaveLength(1);
    // From 2.2 m above standing height: about √(2 g h) = 6.5 m/s.
    expect(lands[0]!.speed).toBeGreaterThan(5.5);
    expect(lands[0]!.radius).toBeGreaterThan(STEP_HEARD.stone!);
    sounds.length = 0;
    step(60);
    expect(sounds).toEqual([]);
    w.dispose();
  });

  test('a hit, by its energy: a ball dropped from higher is heard farther; resting, it is quiet', () => {
    const drop = (height: number) => {
      const { w, step, sounds } = world('box 0 -0.5 0  5 0.5 5  material wood');
      w.createEntity({
        transform: { position: [0, 0.2 + height, 0], rotation: quat.identity() },
        body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.2 }, restitution: 0 },
      });
      step(120);
      const hits = sounds.filter((s) => s.sound === 'hit');
      w.dispose();
      return hits;
    };
    const low = drop(0.5);
    const high = drop(2);
    expect(low[0]!.surface).toBe('wood');
    // The first hit: half the mass times the change in velocity squared: m g h at least (it came at
    // √(2 g h)), a little more for the small bounce the floor gives it back.
    const m = (4 / 3) * Math.PI * 0.2 ** 3;
    expect(high[0]!.energy).toBeGreaterThan(m * 9.81 * 2);
    expect(high[0]!.energy).toBeLessThan(1.5 * m * 9.81 * 2);
    expect(high[0]!.radius).toBeCloseTo(hitRadius(high[0]!.energy), 12);
    expect(high[0]!.radius).toBeGreaterThan(low[0]!.radius);
    // Then the small bounce lands, much softer, and it is quiet while it rests.
    expect(high.slice(1).every((h) => h.energy < high[0]!.energy / 5)).toBe(true);
  });

  test('a door creaks when it starts to move, a lift hums; what breaks is heard farthest', () => {
    const { w, step, sounds } = world(
      'box 0 -0.5 0  5 0.5 5\nbox 2 1 0  0.5 1 0.05  door -0.5 0 0 y 90 1 open\nbox -2 0.1 0  0.5 0.1 0.5  lift 0 2 0 2 open\nlamp 0 1.5 2  3 1  breaks 0.2  name lamp\nsignal open',
    );
    step(5);
    w.setSignal('open', 1);
    step(3);
    expect(sounds.filter((s) => s.sound === 'door' || s.sound === 'lift').map((s) => [s.sound, s.radius])).toEqual([
      ['door', 12],
      ['lift', 12],
    ]);
    w.createEntity({
      transform: { position: [0, 1.5, 1], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.2 }, linearVelocity: [0, 0.5, 6] },
    });
    step(30);
    const broke = sounds.find((s) => s.sound === 'break')!;
    expect(broke.surface).toBe('glass');
    expect(broke.radius).toBeGreaterThanOrEqual(15);
    w.dispose();
  });
});
