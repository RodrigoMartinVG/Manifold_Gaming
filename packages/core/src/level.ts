import { quat, vec3, type Quat, type Vec3 } from '@manifold/common';
import { MATERIAL_NAME, MATERIALS, materialProblem, type Material } from './materials';
import type { CollisionGroups, Components } from './types';
import { ENTITY_NAME, type World } from './world';

/**
 * LEVELS AS DATA (stage 2a; decision 0000, rule 4). A level is text, one thing per line, that can be
 * read, compared by eye and written by hand, by code or (later) by an editor or an importer from
 * Blender, which only have to produce this same text:
 *
 *   # Manifold level 2                        the format's version
 *   title The course
 *   spawn 0 1 6                               where a player starts (x y z)…
 *   facing 0 0 -1                             …and where it looks
 *   box -4 0.62 1.5  1 0.1 2.2  rotate x 18  color #6f6a62
 *                                             a fixed box: its center, half its sizes, a turn
 *                                             (around x, y or z, in degrees) and its color
 *   sensor goal  -3 4.4 -7  1 0.8 1           a zone: what it is for (the game's word), center, half sizes
 *   box 11.5 0.15 6  1.5 0.15 1.5  move 9 0 0 5    a platform that goes 9 m along x in 5 s, and back
 *   box -6 0.2 7  1.5 0.2 1.5  spin y 40           a platform that turns 40° per second around y
 *
 * Format 2 (stage 3b) adds, and format 1 is still read:
 *
 *   material oil  friction 0.02  bounce 0  density 900  drag 0.4
 *                                             a material of the level's own (the engine has stone,
 *                                             wood, metal, glass and ice: materials.ts)
 *   box 0 -0.5 0  10 0.5 10  material ice  name rink
 *                                             what a box is made of (its friction and bounce; a
 *                                             character slides on ice), and its name (`inspect rink`)
 *   box 0 -0.5 0  10 0.5 10  grid             drawn as the Dojo's floor, a grid; `hidden`: not drawn
 *   box 0 1 -3  2 1 0.2  group 2  meets 1     which collision groups it is in, and which it meets (1 to 16)
 *   sensor current  0 0.8 -12  5 0.8 1.5  flow 3 0 0
 *                                             a zone with what it carries: words, each with its numbers
 *                                             (what they mean is the game's, which may say which ones
 *                                             each of its zones takes: `levelFromText`'s `zones`)
 *
 * The turns are written in degrees, as a person thinks them, and become quaternions with our own sine
 * and cosine (`quat.fromDegrees`): the browser's would give other bits in another browser, and the
 * world must be born the same everywhere.
 */
export const LEVEL_FORMAT = 2;
const HEADER = '# Manifold level';

/** A turn around one of the axes, as it is written. */
export interface Turn {
  axis: 'x' | 'y' | 'z';
  degrees: number;
}

/** How a box is drawn: as a box of its color, as a grid (the Dojo's floor), or not at all. */
export type Look = 'solid' | 'grid' | 'hidden';

export interface LevelBox {
  /** Its name (format 2), if it has one: the console finds it by it, signals will join it. */
  name: string | null;
  center: Vec3;
  half: Vec3;
  turn: Turn | null;
  color: number;
  /** How it is drawn (format 2). */
  look: Look;
  /** What it is made of (format 2), if it is said: the engine's materials or the level's. */
  material: string | null;
  /** Which collision groups it is in and meets (format 2), if it is said: if not, all. */
  groups: CollisionGroups | null;
  /** If it goes back and forth (stage 2d): how far, and how long one way takes. */
  move: { by: Vec3; seconds: number } | null;
  /** If it turns (stage 2d): around which axis, and how many degrees per second. */
  spin: Turn | null;
}

export interface LevelSensor {
  /** Its name (format 2), if it has one. */
  name: string | null;
  kind: string;
  center: Vec3;
  half: Vec3;
  turn: Turn | null;
  /** What it carries besides its kind (format 2), in the order written: each word with its numbers. */
  params: Record<string, number[]>;
}

export interface Level {
  title: string;
  spawn: Vec3;
  facing: Vec3;
  /** The level's own materials (format 2), by name, in the order written. */
  materials: Record<string, Material>;
  boxes: LevelBox[];
  sensors: LevelSensor[];
}

