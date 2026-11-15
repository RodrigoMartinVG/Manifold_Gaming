import { beforeAll, describe, expect, test } from 'vitest';
import { quat, vec3, type Quat, type Vec3 } from '@manifold/common';
import { NO_INPUT } from './input';
import { buildLevel, levelFromText } from './level';
import { initPhysics } from './physics';
import { stateHash } from './hash';
import { World } from './world';

beforeAll(initPhysics);

/** A floor, a plate, a button, a door and a lift, and the signals between them. */
const LEVEL = `# Manifold level 3
box 0 -0.5 0  12 0.5 12
box 3 1.1 -4  0.6 1.1 0.06  door -0.6 0 0 y 90 1 gate  name the_door
box -3 0.15 -4  1 0.15 1  lift 0 4 0 2 lift_up  name the_lift
sensor plate   -3 0.5 1  1 0.5 1  name plate
sensor top     -3 5.1 -4  1 0.6 1  name top
sensor button  0 1 4  0.6 1 0.6  name button
signal pressed  used button
signal gate     toggle pressed
signal called   zone plate
signal sent     zone top
signal lift_up  latch called sent
signal lights
signal dark     not lights
`;

function world() {
  const w = new World({ seed: 1 });
  buildLevel(w, levelFromText(LEVEL));
  const changes: string[] = [];
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      w.step();
      for (const ev of w.stepEvents)
        if (ev.type === 'signalChanged') changes.push(`${w.tick} ${ev.signal} ${ev.was}→${ev.value}`);
    }
  };
  return { w, step, changes };
}

/**
 * The angle between two turns, precise near 0 (from the vector part of the turn between them: an
 * arc cosine of their dot product, near 1, turns the rotations' 32-bit rounding into 0.0004 rad).
 */
const turnBetween = (a: Quat, b: Quat) => {
  const d = quat.multiply(quat.conjugate(b), a);
  return 2 * Math.asin(Math.min(1, Math.hypot(d[0], d[1], d[2])));
};

/** A character, standing at a place. */
function hero(w: World, at: Vec3) {
  return w.createEntity({
    transform: { position: at, rotation: quat.identity() },
    body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
    character: { player: 1 },
  });
}

describe('signals (stage 3c, decision 0018)', () => {
  test('an input takes its value at the end of the step it is set, and what reads it follows in the same pass', () => {
    const { w, step, changes } = world();
    step();
    expect([w.signal('lights'), w.signal('dark')]).toEqual([0, 1]);
    w.setSignal('lights', 1);
    expect(w.signal('lights'), 'not until the step ends').toBe(0);
    step();
    expect([w.signal('lights'), w.signal('dark')]).toEqual([1, 0]);
    // Each change, an event, in the order declared.
    expect(changes).toEqual(['1 dark 0→1', '2 lights 0→1', '2 dark 1→0']);
    w.dispose();
  });

  test('a signal that is computed cannot be set; one added reading a later one cannot be added', () => {
    const { w } = world();
    expect(() => w.setSignal('dark', 1)).toThrow(/"dark" is computed \(not lights\): set what it reads/);
    expect(() => w.setSignal('nowhere', 1)).toThrow(/no signal "nowhere"/);
    expect(() => w.addSignal('later', 'not', ['later_still'])).toThrow(/not a signal added before it/);
    expect(() => w.addSignal('dark', 'input', [])).toThrow(/there is one already/);
    w.dispose();
  });

  test('a plate counts who is on it, characters and what the physics moves; a latch keeps the lift called', () => {
    const { w, step } = world();
    step();
    expect(w.signal('called')).toBe(0);
    const ball = w.createEntity({
      transform: { position: [-3, 2, 1], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.2 } },
    });
    step(40);
    expect([w.signal('called'), w.signal('lift_up')]).toEqual([1, 1]);
    // Gone from the plate, the latch keeps it: the lift stays called until it is sent.
    w.removeEntity(ball.id);
    step();
    expect([w.signal('called'), w.signal('lift_up')]).toEqual([0, 1]);
    w.dispose();
  });

  test('a button: pressing `use` in it is one step of `used`, and the toggle flips once per press', () => {
    const { w, step } = world();
    hero(w, [0, 0.82, 4]);
    step(10);
    const press = () => {
      w.inputs.set(1, { ...NO_INPUT, use: true });
      step();
      const used = w.signal('pressed');
      w.inputs.set(1, { ...NO_INPUT, use: true });
      step(5); // held: no more presses
      w.inputs.set(1, NO_INPUT);
      step();
      return used;
    };
    expect(press()).toBe(1);
    expect([w.signal('pressed'), w.signal('gate')]).toEqual([0, 1]);
    press();
    expect(w.signal('gate')).toBe(0);
    w.dispose();
  });
});

