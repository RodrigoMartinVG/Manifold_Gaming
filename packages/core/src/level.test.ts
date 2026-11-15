import { beforeAll, describe, expect, test } from 'vitest';
import { approx, quat } from '@manifold/common';
import { buildLevel, levelFromText, levelToText } from './level';
import { initPhysics } from './physics';
import { World } from './world';

beforeAll(initPhysics);

const TEXT = `# Manifold level 1
# A comment: a whole line that starts with #.
title A small yard
spawn 0 1 6
facing 0 0 -1
box 0 0.5 -2   1 0.5 1   color #8a6a42
box -4 0.62 1.5  1 0.1 2.2  rotate x 18  color #6f6a62
sensor goal  0 1.8 -2  1 0.8 1
sensor fall  0 -6 0    60 3 60  rotate y 45
`;

describe('levels as data (stage 2a)', () => {
  test('a level is read from its text, and written back the same', () => {
    const level = levelFromText(TEXT);
    expect(level.title).toBe('A small yard');
    expect(level.spawn).toEqual([0, 1, 6]);
    expect(level.boxes).toHaveLength(2);
    expect(level.boxes[0]!.color).toBe(0x8a6a42);
    expect(level.boxes[1]!.turn).toEqual({ axis: 'x', degrees: 18 });
    expect(level.sensors.map((s) => s.kind)).toEqual(['goal', 'fall']);
    expect(levelFromText(levelToText(level))).toEqual(level);
  });

  test('a line that is not understood says which one, and why', () => {
    const bad = (line: string) => () => levelFromText(`# Manifold level 1\ntitle x\n${line}\n`);
    expect(bad('box 0 0 0  1 1')).toThrow(/line 3: a number is missing/);
    expect(bad('box 0 0 0  1 1 1  rotate w 10')).toThrow(/line 3: "w" is not an axis/);
    expect(bad('box 0 0 0  1 1 1  color red')).toThrow(/line 3: "red" is not a color/);
    expect(bad('sensor 0 0 0  1 1 1')).toThrow(/line 3: a zone needs what it is for/);
    expect(bad('tree 1 2 3')).toThrow(/line 3: "tree" is not understood/);
    expect(() => levelFromText('title x')).toThrow(/line 1: it must start with/);
    expect(() => levelFromText('# Manifold level 9\n')).toThrow(/format 9/);
  });

  test('what the format does not say is an error too (closing phase 2: before, these were read)', () => {
    const bad = (lines: string) => () => levelFromText(`# Manifold level 1\ntitle x\n${lines}\n`);
    // A box of no size, or turned inside out.
    expect(bad('box 0 0 0  0 1 1')).toThrow(/line 3: a half size must be more than 0/);
    expect(bad('sensor goal 0 0 0  1 -1 1')).toThrow(/line 3: a half size must be more than 0/);
    // Twice on a line, or twice in a level: the first was silently lost.
    expect(bad('box 0 0 0  1 1 1  rotate x 10  rotate y 20')).toThrow(/line 3: "rotate" twice on one line/);
    expect(bad('spawn 0 1 0\nspawn 0 2 0')).toThrow(/line 4: "spawn" twice in a level \(the first, on line 3\)/);
    expect(bad('title y')).toThrow(/line 3: "title" twice/);
    // A direction that is none, and numbers that are not decimal.
    expect(bad('facing 0 0 0')).toThrow(/line 3: facing needs a direction/);
    expect(bad('box 0x10 0 0  1 1 1')).toThrow(/line 3: "0x10" is not a number/);
    expect(bad('box Infinity 0 0  1 1 1')).toThrow(/line 3: "Infinity" is not a number/);
    expect(() => levelFromText('# Manifold level 01\n')).toThrow(/line 1: it must start with/);
    // What a program writes is still read: an exponent, a sign.
    expect(levelFromText('# Manifold level 1\nbox 1e-7 +2 -.5  1 1 1\n').boxes[0]!.center).toEqual([1e-7, 2, -0.5]);
  });

  test('built into a world: its boxes as fixed bodies that are seen, its zones as sensors that are not', () => {
    const world = new World({ seed: 1 });
    buildLevel(world, levelFromText(TEXT));
    const entities = [...world.entities.values()];
    expect(entities.filter((e) => e.body?.type === 'fixed' && e.appearance)).toHaveLength(2);
    const zones = entities.filter((e) => e.sensor);
    expect(zones.map((z) => z.sensor!.kind)).toEqual(['goal', 'fall']);
    expect(zones.every((z) => !z.appearance && !z.body)).toBe(true);
    // The ramp's 18°, with our own sine and cosine: the numbers the course used to have by hand.
    const ramp = entities[1]!.transform!.rotation;
    expect(approx.angleBetween(ramp, [0.15643446504023087, 0, 0, 0.9876883405951378])).toBeLessThan(1e-12);
    world.dispose();
  });
});