/**
 * The zones a game understands, and what each one takes (stage 3b): by kind, each parameter's name
 * and how many numbers it has (`{ current: { flow: 3 }, goal: {} }`). Given to `levelFromText`, a
 * zone of another kind, a parameter missing, extra or with more or fewer numbers is an error with its
 * line: before, a `chekpoint` was read, and did nothing.
 */
export type ZoneKinds = Readonly<Record<string, Readonly<Record<string, number>>>>;

export interface LevelOptions {
  zones?: ZoneKinds;
}

/** A box's color when it is not said, and a grid's lines. */
const DEFAULT_COLOR = 0x6f6a62;
export const GRID_COLOR = 0x262a33;
/** All 16 collision groups (a body in no groups said is in all, and meets all). */
const ALL_GROUPS = 0xffff;

const AXES: Record<Turn['axis'], Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
/** The quaternion of a turn (or no turn). */
export const turnOf = (turn: Turn | null): Quat => (turn ? quat.fromDegrees(AXES[turn.axis], turn.degrees) : quat.identity());

/** A number in decimal (an exponent too: a level written by a program may have one). Not hexadecimal, not Infinity. */
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
/** A word a zone's parameter is named by. */
const PARAMETER = /^[a-z][a-z0-9_]*$/;
/** What a format-2 level may say that a format-1 one may not. */
const SINCE_2 = new Set(['material', 'name', 'group', 'meets', 'grid', 'hidden']);

