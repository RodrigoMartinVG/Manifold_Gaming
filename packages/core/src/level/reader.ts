import type { Vec3 } from '@manifold/common';
import { COMPONENT_NAME } from '../components';
import { MATERIAL_NAME } from '../materials';
import type { LevelMap } from '../map';
import { AFFORDANCES, type Affordance } from '../types';
import { ENTITY_NAME } from '../world';
import { WORD } from '../words';
import type { Level, LevelOptions, Turn } from './format';

/** A number in decimal (an exponent too: a level written by a program may have one). Not hexadecimal, not Infinity. */
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
/** A word a zone's parameter is named by. */
export const PARAMETER = WORD;
/** A key of the game's words (decision 0019): its name first, then words, dots between. */
export const KEY = /^[a-z][a-z0-9_.-]*$/;

/**
 * A LEVEL BEING READ (stage 5.5e): the level so far, its format, the game's options, where each name and
 * declaration came, and what its lines name that may come below (a material, a zone, a signal, a watcher,
 * an objective), checked once the whole level is read.
 */
export interface Reading {
  readonly level: Level;
  readonly format: number;
  readonly o: LevelOptions;
  /** Where each name was given, each material and each signal declared, each line that comes once came. */
  readonly names: Map<string, number>;
  readonly materials: Map<string, number>;
  readonly signals: Map<string, number>;
  readonly once: Map<string, number>;
  /** What lines named, with their lines (each may be declared below). */
  readonly madeOf: { material: string; line: number }[];
  readonly zonesRead: { zone: string; line: number }[];
  readonly followed: { signal: string; line: number }[];
  readonly watchersRead: { watcher: string; line: number }[];
  readonly ledTo: { name: string; line: number }[];
  /** A map being read (format 7): its rows come as they are written, until `end`. */
  drawing: { map: LevelMap; line: number } | null;
}

/** What may come at the end of a line of one kind: each word, the format since which it is read, and how. */
export type Extras<T> = Readonly<Record<string, { since?: number; read: (r: LineReader, into: T) => void }>>;

/**
 * ONE LINE BEING READ (stage 5.5e, S5): its words, where the reader is in them, and what every kind of line
 * reads with, each failing with the line's number. Before, these were closures made again for every line,
 * and each kind of line had its own loop over the words at its end (five of them); now `extras` is one.
 */
export class LineReader {
  /** The next word to read (the first is the line's kind). */
  at = 1;
  constructor(
    /** The line, trimmed, and its words. */
    readonly line: string,
    readonly words: readonly string[],
    readonly n: number,
    readonly reading: Reading,
  ) {}