describe('zones (stage 2a)', () => {
  test('a turned zone notices a body in its corner, where the same zone unturned would not reach (stage 2.5b)', () => {
    // A long thin zone (4 m by 0.5 m) turned 45° around y: its far corner is near (1.4, 0, 1.4).
    // A body there is inside it; the zone unturned only reaches 0.25 m along z. (First, the box along
    // the world's axes that holds the zone: it must hold all of it.)
    const world = new World({ seed: 1 });
    world.createEntity({
      transform: { position: [0, 1, 0], rotation: quat.fromDegrees([0, 1, 0], -45) },
      sensor: { kind: 'z', half: [2, 0.5, 0.25] },
    });
    const ball = world.createEntity({
      transform: { position: [1.3, 1, 1.3], rotation: quat.identity() },
      body: { type: 'kinematic', shape: { kind: 'ball', radius: 0.1 } },
    });
    world.step();
    expect(world.stepEvents).toContainEqual({ type: 'sensorEntered', sensor: 1, entity: ball.id });
    world.dispose();
  });

  test('a ball falling through a zone: it came in, and then it left, once each', () => {
    const world = new World({ seed: 1 });
    const zone = world.createEntity({
      transform: { position: [0, 3, 0], rotation: quat.identity() },
      sensor: { kind: 'z', half: [1, 0.5, 1] },
    });
    const ball = world.createEntity({
      transform: { position: [0, 6, 0], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.2 } },
    });
    const seen: string[] = [];
    for (let i = 0; i < 90; i++) {
      world.step();
      for (const ev of world.stepEvents)
        if (ev.type === 'sensorEntered' || ev.type === 'sensorLeft')
          seen.push(`${ev.type} ${ev.sensor} ${ev.entity} at ${world.tick}`);
    }
    expect(seen).toHaveLength(2);
    expect(seen[0]).toMatch(new RegExp(`^sensorEntered ${zone.id} ${ball.id} `));
    expect(seen[1]).toMatch(new RegExp(`^sensorLeft ${zone.id} ${ball.id} `));
    expect(zone.sensor!.inside).toEqual([]);
    world.dispose();
  });

  test('a turned zone notices by its own axes; and someone removed inside it simply is not there any more', () => {
    const world = new World({ seed: 1, gravity: { kind: 'uniform', vector: [0, 0, 0] } });
    // A thin, long zone along x, turned 45° around y: (1.4, 0, 1.4) is inside it, (2, 0, 0) is not.
    const zone = world.createEntity({
      transform: { position: [0, 0, 0], rotation: quat.fromDegrees([0, 1, 0], -45) },
      sensor: { kind: 'z', half: [3, 1, 0.3] },
    });
    const inside = world.createEntity({
      transform: { position: [1.4, 0, 1.4], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.1 } },
    });
    world.createEntity({
      transform: { position: [2, 0, 0], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.1 } },
    });
    world.step();
    expect(zone.sensor!.inside).toEqual([inside.id]);
    world.removeEntity(inside.id);
    world.step();
    expect(zone.sensor!.inside).toEqual([]);
    expect(world.stepEvents.filter((e) => e.type === 'sensorLeft')).toEqual([]);
    world.dispose();
  });

  test('a body asleep is read once when it falls asleep, and again when something wakes it (stage 2.5b)', () => {
    const world = new World({ seed: 1 });
    world.createEntity({
      transform: { position: [0, -0.5, 0], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [10, 0.5, 10] } },
    });
    const cube = world.createEntity({
      transform: { position: [0, 0.6, 0], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'box', halfExtents: [0.25, 0.25, 0.25] } },
    });
    // Resting on the floor, it falls asleep: its velocities, read when it did, are exactly zero.
    for (let i = 0; i < 300; i++) world.step();
    expect(cube.body!.linearVelocity).toEqual([0, 0, 0]);
    const resting = [...cube.transform!.position];
    for (let i = 0; i < 30; i++) world.step();
    expect(cube.transform!.position).toEqual(resting);
    // Put up high, it wakes, falls, and its components follow it again.
    world.place(cube, [0, 5, 0]);
    for (let i = 0; i < 20; i++) world.step();
    expect(cube.transform!.position[1]).toBeLessThan(4.9);
    expect(cube.body!.linearVelocity[1]).toBeLessThan(-1);
    world.dispose();
  });

  test('placing an entity: it is there at once, stopped, without crossing what is in between', () => {
    const world = new World({ seed: 1 });
    const ball = world.createEntity({
      transform: { position: [0, 5, 0], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.2 } },
    });
    for (let i = 0; i < 30; i++) world.step();
    world.place(ball, [3, 8, -2]);
    expect(ball.transform!.position).toEqual([3, 8, -2]);
    expect(ball.body!.linearVelocity).toEqual([0, 0, 0]);
    world.step();
    expect(ball.transform!.position[0]).toBeCloseTo(3, 5);
    expect(ball.transform!.position[1]).toBeGreaterThan(7.9);
    world.dispose();
  });

  test('a character put just above the floor computes its next step from there, not from where it was: it does not sink', () => {
    const world = new World({ seed: 1 });
    world.createEntity({
      transform: { position: [0, -0.5, 0], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [30, 0.5, 30] } },
    });
    const hero = world.createEntity({
      transform: { position: [0, 3, 0], rotation: quat.identity() },
      body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
      character: { player: 1 },
    });
    for (let i = 0; i < 180; i++) world.step();
    const resting = hero.transform!.position[1];
    // High in the air, falling, and then put 1 mm above where it rests.
    world.place(hero, [0, 10, 0]);
    for (let i = 0; i < 20; i++) world.step();
    world.place(hero, [5, resting + 0.001, 0]);
    // Measured: computed from the air, the first step took it 2.7 mm down (one step of gravity, through
    // the floor), and it came out 0.1 mm per step. Now it stays where it rests (±0.1 mm).
    for (let i = 0; i < 10; i++) {
      world.step();
      expect(hero.transform!.position[1], `step ${i + 1}`).toBeGreaterThan(resting - 0.0001);
    }
    world.dispose();
  });
});