/** A level from its text. A line that is not understood is an error, with its number. */
export function levelFromText(text: string, o: LevelOptions = {}): Level {
  const level: Level = { title: '', spawn: [0, 1, 0], facing: [0, 0, -1], materials: {}, boxes: [], sensors: [] };
  const rows = text.split(/\r?\n/);
  const fail = (n: number, why: string): never => {
    throw new Error(`level, line ${n + 1}: ${why}`);
  };
  const header = /^# Manifold level ([1-9]\d*)$/.exec(rows[0]?.trim() ?? '');
  if (!header) fail(0, `it must start with "${HEADER} ${LEVEL_FORMAT}"`);
  const format = Number(header![1]);
  if (format < 1 || format > LEVEL_FORMAT) fail(0, `a level of format ${format}: this engine reads formats 1 to ${LEVEL_FORMAT}`);
  /** The lines that come once in a level (`title`, `spawn`, `facing`), and where each one came. */
  const once = new Map<string, number>();
  /** Where each name was given, and each material declared: twice is an error that says where the first was. */
  const names = new Map<string, number>();
  const declared = new Map<string, number>();
  /** The materials boxes are made of, and their lines: checked at the end (a material may be declared below). */
  const madeOf: { material: string; line: number }[] = [];
  rows.forEach((row, n) => {
    // A comment is a whole line that starts with # (a color, like #6f6a62, is not one).
    const line = row.trim();
    if (!line || line.startsWith('#')) return;
    const words = line.split(/\s+/);
    const kind = words[0]!;
    let at = 1;
    /** A word only format 2 knows, in a level of format 1. */
    const since2 = (word: string) => {
      if (format < 2 && SINCE_2.has(word)) fail(n, `"${word}" is format 2: this level says format ${format} (its first line)`);
    };
    // Not hexadecimal, not Infinity: closing phase 2 found that `Number` took them.
    const number = () => {
      const t = words[at++];
      if (t === undefined) return fail(n, 'a number is missing');
      if (!NUMBER.test(t)) return fail(n, `"${t}" is not a number`);
      return Number(t);
    };
    /** The numbers that come next, as many as there are (until a word that is not one). */
    const numbers = (): number[] => {
      const out: number[] = [];
      while (at < words.length && NUMBER.test(words[at]!)) out.push(Number(words[at++]));
      return out;
    };
    const vector = (): Vec3 => [number(), number(), number()];
    /** Half a size along each axis: more than 0 (a box of no size, or turned inside out, is not one). */
    const halves = (): Vec3 => {
      const half = vector();
      if (half.some((h) => h <= 0)) fail(n, 'a half size must be more than 0');
      return half;
    };
    /** An axis and a number of degrees, as in `rotate x 18` or `spin y 40`. */
    const axisAndDegrees = (): Turn => {
      const axis = words[at++];
      if (axis !== 'x' && axis !== 'y' && axis !== 'z') fail(n, `"${axis ?? ''}" is not an axis (x, y or z)`);
      return { axis: axis as Turn['axis'], degrees: number() };
    };
    /** A name, given once in the level. */
    const aName = (): string => {
      const name = words[at++] ?? '';
      if (!ENTITY_NAME.test(name)) fail(n, `"${name}" is not a name: one word, lowercase, digits and _ (like door_north)`);
      const first = names.get(name);
      if (first !== undefined) fail(n, `the name "${name}" twice in a level (the first, on line ${first + 1})`);
      names.set(name, n);
      return name;
    };
    /** Collision groups, as their numbers (1 to 16), as bits. */
    const groupBits = (word: string): number => {
      const list = numbers();
      if (list.length === 0) fail(n, `"${word}" needs which groups: their numbers, 1 to 16`);
      let bits = 0;
      for (const g of list) {
        if (!Number.isInteger(g) || g < 1 || g > 16) fail(n, `${g} is not a collision group (1 to 16)`);
        if (bits & (1 << (g - 1))) fail(n, `the group ${g} twice`);
        bits |= 1 << (g - 1);
      }
      return bits;
    };
    /** What may come at the end of a box. */
    const boxExtras = () => {
      const box = {
        turn: null as Turn | null,
        color: DEFAULT_COLOR,
        look: 'solid' as Look,
        material: null as string | null,
        name: null as string | null,
        move: null as LevelBox['move'],
        spin: null as Turn | null,
        member: null as number | null,
        filter: null as number | null,
      };
      const seen = new Set<string>();
      while (at < words.length) {
        const word = words[at++]!;
        since2(word);
        // Each one once: twice, the first was silently lost.
        if (seen.has(word)) fail(n, `"${word}" twice on one line`);
        seen.add(word);
        if (word === 'rotate') box.turn = axisAndDegrees();
        else if (word === 'move') {
          const by = vector();
          const seconds = number();
          if (seconds <= 0) fail(n, 'a movement takes some time: its seconds must be more than 0');
          box.move = { by, seconds };
        } else if (word === 'spin') box.spin = axisAndDegrees();
        else if (word === 'color') {
          const hex = words[at++] ?? '';
          if (!/^#[0-9a-f]{6}$/i.test(hex)) fail(n, `"${hex}" is not a color (#rrggbb)`);
          box.color = parseInt(hex.slice(1), 16);
        } else if (word === 'material') {
          const material = words[at++] ?? '';
          if (!MATERIAL_NAME.test(material)) fail(n, `"${material}" is not a material's name`);
          box.material = material;
          madeOf.push({ material, line: n });
        } else if (word === 'name') box.name = aName();
        else if (word === 'group') box.member = groupBits(word);
        else if (word === 'meets') box.filter = groupBits(word);
        else if (word === 'grid' || word === 'hidden') box.look = word;
        else fail(n, `"${word}" is not understood here`);
      }
      // A grid's or a hidden box's color would not be seen: saying one is a mistake.
      if (seen.has('grid') && seen.has('hidden')) fail(n, 'a box is drawn as a grid or not at all, not both');
      if (box.look !== 'solid' && seen.has('color')) fail(n, `a ${box.look} box has no color of its own`);
      return box;
    };
    if (kind === 'title' || kind === 'spawn' || kind === 'facing') {
      const first = once.get(kind);
      if (first !== undefined) fail(n, `"${kind}" twice in a level (the first, on line ${first + 1})`);
      once.set(kind, n);
    }
    switch (kind) {
      case 'title':
        level.title = line.slice('title'.length).trim();
        at = words.length; // the title is the rest of the line
        break;
      case 'spawn':
        level.spawn = vector();
        break;
      case 'facing':
        level.facing = vector();
        if (level.facing.every((v) => v === 0)) fail(n, 'facing needs a direction, not 0 0 0');
        break;
      case 'material': {
        since2(kind);
        const name = words[at++] ?? '';
        if (!MATERIAL_NAME.test(name)) fail(n, `"${name}" is not a material's name: one word in lowercase, like oil`);
        if (MATERIALS[name]) fail(n, `"${name}" is the engine's: a level's material needs a name of its own`);
        const first = declared.get(name);
        if (first !== undefined) fail(n, `the material "${name}" twice (the first, on line ${first + 1})`);
        declared.set(name, n);
        const got: Partial<Material> = {};
        while (at < words.length) {
          const key = words[at++]!;
          if (key !== 'friction' && key !== 'bounce' && key !== 'density' && key !== 'drag')
            fail(n, `"${key}" is not a material's (friction, bounce, density, drag)`);
          if (got[key as keyof Material] !== undefined) fail(n, `"${key}" twice on one line`);
          got[key as keyof Material] = number();
        }
        const missing = (['friction', 'bounce', 'density', 'drag'] as const).filter((k) => got[k] === undefined);
        if (missing.length) fail(n, `a material needs its ${missing.join(', ')}`);
        const problem = materialProblem(got as Material);
        if (problem) fail(n, `the material "${name}": ${problem}`);
        level.materials[name] = got as Material;
        break;
      }
      case 'box': {
        const center = vector();
        const half = halves();
        const b = boxExtras();
        const groups =
          b.member === null && b.filter === null ? null : { member: b.member ?? ALL_GROUPS, filter: b.filter ?? ALL_GROUPS };
        level.boxes.push({
          name: b.name,
          center,
          half,
          turn: b.turn,
          color: b.color,
          look: b.look,
          material: b.material,
          groups,
          move: b.move,
          spin: b.spin,
        });
        break;
      }
      case 'sensor': {
        const what = words[at++];
        if (!what || !/^[a-z][a-z0-9.-]*$/.test(what)) fail(n, 'a zone needs what it is for, in one word (checkpoint, goal…)');
        const center = vector();
        const half = halves();
        let turn: Turn | null = null;
        let name: string | null = null;
        const params: Record<string, number[]> = {};
        const seen = new Set<string>();
        while (at < words.length) {
          const word = words[at++]!;
          if (seen.has(word)) fail(n, `"${word}" twice on one line`);
          seen.add(word);
          if (word === 'rotate') turn = axisAndDegrees();
          else if (word === 'name') {
            since2(word);
            name = aName();
          } else {
            // Anything else is what the zone carries: a word and its numbers (format 2).
            if (!PARAMETER.test(word)) fail(n, `"${word}" is not understood here`);
            if (format < 2) fail(n, `"${word}": a zone carries what it says from format 2 on (this level says format ${format})`);
            if (SINCE_2.has(word)) fail(n, `"${word}" is not something a zone carries`);
            const values = numbers();
            if (values.length === 0) fail(n, `"${word}" needs its numbers`);
            params[word] = values;
          }
        }
        // What the game says its zones take (if it says it).
        const kinds = o.zones;
        if (kinds) {
          const takes = kinds[what!];
          if (!takes) fail(n, `"${what}" is not a zone of this game (${Object.keys(kinds).join(', ')})`);
          for (const [param, values] of Object.entries(params)) {
            const count = takes![param];
            if (count === undefined)
              fail(n, `a ${what} carries no "${param}" (${Object.keys(takes!).join(', ') || 'it carries nothing'})`);
            if (values.length !== count) fail(n, `"${param}" takes ${count === 1 ? '1 number' : `${count} numbers`}`);
          }
          for (const [param, count] of Object.entries(takes!))
            if (!params[param]) fail(n, `a ${what} needs its ${param} (${count === 1 ? '1 number' : `${count} numbers`})`);
        }
        level.sensors.push({ name, kind: what!, center, half, turn, params });
        break;
      }
      default:
        fail(n, `"${kind}" is not understood (title, spawn, facing, material, box, sensor)`);
    }
    if (at < words.length) fail(n, `"${words[at]}" is extra`);
  });
  for (const { material, line } of madeOf)
    if (!MATERIALS[material] && !level.materials[material])
      fail(line, `no material "${material}" (the engine's: ${Object.keys(MATERIALS).join(', ')}; or one the level declares)`);
  return level;
}

const numbersText = (v: readonly number[]) => v.join(' ');
const turnText = (turn: Turn | null) => (turn ? `  rotate ${turn.axis} ${turn.degrees}` : '');
/** Bits as the groups' numbers (1 to 16). */
const groupList = (bits: number) =>
  Array.from({ length: 16 }, (_, i) => i + 1)
    .filter((g) => bits & (1 << (g - 1)))
    .join(' ');

/** A level as text, in the latest format (what `levelFromText` reads back the same). */
export function levelToText(level: Level): string {
  const boxText = (b: LevelBox) =>
    `box ${numbersText(b.center)}  ${numbersText(b.half)}${turnText(b.turn)}` +
    (b.move ? `  move ${numbersText(b.move.by)} ${b.move.seconds}` : '') +
    (b.spin ? `  spin ${b.spin.axis} ${b.spin.degrees}` : '') +
    (b.material ? `  material ${b.material}` : '') +
    (b.groups && b.groups.member !== ALL_GROUPS ? `  group ${groupList(b.groups.member)}` : '') +
    (b.groups && b.groups.filter !== ALL_GROUPS ? `  meets ${groupList(b.groups.filter)}` : '') +
    (b.look === 'solid' ? `  color #${b.color.toString(16).padStart(6, '0')}` : `  ${b.look}`) +
    (b.name ? `  name ${b.name}` : '');
  const sensorText = (s: LevelSensor) =>
    `sensor ${s.kind}  ${numbersText(s.center)}  ${numbersText(s.half)}${turnText(s.turn)}` +
    Object.entries(s.params)
      .map(([k, v]) => `  ${k} ${numbersText(v)}`)
      .join('') +
    (s.name ? `  name ${s.name}` : '');
  return (
    [
      `${HEADER} ${LEVEL_FORMAT}`,
      `title ${level.title}`,
      `spawn ${numbersText(level.spawn)}`,
      `facing ${numbersText(level.facing)}`,
      ...Object.entries(level.materials).map(
        ([name, m]) => `material ${name}  friction ${m.friction}  bounce ${m.bounce}  density ${m.density}  drag ${m.drag}`,
      ),
      ...level.boxes.map(boxText),
      ...level.sensors.map(sensorText),
    ].join('\n') + '\n'
  );
}

/**
 * Puts a level into a world: its materials, its boxes, as bodies (fixed; or, if they move or turn,
 * kinematic: the program moves them, and they push what they touch), drawn as their look says, and
 * its zones, as sensors that are not (`show.sensors` draws them). Where the players start is the
 * game's to use (`level.spawn`).
 */
export function buildLevel(world: World, level: Level) {
  for (const [name, m] of Object.entries(level.materials)) world.addMaterial(name, m);
  for (const b of level.boxes) {
    const moves = b.move !== null || b.spin !== null;
    // Degrees per second to radians per second: a constant product, the same everywhere.
    const spin = b.spin ? vec3.scale(AXES[b.spin.axis], (b.spin.degrees * Math.PI) / 180) : null;
    const size: Vec3 = [b.half[0] * 2, b.half[1] * 2, b.half[2] * 2];
    const appearance: Components['appearance'] =
      b.look === 'hidden'
        ? undefined
        : b.look === 'grid'
          ? { shape: 'grid', size, color: GRID_COLOR }
          : { shape: 'box', size, color: b.color };
    world.createEntity({
      ...(b.name ? { name: b.name } : {}),
      transform: { position: [...b.center], rotation: turnOf(b.turn) },
      body: {
        type: moves ? 'kinematic' : 'fixed',
        shape: { kind: 'box', halfExtents: [...b.half] },
        ...(b.material ? { material: b.material } : {}),
        ...(b.groups ? { groups: { ...b.groups } } : {}),
      },
      ...(appearance ? { appearance } : {}),
      ...(spin ? { spin: { angularVelocity: spin } } : {}),
      ...(b.move ? { mover: { from: [...b.center], to: vec3.add(b.center, b.move.by), seconds: b.move.seconds } } : {}),
    });
  }
  for (const s of level.sensors)
    world.createEntity({
      ...(s.name ? { name: s.name } : {}),
      transform: { position: [...s.center], rotation: turnOf(s.turn) },
      sensor: { kind: s.kind, half: [...s.half], params: s.params },
    });
}
