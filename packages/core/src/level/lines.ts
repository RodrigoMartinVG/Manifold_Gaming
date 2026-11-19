import { quat, sinCosDegrees, vec3, type Vec3 } from '@manifold/common';
import { MATERIAL_NAME, MATERIALS, materialProblem, type Material } from '../materials';
import { FLOOR_THICKNESS, mapParts, type LevelMap } from '../map';
import type { Affordance, Components, Entity, SignalOp } from '../types';
import { copyData, ENTITY_NAME, type World } from '../world';
import { SIGNAL_READS, signalReadsProblem } from '../words';
import {
  ALL_GROUPS,
  AXES,
  DEFAULT_COLOR,
  GRID_COLOR,
  turnOf,
  type Level,
  type LevelBox,
  type LevelKit,
  type LevelLamp,
  type LevelObjective,
  type LevelRoute,
  type LevelScene,
  type LevelSensor,
  type LevelWatcher,
  type Turn,
} from './format';
import { AFFORDS, KEY, NAME, PARAMETER, ROTATE, type Extras, type LineReader } from './reader';

/** A box as it is read: its groups as the line says them, `group` and `meets` apart. */
type BoxRead = Omit<LevelBox, 'groups'> & { member: number | null; filter: number | null };

/** How long a mechanism takes, more than 0, and the signal it follows. */
const timeAndSignal = (r: LineReader) => {
  const seconds = r.number();
  if (seconds <= 0) r.fail('a mechanism takes some time: its seconds must be more than 0');
  return { seconds, signal: r.followed() };
};