describe('moving platforms (stage 2d)', () => {
  test('a box that moves or spins: read, written back the same, built as a kinematic body', () => {
    const text =
      '# Manifold level 1\ntitle P\nbox 0 0.15 0  1.5 0.15 1.5  move 4 0 0 2  color #8a6a42\nbox 5 0.2 0  1 0.2 1  spin y 90\n';
    const level = levelFromText(text);
    expect(level.boxes[0]!.move).toEqual({ by: [4, 0, 0], seconds: 2 });
    expect(level.boxes[1]!.spin).toEqual({ axis: 'y', degrees: 90 });
    expect(levelFromText(levelToText(level))).toEqual(level);
    expect(() => levelFromText('# Manifold level 1\nbox 0 0 0  1 1 1  move 1 0 0 0\n')).toThrow(
      /line 2: a movement takes some time/,
    );
    const world = new World({ seed: 1 });
    buildLevel(world, level);
    const [moving, spinning] = [...world.entities.values()];
    expect(moving!.body!.type).toBe('kinematic');
    expect(moving!.mover).toEqual({ from: [0, 0.15, 0], to: [4, 0.15, 0], seconds: 2 });
    expect(spinning!.spin!.angularVelocity[1]).toBeCloseTo(Math.PI / 2, 12);
    world.dispose();
  });

  test('it goes and comes back where it should, trip after trip, without drifting', () => {
    const world = new World({ seed: 1 });
    buildLevel(world, levelFromText('# Manifold level 1\nbox 0 0.15 0  1.5 0.15 1.5  move 4 0 0 2\n'));
    const platform = [...world.entities.values()][0]!;
    const at = (steps: number) => {
      for (let i = 0; i < steps; i++) world.step();
      return platform.transform!.position[0];
    };
    expect(at(120)).toBeCloseTo(4, 3); // there, after 2 s
    expect(at(120)).toBeCloseTo(0, 3); // and back, after 4 s
    expect(at(60 * 40)).toBeCloseTo(0, 3); // ten more round trips later, in the same place
    world.dispose();
  });
});

