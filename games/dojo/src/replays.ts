/**
 * THE REFERENCE REPLAYS (stage 2.5a): one per phase, in `games/dojo/replays/`, each one a run through
 * what that phase built. Their last line is a hash: playing them must end there. They are the safety
 * net of every refactor (it must keep them, bit for bit) and what every browser plays to show it
 * gives the same bits (the determinism check, which needs no screen).
 *
 * They are recorded by `reference.test.ts`, from a script, and only change when the simulation
 * changes on purpose (SIMULATION_VERSION goes up): `npm run references` records them again.
 */
const files = import.meta.glob<string>('../replays/*.replay', { query: '?raw', import: 'default', eager: true });

/** By name (the file's, without `.replay`), in order: `phase-0`, `phase-1`… */
export const REFERENCE_REPLAYS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(files)
    .map(([path, text]) => [path.replace(/^.*\/([^/]+)\.replay$/, '$1'), text] as const)
    .sort(([a], [b]) => a.localeCompare(b)),
);