describe('mechanisms (stage 3c)', () => {
  test('a door opens one step after its signal turns on, and after its seconds is open exactly where its function says', () => {
    const { w, step } = world();
    const door = w.named('the_door')!;
    hero(w, [0, 0.82, 4]);
    step(10);
    const closed = [...door.transform!.position] as Vec3;
    // One press of the button at step N: its toggle turns the door's signal on at the end of N.
    w.inputs.set(1, { ...NO_INPUT, use: true });
    step();
    const pressedAt = w.tick;
    expect(w.signal('gate')).toBe(1);
    expect(door.transform!.position, 'not yet: the signal changed at the end of this step').toEqual(closed);
    w.inputs.set(1, NO_INPUT);
    step();
    expect(turnBetween(door.transform!.rotation, quat.fromDegrees([0, 1, 0], 1.5))).toBeLessThan(1e-6);
    // One second (60 steps) after it started: open, 90° around its hinge at x = 2.4.
    step(59);
    expect(w.tick - pressedAt).toBe(60);
    expect(vec3.length(vec3.sub(door.transform!.position, [2.4, 1.1, -4.6]))).toBeLessThan(1e-5);
    expect(turnBetween(door.transform!.rotation, quat.fromDegrees([0, 1, 0], 90))).toBeLessThan(1e-5);
    // And it stays there.
    step(30);
    expect(turnBetween(door.transform!.rotation, quat.fromDegrees([0, 1, 0], 90))).toBeLessThan(1e-5);
    w.dispose();
  });

  test('turned back halfway, it closes from where it is, in as long as it took to get there', () => {
    const { w, step } = world();
    const door = w.named('the_door')!;
    hero(w, [0, 0.82, 4]);
    step(10);
    const press = () => {
      w.inputs.set(1, { ...NO_INPUT, use: true });
      step();
      w.inputs.set(1, NO_INPUT);
    };
    const at = (degrees: number) => turnBetween(door.transform!.rotation, quat.fromDegrees([0, 1, 0], degrees));
    press();
    step(30);
    expect(at(45), 'half open').toBeLessThan(1e-5);
    // Pressed again: it still opens in that step (its signal changes at the step's end), 46.5°, then it
    // comes back from there, 1.5° a step: 31 steps.
    press();
    expect(at(46.5)).toBeLessThan(1e-5);
    step(30);
    expect(at(1.5)).toBeLessThan(1e-5);
    step();
    expect(at(0), 'closed').toBeLessThan(1e-5);
    step(10);
    expect(at(0), 'and it stays').toBeLessThan(1e-5);
    w.dispose();
  });

  test('riding the lift: called from the plate, it takes the character up 4 m, standing all the way (3a: its ground)', () => {
    const { w, step } = world();
    const lift = w.named('the_lift')!;
    const rider = hero(w, [-3, 1.15, -4]);
    step(20);
    expect(rider.character!.grounded).toBe(true);
    const from = rider.transform!.position[1];
    // A ball on the plate calls it.
    w.createEntity({
      transform: { position: [-3, 2, 1], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.2 } },
    });
    let off = 0;
    for (let i = 0; i < 200; i++) {
      step();
      if (!rider.character!.grounded) off++;
    }
    expect(lift.transform!.position[1]).toBeCloseTo(4.15, 4);
    expect(rider.transform!.position[1] - from).toBeCloseTo(4, 2);
    expect(off, 'steps it was not standing').toBe(0);
    // At the top it is in the zone `top`, which sends the lift back down: a latch, the first wins (called
    // is still on: the ball is still on the plate), so it stays up.
    expect([w.signal('sent'), w.signal('lift_up')]).toEqual([1, 1]);
    w.dispose();
  });

  test('a snapshot halfway through a door opening goes on to exactly the same: signals and mechanisms are data', () => {
    const { w, step } = world();
    hero(w, [0, 0.82, 4]);
    step(10);
    w.inputs.set(1, { ...NO_INPUT, use: true });
    step();
    w.inputs.set(1, NO_INPUT);
    step(20);
    const snap = w.snapshot();
    const back = World.restore(snap);
    for (let i = 0; i < 60; i++) {
      w.step();
      back.step();
    }
    expect(stateHash(back)).toBe(stateHash(w));
    expect(back.named('the_door')!.transform!.rotation).toEqual(w.named('the_door')!.transform!.rotation);
    w.dispose();
    back.dispose();
  });
});