const BOX_EXTRAS: Extras<BoxRead> = {
  rotate: ROTATE,
  move: {
    read: (r, b) => {
      const by = r.vector();
      const seconds = r.number();
      if (seconds <= 0) r.fail('a movement takes some time: its seconds must be more than 0');
      b.move = { by, seconds };
    },
  },
  spin: { read: (r, b) => void (b.spin = r.turn()) },
  color: {
    read: (r, b) => {
      const hex = r.word();
      if (!/^#[0-9a-f]{6}$/i.test(hex)) r.fail(`"${hex}" is not a color (#rrggbb)`);
      b.color = parseInt(hex.slice(1), 16);
    },
  },
  material: { since: 2, read: (r, b) => void (b.material = r.material()) },
  name: NAME,
  group: { since: 2, read: (r, b) => void (b.member = r.groups('group')) },
  meets: { since: 2, read: (r, b) => void (b.filter = r.groups('meets')) },
  grid: { since: 2, read: (_, b) => void (b.look = 'grid') },
  hidden: { since: 2, read: (_, b) => void (b.look = 'hidden') },
  door: {
    since: 3,
    read: (r, b) => {
      const hinge = r.vector();
      const turn = r.turn();
      b.door = { hinge, turn, ...timeAndSignal(r) };
    },
  },
  lift: {
    since: 3,
    read: (r, b) => {
      const by = r.vector();
      b.lift = { by, ...timeAndSignal(r) };
    },
  },
  model: { since: 3, read: (r, b) => void (b.model = r.model()) },
  breaks: { since: 5, read: (r, b) => void (b.breaks = r.energy()) },
  dynamic: { since: 6, read: (_, b) => void (b.dynamic = true) },
  affords: AFFORDS,
};
const KIT_EXTRAS: Extras<LevelKit> = {
  rotate: ROTATE,
  name: NAME,
  material: { since: 2, read: (r, k) => void (k.material = r.material()) },
  affords: AFFORDS,
};
const SENSOR_EXTRAS: Extras<LevelSensor> = { rotate: ROTATE, name: NAME, affords: AFFORDS };
const LAMP_EXTRAS: Extras<LevelLamp> = {
  signal: { since: 3, read: (r, l) => void (l.signal = r.followed()) },
  name: NAME,
  breaks: { since: 5, read: (r, l) => void (l.breaks = r.energy()) },
  model: { since: 3, read: (r, l) => void (l.model = r.model()) },
  affords: AFFORDS,
};
const WATCHER_EXTRAS: Extras<LevelWatcher> = { rotate: ROTATE, name: NAME, affords: AFFORDS };
const MATERIAL_KEYS = ['friction', 'bounce', 'density', 'drag'] as const;
const MATERIAL_EXTRAS: Extras<Partial<Material>> = Object.fromEntries(
  MATERIAL_KEYS.map((k) => [k, { read: (r: LineReader, m: Partial<Material>) => void (m[k] = r.number()) }]),
);

/**
 * WHAT A LEVEL'S LINE BUILDS (stage 3j): a box, a kit piece, a zone, a lamp, a watcher, a map's floor, a
 * route, an objective, a scene, by the word of the line that says it. The entity keeps it as data
 * (`source`), so the world can be written back as a level (`levelOfWorld`), with what the console added,
 * moved or took away since.
 */
export interface PieceItems {
  box: LevelBox;
  /** A piece of the game's kit (format 9): one body of its boxes, drawn with its model. */
  kit: LevelKit;
  sensor: LevelSensor;
  lamp: LevelLamp;
  watcher: LevelWatcher;
  /** A map's floor (stage 4a), one body: written back as a map of floor alone (its walls and zones are their own lines). */
  map: LevelMap;
  /** A route (stage 4d): an entity with its name and its points, and nothing else. */
  route: LevelRoute;
  /** An objective, a scene (stage 4f): an entity with its name and them. */
  objective: LevelObjective;
  scene: LevelScene;
}
export type PieceWord = keyof PieceItems;
export type LevelPiece = { [W in PieceWord]: { [K in W]: PieceItems[W] } }[PieceWord];

/** A kind of line (stage 5.5e, S5): how it is read, written and built. */
export interface LineKind {
  /** The format since which it is read (format 1's, if not said). */
  since?: number;
  /** Whether it comes once in a level (`title`, `spawn`…). */
  once?: boolean;
  /** Reads the rest of one line (its first word is its kind) into the level. */
  read(r: LineReader, level: Level): void;
  /** The level's lines of this kind, as text. */
  write(level: Level): string[];
  /** Puts the level's lines of this kind into a world (`buildLevel` runs them in the registry's order). */
  build?(world: World, level: Level): void;
}

/** A kind of line that builds pieces (stage 5.5e): one of them built, moved, kept as the level's, followed. */
export interface PieceKind<T> extends LineKind {
  /** Where a level keeps them. */
  list(level: Level): T[];
  /** The entity one makes, which keeps it as its `source`. */
  make(world: World, item: T, source: LevelPiece): Entity;
  /** It moved by `by` (`clone`); absent, one of a kind, with no place (an objective, a scene): not cloned. */
  move?(item: T, by: Vec3): void;
  /** Whether `add` takes a line of it (stage 3j). */
  added?: boolean;
  /** Whether it has a name `set name` changes along with its entity's. */
  named?: boolean;
  /** Its line follows a `set` of its entity's (its place, its color, a lamp's radius…). */
  follow?(item: T, field: string, value: unknown): void;
}

/** One thing written in a level that comes once: its word, and the line, if the level says it. */
type LineWords = 'title' | 'spawn' | 'facing' | 'ambient' | 'sky' | 'material' | 'signal';
type Lines = { [W in LineWords]: LineKind } & { [W in PieceWord]: PieceKind<PieceItems[W]> };

/** A piece with a center: moved there, its name not the copy's (names are one entity's), and its place followed. */
const centered = {
  move(item: { center: Vec3; name: string | null }, by: Vec3) {
    item.center = [item.center[0] + by[0], item.center[1] + by[1], item.center[2] + by[2]];
    item.name = null;
  },
  added: true,
  named: true,
};
const followPlace = (item: { center: Vec3 }, field: string, value: unknown) => {
  if (field === 'transform.position') item.center = [...(value as Vec3)];
};

const numbersText = (v: readonly number[]) => v.join(' ');
const affordsText = (affords: readonly Affordance[] | undefined) => (affords?.length ? `  affords ${affords.join(' ')}` : '');
const turnText = (turn: Turn | null) => (turn ? `  rotate ${turn.axis} ${turn.degrees}` : '');
/** Bits as the groups' numbers (1 to 16). */
const groupList = (bits: number) =>
  Array.from({ length: 16 }, (_, i) => i + 1)
    .filter((g) => bits & (1 << (g - 1)))
    .join(' ');
/** What the line says the thing is for (format 8), if it says. */
const affordsOf = (list: readonly Affordance[] | undefined) => (list?.length ? { affords: [...list] } : {});
/** A map's walls or its zones, as pieces (its floor is one body of its own). */
const mapPiecesOf = (m: LevelMap, kind: 'wall' | 'zone') => {
  const parts = mapParts(m);
  return mapPieces(m).filter((_, i) => parts[i]!.kind === kind);
};

/**
 * THE KINDS OF LINES (stage 5.5e, S5), each in one place: its word, the format since which it is read,
 * how it is read, written and built, and, for those that build pieces, how one is made, moved, kept and
 * followed. In the order they are written, which is the order they are built: an entity's id comes from
 * it, and so every world's hash (a map's walls after the kit pieces, its zones after the level's own).
 * Before, a kind was told apart in six places (the reader, the writer, the builder, the piece's union and
 * five places of the console's commands): the forest's `terrain` would have been about thirteen edits.
 */
export const LINES: Lines = {
  title: {
    once: true,
    read(r, level) {
      level.title = r.line.slice('title'.length).trim();
      r.at = r.words.length; // the title is the rest of the line
    },
    write: (level) => [`title ${level.title}`],
  },
  spawn: {
    once: true,
    read(r, level) {
      level.spawn = r.vector();
    },
    write: (level) => [`spawn ${numbersText(level.spawn)}`],
  },
  facing: {
    once: true,
    read(r, level) {
      level.facing = r.vector();
      if (level.facing.every((v) => v === 0)) r.fail('facing needs a direction, not 0 0 0');
    },
    write: (level) => [`facing ${numbersText(level.facing)}`],
  },
  ambient: {
    since: 4,
    once: true,
    read(r, level) {
      const light = r.number();
      if (light < 0) r.fail('the ambient light is 0 or more');
      level.ambient = light;
    },
    write: (level) => (level.ambient === null ? [] : [`ambient ${level.ambient}`]),
    build(world, level) {
      if (level.ambient !== null) world.ambient = level.ambient;
    },
  },
  sky: {
    since: 10,
    once: true,
    read(r, level) {
      const hour = r.number();
      if (hour < 0 || hour > 24) r.fail("the sky's hour is from 0 to 24 (19.5: half past seven in the evening)");
      level.sky = hour;
    },
    write: (level) => (level.sky === null ? [] : [`sky ${level.sky}`]),
  },
  material: {
    since: 2,
    read(r, level) {
      const name = r.word();
      if (!MATERIAL_NAME.test(name)) r.fail(`"${name}" is not a material's name: one word in lowercase, like oil`);
      if (MATERIALS[name]) r.fail(`"${name}" is the engine's: a level's material needs a name of its own`);
      const first = r.reading.materials.get(name);
      if (first !== undefined) r.fail(`the material "${name}" twice (the first, on line ${first + 1})`);
      r.reading.materials.set(name, r.n);
      const got: Partial<Material> = {};
      r.extras(got, MATERIAL_EXTRAS, (key) => r.fail(`"${key}" is not a material's (${MATERIAL_KEYS.join(', ')})`));
      const missing = MATERIAL_KEYS.filter((k) => got[k] === undefined);
      if (missing.length) r.fail(`a material needs its ${missing.join(', ')}`);
      const problem = materialProblem(got as Material);
      if (problem) r.fail(`the material "${name}": ${problem}`);
      level.materials[name] = got as Material;
    },
    write: (level) =>
      Object.entries(level.materials).map(
        ([name, m]) => `material ${name}  friction ${m.friction}  bounce ${m.bounce}  density ${m.density}  drag ${m.drag}`,
      ),
    build(world, level) {
      for (const [name, m] of Object.entries(level.materials)) world.addMaterial(name, m);
    },
  },
  box: {
    read(r, level) {
      const center = r.vector();
      const half = r.halves();
      const b: BoxRead = {
        name: null,
        center,
        half,
        turn: null,
        color: DEFAULT_COLOR,
        look: 'solid',
        model: null,
        breaks: null,
        dynamic: false,
        material: null,
        member: null,
        filter: null,
        move: null,
        spin: null,
        door: null,
        lift: null,
      };
      const seen = r.extras(b, BOX_EXTRAS);
      // What the program moves, one way at a time: a platform that comes and goes, one that turns, or a
      // mechanism that follows its signal.
      const ways = ['move', 'spin', 'door', 'lift', 'dynamic'].filter((w) => seen.has(w));
      if (ways.length > 1) r.fail(`a box moves one way: ${ways.join(' and ')} together`);
      // A grid's or a hidden box's color would not be seen: saying one is a mistake.
      if (seen.has('grid') && seen.has('hidden')) r.fail('a box is drawn as a grid or not at all, not both');
      if (b.look !== 'solid' && seen.has('color')) r.fail(`a ${b.look} box has no color of its own`);
      if (b.look !== 'solid' && b.model) r.fail(`a ${b.look} box is not drawn with a model`);
      const groups =
        b.member === null && b.filter === null ? null : { member: b.member ?? ALL_GROUPS, filter: b.filter ?? ALL_GROUPS };
      level.boxes.push({
        name: b.name,
        center,
        half,
        turn: b.turn,
        color: b.color,
        look: b.look,
        model: b.model,
        breaks: b.breaks,
        dynamic: b.dynamic,
        material: b.material,
        groups,
        move: b.move,
        spin: b.spin,
        door: b.door,
        lift: b.lift,
        ...(b.affords ? { affords: b.affords } : {}),
      });
    },
    write: (level) =>
      level.boxes.map(
        (b) =>
          `box ${numbersText(b.center)}  ${numbersText(b.half)}${turnText(b.turn)}` +
          (b.move ? `  move ${numbersText(b.move.by)} ${b.move.seconds}` : '') +
          (b.spin ? `  spin ${b.spin.axis} ${b.spin.degrees}` : '') +
          (b.door
            ? `  door ${numbersText(b.door.hinge)} ${b.door.turn.axis} ${b.door.turn.degrees} ${b.door.seconds} ${b.door.signal}`
            : '') +
          (b.lift ? `  lift ${numbersText(b.lift.by)} ${b.lift.seconds} ${b.lift.signal}` : '') +
          (b.material ? `  material ${b.material}` : '') +
          (b.groups && b.groups.member !== ALL_GROUPS ? `  group ${groupList(b.groups.member)}` : '') +
          (b.groups && b.groups.filter !== ALL_GROUPS ? `  meets ${groupList(b.groups.filter)}` : '') +
          (b.look === 'solid' ? `  color #${b.color.toString(16).padStart(6, '0')}` : `  ${b.look}`) +
          (b.model ? `  model ${b.model}` : '') +
          (b.breaks !== null ? `  breaks ${b.breaks}` : '') +
          (b.dynamic ? '  dynamic' : '') +
          affordsText(b.affords) +
          (b.name ? `  name ${b.name}` : ''),
      ),
    build(world, level) {
      for (const box of level.boxes) buildPiece(world, { box });
    },
    list: (level) => level.boxes,
    // Fixed; or, if it moves or turns, or is a mechanism, kinematic: the program moves it, and it pushes
    // what it touches; drawn as its look says.
    make(world, b, source) {
      const moves = b.move !== null || b.spin !== null || b.door !== null || b.lift !== null;
      // Degrees per second to radians per second: a constant product, the same everywhere.
      const spin = b.spin ? vec3.scale(AXES[b.spin.axis], (b.spin.degrees * Math.PI) / 180) : null;
      const size: Vec3 = [b.half[0] * 2, b.half[1] * 2, b.half[2] * 2];
      const appearance: Components['appearance'] =
        b.look === 'hidden'
          ? undefined
          : b.look === 'grid'
            ? { shape: 'grid', size, color: GRID_COLOR }
            : { shape: 'box', size, color: b.color, ...(b.model ? { model: b.model } : {}) };
      return world.createEntity({
        ...(b.name ? { name: b.name } : {}),
        transform: { position: [...b.center], rotation: turnOf(b.turn) },
        body: {
          type: b.dynamic ? 'dynamic' : moves ? 'kinematic' : 'fixed',
          shape: { kind: 'box', halfExtents: [...b.half] },
          ...(b.material ? { material: b.material } : {}),
          ...(b.groups ? { groups: { ...b.groups } } : {}),
        },
        ...(appearance ? { appearance } : {}),
        ...(spin ? { spin: { angularVelocity: spin } } : {}),
        ...(b.move ? { mover: { from: [...b.center], to: vec3.add(b.center, b.move.by), seconds: b.move.seconds } } : {}),
        ...(b.door
          ? {
              mechanism: {
                signal: b.door.signal,
                seconds: b.door.seconds,
                door: { hinge: vec3.add(b.center, b.door.hinge), axis: AXES[b.door.turn.axis], degrees: b.door.turn.degrees },
              },
            }
          : {}),
        ...(b.lift ? { mechanism: { signal: b.lift.signal, seconds: b.lift.seconds, lift: { by: [...b.lift.by] } } } : {}),
        ...(b.breaks !== null ? { breakable: { threshold: b.breaks } } : {}),
        ...affordsOf(b.affords),
        source,
      });
    },
    ...centered,
    follow(b, field, value) {
      followPlace(b, field, value);
      if (field === 'appearance.color') b.color = value as number;
    },
  },
  kit: {
    since: 9,
    read(r, level) {
      const piece = r.word();
      if (!/^[a-z][a-z0-9_]*$/.test(piece)) r.fail(`"${piece}" is not a kit piece's name (like wall_2)`);
      const kit = r.reading.o.kit;
      if (kit && !kit[piece]) r.fail(`"${piece}" is not a piece of this game's kit (${Object.keys(kit).join(', ')})`);
      const k: LevelKit = { name: null, piece, center: r.vector(), turn: null, material: null };
      r.extras(k, KIT_EXTRAS);
      level.kits.push(k);
    },
    write: (level) =>
      level.kits.map(
        (k) =>
          `kit ${k.piece}  ${numbersText(k.center)}${turnText(k.turn)}` +
          (k.material ? `  material ${k.material}` : '') +
          affordsText(k.affords) +
          (k.name ? `  name ${k.name}` : ''),
      ),
    build(world, level) {
      for (const kit of level.kits) buildPiece(world, { kit });
    },
    list: (level) => level.kits,
    // One body that never moves, its shape the piece's boxes as one compound, its look the piece's model
    // (the world has its game's kit).
    make(world, k, source) {
      const made = world.kit[k.piece];
      if (!made) throw new Error(`"${k.piece}" is not a piece of this game's kit`);
      return world.createEntity({
        ...(k.name ? { name: k.name } : {}),
        transform: { position: [...k.center], rotation: turnOf(k.turn) },
        body: {
          type: 'fixed',
          shape: {
            kind: 'compound',
            parts: made.boxes.map((b) => ({
              offset: [...b.center] as Vec3,
              halfExtents: [...b.half] as Vec3,
              ...(b.turn ? { rotation: turnOf(b.turn) } : {}),
            })),
          },
          ...(k.material ? { material: k.material } : {}),
        },
        appearance: { shape: 'box', size: [...made.size], color: DEFAULT_COLOR, model: made.model },
        ...affordsOf(k.affords),
        source,
      });
    },
    ...centered,
    follow: followPlace,
  },
  map: {
    since: 7,
    read(r) {
      const origin = r.vector();
      const cell = r.number();
      const height = r.number();
      if (cell <= 0 || height <= 0) r.fail("a map's cell and its walls' height are more than 0");
      // Then each character that stands for a zone, and the zone's kind.
      const zones = r.reading.o.zones;
      const legend: Record<string, string> = {};
      while (r.at < r.words.length) {
        const char = r.word();
        const zone = r.words[r.at++];
        if (char.length !== 1 || '#. '.includes(char)) r.fail(`"${char}" cannot stand for a zone: one character, not # or .`);
        if (!zone || !/^[a-z][a-z0-9.-]*$/.test(zone)) r.fail(`"${char}" needs the kind of zone it stands for`);
        const takes = zones?.[zone!];
        if (zones && !takes) r.fail(`"${zone}" is not a zone of this game (${Object.keys(zones).join(', ')})`);
        if (takes && Object.keys(takes).length) r.fail(`a ${zone} carries numbers: in a map, only zones that carry nothing`);
        legend[char] = zone!;
      }
      r.reading.drawing = { map: { origin, cell, height, legend, rows: [] }, line: r.n };
    },
    write: (level) =>
      level.maps.flatMap((m) => [
        `map ${numbersText(m.origin)}  ${m.cell} ${m.height}` +
          Object.entries(m.legend)
            .map(([c, z]) => `  ${c} ${z}`)
            .join(''),
        ...m.rows,
        'end',
      ]),
    // Its walls, each a box of its own; its floor, one body (stage 4a); its zones, after the level's own.
    build(world, level) {
      for (const m of level.maps) for (const p of mapPiecesOf(m, 'wall')) buildPiece(world, p);
      for (const m of level.maps) if (m.rows.some((r) => r.trim() !== '')) buildPiece(world, { map: floorOnly(m) });
    },
    list: (level) => level.maps,
    // A map's floor: one fixed body, a compound of its slabs, around the middle of what they cover.
    make(world, map, source) {
      const slabs = mapParts(map).filter((p) => p.kind === 'floor');
      const lo = [0, 1, 2].map((k) => Math.min(...slabs.map((p) => p.center[k]! - p.half[k]!)));
      const hi = [0, 1, 2].map((k) => Math.max(...slabs.map((p) => p.center[k]! + p.half[k]!)));
      const center: Vec3 = [(lo[0]! + hi[0]!) / 2, (lo[1]! + hi[1]!) / 2, (lo[2]! + hi[2]!) / 2];
      const parts = slabs.map((p) => ({ offset: vec3.sub(p.center, center), halfExtents: [...p.half] as Vec3 }));
      return world.createEntity({
        transform: { position: center, rotation: quat.identity() },
        // (Its slabs cover whole cells of the map: the physics makes them a grid, with no seams.)
        body: { type: 'fixed', shape: { kind: 'compound', parts, cell: [map.cell, FLOOR_THICKNESS, map.cell] } },
        appearance: {
          shape: 'boxes',
          size: [hi[0]! - lo[0]!, hi[1]! - lo[1]!, hi[2]! - lo[2]!],
          color: MAP_FLOOR,
          parts: parts.map((p) => ({ offset: [...p.offset], size: vec3.scale(p.halfExtents, 2) })),
        },
        source,
      });
    },
    // (Its map moves; it has no name.)
    move(map, by) {
      map.origin = [map.origin[0] + by[0], map.origin[1] + by[1], map.origin[2] + by[2]];
    },
  },
  sensor: {
    read(r, level) {
      const kind = r.words[r.at++];
      if (!kind || !/^[a-z][a-z0-9.-]*$/.test(kind)) r.fail('a zone needs what it is for, in one word (checkpoint, goal…)');
      const s: LevelSensor = { name: null, kind: kind!, center: r.vector(), half: r.halves(), turn: null, params: {} };
      // Anything else is what the zone carries: a word and its numbers (format 2).
      r.extras(s, SENSOR_EXTRAS, (word) => {
        if (!PARAMETER.test(word)) r.fail(`"${word}" is not understood here`);
        if (r.format < 2) r.fail(`"${word}": a zone carries what it says from format 2 on (this level says format ${r.format})`);
        if (FORMAT_WORDS.has(word)) r.fail(`"${word}" is not something a zone carries`);
        const values = r.numbers();
        if (values.length === 0) r.fail(`"${word}" needs its numbers`);
        s.params[word] = values;
      });
      // What the game says its zones take (if it says it).
      const kinds = r.reading.o.zones;
      if (kinds) {
        const takes = kinds[s.kind];
        if (!takes) r.fail(`"${s.kind}" is not a zone of this game (${Object.keys(kinds).join(', ')})`);
        for (const [param, values] of Object.entries(s.params)) {
          const count = takes![param];
          if (count === undefined)
            r.fail(`a ${s.kind} carries no "${param}" (${Object.keys(takes!).join(', ') || 'it carries nothing'})`);
          if (values.length !== count) r.fail(`"${param}" takes ${count === 1 ? '1 number' : `${count} numbers`}`);
        }
        for (const [param, count] of Object.entries(takes!))
          if (!s.params[param]) r.fail(`a ${s.kind} needs its ${param} (${count === 1 ? '1 number' : `${count} numbers`})`);
      }
      level.sensors.push(s);
    },
    write: (level) =>
      level.sensors.map(
        (s) =>
          `sensor ${s.kind}  ${numbersText(s.center)}  ${numbersText(s.half)}${turnText(s.turn)}` +
          Object.entries(s.params)
            .map(([k, v]) => `  ${k} ${numbersText(v)}`)
            .join('') +
          affordsText(s.affords) +
          (s.name ? `  name ${s.name}` : ''),
      ),
    // The level's zones, then those its maps draw.
    build(world, level) {
      for (const sensor of level.sensors) buildPiece(world, { sensor });
      for (const m of level.maps) for (const p of mapPiecesOf(m, 'zone')) buildPiece(world, p);
    },
    list: (level) => level.sensors,
    // A sensor that is not seen (`show.sensors` draws them); one that attenuates (stage 3d: an `opacity`)
    // is: a translucent box, as much as what gets through its thinnest side lets through.
    make(world, s, source) {
      const opacity = s.params.opacity?.[0];
      return world.createEntity({
        ...(s.name ? { name: s.name } : {}),
        transform: { position: [...s.center], rotation: turnOf(s.turn) },
        sensor: { kind: s.kind, half: [...s.half], params: copyParams(s.params) },
        ...(opacity
          ? {
              appearance: {
                shape: 'box' as const,
                size: [s.half[0] * 2, s.half[1] * 2, s.half[2] * 2] as Vec3,
                color: FOG_COLOR,
                opacity: 1 - 1 / (1 + opacity * 2 * Math.min(...s.half)),
              },
            }
          : {}),
        ...affordsOf(s.affords),
        source,
      });
    },
    ...centered,
    follow(s, field, value) {
      followPlace(s, field, value);
      if (field.startsWith('sensor.params.')) s.params[field.split('.').at(-1)!] = [...(value as number[])];
      else if (field === 'sensor.half') s.half = [...(value as Vec3)];
    },
  },
  lamp: {
    since: 4,
    read(r, level) {
      const center = r.vector();
      const radius = r.number();
      if (radius <= 0) r.fail("a lamp's radius must be more than 0");
      const intensity = r.number();
      if (intensity < 0) r.fail("a lamp's intensity is 0 or more");
      const l: LevelLamp = { name: null, center, radius, intensity, signal: null, breaks: null, model: null };
      r.extras(l, LAMP_EXTRAS);
      level.lamps.push(l);
    },
    write: (level) =>
      level.lamps.map(
        (l) =>
          `lamp ${numbersText(l.center)}  ${l.radius} ${l.intensity}` +
          (l.signal ? `  signal ${l.signal}` : '') +
          (l.breaks !== null ? `  breaks ${l.breaks}` : '') +
          (l.model ? `  model ${l.model}` : '') +
          affordsText(l.affords) +
          (l.name ? `  name ${l.name}` : ''),
      ),
    build(world, level) {
      for (const lamp of level.lamps) buildPiece(world, { lamp });
    },
    list: (level) => level.lamps,
    // Seen: a small warm ball (the presentation lights with it too).
    make(world, l, source) {
      return world.createEntity({
        ...(l.name ? { name: l.name } : {}),
        transform: { position: [...l.center], rotation: quat.identity() },
        lamp: { radius: l.radius, intensity: l.intensity, signal: l.signal },
        appearance: { shape: 'sphere', size: [0.3, 0.3, 0.3], color: LAMP_COLOR, ...(l.model ? { model: l.model } : {}) },
        // One that breaks has a small body, to be hit (its light's rays leave it out: lightAt).
        ...(l.breaks !== null
          ? {
              body: { type: 'fixed' as const, shape: { kind: 'ball' as const, radius: 0.15 } },
              breakable: { threshold: l.breaks },
            }
          : {}),
        ...affordsOf(l.affords),
        source,
      });
    },
    ...centered,
    follow(l, field, value) {
      followPlace(l, field, value);
      if (field === 'lamp.radius') l.radius = value as number;
      else if (field === 'lamp.intensity') l.intensity = value as number;
    },
  },
  watcher: {
    since: 4,
    read(r, level) {
      const center = r.vector();
      const range = r.number();
      if (range <= 0) r.fail("a watcher's range must be more than 0");
      const degrees = r.number();
      if (degrees <= 0 || degrees > 360) r.fail("a watcher's field of view is more than 0 degrees, and 360 at most");
      const threshold = r.number();
      if (threshold < 0) r.fail("a watcher's threshold is 0 or more");
      const w: LevelWatcher = { name: null, center, turn: null, range, degrees, threshold };
      r.extras(w, WATCHER_EXTRAS);
      level.watchers.push(w);
    },
    write: (level) =>
      level.watchers.map(
        (w) =>
          `watcher ${numbersText(w.center)}  ${w.range} ${w.degrees} ${w.threshold}${turnText(w.turn)}` +
          affordsText(w.affords) +
          (w.name ? `  name ${w.name}` : ''),
      ),
    build(world, level) {
      for (const watcher of level.watchers) buildPiece(world, { watcher });
    },
    list: (level) => level.watchers,
    // Seen: a short capsule with a visor that shows where it looks.
    make(world, w, source) {
      return world.createEntity({
        ...(w.name ? { name: w.name } : {}),
        transform: { position: [...w.center], rotation: turnOf(w.turn) },
        // Half its field of view's cosine, with our own (the same bits everywhere).
        watcher: { range: w.range, cone: sinCosDegrees(w.degrees / 2)[1], threshold: w.threshold },
        appearance: { shape: 'capsule', size: [0.5, 0.8, 0.5], color: WATCHER_COLOR },
        ...affordsOf(w.affords),
        source,
      });
    },
    ...centered,
    follow(w, field, value) {
      followPlace(w, field, value);
      if (field === 'watcher.range') w.range = value as number;
      else if (field === 'watcher.threshold') w.threshold = value as number;
    },
  },
  signal: {
    since: 3,
    read(r, level) {
      const name = r.signalName();
      const first = r.reading.signals.get(name);
      if (first !== undefined) r.fail(`the signal "${name}" twice (the first, on line ${first + 1})`);
      const op = (r.words[r.at++] ?? 'input') as SignalOp;
      if (SIGNAL_READS[op] === undefined) r.fail(signalReadsProblem(op, 0)!);
      const reads: string[] = [];
      while (r.at < r.words.length) {
        const read = r.word();
        if (!ENTITY_NAME.test(read)) r.fail(`"${read}" is not a name`);
        reads.push(read);
      }
      const wrong = signalReadsProblem(op, reads.length);
      if (wrong) r.fail(wrong);
      for (const read of reads) {
        if (op === 'zone' || op === 'used') r.reading.zonesRead.push({ zone: read, line: r.n });
        else if (op === 'seen') r.reading.watchersRead.push({ watcher: read, line: r.n });
        // Only signals declared above: so a cycle cannot be written.
        else if (!r.reading.signals.has(read))
          r.fail(
            `"${read}" is not a signal declared above (a signal reads only those above it: so it cannot read itself, even through others)`,
          );
      }
      r.reading.signals.set(name, r.n);
      level.signals.push({ name, op, reads });
    },
    write: (level) => level.signals.map((g) => ['signal', g.name, ...(g.op === 'input' ? [] : [g.op, ...g.reads])].join(' ')),
    // In their order, once the zones and the watchers they read are there.
    build(world, level) {
      for (const g of level.signals) world.addSignal(g.name, g.op, g.reads);
    },
  },
  route: {
    since: 8,
    read(r, level) {
      const name = r.name();
      const loop = r.words[r.at] === 'loop';
      if (loop) r.at++;
      const values = r.numbers();
      if (values.length % 3 !== 0) r.fail("a route's points are three numbers each (x y z)");
      const points: Vec3[] = [];
      for (let k = 0; k < values.length; k += 3) points.push([values[k]!, values[k + 1]!, values[k + 2]!]);
      if (points.length < 2) r.fail('a route needs two points or more');
      level.routes.push({ name, loop, points });
    },
    write: (level) => level.routes.map((r) => `route ${r.name}${r.loop ? ' loop' : ''}  ${r.points.map(numbersText).join('  ')}`),
    build(world, level) {
      for (const route of level.routes) buildPiece(world, { route });
    },
    list: (level) => level.routes,
    make: (world, r, source) =>
      world.createEntity({ name: r.name, route: { points: r.points.map((p) => [...p] as Vec3), loop: r.loop }, source }),
    // (Its points move; it needs a name, so a copy's is the first free one after it: `clone`.)
    move(r, by) {
      r.points = r.points.map((q) => [q[0] + by[0], q[1] + by[1], q[2] + by[2]]);
    },
    added: true,
  },
  objective: {
    since: 8,
    read(r, level) {
      const name = r.name();
      if (r.word() !== 'when') r.fail('an objective says `when <signal>` after its name');
      const when = r.followed();
      if (r.word() !== 'say') r.fail('an objective says `say <key>` after its signal');
      const say = r.key();
      let then: string | null = null;
      if (r.words[r.at] === 'then') {
        r.at++;
        then = r.word();
        if (!ENTITY_NAME.test(then)) r.fail(`"${then}" is not an objective's name`);
        r.reading.ledTo.push({ name: then, line: r.n });
      }
      level.objectives.push({ name, when, say, then });
    },
    write: (level) =>
      level.objectives.map((o) => `objective ${o.name} when ${o.when} say ${o.say}${o.then ? ` then ${o.then}` : ''}`),
    build(world, level) {
      for (const objective of level.objectives) buildPiece(world, { objective });
    },
    list: (level) => level.objectives,
    // The one to do if no objective leads to it (and one it leads to waits, now).
    make(world, o, source) {
      const led = [...world.entities.values()].some((e) => e.objective?.then === o.name);
      const next = o.then ? world.named(o.then) : undefined;
      if (next?.objective?.state === 'active') next.objective.state = 'waiting';
      return world.createEntity({
        name: o.name,
        objective: { say: o.say, when: o.when, then: o.then, state: led ? 'waiting' : 'active' },
        source,
      });
    },
  },
  scene: {
    since: 8,
    read(r, level) {
      const name = r.name();
      if (r.word() !== 'when') r.fail('a scene says `when <signal>` after its name');
      const when = r.followed();
      const lines: { who: string; say: string }[] = [];
      while (r.at < r.words.length) {
        const pair = r.word();
        const [who, say] = pair.split(':');
        if (!who || !say || !KEY.test(who) || !KEY.test(say))
          r.fail(`"${pair}" is not a line of a scene: who:key, like master:dojo.story.hello`);
        lines.push({ who: who!, say: say! });
      }
      if (lines.length === 0) r.fail('a scene needs a line at least (who:key)');
      level.scenes.push({ name, when, lines });
    },
    write: (level) =>
      level.scenes.map((sc) => `scene ${sc.name} when ${sc.when}  ${sc.lines.map((l) => `${l.who}:${l.say}`).join('  ')}`),
    build(world, level) {
      for (const scene of level.scenes) buildPiece(world, { scene });
    },
    list: (level) => level.scenes,
    make: (world, sc, source) =>
      world.createEntity({
        name: sc.name,
        scene: { lines: sc.lines.map((l) => ({ ...l })), when: sc.when, played: false },
        source,
      }),
  },
};

/** The words some format brought (a kind of line, or a word at its end): a zone may not carry one as its own. */
const FORMAT_WORDS: ReadonlySet<string> = new Set([
  ...Object.entries(LINES as Record<string, LineKind>).flatMap(([word, k]) => (k.since === undefined ? [] : [word])),
  ...[BOX_EXTRAS, KIT_EXTRAS, SENSOR_EXTRAS, LAMP_EXTRAS, WATCHER_EXTRAS].flatMap((extras) =>
    Object.entries(extras as Extras<unknown>).flatMap(([word, x]) => (x.since === undefined ? [] : [word])),
  ),
]);

/** The kind of a line by its first word, if it is one. */
export const lineKind = (word: string): LineKind | undefined =>
  Object.hasOwn(LINES, word) ? (LINES as Record<string, LineKind>)[word] : undefined;

/** The kind of the pieces a word's lines build, if they build pieces. */
export const pieceKind = (word: string): PieceKind<unknown> | undefined => {
  const kind = lineKind(word);
  return kind && 'list' in kind ? (kind as PieceKind<unknown>) : undefined;
};

/** A piece's word (its one key), its kind, and what its line says. */
export function pieceOf(piece: LevelPiece): { word: PieceWord; kind: PieceKind<unknown>; item: unknown } {
  const word = Object.keys(piece)[0] as PieceWord;
  return { word, kind: pieceKind(word)!, item: (piece as Record<string, unknown>)[word] };
}

/** A map's color for its walls and its floor. */
const MAP_WALL = 0x6f6a62;
const MAP_FLOOR = 0x57534c;

/**
 * A MAP'S FLOOR, AS ONE BODY (stage 4a): the map with every cell that is not a pit made floor, and no zones.
 * Built, it is one entity whose body is a compound of the floor's slabs, so what rolls across where two
 * slabs meet does not hop (measured after the tutorial: a ball at 6 m/s, 29 cm over slabs of 1 m; Rapier
 * mends seams within one collider). Written back, it is this map, which builds the same floor again.
 */
export function floorOnly(m: LevelMap): LevelMap {
  return { origin: [...m.origin], cell: m.cell, height: m.height, legend: {}, rows: m.rows.map((r) => r.replace(/[^ ]/g, '.')) };
}

/** What a map's parts are as a level's lines: its walls and floor, boxes; its zones, zones. */
export function mapPieces(m: LevelMap): LevelPiece[] {
  return mapParts(m).map((p): LevelPiece => {
    if (p.kind === 'zone')
      return { sensor: { name: null, kind: p.zone!, center: p.center, half: p.half, turn: null, params: {} } };
    return {
      box: {
        name: null,
        center: p.center,
        half: p.half,
        turn: null,
        color: p.kind === 'wall' ? MAP_WALL : MAP_FLOOR,
        look: 'solid',
        model: null,
        breaks: null,
        dynamic: false,
        material: null,
        groups: null,
        move: null,
        spin: null,
        door: null,
        lift: null,
      },
    };
  });
}

/** One piece of a level, in a world: the entity it makes, which keeps it (`source`). */
export function buildPiece(world: World, piece: LevelPiece): Entity {
  const { kind, item } = pieceOf(piece);
  return kind.make(world, item, copyPiece(piece));
}

/** A zone's parameters, copied (each its own list). */
const copyParams = (params: Record<string, number[]>) => Object.fromEntries(Object.entries(params).map(([k, v]) => [k, [...v]]));

/** A piece, copied all the way down (the entity's own: the level's stays as it was). */
const copyPiece = (piece: LevelPiece): LevelPiece => copyData(piece);

/** How a lamp and a watcher are drawn. */
export const LAMP_COLOR = 0xffd27a;
const FOG_COLOR = 0xb8c0c8;
const WATCHER_COLOR = 0x9a4a4a;