describe('the level format, version 2 (stage 3b)', () => {
  const V2 = `# Manifold level 2
title Everything format 2 says
spawn 0 1 6
facing 0 0 -1
material oil  friction 0.02  bounce 0  density 900  drag 0.4
box 0 -0.5 0  10 0.5 10  grid  name floor
box 0 0.1 -4  2 0.1 2  material ice  color #c8dde6  name rink
box 3 0.1 -4  1 0.1 1  material oil  hidden
box 0 1 -8  2 1 0.2  group 2 3  meets 1
sensor current  0 1 -12  4 1 2  flow 3 0 0  name stream
sensor fog  0 2 -20  4 2 4  rotate y 30  opacity 0.2  color 0.8 0.8 0.9
`;

  test('names, materials, how a box is drawn, its groups, and what a zone carries: read, and written back the same', () => {
    const level = levelFromText(V2);
    expect(level.materials).toEqual({ oil: { friction: 0.02, bounce: 0, density: 900, drag: 0.4 } });
    const [floor, rink, slick, wall] = level.boxes;
    expect([floor!.name, floor!.look]).toEqual(['floor', 'grid']);
    expect([rink!.name, rink!.material, rink!.color]).toEqual(['rink', 'ice', 0xc8dde6]);
    expect([slick!.material, slick!.look]).toEqual(['oil', 'hidden']);
    // Groups 2 and 3 (bits 1 and 2), meeting only group 1; a box that says nothing, all of them.
    expect(wall!.groups).toEqual({ member: 0b110, filter: 0b1 });
    expect(floor!.groups).toBeNull();
    const [stream, fog] = level.sensors;
    expect([stream!.name, stream!.params]).toEqual(['stream', { flow: [3, 0, 0] }]);
    // A parameter's name may be any word (a fog's `color` is three numbers: the format does not read it).
    expect(fog!.params).toEqual({ opacity: [0.2], color: [0.8, 0.8, 0.9] });
    expect(levelFromText(levelToText(level))).toEqual(level);
  });

  test('a level of format 1 is still read, as what it says; what only format 2 says is an error in it, with its line', () => {
    const level = levelFromText(TEXT);
    expect(level.boxes.map((b) => [b.name, b.look, b.material, b.groups])).toEqual([
      [null, 'solid', null, null],
      [null, 'solid', null, null],
    ]);
    expect(level.sensors[0]!.params).toEqual({});
    const v1 = (line: string) => () => levelFromText(`# Manifold level 1\ntitle x\n${line}\n`);
    expect(v1('box 0 0 0  1 1 1  name a')).toThrow(/line 3: "name" is format 2: this level says format 1/);
    expect(v1('box 0 0 0  1 1 1  material ice')).toThrow(/line 3: "material" is format 2/);
    expect(v1('box 0 0 0  1 1 1  grid')).toThrow(/line 3: "grid" is format 2/);
    expect(v1('material oil friction 0 bounce 0 density 1 drag 0')).toThrow(/line 3: "material" is format 2/);
    expect(v1('sensor current 0 0 0  1 1 1  flow 1 0 0')).toThrow(/line 3: "flow": a zone carries what it says from format 2 on/);
    expect(() => levelFromText('# Manifold level 3\n')).toThrow(/line 1: a level of format 3: this engine reads formats 1 to 2/);
  });

  test('what format 2 does not allow says which line, and why', () => {
    const bad = (lines: string) => () => levelFromText(`# Manifold level 2\ntitle x\n${lines}\n`);
    // Materials: one the level does not have (declared below counts), the engine's again, incomplete, impossible.
    expect(bad('box 0 0 0  1 1 1  material lava')).toThrow(/line 3: no material "lava"/);
    expect(() =>
      levelFromText(`# Manifold level 2\nbox 0 0 0  1 1 1  material oil\nmaterial oil  friction 0 bounce 0 density 900 drag 0\n`),
    ).not.toThrow();
    expect(bad('material ice  friction 0 bounce 0 density 900 drag 0')).toThrow(/line 3: "ice" is the engine's/);
    expect(bad('material oil  friction 0.1 bounce 0')).toThrow(/line 3: a material needs its density, drag/);
    expect(bad('material oil  friction 0.1 bounce 2 density 1 drag 0')).toThrow(
      /line 3: the material "oil": its bounce goes from 0 to 1/,
    );
    expect(bad('material oil  friction 0.1 bounce 0 density 0 drag 0')).toThrow(/its density must be more than 0/);
    expect(bad('material oil  friction 0 bounce 0 density 1 drag 0\nmaterial oil  friction 0 bounce 0 density 1 drag 0')).toThrow(
      /line 4: the material "oil" twice \(the first, on line 3\)/,
    );
    // Names: one word, once in a level, for a box or a zone.
    expect(bad('box 0 0 0  1 1 1  name Door')).toThrow(/line 3: "Door" is not a name/);
    expect(bad('box 0 0 0  1 1 1  name door\nsensor goal 0 0 0  1 1 1  name door')).toThrow(
      /line 4: the name "door" twice in a level \(the first, on line 3\)/,
    );
    // How it is drawn: a grid or hidden, not both, and with no color of its own.
    expect(bad('box 0 0 0  1 1 1  grid hidden')).toThrow(/line 3: a box is drawn as a grid or not at all/);
    expect(bad('box 0 0 0  1 1 1  hidden  color #ffffff')).toThrow(/line 3: a hidden box has no color of its own/);
    // Groups: 1 to 16, each once, at least one.
    expect(bad('box 0 0 0  1 1 1  group 17')).toThrow(/line 3: 17 is not a collision group/);
    expect(bad('box 0 0 0  1 1 1  group 2 2')).toThrow(/line 3: the group 2 twice/);
    expect(bad('box 0 0 0  1 1 1  meets')).toThrow(/line 3: "meets" needs which groups/);
    // A zone's parameter: a word with its numbers, not one of the format's own words.
    expect(bad('sensor goal 0 0 0  1 1 1  flow')).toThrow(/line 3: "flow" needs its numbers/);
    expect(bad('sensor goal 0 0 0  1 1 1  material 1')).toThrow(/line 3: "material" is not something a zone carries/);
  });

  test("given the game's zones, a zone it does not have, or a parameter missing, extra or of another size, is an error with its line", () => {
    const zones = { goal: {}, current: { flow: 3 } };
    const read = (line: string) => () => levelFromText(`# Manifold level 2\n${line}\n`, { zones });
    expect(read('sensor current 0 0 0  1 1 1  flow 3 0 0')).not.toThrow();
    expect(read('sensor chekpoint 0 0 0  1 1 1')).toThrow(/line 2: "chekpoint" is not a zone of this game \(goal, current\)/);
    expect(read('sensor current 0 0 0  1 1 1')).toThrow(/line 2: a current needs its flow \(3 numbers\)/);
    expect(read('sensor current 0 0 0  1 1 1  flow 3 0')).toThrow(/line 2: "flow" takes 3 numbers/);
    expect(read('sensor current 0 0 0  1 1 1  flow 3 0 0  speed 2')).toThrow(/line 2: a current carries no "speed" \(flow\)/);
    expect(read('sensor goal 0 0 0  1 1 1  flow 3 0 0')).toThrow(/line 2: a goal carries no "flow" \(it carries nothing\)/);
  });

  test('built into a world: its materials, its names, its bodies made of them, drawn as they say, and its zones with what they carry', () => {
    const world = new World({ seed: 1 });
    buildLevel(world, levelFromText(V2));
    expect(world.materials.oil).toEqual({ friction: 0.02, bounce: 0, density: 900, drag: 0.4 });
    const floor = world.named('floor')!;
    expect(floor.appearance).toEqual({ shape: 'grid', size: [20, 1, 20], color: 0x262a33 });
    // Made of ice: its friction and bounce, ice's.
    const rink = world.named('rink')!;
    expect([rink.body!.material, rink.body!.friction, rink.body!.restitution]).toEqual(['ice', 0.05, 0.05]);
    // Hidden: a body, and nothing drawn.
    const slick = [...world.entities.values()].find((e) => e.body?.material === 'oil')!;
    expect([slick.body!.friction, slick.appearance]).toEqual([0.02, undefined]);
    expect([...world.entities.values()].find((e) => e.body?.groups)!.body!.groups).toEqual({ member: 0b110, filter: 0b1 });
    expect(world.named('stream')!.sensor!.params).toEqual({ flow: [3, 0, 0] });
    world.dispose();
  });
});
