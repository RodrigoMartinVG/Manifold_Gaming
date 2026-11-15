import { beforeAll, describe, expect, test } from 'vitest';
import { quat, type Vec3 } from '@manifold/common';
import { stateHash } from './hash';
import { buildLevel, levelFromText } from './level';
import { initPhysics } from './physics';
import { insideLength, World } from './world';

beforeAll(initPhysics);

/**
 * A dark room (ambient 0.05): a floor, a lamp on a signal, a wall that shades, a screen between the
 * watcher and part of the lit floor, a fog bank, and a watcher at one end
 * looking down the room (along +Z: turned half a turn), seeing 20 m, 90°, things lit 0.3 or more.
 */
const ROOM = `# Manifold level 4
ambient 0.05
box 0 -0.5 0  10 0.5 12
box 4 1 0  0.2 1 2  name wall
box 3 1 -3  1 1 0.2  name screen
lamp 0 3 0  6 1  signal lights  name lamp
sensor fog  -5 1 0  1.5 1 1.5  opacity 2  name fog
watcher 0 2 -10  20 90 0.3  rotate y 180  name eye
signal lights
signal spotted  seen eye
`;

function room() {
  const world = new World({ seed: 1 });
  buildLevel(world, levelFromText(ROOM));
  const events: string[] = [];
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      world.step();
      for (const ev of world.stepEvents) if (ev.type === 'seen' || ev.type === 'lost') events.push(`${world.tick} ${ev.type}`);
    }
  };
  return { world, step, events };
}

function hero(world: World, at: Vec3) {
  return world.createEntity({
    transform: { position: at, rotation: quat.identity() },
    body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
    character: { player: 1 },
  });
}

describe('the light, the simulation’s (stage 3d)', () => {
  test('how lit a point is: the ambient, plus a lamp that sees it, falling linearly to its radius', () => {
    const { world, step } = room();
    world.setSignal('lights', 1);
    step();
    // Off in the step its signal turns on: it reads it as a mechanism does, as it was at the last step.
    expect(world.named('lamp')!.lamp!.on).toBe(false);
    step();
    expect(world.named('lamp')!.lamp!.on).toBe(true);
    // Under it, 2 m down: 1 × (1 − 2/6) + 0.05; 6 m away or more, the ambient alone.
    expect(world.lightAt([0, 1, 0])).toBeCloseTo(0.05 + 1 - 2 / 6, 12);
    expect(world.lightAt([0, 3, 6])).toBeCloseTo(0.05, 12);
    // Behind the wall (x = 4, from y 0 to 2): its shadow. Above it, the lamp sees it.
    expect(world.lightAt([5, 1, 0])).toBeCloseTo(0.05, 12);
    expect(world.lightAt([4.5, 2.6, 0])).toBeGreaterThan(0.2);
    // Off, the ambient alone everywhere.
    world.setSignal('lights', 0);
    step(2);
    expect(world.lightAt([0, 1, 0])).toBeCloseTo(0.05, 12);
    world.dispose();
  });

  test('a character knows how lit it is, at its center; its own body does not shade it, another body does', () => {
    const { world, step } = room();
    world.setSignal('lights', 1);
    const a = hero(world, [1, 1, 0]);
    step(30);
    const lit = a.character!.light;
    expect(lit).toBeCloseTo(0.05 + 1 - Math.hypot(1, 3 - a.transform!.position[1]) / 6, 6);
    // A ball between it and the lamp shades it.
    const y = a.transform!.position[1];
    world.createEntity({
      transform: { position: [0.5, (3 + y) / 2, 0], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'ball', radius: 0.3 } },
    });
    step(2);
    expect(a.character!.light).toBeCloseTo(0.05, 12);
    world.dispose();
  });

  test('what gets through a fog bank: 1 / (1 + its opacity × the length inside it), the same for light and sight', () => {
    const { world } = room();
    // The fog: 3 m across (x from −6.5 to −3.5), opacity 2 per meter: straight through it, 1 / (1 + 6).
    expect(world.transmission([-9, 1, 0], [-1, 1, 0])).toBeCloseTo(1 / 7, 12);
    // Half way in, 1.5 m: 1 / 4. Missing it, all of it.
    expect(world.transmission([-9, 1, 0], [-5, 1, 0])).toBeCloseTo(1 / 4, 12);
    expect(world.transmission([-9, 5, 0], [-1, 5, 0])).toBe(1);
    // The length inside a turned box: a cube of side 2 turned 45° around y, crossed along x through its
    // center: its diagonal, 2√2.
    expect(insideLength([0, 0, 0], quat.fromDegrees([0, 1, 0], 45), [1, 1, 1], [-5, 0, 0], [5, 0, 0])).toBeCloseTo(
      2 * Math.SQRT2,
      12,
    );
    world.dispose();
  });
});

