import { beforeAll, describe, expect, test } from 'vitest';
import { levelDiff, levelOfWorld } from './building';
import type { Cartridge } from './cartridge';
import { buildLevel, levelFromText, levelToText } from './level';
import { initPhysics } from './physics';
import { playRecipe, registryFor, Session } from './session';
import { World } from './world';

beforeAll(initPhysics);

/** A room: a floor, a lamp, a zone that reads who is in it, a door that follows it. */
const ROOM = `# Manifold level 7
title The room
spawn 0 1 4
facing 0 0 -1
ambient 0.2
material oil  friction 0.02  bounce 0  density 900  drag 0.4
box 0 -0.5 0  6 0.5 6  grid  name floor
box 2 1 -3  0.5 1 0.05  door -0.5 0 0 y 90 1 open  color #8a6a42  name door
sensor plate  0 0.1 -1  0.5 0.1 0.5  name pad
lamp 0 3 0  6 1  name lamp
watcher 0 2 -5  8 60 0.3  name eye
signal open zone pad
`;

/** A game that builds a level, by its text, from a startup value (as the Dojo does with its files). */
const game: Cartridge = {
  id: 'test',
  title: 'Test',
  zones: { plate: {}, goal: {} },
  onDeclare(registry) {
    registry.declareVariable({
      name: 'test.level',
      description: 'Which level.',
      scope: 'startup',
      type: { kind: 'text' },
      default: 'room',
    });
  },
  onStart(world) {
    buildLevel(world, levelFromText(ROOM, { zones: { plate: {}, goal: {} } }));
  },
};

describe('a world as a level (stage 3j)', () => {
  test('what a level built, written back: the same level (its title, start, ambient, materials, pieces and signals)', () => {
    const level = levelFromText(ROOM);
    const world = new World({ seed: 1 });
    buildLevel(world, level);
    expect(levelOfWorld(world)).toEqual(level);
    expect(levelToText(levelOfWorld(world))).toBe(levelToText(level));
    // A snapshot keeps what it was built from.
    expect(levelOfWorld(World.restore(world.snapshot()))).toEqual(level);
    world.dispose();
  });

  test('a map is built as its walls, its zones and its floor as one body; written back, they build the same world again', () => {
    const text = '# Manifold level 7\ntitle Maze\nmap 0 0 0  2 3  G goal\n#####\n#..G#\n#####\nend\n';
    const level = levelFromText(text, { zones: { goal: {} } });
    expect(level.maps[0]!.rows).toEqual(['#####', '#..G#', '#####']);
    expect(levelFromText(levelToText(level))).toEqual(level);
    const world = new World({ seed: 1 });
    buildLevel(world, level);
    const once = levelOfWorld(world);
    // Its walls as boxes (the top row; each side, two rows; what is left of the bottom one), its zone,
    // and its floor (stage 4a: one body) as a map of floor alone.
    expect(once.boxes.length).toBe(4);
    expect(once.sensors.map((s) => s.kind)).toEqual(['goal']);
    expect(once.maps.map((m) => m.rows)).toEqual([['.....', '.....', '.....']]);
    expect(once.maps[0]!.legend).toEqual({});
    const again = new World({ seed: 1 });
    buildLevel(again, once);
    expect(levelOfWorld(again)).toEqual(once);
    world.dispose();
    again.dispose();
  });

  test('a map that is not understood says its line: a character it does not know, one that does not end', () => {
    expect(() => levelFromText('# Manifold level 7\nmap 0 0 0  2 3\n#x#\nend\n')).toThrow(/line 3: "x" is not in the map/);
    expect(() => levelFromText('# Manifold level 7\nmap 0 0 0  2 3\n###\n')).toThrow(/line 2: a map that does not end/);
    expect(() => levelFromText('# Manifold level 6\nmap 0 0 0  2 3\n#\nend\n')).toThrow(/line 2: "map" is format 7/);
    expect(() => levelFromText('# Manifold level 7\nmap 0 0 0  2 3  G nest\n#G#\nend\n', { zones: { goal: {} } })).toThrow(
      /line 2: "nest" is not a zone of this game/,
    );
  });
});

