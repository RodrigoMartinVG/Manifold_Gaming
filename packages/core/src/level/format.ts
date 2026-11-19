import { quat, type Quat, type Vec3 } from '@manifold/common';
import type { Material } from '../materials';
import type { LevelMap } from '../map';
import type { Affordance, CollisionGroups, SignalOp } from '../types';

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
 * Format 8 (stage 4d, decision 0024) adds routes, and what things are for:
 *
 *   route rounds loop  0 0 4  4 0 4  4 0 -4     a route: its name, round or not (`loop`: there and back
 *                                             without it), its points (x y z), two or more
 *   box 2 0.5 0  1 0.5 0.2  affords cover     what a thing is for, on any line: cover, throw, kick,
 *                                             weak (a weak point): words the brains read
 *
 * And (stage 4f) the story's pieces, keys of the game's words that signals move on:
 *
 *   objective take when armed say dojo.story.take then cross
 *                                             an objective: done when its signal is on, then the next
 *                                             one is the one to do (one nothing leads to starts so)
 *   scene hello when arrived  master:dojo.story.hello  master:dojo.story.go
 *                                             a short scene, once, when its signal turns on: who says
 *                                             which key, in order
 *
 * Format 9 (stage 4.5e, decision 0026) adds the game's kit of pieces:
 *
 *   kit wall_door  4 0 -6  rotate y 90  name gate_west
 *                                             a piece of the game's kit where it goes, turned: what it
 *                                             collides with and how it looks are the kit's
 *
 * Format 10 (stage 5a) adds the sky:
 *
 *   sky 19.5                                  the hour its sky shows (0 to 24): its colors, where the sun
 *                                             or the moon is, the stars. Only how it is drawn: how lit
 *                                             the world is (what a watcher sees by) is `ambient`'s
 *
 * The turns are written in degrees, as a person thinks them, and become quaternions with our own sine
 * and cosine (`quat.fromDegrees`): the browser's would give other bits in another browser, and the
 * world must be born the same everywhere.
 */
export const LEVEL_FORMAT = 10;
export const HEADER = '# Manifold level';

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
  /** What it is for (format 8): cover, throw, kick, weak; only if it says (so a line without it is what it was). */
  affords?: Affordance[];
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
  /** What it is for (format 8), if it says. */
  affords?: Affordance[];
}

/** A watcher (format 4): where, turned how, how far it sees, its field of view, how lit things must look. */
export interface LevelWatcher {
  name: string | null;
  center: Vec3;
  turn: Turn | null;
  range: number;
  degrees: number;
  threshold: number;
  /** What it is for (format 8), if it says. */
  affords?: Affordance[];
}

/** An objective (format 8, stage 4f): its name, the signal that completes it, its words' key, the one after it. */
export interface LevelObjective {
  name: string;
  when: string;
  say: string;
  then: string | null;
}

/** A short scene (format 8, stage 4f): its name, the signal that plays it, and who says which key. */
export interface LevelScene {
  name: string;
  when: string;
  lines: { who: string; say: string }[];
}

/** A kit piece (format 9, decision 0026): which piece of the game's kit, where its origin goes, turned how. */
export interface LevelKit {
  name: string | null;
  piece: string;
  center: Vec3;
  turn: Turn | null;
  /** What it is made of (its friction, its sound), if it says: the engine's or the level's materials. */
  material: string | null;
  /** What it is for (format 8), if it says. */
  affords?: Affordance[];
}

/**
 * A GAME'S KIT OF LEVEL PIECES (stage 4.5e, decision 0026), by name: for each, the boxes it collides
 * with in its own frame (a box may be turned within it), its size, and the model it is drawn with. The
 * game gives it (its `kit`, as it gives its zones); the engine knows what a kit is, not what is in one.
 */
export interface KitPiece {
  boxes: readonly { center: Vec3; half: Vec3; turn?: Turn }[];
  size: Vec3;
  model: string;
}
export type KitPieces = Readonly<Record<string, KitPiece>>;

/** A route (format 8): its name, its points, and whether it goes round. */
export interface LevelRoute {
  name: string;
  loop: boolean;
  points: Vec3[];
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
  /** What it is for (format 8), if it says. */
  affords?: Affordance[];
}

export interface Level {
  title: string;
  spawn: Vec3;
  facing: Vec3;
  /** The level's own materials (format 2), by name, in the order written. */
  materials: Record<string, Material>;
  boxes: LevelBox[];
  /** Its kit pieces (format 9), in the order written. */
  kits: LevelKit[];
  /** Its maps (format 7): parts drawn as text, made into boxes and zones when it is built. */
  maps: LevelMap[];
  sensors: LevelSensor[];
  /** Its signals (format 3), in the order they are computed. */
  signals: LevelSignal[];
  /** How lit everything is with no lamp (format 4), if it says. */
  ambient: number | null;
  /** The hour its sky shows (format 10), if it says: only how it is drawn. */
  sky: number | null;
  lamps: LevelLamp[];
  watchers: LevelWatcher[];
  /** Its routes (format 8), in the order written. */
  routes: LevelRoute[];
  /** Its objectives and scenes (format 8, stage 4f), in the order written. */
  objectives: LevelObjective[];
  scenes: LevelScene[];
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
  /** The game's kit (format 9): a `kit` line of a piece it does not have is an error, with its line. */
  kit?: KitPieces;
}

/** A box's color when it is not said, and a grid's lines. */
export const DEFAULT_COLOR = 0x6f6a62;
export const GRID_COLOR = 0x262a33;
/** All 16 collision groups (a body in no groups said is in all, and meets all). */
export const ALL_GROUPS = 0xffff;

export const AXES: Record<Turn['axis'], Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
/** The quaternion of a turn (or no turn). */
export const turnOf = (turn: Turn | null): Quat => (turn ? quat.fromDegrees(AXES[turn.axis], turn.degrees) : quat.identity());

/** A level with nothing in it yet. */
export function emptyLevel(): Level {
  return {
    title: '',
    spawn: [0, 1, 0],
    facing: [0, 0, -1],
    materials: {},
    boxes: [],
    kits: [],
    maps: [],
    sensors: [],
    signals: [],
    ambient: null,
    sky: null,
    lamps: [],
    watchers: [],
    routes: [],
    objectives: [],
    scenes: [],
  };
}