describe('a watcher (stage 3d)', () => {
  test('it sees a character where it is lit, and loses it in the dark: "seen" and "lost" are events, and a signal counts them', () => {
    const { world, step, events } = room();
    world.setSignal('lights', 1);
    const a = hero(world, [0, 1, 0]);
    step(30);
    expect(world.named('eye')!.watcher!.sees).toEqual([a.id]);
    expect(world.signal('spotted')).toBe(1);
    // Into the dark (the lamp does not reach 8 m down the room): lost.
    world.place(a, [0, 1, 8]);
    step(5);
    expect(world.named('eye')!.watcher!.sees).toEqual([]);
    expect(world.signal('spotted')).toBe(0);
    // Back into the light; then the light goes out.
    world.place(a, [0, 1, 0]);
    step(5);
    world.setSignal('lights', 0);
    step(5);
    expect(events.map((e) => e.split(' ')[1])).toEqual(['seen', 'lost', 'seen', 'lost']);
    world.dispose();
  });

  test('not behind a wall, not outside its field of view, not through a fog bank it would see it without', () => {
    const { world, step } = room();
    world.setSignal('lights', 1);
    // Lit, but behind the screen from the eye: hidden. (The screen across z = −3, from x 2 to 4; the
    // eye at (0, 2, −10).)
    const a = hero(world, [3, 1, -1]);
    step(30);
    expect(a.character!.light, 'lit').toBeGreaterThan(0.3);
    expect(world.named('eye')!.watcher!.sees, 'behind the screen').toEqual([]);
    // Behind the eye: out of its 90°.
    world.place(a, [0, 1, -11]);
    step(5);
    expect(world.named('eye')!.watcher!.sees).toEqual([]);
    world.dispose();
    // A lamp in the fog bank lights it; seen from beyond it, the fog takes what the eye would see.
    const w2 = new World({ seed: 1 });
    buildLevel(
      w2,
      levelFromText(
        '# Manifold level 4\nambient 0\nbox 0 -0.5 0  10 0.5 12\nlamp -5 3 4  5 1\nsensor fog  -5 1 0  3 1.5 1  opacity 2\nwatcher -5 1.5 -9  20 90 0.3  rotate y 180  name eye\n',
      ),
    );
    const b = hero(w2, [-5, 1, 4]);
    for (let i = 0; i < 30; i++) w2.step();
    expect(b.character!.light).toBeGreaterThan(0.3);
    expect(w2.named('eye')!.watcher!.sees, 'through 2 m of fog: a fifth of its light').toEqual([]);
    w2.place(b, [-5, 1, 4]);
    w2.named('eye')!.transform!.position = [-5, 1.5, 9]; // (the eye moved: on the lamp's side)
    w2.named('eye')!.transform!.rotation = quat.identity();
    for (let i = 0; i < 2; i++) w2.step();
    expect(w2.named('eye')!.watcher!.sees, 'from this side of the fog').toEqual([b.id]);
    w2.dispose();
  });

  test('the light and what the watcher sees are data: in the hash, and a snapshot goes on to exactly the same', () => {
    const { world, step } = room();
    world.setSignal('lights', 1);
    const a = hero(world, [0, 1, 0]);
    step(20);
    const snap = world.snapshot();
    const back = World.restore(snap);
    expect(back.ambient).toBe(0.05);
    for (let i = 0; i < 40; i++) {
      world.inputs.set(1, { move: [0, 0, 1] });
      back.inputs.set(1, { move: [0, 0, 1] });
      world.step();
      back.step();
    }
    expect(stateHash(back)).toBe(stateHash(world));
    expect(back.entities.get(a.id)!.character!.light).toBe(a.character!.light);
    const before = stateHash(world);
    world.ambient = 0.06;
    expect(stateHash(world)).not.toBe(before);
    world.dispose();
    back.dispose();
  });
});