describe('building from the console (stage 3j)', () => {
  /** A session of the test game, and a way to type and step. */
  function room() {
    const session = new Session(game);
    const type = (line: string) => session.registry.run(line);
    const step = (n = 1) => {
      for (let i = 0; i < n; i++) session.step();
    };
    return { session, type, step, world: () => session.world };
  }

  test('a route (stage 4d), added and cloned: its points moved, the copy named the next free name after it', () => {
    const { type, step, world } = room();
    expect(type('add route rounds loop  0 0 4  4 0 4')).toEqual([]);
    step();
    type('clone rounds 0 0 -1');
    type('clone rounds 0 0 -2');
    step();
    expect(levelOfWorld(world()).routes).toEqual([
      {
        name: 'rounds',
        loop: true,
        points: [
          [0, 0, 4],
          [4, 0, 4],
        ],
      },
      {
        name: 'rounds_2',
        loop: true,
        points: [
          [0, 0, 3],
          [4, 0, 3],
        ],
      },
      {
        name: 'rounds_3',
        loop: true,
        points: [
          [0, 0, 2],
          [4, 0, 2],
        ],
      },
    ]);
  });

  test('add, clone, set, delete: world changes at a step; the level written back says what was done', () => {
    const { session, type, step, world } = room();
    expect(type('add box 0 2 -2  0.2 0.2 0.2  dynamic  material wood  color #b08850  name crate')).toEqual([]);
    expect(type('add lamp 3 3 0  5 1')).toEqual([]);
    step();
    expect(world().named('crate')!.body!.type).toBe('dynamic');
    type('clone crate 1 0 0');
    type('set lamp lamp.intensity *2');
    type('set floor appearance.color #223344');
    type('delete eye');
    step();
    const level = levelOfWorld(world());
    expect(level.boxes.map((b) => b.name)).toEqual(['floor', 'door', 'crate', null]);
    // The clone is the crate's line, moved, without its name.
    expect(level.boxes[3]!.center).toEqual([1, 2, -2]);
    expect(level.lamps.find((l) => l.name === 'lamp')!.intensity).toBe(2);
    expect(level.watchers).toEqual([]);
    // What changed since it was born.
    const born = levelFromText(ROOM);
    expect(levelDiff(born, level)).toEqual([
      '- lamp 0 3 0  6 1  name lamp',
      '- watcher 0 2 -5  8 60 0.3  name eye',
      expect.stringMatching(/^\+ box 0 2 -2 {2}0.2 0.2 0.2 {2}material wood {2}color #b08850 {2}dynamic {2}name crate$/),
      expect.stringMatching(/^\+ box 1 2 -2 /),
      '+ lamp 0 3 0  6 2  name lamp',
      '+ lamp 3 3 0  5 1',
    ]);
    // In the session's history, like any world change, as it was typed (the rest of the line as it is,
    // not in quotes: it is read back that way): a replay plays them.
    expect(session.history.map((h) => h.line.split(' ')[0])).toEqual(['add', 'add', 'clone', 'set', 'set', 'delete']);
    expect(session.history[0]!.line).toBe('add box 0 2 -2  0.2 0.2 0.2  dynamic  material wood  color #b08850  name crate');
    expect(session.history[3]!.line).toBe('set lamp lamp.intensity *2');
    session.world.dispose();
  });

  test('what cannot be done is said when typed, with why, and nothing is scheduled', () => {
    const { session, type } = room();
    const errors = (line: string) =>
      type(line)
        .filter((m) => m.level === 'error')
        .map((m) => m.text);
    expect(errors('add box 0 0 0  1 1 1  name floor')).toEqual([
      expect.stringMatching(/add: the name "floor" is already in the world/),
    ]);
    expect(errors('add box 0 0 0  1 1 1  door 0 0 0 y 90 1 nothing')).toEqual([expect.stringMatching(/no signal "nothing"/)]);
    expect(errors('add sensor nest 0 0 0  1 1 1')).toEqual([expect.stringMatching(/"nest" is not a zone of this game/)]);
    expect(errors('delete ghost')).toEqual(['delete: no entity ghost']);
    expect(errors('set door transform.position 0 0 0')).toEqual(["set: it moves by itself: its place is its line's"]);
    expect(errors('set floor body.shape 1')).toEqual([expect.stringMatching(/the physics'/)]);
    expect(errors('set lamp lamp.intensity 1 2')).toEqual(['set: lamp.intensity: a number']);
    expect(session.history).toEqual([]);
    session.world.dispose();
  });

  test('set moves what the physics moves through the world, and the level line follows; relative values', () => {
    const { session, type, step, world } = room();
    type('add box 0 1 -2  0.2 0.2 0.2  material wood  name block');
    step();
    type('set block transform.position +1 +0 +0');
    step();
    expect(world().named('block')!.transform!.position).toEqual([1, 1, -2]);
    expect(levelOfWorld(world()).boxes.find((b) => b.name === 'block')!.center).toEqual([1, 1, -2]);
    // A variable, relative: half the gravity.
    session.registry.run('physics.gravity *0.5');
    expect(session.registry.value('physics.gravity')).toEqual([0, -4.905, 0]);
    session.world.dispose();
  });
});

describe('recipes that wait and check (stage 3j)', () => {
  test('wait leaves the rest for later; assert says yes or no: a recipe is a test', () => {
    const { session, said, failed } = playRecipe(
      game,
      [
        'test.level room',
        'wait 1',
        'add box 0 3 -2  0.2 0.2 0.2  dynamic  name ball',
        'assert ball.transform.position.y > 2',
        'wait 90',
        'assert ball.transform.position.y < 0.3',
        'assert signal.open = 0',
        'assert ambient.nothing = 1',
        'assert floor.transform.position ~ 0 -0.5 0',
      ].join('\n'),
    );
    // Right after it is scheduled, the ball is not there yet (it enters at the next step).
    expect(failed).toEqual([
      'assert ball.transform.position.y > 2: no variable, signal or entity "ball"',
      'assert ambient.nothing = 1: no variable, signal or entity "ambient"',
    ]);
    expect(said.filter((m) => m.level === 'info').map((m) => m.text)).toEqual([
      'test.level = room',
      'assert ball.transform.position.y < 0.3: yes',
      'assert signal.open = 0: yes',
      'assert floor.transform.position ~ 0 -0.5 0: yes',
    ]);
    expect(session.world.tick).toBe(91);
    session.world.dispose();
  });

  test('a registry with nothing waiting: wait alone says so; a bad count is an error', () => {
    const registry = registryFor(game);
    expect(registry.run('wait 10')).toEqual([]);
    expect(registry.pending).toBe(false);
    expect(registry.run('wait x').map((m) => m.level)).toEqual(['error']);
  });
});
