import type { Registry, Value } from '@manifold/commands';
import type { Vec3 } from '@manifold/common';
import type { Cartridge } from './cartridge';
import {
  buildPiece,
  emptyLevel,
  levelFromText,
  levelToText,
  LINES,
  pieceKind,
  pieceOf,
  type Level,
  type LevelPiece,
  type ZoneKinds,
} from './level';
import { MATERIALS } from './materials';
import type { Entity } from './types';
import { copyData, DEFAULT_AMBIENT, ENTITY_NAME, World } from './world';

/**
 * A WORLD AS A LEVEL (stage 3j): what was built from a level's lines, and what the console added,
 * cloned, moved or deleted since, written back as a level. Every entity a level built keeps its line
 * as data (`source`); the world keeps the level's title, start and ambient (`origin`). Characters,
 * balls, fragments, what a game makes on its own, have no line: they are not the level's.
 */
export function levelOfWorld(world: World): Level {
  const origin = world.origin ?? { title: 'Untitled', spawn: [0, 1, 0] as Vec3, facing: [0, 0, -1] as Vec3, ambient: null };
  const level: Level = {
    ...emptyLevel(),
    title: origin.title,
    spawn: [...origin.spawn],
    facing: [...origin.facing],
    sky: origin.sky ?? null,
    // The level's own materials: the world's that are not the engine's.
    materials: Object.fromEntries(
      Object.entries(world.materials)
        .filter(([name]) => !(name in MATERIALS))
        .map(([name, m]) => [name, { ...m }]),
    ),
    signals: world.signals.map((s) => ({ name: s.name, op: s.op, reads: [...s.reads] })),
    // As the level said it, unless it was changed since.
    ambient: world.ambient === (origin.ambient ?? DEFAULT_AMBIENT) ? origin.ambient : world.ambient,
  };
  // Each piece in its kind's list (stage 5.5e: `LINES`), in the order the entities were made.
  for (const e of [...world.entities.values()].sort((a, b) => a.id - b.id)) {
    if (!e.source) continue;
    const { kind, item } = pieceOf(e.source);
    kind.list(level).push(copyData(item));
  }
  return level;
}

/** What changed from one level to another, line by line: `- ` what went, `+ ` what came (in the order written). */
export function levelDiff(from: Level, to: Level): string[] {
  const lines = (l: Level) => levelToText(l).trimEnd().split('\n');
  const before = lines(from);
  const after = lines(to);
  const left = [...after];
  const gone: string[] = [];
  for (const line of before) {
    const i = left.indexOf(line);
    if (i >= 0) left.splice(i, 1);
    else gone.push(`- ${line}`);
  }
  return [...gone, ...left.map((line) => `+ ${line}`)];
}

/**
 * One line of a level, read in the world's context (its named zones, its signals, its materials: a
 * door that follows `open` needs `open` to be there), as the piece it is: a box, a zone, a lamp, a
 * watcher or a route (stage 4d). A line that is not understood throws, with why.
 */
export function pieceFromLine(world: World, line: string, zones?: ZoneKinds): LevelPiece {
  const word = line.trim().split(/\s+/)[0] ?? '';
  const kind = pieceKind(word);
  if (!kind?.added)
    throw new Error(
      `"${word}": what is added is a line of one of these (${Object.keys(LINES)
        .filter((w) => pieceKind(w)?.added)
        .join(', ')})`,
    );
  // The world as a level, and the new line at its end: read as one, so names and signals are checked.
  const before = levelOfWorld(world);
  const text = levelToText(before) + line + '\n';
  let level: Level;
  try {
    level = levelFromText(text, { ...(zones ? { zones } : {}), kit: world.kit });
  } catch (e) {
    // The line number is the new line's, at the end, and the first of a name is somewhere in the
    // world: said without them.
    throw new Error(
      String((e as Error).message)
        .replace(/^level, line \d+: /, '')
        .replace(/ twice in a level \(the first, on line \d+\)/, ' is already in the world'),
      { cause: e },
    );
  }
  return { [word]: kind.list(level).at(-1) } as LevelPiece;
}

/** An entity by its id or its name. */
export function entityNamed(world: World, which: string): Entity | undefined {
  return /^\d+$/.test(which) ? world.entities.get(Number(which)) : world.named(which);
}

/** A piece moved by `by`, as its kind moves one (without its name: names are one entity's). */
function moved(piece: LevelPiece, by: Vec3): LevelPiece {
  const p = copyData(piece);
  const { kind, item } = pieceOf(p);
  kind.move?.(item, by);
  return p;
}

/**
 * THE BUILDING COMMANDS (stage 3j), every game's (each decides whether it mounts a console): world
 * changes, so they enter at a step, go in the session's history and replays, and play the same in
 * Node. `add` reads a level line; `clone` copies what a line built, moved; `delete` takes it away;
 * `set` changes a value of an entity (`set crate transform.position 0 1 0`); `level.export` writes
 * the world as a level, and `level.diff` what changed since it was born.
 */