  get format() {
    return this.reading.format;
  }
  fail(why: string): never {
    throw new Error(`level, line ${this.n + 1}: ${why}`);
  }
  /** A word only a newer format knows, in a level of an older one. */
  since(word: string, from: number | undefined) {
    if (from !== undefined && this.format < from)
      this.fail(`"${word}" is format ${from}: this level says format ${this.format} (its first line)`);
  }
  /** The next word, read ('' if there is none). */
  word(): string {
    return this.words[this.at++] ?? '';
  }
  // Not hexadecimal, not Infinity: closing phase 2 found that `Number` took them.
  number(): number {
    const t = this.words[this.at++];
    if (t === undefined) return this.fail('a number is missing');
    if (!NUMBER.test(t)) return this.fail(`"${t}" is not a number`);
    return Number(t);
  }
  /** The numbers that come next, as many as there are (until a word that is not one). */
  numbers(): number[] {
    const out: number[] = [];
    while (this.at < this.words.length && NUMBER.test(this.words[this.at]!)) out.push(Number(this.words[this.at++]));
    return out;
  }
  vector(): Vec3 {
    return [this.number(), this.number(), this.number()];
  }
  /** Half a size along each axis: more than 0 (a box of no size, or turned inside out, is not one). */
  halves(): Vec3 {
    const half = this.vector();
    if (half.some((h) => h <= 0)) this.fail('a half size must be more than 0');
    return half;
  }
  /** An axis and a number of degrees, as in `rotate x 18` or `spin y 40`. */
  turn(): Turn {
    const axis = this.words[this.at++];
    if (axis !== 'x' && axis !== 'y' && axis !== 'z') this.fail(`"${axis ?? ''}" is not an axis (x, y or z)`);
    return { axis: axis as Turn['axis'], degrees: this.number() };
  }
  /** A name, given once in the level. */
  name(): string {
    const name = this.word();
    if (!ENTITY_NAME.test(name)) this.fail(`"${name}" is not a name: one word, lowercase, digits and _ (like door_north)`);
    const first = this.reading.names.get(name);
    if (first !== undefined) this.fail(`the name "${name}" twice in a level (the first, on line ${first + 1})`);
    this.reading.names.set(name, this.n);
    return name;
  }
  /** A signal's name, as a mechanism or a signal names it. */
  signalName(): string {
    const name = this.word();
    if (!ENTITY_NAME.test(name)) this.fail(`"${name}" is not a signal's name: one word, lowercase, digits and _`);
    return name;
  }
  /** A signal this line follows (declared anywhere in the level: checked at its end). */
  followed(): string {
    const signal = this.signalName();
    this.reading.followed.push({ signal, line: this.n });
    return signal;
  }
  /** A key of the game's words (stage 4f: `dojo.story.hello`). */
  key(): string {
    const key = this.word();
    if (!KEY.test(key)) this.fail(`"${key}" is not a key of the game's words (like dojo.story.hello)`);
    return key;
  }
  /** A model's name, as the game gives it (`dojo.door`). */
  model(): string {
    const model = this.word();
    if (!/^[a-z][a-z0-9_.-]*$/.test(model)) this.fail(`"${model}" is not a model's name (like dojo.door)`);
    return model;
  }
  /** The energy of a hit that breaks something, in joules: 0 or more. */
  energy(): number {
    const joules = this.number();
    if (joules < 0) this.fail('what breaks it is an energy, 0 or more');
    return joules;
  }
  /** A material it is made of (the engine's or one the level declares, anywhere in it: checked at its end). */
  material(): string {
    const material = this.word();
    if (!MATERIAL_NAME.test(material)) this.fail(`"${material}" is not a material's name`);
    this.reading.madeOf.push({ material, line: this.n });
    return material;
  }
  /** What a thing is for (format 8): the words that come next, as many as are what things are for (one at least). */
  affordances(): Affordance[] {
    const out: Affordance[] = [];
    // The engine's words, or a game's own with its owner (stage 5.5e: `forest.perch`).
    while (
      this.at < this.words.length &&
      ((AFFORDANCES as readonly string[]).includes(this.words[this.at]!) || COMPONENT_NAME.test(this.words[this.at]!))
    ) {
      const a = this.words[this.at++] as Affordance;
      if (out.includes(a)) this.fail(`"${a}" twice in what it affords`);
      out.push(a);
    }
    if (out.length === 0) this.fail(`"affords" needs what it is for (${AFFORDANCES.join(', ')}, or a game's own: forest.perch)`);
    return out;
  }
  /** Collision groups, as their numbers (1 to 16), as bits. */
  groups(word: string): number {
    const list = this.numbers();
    if (list.length === 0) this.fail(`"${word}" needs which groups: their numbers, 1 to 16`);
    let bits = 0;
    for (const g of list) {
      if (!Number.isInteger(g) || g < 1 || g > 16) this.fail(`${g} is not a collision group (1 to 16)`);
      if (bits & (1 << (g - 1))) this.fail(`the group ${g} twice`);
      bits |= 1 << (g - 1);
    }
    return bits;
  }
  /**
   * THE WORDS AT A LINE'S END (stage 5.5e: one reader for every kind of line): each once (twice, the first
   * was silently lost), each read as its kind says, from its format on. A word its kind does not know goes
   * to `other` (a zone's parameters), or is an error that says which words it takes. What it saw, back.
   */
  extras<T>(into: T, extras: Extras<T>, other?: (word: string) => void): Set<string> {
    const seen = new Set<string>();
    while (this.at < this.words.length) {
      const word = this.words[this.at++]!;
      if (seen.has(word)) this.fail(`"${word}" twice on one line`);
      seen.add(word);
      const extra = Object.hasOwn(extras, word) ? extras[word] : undefined;
      if (extra) {
        this.since(word, extra.since);
        extra.read(this, into);
      } else if (other) other(word);
      else this.fail(`"${word}" is not understood here (${Object.keys(extras).join(', ')})`);
    }
    return seen;
  }
}

/** The words that may end most lines: a turn, a name, what it is for. */
export const ROTATE = { read: (r: LineReader, into: { turn: Turn | null }) => void (into.turn = r.turn()) };
export const NAME = { since: 2, read: (r: LineReader, into: { name: string | null }) => void (into.name = r.name()) };
export const AFFORDS = {
  since: 8,
  read: (r: LineReader, into: { affords?: Affordance[] }) => void (into.affords = r.affordances()),
};
