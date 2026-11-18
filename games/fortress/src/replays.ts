/**
 * THE FORTRESS'S REFERENCE REPLAYS (stage 5f): each level played to its way out by its test
 * (levels.test.ts), as text, by name (`level-1`…). Playing one must end with the hash on its last line.
 */
const files = import.meta.glob<string>('../replays/*.replay', { query: '?raw', import: 'default', eager: true });

export const FORTRESS_REPLAYS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(files).map(([path, text]) => [path.replace(/^.*\/(.+)\.replay$/, '$1'), text]),
);
