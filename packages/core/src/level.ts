import { quat, sinCosDegrees, vec3, type Quat, type Vec3 } from '@manifold/common';
import { MATERIAL_NAME, MATERIALS, materialProblem, type Material } from './materials';
import type { CollisionGroups, Components, SignalOp } from './types';
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
 * Format 3 (stage 3c, decision 0018) adds signals, and mechanisms that follow them:
 *
 *   signal plate_on  zone plate               a signal: how many are in the zone named plate
 *   signal pressed   used button              1 at the step a character pressed `use` in it
 *   signal gate      toggle pressed           flips each time `pressed` turns on (any, all, not,
 *                                             toggle, latch; nothing: an input, set by the game)
 *   box 3 1.1 -4  0.6 1.1 0.06  door -0.6 0 0 y 90 1 gate
 *                                             a door: its hinge (from the box's center), the axis
 *                                             and the degrees it turns, the seconds it takes, its signal
 *   box 0 0.15 -8  1.5 0.15 1.5  lift 0 4 0 3 lift_up    a lift: its way, its seconds, its signal
 *   box 3 1.1 -4  0.6 1.1 0.06  model dojo.door    drawn with a model the game has, instead of a box
 *
 * A signal reads only zones (anywhere in the level) and signals declared above it.
 *
 * Format 4 (stage 3d) adds the light, and an eye that looks with it:
 *
 *   ambient 0.15                              how lit everything is with no lamp (1, if not said)
 *   lamp 0 3 -4  6 1  signal lights  name a   a lamp: where, how far it reaches, how bright at its
 *                                             center; on while its signal is (always, without one)
 *   watcher 0 2.5 -10  12 60 0.4  rotate y 180  name eye
 *                                             an eye: where, how far it sees, its field of view
 *                                             (degrees), how lit things must look; it looks along −Z,
 *                                             turned as it says
 *   signal spotted  seen eye                  how many characters the watcher named eye sees
 *   sensor fog  0 1 -6  3 1 1  opacity 0.8    a zone with an opacity (per meter) attenuates light and
 *                                             sight through it, whatever its kind
 *
 * Format 5 (stage 3e) adds what breaks:
 *
 *   lamp -4 1.5 2  4 1  breaks 0.4  model dojo.lamp
 *                                             a lamp a hit of 0.4 J breaks (it gets a small body, to be
 *                                             hit), drawn with a model the game has
 *   box 2 0.5 -3  0.5 0.5 0.5  breaks 3       a box a hit of 3 J breaks into pieces
 *
 * Format 6 (stage 3g) adds a box the physics moves:
 *
 *   box 1 0.2 5  0.2 0.2 0.2  dynamic  material wood    a crate of 45 kg (wood's density, its size):
 *                                             it falls, it is pushed, it can be grabbed
 *
 * The turns are written in degrees, as a person thinks them, and become quaternions with our own sine
 * and cosine (`quat.fromDegrees`): the browser's would give other bits in another browser, and the
 * world must be born the same everywhere.
 */
export const LEVEL_FORMAT = 6;
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
  /** A model the game has, drawn instead of the box, at its size (format 3: `dojo.door`). */
  model: string | null;
  /** The energy of a hit that breaks it (format 5), in joules, if it breaks. */
  breaks: number | null;
  /** Whether the physics moves it (format 6): it falls, is pushed and can be grabbed. */
  dynamic: boolean;
  /** What it is made of (format 2), if it is said: the engine's materials or the level's. */
  material: string | null;
  /** Which collision groups it is in and meets (format 2), if it is said: if not, all. */
  groups: CollisionGroups | null;
  /** If it goes back and forth (stage 2d): how far, and how long one way takes. */
  move: { by: Vec3; seconds: number } | null;
  /** If it turns (stage 2d): around which axis, and how many degrees per second. */
  spin: Turn | null;
  /** A door (format 3): its hinge, from the box's center, the turn it opens, how long, and its signal. */
  door: { hinge: Vec3; turn: Turn; seconds: number; signal: string } | null;
  /** A lift (format 3): its way, how long, and its signal. */
  lift: { by: Vec3; seconds: number; signal: string } | null;
}

/** A lamp (format 4): where, how far it reaches, how bright at its center, the signal it follows. */
export interface LevelLamp {
  name: string | null;
  center: Vec3;
  radius: number;
  intensity: number;
  signal: string | null;
  /** The energy of a hit that breaks it (format 5), if it breaks; and a model it is drawn with. */
  breaks: number | null;
  model: string | null;
}

/** A watcher (format 4): where, turned how, how far it sees, its field of view, how lit things must look. */
export interface LevelWatcher {
  name: string | null;
  center: Vec3;
  turn: Turn | null;
  range: number;
  degrees: number;
  threshold: number;
}

/** A signal (format 3): its name, what it is, and what it reads. */
export interface LevelSignal {
  name: string;
  op: SignalOp;
  reads: string[];
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
  /** Its signals (format 3), in the order they are computed. */
  signals: LevelSignal[];
  /** How lit everything is with no lamp (format 4), if it says. */
  ambient: number | null;
  lamps: LevelLamp[];
  watchers: LevelWatcher[];
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
/** The words each format brought: a level that says an older one may not use them. */
const SINCE: Record<string, number> = {
  material: 2,
  name: 2,
  group: 2,
  meets: 2,
  grid: 2,
  hidden: 2,
  signal: 3,
  door: 3,
  lift: 3,
  model: 3,
  ambient: 4,
  lamp: 4,
  watcher: 4,
  breaks: 5,
  dynamic: 6,
};
/** How many signals or zones each kind of signal reads (−1: one or more), as the world says. */
const READS: Record<SignalOp, number> = { input: 0, zone: 1, used: 1, seen: 1, any: -1, all: -1, not: 1, toggle: 1, latch: 2 };

/** A level from its text. A line that is not understood is an error, with its number. */
export function levelFromText(text: string, o: LevelOptions = {}): Level {
  const level: Level = {
    title: '',
    spawn: [0, 1, 0],
    facing: [0, 0, -1],
    materials: {},
    boxes: [],
    sensors: [],
    signals: [],
    ambient: null,
    lamps: [],
    watchers: [],
  };
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
  /** The zones signals read and the signals mechanisms follow, with their lines: checked at the end too. */
  const zonesRead: { zone: string; line: number }[] = [];
  const followed: { signal: string; line: number }[] = [];
  /** Where each signal was declared. */
  const signalLines = new Map<string, number>();
  /** The watchers signals read, with their lines (checked at the end: a watcher may come below). */
  const watchersRead: { watcher: string; line: number }[] = [];
  rows.forEach((row, n) => {
    // A comment is a whole line that starts with # (a color, like #6f6a62, is not one).
    const line = row.trim();
    if (!line || line.startsWith('#')) return;
    const words = line.split(/\s+/);
    const kind = words[0]!;
    let at = 1;
    /** A word only a newer format knows, in a level of an older one. */
    const since = (word: string) => {
      const from = SINCE[word];
      if (from !== undefined && format < from)
        fail(n, `"${word}" is format ${from}: this level says format ${format} (its first line)`);
    };
    /** A model's name, as the game gives it (`dojo.door`). */
    const modelName = (): string => {
      const model = words[at++] ?? '';
      if (!/^[a-z][a-z0-9_.-]*$/.test(model)) fail(n, `"${model}" is not a model's name (like dojo.door)`);
      return model;
    };
    /** The energy of a hit that breaks something, in joules: 0 or more. */
    const energy = (): number => {
      const joules = number();
      if (joules < 0) fail(n, 'what breaks it is an energy, 0 or more');
      return joules;
    };
    /** A signal's name, as a mechanism or a signal names it. */
    const signalName = (): string => {
      const name = words[at++] ?? '';
      if (!ENTITY_NAME.test(name)) fail(n, `"${name}" is not a signal's name: one word, lowercase, digits and _`);
      return name;
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
        door: null as LevelBox['door'],
        lift: null as LevelBox['lift'],
        model: null as string | null,
        breaks: null as number | null,
        dynamic: false,
      };
      /** How long a mechanism takes, more than 0, and the signal it follows. */
      const timeAndSignal = () => {
        const seconds = number();
        if (seconds <= 0) fail(n, 'a mechanism takes some time: its seconds must be more than 0');
        const signal = signalName();
        followed.push({ signal, line: n });
        return { seconds, signal };
      };
      const seen = new Set<string>();
      while (at < words.length) {
        const word = words[at++]!;
        since(word);
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
        else if (word === 'door') {
          const hinge = vector();
          const turn = axisAndDegrees();
          box.door = { hinge, turn, ...timeAndSignal() };
        } else if (word === 'lift') {
          const by = vector();
          box.lift = { by, ...timeAndSignal() };
        } else if (word === 'model') {
          box.model = modelName();
        } else if (word === 'breaks') {
          box.breaks = energy();
        } else if (word === 'dynamic') {
          box.dynamic = true;
        } else fail(n, `"${word}" is not understood here`);
      }
      // What the program moves, one way at a time: a platform that comes and goes, one that turns, or a
      // mechanism that follows its signal.
      const ways = ['move', 'spin', 'door', 'lift', 'dynamic'].filter((w) => seen.has(w));
      if (ways.length > 1) fail(n, `a box moves one way: ${ways.join(' and ')} together`);
      // A grid's or a hidden box's color would not be seen: saying one is a mistake.
      if (seen.has('grid') && seen.has('hidden')) fail(n, 'a box is drawn as a grid or not at all, not both');
      if (box.look !== 'solid' && seen.has('color')) fail(n, `a ${box.look} box has no color of its own`);
      if (box.look !== 'solid' && box.model) fail(n, `a ${box.look} box is not drawn with a model`);
      return box;
    };
    if (kind === 'title' || kind === 'spawn' || kind === 'facing' || kind === 'ambient') {
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
      case 'ambient': {
        since(kind);
        const light = number();
        if (light < 0) fail(n, 'the ambient light is 0 or more');
        level.ambient = light;
        break;
      }
      case 'lamp': {
        since(kind);
        const center = vector();
        const radius = number();
        if (radius <= 0) fail(n, "a lamp's radius must be more than 0");
        const intensity = number();
        if (intensity < 0) fail(n, "a lamp's intensity is 0 or more");
        let signal: string | null = null;
        let name: string | null = null;
        let breaks: number | null = null;
        let model: string | null = null;
        const seen = new Set<string>();
        while (at < words.length) {
          const word = words[at++]!;
          if (seen.has(word)) fail(n, `"${word}" twice on one line`);
          seen.add(word);
          since(word);
          if (word === 'signal') {
            signal = signalName();
            followed.push({ signal, line: n });
          } else if (word === 'name') name = aName();
          else if (word === 'breaks') breaks = energy();
          else if (word === 'model') model = modelName();
          else fail(n, `"${word}" is not understood here (signal, name, breaks, model)`);
        }
        level.lamps.push({ name, center, radius, intensity, signal, breaks, model });
        break;
      }
      case 'watcher': {
        since(kind);
        const center = vector();
        const range = number();
        if (range <= 0) fail(n, "a watcher's range must be more than 0");
        const degrees = number();
        if (degrees <= 0 || degrees > 360) fail(n, "a watcher's field of view is more than 0 degrees, and 360 at most");
        const threshold = number();
        if (threshold < 0) fail(n, "a watcher's threshold is 0 or more");
        let turn: Turn | null = null;
        let name: string | null = null;
        const seen = new Set<string>();
        while (at < words.length) {
          const word = words[at++]!;
          if (seen.has(word)) fail(n, `"${word}" twice on one line`);
          seen.add(word);
          if (word === 'rotate') turn = axisAndDegrees();
          else if (word === 'name') name = aName();
          else fail(n, `"${word}" is not understood here (rotate, name)`);
        }
        level.watchers.push({ name, center, turn, range, degrees, threshold });
        break;
      }
      case 'material': {
        since(kind);
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
          model: b.model,
          breaks: b.breaks,
          dynamic: b.dynamic,
          material: b.material,
          groups,
          move: b.move,
          spin: b.spin,
          door: b.door,
          lift: b.lift,
        });
        break;
      }
      case 'signal': {
        since(kind);
        const name = signalName();
        const first = signalLines.get(name);
        if (first !== undefined) fail(n, `the signal "${name}" twice (the first, on line ${first + 1})`);
        const op = (words[at++] ?? 'input') as SignalOp;
        const count = READS[op];
        if (count === undefined) fail(n, `"${op}" is not what a signal can be (${Object.keys(READS).join(', ')})`);
        const reads: string[] = [];
        while (at < words.length) {
          const read = words[at++]!;
          if (!ENTITY_NAME.test(read)) fail(n, `"${read}" is not a name`);
          reads.push(read);
        }
        if (count >= 0 ? reads.length !== count : reads.length < 1)
          fail(
            n,
            `a ${op} reads ${count < 0 ? 'one signal or more' : count === 0 ? 'nothing' : count === 1 ? 'one' : `${count}`}`,
          );
        for (const read of reads) {
          if (op === 'zone' || op === 'used') zonesRead.push({ zone: read, line: n });
          else if (op === 'seen') watchersRead.push({ watcher: read, line: n });
          // Only signals declared above: so a cycle cannot be written.
          else if (!signalLines.has(read))
            fail(
              n,
              `"${read}" is not a signal declared above (a signal reads only those above it: so it cannot read itself, even through others)`,
            );
        }
        signalLines.set(name, n);
        level.signals.push({ name, op, reads });
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
            since(word);
            name = aName();
          } else {
            // Anything else is what the zone carries: a word and its numbers (format 2).
            if (!PARAMETER.test(word)) fail(n, `"${word}" is not understood here`);
            if (format < 2) fail(n, `"${word}": a zone carries what it says from format 2 on (this level says format ${format})`);
            if (SINCE[word] !== undefined) fail(n, `"${word}" is not something a zone carries`);
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
        fail(n, `"${kind}" is not understood (title, spawn, facing, ambient, material, box, sensor, lamp, watcher, signal)`);
    }
    if (at < words.length) fail(n, `"${words[at]}" is extra`);
  });
  for (const { material, line } of madeOf)
    if (!MATERIALS[material] && !level.materials[material])
      fail(line, `no material "${material}" (the engine's: ${Object.keys(MATERIALS).join(', ')}; or one the level declares)`);
  const zoneNames = new Set(level.sensors.flatMap((s) => (s.name ? [s.name] : [])));
  for (const { zone, line } of zonesRead) if (!zoneNames.has(zone)) fail(line, `no zone named "${zone}" in the level`);
  for (const { signal, line } of followed) if (!signalLines.has(signal)) fail(line, `no signal "${signal}" in the level`);
  const watcherNames = new Set(level.watchers.flatMap((w) => (w.name ? [w.name] : [])));
  for (const { watcher, line } of watchersRead)
    if (!watcherNames.has(watcher)) fail(line, `no watcher named "${watcher}" in the level`);
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
      ...(level.ambient === null ? [] : [`ambient ${level.ambient}`]),
      ...Object.entries(level.materials).map(
        ([name, m]) => `material ${name}  friction ${m.friction}  bounce ${m.bounce}  density ${m.density}  drag ${m.drag}`,
      ),
      ...level.boxes.map(boxText),
      ...level.sensors.map(sensorText),
      ...level.lamps.map(
        (l) =>
          `lamp ${numbersText(l.center)}  ${l.radius} ${l.intensity}` +
          (l.signal ? `  signal ${l.signal}` : '') +
          (l.breaks !== null ? `  breaks ${l.breaks}` : '') +
          (l.model ? `  model ${l.model}` : '') +
          (l.name ? `  name ${l.name}` : ''),
      ),
      ...level.watchers.map(
        (w) =>
          `watcher ${numbersText(w.center)}  ${w.range} ${w.degrees} ${w.threshold}${turnText(w.turn)}` +
          (w.name ? `  name ${w.name}` : ''),
      ),
      ...level.signals.map((g) => ['signal', g.name, ...(g.op === 'input' ? [] : [g.op, ...g.reads])].join(' ')),
    ].join('\n') + '\n'
  );
}