export function declareBuilding(registry: Registry<World>, cartridge?: Cartridge) {
  const zones = cartridge?.zones;
  registry.declareCommand({
    name: 'add',
    description:
      "Adds what a line of a level says, in the world as it is (stage 3j): `add box 0 1 -3  1 1 1  material wood  name crate`, a piece of the game's kit (`add kit wall_2 0 0 -3`, stage 4.5e), a `sensor`, a `lamp`, a `watcher` or a `route` (stage 4d). Its names and signals are checked against the world. Like every world change it enters at the next step: in a recipe, `wait 1` before using it.",
    args: [{ name: 'line', type: { kind: 'rest' } }],
    inRecipes: true,
    check: (world, [line], out) => {
      try {
        pieceFromLine(world, String(line), zones);
        return true;
      } catch (e) {
        out.write(`add: ${(e as Error).message}`, 'error');
        return false;
      }
    },
    onWorld: (world, [line]) => void buildPiece(world, pieceFromLine(world, String(line), zones)),
  });
  registry.declareCommand({
    name: 'clone',
    description:
      'A copy of what a level line built (a box, a zone, a lamp, a watcher, a route), moved by x y z (stage 3j): `clone crate 1 0 0`. The copy has no name (a route, the next free one after its own).',
    args: [
      { name: 'entity', type: { kind: 'text' } },
      { name: 'by', type: { kind: 'vector' }, optional: true },
    ],
    inRecipes: true,
    check: (world, [which], out) => {
      const e = entityNamed(world, String(which));
      if (e?.source && !pieceOf(e.source).kind.move) {
        out.write(`clone: ${String(which)} is an objective or a scene: one of a kind (stage 4f)`, 'error');
        return false;
      }
      if (e?.source) return true;
      out.write(e ? `clone: ${String(which)} was not built from a level line` : `clone: no entity ${String(which)}`, 'error');
      return false;
    },
    onWorld: (world, [which, by]) => {
      const e = entityNamed(world, String(which));
      if (!e?.source) return;
      const copy = moved(e.source, (by as Vec3 | undefined) ?? [0, 0, 0]);
      if ('route' in copy) {
        let k = 2;
        while (world.named(`${copy.route.name}_${k}`)) k++;
        copy.route.name = `${copy.route.name}_${k}`;
      }
      buildPiece(world, copy);
    },
  });
  registry.declareCommand({
    name: 'delete',
    description:
      'Takes an entity away, by its id or its name (stage 3j): `delete crate`. Not a character: it leaves with its player.',
    args: [{ name: 'entity', type: { kind: 'text' } }],
    inRecipes: true,
    check: (world, [which], out) => {
      const e = entityNamed(world, String(which));
      if (e && !e.character) return true;
      out.write(e ? 'delete: a character leaves with its player' : `delete: no entity ${String(which)}`, 'error');
      return false;
    },
    onWorld: (world, [which]) => {
      const e = entityNamed(world, String(which));
      if (e && !e.character) world.removeEntity(e.id);
    },
  });
  registry.declareCommand({
    name: 'set',
    description:
      "Changes a value of an entity (stage 3j), by its id or its name and the value's way in: `set crate transform.position 0 2 0`, `set lamp_near lamp.intensity 2`, `set stream sensor.params.flow 0 0 3`. Relative: `+0 +1 +0`, `*2`. What the physics keeps (a body's shape or kind) is not changed here: delete it and add it again.",
    args: [
      { name: 'entity', type: { kind: 'text' } },
      { name: 'field', type: { kind: 'text' } },
      { name: 'value', type: { kind: 'rest' } },
    ],
    inRecipes: true,
    check: (world, [which, field, value], out) => {
      const problem = setField(world, String(which), String(field), String(value), true);
      if (problem) out.write(`set: ${problem}`, 'error');
      return problem === null;
    },
    onWorld: (world, [which, field, value]) => void setField(world, String(which), String(field), String(value), false),
  });
  registry.declareCommand({
    name: 'level.export',
    description:
      'The world as a level, in its text (stage 3j): what its level built, and what was added, cloned, moved or deleted since. Saved as a `.level` file, it loads back the same.',
    run: (_, out) => {
      const world = registry.world?.();
      if (!world) return out.write('level.export: there is no world yet', 'error');
      out.write(levelToText(levelOfWorld(world)).trimEnd());
    },
  });
  registry.declareCommand({
    name: 'level.diff',
    description: 'What changed in the world since it was born (stage 3j), as lines of its level: `- ` what went, `+ ` what came.',
    run: (_, out) => {
      const world = registry.world?.();
      if (!world || !cartridge) return out.write('level.diff: there is no world yet', 'error');
      // A world born from the same values, to compare with.
      const born = new World({ seed: Number(registry.value('seed')), profile: world.profile }).attach(cartridge);
      try {
        cartridge.onStart(born, registry);
        const lines = levelDiff(levelOfWorld(born), levelOfWorld(world));
        out.write(lines.length ? lines.join('\n') : 'nothing changed since it was born');
      } finally {
        born.dispose();
      }
    },
  });
}

/** Within this, a number is the same (what a relative value adds to 0.1 + 0.2). */
const NUMBERS = /^[+*]?-?\d*\.?\d+(e-?\d+)?$/i;

