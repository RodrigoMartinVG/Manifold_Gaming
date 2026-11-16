import { recipeTitle } from '@manifold/commands';

/**
 * THE DOJO'S SAVED ROOMS (decision 0010): plain-text recipes in `games/dojo/recipes/`. Each one has
 * its own address on the site (`…/jugar/dojo/rain/`), is loaded from the console (`load rain`) and
 * is run by the tests without a screen. Adding a room is adding a file: nothing else to maintain.
 */
const files = import.meta.glob<string>('../recipes/*.txt', { query: '?raw', import: 'default', eager: true });

/**
 * THE ROOMS' GROUPS, in the order the site shows them: to start; the phases' demonstrations; the
 * character; the world that responds; the engine inside. A recipe says its group in its header, a
 * comment (`# group: world`), so adding a room is still adding a file.
 */
export const ROOM_GROUPS = ['start', 'demos', 'character', 'world', 'engine'] as const;
export type RoomGroup = (typeof ROOM_GROUPS)[number];

export interface Room {
  /** Its title, the recipe's first comment (in English, like everything in the console). */
  title: string;
  /** Its group, from its header's `# group:` comment (null if it has none: the site puts it last). */
  group: RoomGroup | null;
  text: string;
}

/** The group a recipe's header declares, among its first comments (before any command). */
export function recipeGroup(text: string): RoomGroup | null {
  for (const row of text.split(/\r?\n/)) {
    const line = row.trim();
    if (line !== '' && !line.startsWith('#')) return null; // a command: the header is over
    const m = /^#\s*group:\s*(\S+)/.exec(line);
    if (m) return (ROOM_GROUPS as readonly string[]).includes(m[1]!) ? (m[1] as RoomGroup) : null;
  }
  return null;
}

/** By name (the file's, without `.txt`). */
export const ROOMS: Readonly<Record<string, Room>> = Object.fromEntries(
  Object.entries(files)
    .map(
      ([path, text]) =>
        [path.replace(/^.*\/([^/]+)\.txt$/, '$1'), { title: recipeTitle(text) ?? '', group: recipeGroup(text), text }] as const,
    )
    .sort(([a], [b]) => a.localeCompare(b)),
);