/**
 * Puts a level into a world: its materials, its boxes, as bodies (fixed; or, if they move or turn,
 * or are mechanisms, kinematic: the program moves them, and they push what they touch), drawn as
 * their look says, its zones, as sensors that are not (`show.sensors` draws them), and its signals,
 * in their order, once the zones they read are there. Where the players start is the game's to use
 * (`level.spawn`).
 */
export function buildLevel(world: World, level: Level) {
  for (const [name, m] of Object.entries(level.materials)) world.addMaterial(name, m);
  for (const b of level.boxes) {
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
    world.createEntity({
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
    });
  }
  for (const s of level.sensors) {
    // A zone that attenuates (stage 3d: an `opacity`) is seen: a translucent box, as much as what gets
    // through its thinnest side lets through.
    const opacity = s.params.opacity?.[0];
    world.createEntity({
      ...(s.name ? { name: s.name } : {}),
      transform: { position: [...s.center], rotation: turnOf(s.turn) },
      sensor: { kind: s.kind, half: [...s.half], params: s.params },
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
    });
  }
  if (level.ambient !== null) world.ambient = level.ambient;
  // A lamp, seen: a small warm ball (the presentation lights with it too); a watcher, a short capsule
  // with a visor that shows where it looks.
  for (const l of level.lamps)
    world.createEntity({
      ...(l.name ? { name: l.name } : {}),
      transform: { position: [...l.center], rotation: quat.identity() },
      lamp: { radius: l.radius, intensity: l.intensity, signal: l.signal },
      appearance: { shape: 'sphere', size: [0.3, 0.3, 0.3], color: LAMP_COLOR, ...(l.model ? { model: l.model } : {}) },
      // One that breaks has a small body, to be hit (its light's rays leave it out: lightAt).
      ...(l.breaks !== null
        ? { body: { type: 'fixed' as const, shape: { kind: 'ball' as const, radius: 0.15 } }, breakable: { threshold: l.breaks } }
        : {}),
    });
  for (const w of level.watchers)
    world.createEntity({
      ...(w.name ? { name: w.name } : {}),
      transform: { position: [...w.center], rotation: turnOf(w.turn) },
      // Half its field of view's cosine, with our own (the same bits everywhere).
      watcher: { range: w.range, cone: sinCosDegrees(w.degrees / 2)[1], threshold: w.threshold },
      appearance: { shape: 'capsule', size: [0.5, 0.8, 0.5], color: WATCHER_COLOR },
    });
  for (const g of level.signals) world.addSignal(g.name, g.op, g.reads);
}

/** How a lamp and a watcher are drawn. */
export const LAMP_COLOR = 0xffd27a;
const FOG_COLOR = 0xb8c0c8;
const WATCHER_COLOR = 0x9a4a4a;
