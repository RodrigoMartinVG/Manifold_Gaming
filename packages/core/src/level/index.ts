import { MATERIALS } from '../materials';
import type { World } from '../world';
import { emptyLevel, HEADER, LEVEL_FORMAT, type Level, type LevelOptions } from './format';
import { lineKind, LINES, type LineKind } from './lines';
import { LineReader, type Reading } from './reader';

/**
 * LEVELS AS DATA (stage 2a; decision 0000, rule 4), in four parts since stage 5.5e: what a level is and
 * how its format grew (`format.ts`), how one line is read (`reader.ts`), each kind of line in one place
 * (`lines.ts`: how it is read, written, built, moved and followed), and here, a whole level read, written
 * and built, each by going through the kinds in their order.
 */
export * from './format';
export {
  buildPiece,
  floorOnly,
  LAMP_COLOR,
  LINES,
  mapPieces,
  pieceKind,
  pieceOf,
  type LevelPiece,
  type LineKind,
  type PieceItems,
  type PieceKind,
  type PieceWord,
} from './lines';
export type { LineReader } from './reader';

/** A level from its text. A line that is not understood is an error, with its number. */
export function levelFromText(text: string, o: LevelOptions = {}): Level {
  const level = emptyLevel();
  const rows = text.split(/\r?\n/);
  const header = /^# Manifold level ([1-9]\d*)$/.exec(rows[0]?.trim() ?? '');
  const fail = (n: number, why: string): never => {
    throw new Error(`level, line ${n + 1}: ${why}`);
  };
  if (!header) fail(0, `it must start with "${HEADER} ${LEVEL_FORMAT}"`);
  const format = Number(header![1]);
  if (format < 1 || format > LEVEL_FORMAT) fail(0, `a level of format ${format}: this engine reads formats 1 to ${LEVEL_FORMAT}`);
  const reading: Reading = {
    level,
    format,
    o,
    names: new Map(),
    materials: new Map(),
    signals: new Map(),
    once: new Map(),
    madeOf: [],
    zonesRead: [],
    followed: [],
    watchersRead: [],
    ledTo: [],
    drawing: null,
  };
  rows.forEach((row, n) => {
    // Inside a map, every row is a row of it (a `#` is a wall, not a comment), as written: a space at
    // its start is a pit; one at its end, nothing, the same.
    const drawing = reading.drawing;
    if (drawing) {
      if (row.trim() === 'end') {
        if (drawing.map.rows.length === 0) fail(n, 'a map with no rows');
        level.maps.push(drawing.map);
        reading.drawing = null;
        return;
      }
      const cells = row.replace(/\s+$/, '');
      const odd = [...cells].find((c) => c !== '#' && c !== '.' && c !== ' ' && !(c in drawing.map.legend));
      if (odd !== undefined)
        fail(n, `"${odd}" is not in the map (# a wall, . floor, a space nothing, or a letter its line gives a zone)`);
      drawing.map.rows.push(cells);
      return;
    }
    // A comment is a whole line that starts with # (a color, like #6f6a62, is not one).
    const line = row.trim();
    if (!line || line.startsWith('#')) return;
    const r = new LineReader(line, line.split(/\s+/), n, reading);
    const word = r.words[0]!;
    const kind = lineKind(word);
    if (!kind) return r.fail(`"${word}" is not understood (${Object.keys(LINES).join(', ')})`);
    if (kind.once) {
      const first = reading.once.get(word);
      if (first !== undefined) r.fail(`"${word}" twice in a level (the first, on line ${first + 1})`);
      reading.once.set(word, n);
    }
    r.since(word, kind.since);
    kind.read(r, level);
    if (r.at < r.words.length) r.fail(`"${r.words[r.at]}" is extra`);
  });
  if (reading.drawing) fail(reading.drawing.line, 'a map that does not end (its last row, then a line with `end`)');
  for (const { material, line } of reading.madeOf)
    if (!MATERIALS[material] && !level.materials[material])
      fail(line, `no material "${material}" (the engine's: ${Object.keys(MATERIALS).join(', ')}; or one the level declares)`);
  const zoneNames = new Set(level.sensors.flatMap((s) => (s.name ? [s.name] : [])));
  for (const { zone, line } of reading.zonesRead) if (!zoneNames.has(zone)) fail(line, `no zone named "${zone}" in the level`);
  for (const { signal, line } of reading.followed)
    if (!reading.signals.has(signal)) fail(line, `no signal "${signal}" in the level`);
  const watcherNames = new Set(level.watchers.flatMap((w) => (w.name ? [w.name] : [])));
  for (const { watcher, line } of reading.watchersRead)
    if (!watcherNames.has(watcher)) fail(line, `no watcher named "${watcher}" in the level`);
  const objectiveNames = new Set(level.objectives.map((ob) => ob.name));
  for (const { name, line } of reading.ledTo)
    if (!objectiveNames.has(name)) fail(line, `no objective named "${name}" in the level`);
  return level;
}

/** A level as text, in the latest format (what `levelFromText` reads back the same): each kind's lines, in the registry's order. */
export function levelToText(level: Level): string {
  return (
    [`${HEADER} ${LEVEL_FORMAT}`, ...Object.values(LINES as Record<string, LineKind>).flatMap((k) => k.write(level))].join('\n') +
    '\n'
  );
}

/**
 * Puts a level into a world: where its players start, its title and its ambient, kept to be written back as a
 * level (`origin`; where the players start is the game's to use), and then each kind of line's, in the
 * registry's order (`LINES`): its materials, its boxes, as bodies, its kit pieces, its maps' walls and
 * floors, its zones, as sensors that are not seen (`show.sensors` draws them), its lamps and watchers, its
 * signals, in their order, once the zones they read are there, its routes, objectives and scenes.
 */
export function buildLevel(world: World, level: Level) {
  // (Its sky only if it has one: an origin without it is as it was, and so are the hashes of worlds before format 10.)
  world.origin = {
    title: level.title,
    spawn: [...level.spawn],
    facing: [...level.facing],
    ambient: level.ambient,
    ...(level.sky === null ? {} : { sky: level.sky }),
  };
  for (const kind of Object.values(LINES as Record<string, LineKind>)) kind.build?.(world, level);
}
