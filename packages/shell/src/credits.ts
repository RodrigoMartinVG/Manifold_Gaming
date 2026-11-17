/** A file's entry in an asset list (decision 0015: `assets.json`, beside the files). */
export interface AssetEntry {
  what: string;
  /** The script of this repository that makes it (Blender without a screen). */
  madeBy?: string;
  /** Or, from outside: its author, where it comes from, and its license. */
  author?: string;
  source?: string;
  license?: string;
}

/** An asset list: each file of a folder, by its name. */
export type AssetList = Readonly<Record<string, AssetEntry>>;

/** A line of the credits: the file, and where it comes from (a script of ours, or someone's under a license). */
export type CreditLine =
  | { file: string; made: 'script'; by: string }
  | { file: string; made: 'outside'; author: string; source: string; license: string };

/**
 * WHERE EVERY FILE A GAME DRAWS COMES FROM (stage 5b, decision 0015), from the asset lists of what it
 * uses (the kit's, the character's, its own), as the credits say it: one line a file, in the order of
 * the lists, a file listed twice once. A list's tests keep it whole (no file without its entry), so
 * the credits are whole too.
 */
export function creditsFrom(lists: readonly AssetList[]): CreditLine[] {
  const lines: CreditLine[] = [];
  const seen = new Set<string>();
  for (const list of lists)
    for (const [file, e] of Object.entries(list)) {
      if (seen.has(file)) continue;
      seen.add(file);
      lines.push(
        e.madeBy
          ? { file, made: 'script', by: e.madeBy }
          : { file, made: 'outside', author: e.author ?? '?', source: e.source ?? '?', license: e.license ?? '?' },
      );
    }
  return lines;
}

/**
 * What the engine is made with, from outside (its code, not files a game draws), with each one's
 * license: the physics and the drawing. Shown in every game's credits.
 */
export const ENGINE_CREDITS: readonly { what: string; name: string; license: string }[] = [
  { what: 'physics', name: 'Rapier', license: 'Apache-2.0' },
  { what: 'drawing', name: 'three.js', license: 'MIT' },
];