/**
 * A value of an entity, changed: its component and field (`lamp.intensity`), the new value in words
 * (as many numbers as it has; `+1` adds, `*2` multiplies; a color as `#rrggbb`; `on`/`off`; a word).
 * The way to a value the physics keeps goes through the world (a position: `place`; a velocity: a
 * push), and the entity's level line follows what it says (so `level.export` writes it). With `dry`,
 * only whether it can: the problem, or null.
 */
export function setField(world: World, which: string, field: string, words: string, dry: boolean): string | null {
  const e = entityNamed(world, which);
  if (!e) return `no entity ${which}`;
  const path = field.split('.');
  const parts = words.trim().split(/\s+/).filter(Boolean);
  // The name: one word, of one entity.
  if (field === 'name') {
    const name = parts[0] ?? '';
    if (parts.length !== 1 || !ENTITY_NAME.test(name)) return 'a name is one word: lowercase letters, digits and _';
    if (world.named(name) && world.named(name) !== e) return `${name} is another entity's name`;
    if (!dry) {
      world.rename(e, name);
      const piece = e.source && pieceOf(e.source);
      if (piece && piece.kind.named) (piece.item as { name: string | null }).name = name;
    }
    return null;
  }
  const [component, ...rest] = path;
  if (component === 'body' && rest[0] !== 'linearVelocity' && rest[0] !== 'angularVelocity')
    return "a body's shape, kind and material are the physics': delete it and add it again";
  if (component === 'transform' && rest[0] === 'rotation')
    return "a turn is its line's (`rotate y 45`): delete it and add it again";
  if (component === 'mechanism' || component === 'mover' || component === 'source')
    return `${component} is the level line's: delete it and add it again`;
  const holder = (e as unknown as Record<string, unknown>)[component ?? ''];
  if (holder === undefined || holder === null || typeof holder !== 'object') return `${which} has no ${component}`;
  // Down the way, to the object that holds the value.
  let at = holder as Record<string, unknown>;
  for (const key of rest.slice(0, -1)) {
    const next = at[key];
    if (next === null || typeof next !== 'object' || Array.isArray(next)) return `${which} has no ${field}`;
    at = next as Record<string, unknown>;
  }
  const key = rest.at(-1);
  if (key === undefined || !(key in at)) return `${which} has no ${field}`;
  const was = at[key];
  const value = parseLike(was, parts);
  if (typeof value === 'string' && value.startsWith('!')) return `${field}: ${value.slice(1)}`;
  // A moving box's place is its motion's.
  if (field === 'transform.position' && (e.mover || e.mechanism || e.spin)) return "it moves by itself: its place is its line's";
  if (dry) return null;
  if (field === 'transform.position') world.place(e, value as Vec3);
  else if (component === 'body') {
    const now = was as Vec3;
    const to = value as Vec3;
    if (rest[0] === 'linearVelocity') world.push(e, [to[0] - now[0], to[1] - now[1], to[2] - now[2]]);
    else at[key] = to;
  } else at[key] = value;
  // The level line follows, as its kind says (stage 5.5e: `LINES`). (A map's floor, stage 4a, follows
  // nothing: it is written back as its map; nor a route, stage 4d.)
  if (e.source) {
    const { kind, item } = pieceOf(e.source);
    kind.follow?.(item, field, value);
  }
  return null;
}

/**
 * Words read as a value like the one there was: as many numbers as it had (relative ones against it),
 * yes or no, a color, a word. A problem comes back as "!why".
 */
function parseLike(was: unknown, words: string[]): Value | number[] {
  const number = (word: string, old: number): number | null => {
    if (!NUMBERS.test(word)) return null;
    if (word.startsWith('+')) return old + Number(word.slice(1));
    if (word.startsWith('*')) return old * Number(word.slice(1));
    return Number(word);
  };
  if (typeof was === 'number') {
    if (words.length === 1 && /^#[0-9a-f]{6}$/i.test(words[0]!)) return parseInt(words[0]!.slice(1), 16);
    const n = words.length === 1 ? number(words[0]!, was) : null;
    return n === null || !Number.isFinite(n) ? '!a number' : n;
  }
  if (typeof was === 'boolean')
    return words[0] === 'on' || words[0] === 'true' ? true : words[0] === 'off' || words[0] === 'false' ? false : '!on or off';
  if (typeof was === 'string') return words.length === 1 ? words[0]! : '!one word';
  if (Array.isArray(was) && was.every((x) => typeof x === 'number')) {
    // One relative value for all of them (`*2`), or one per number.
    const all = words.length === 1 && /^[+*]/.test(words[0]!) && was.length > 1 ? was.map(() => words[0]!) : words;
    if (all.length !== was.length) return `!${was.length} numbers`;
    const out = all.map((w, i) => number(w, was[i] as number));
    return out.some((n) => n === null || !Number.isFinite(n)) ? `!${was.length} numbers` : (out as number[]);
  }
  return '!not a value that can be set (a number, numbers, yes or no, a word)';
}
