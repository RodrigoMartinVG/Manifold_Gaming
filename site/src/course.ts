/**
 * THE TUTORIAL'S PROJECT, A STEP AT A TIME (decision 0021). The project the lessons build lives once,
 * in `src/course/`: a folder per step (`parte-1/02-moverse/`), with only the files that step adds or
 * changes, whole. A step's project is, for each file, its latest version up to that step: nothing is
 * copied by hand, and a change to an early file reaches every later step (a test builds them all).
 *
 * Shared by the live examples (LiveCode.astro) and the test that type-checks every step's project.
 */

/** One file of a step's project, and whether this step added or changed it. */
export interface ProjectFile {
  name: string;
  code: string;
  changed: boolean;
}

/**
 * `../course/parte-1/02-moverse/vec.ts` → `{ step: 'parte-1/02-moverse', name: 'vec.ts' }`, and a file in a
 * folder of the project keeps its folder: `…/01-ventana/view/view.ts` → `view/view.ts` (null outside a step).
 */
function parse(path: string): { step: string; name: string } | null {
  const m = /course\/([^/]+\/[^/]+)\/(.+\.ts)$/.exec(path);
  if (!m || m[2]!.endsWith('.test.ts')) return null; // (a step's unit tests are not the reader's code)
  return { step: m[1]!, name: m[2]! };
}

/** Every step, in order: by part, then by step (`parte-1/01-…` before `parte-1/02-…` before `parte-2/01-…`). */
export function stepsOf(paths: readonly string[]): string[] {
  const steps = new Set(paths.map(parse).flatMap((p) => (p ? [p.step] : [])));
  return [...steps].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

/**
 * Which project a step belongs to: the second version's parts (`parte-1/…`, `parte-2/…`) are one project, a
 * story through its parts; the book (the third version, docs/tutorial-v3.md) is another (`libro/…`). A step
 * inherits only from the steps of its own project.
 */
export const projectOf = (step: string) => (step.startsWith('parte-') ? 'partes' : step.split('/')[0]!);

/**
 * A step's project: the latest version of every file up to `step`. `main.ts` first, then what this
 * step changed, then the rest. Throws for a step that does not exist (a misspelt lesson fails the build).
 */
export function projectAt(sources: Readonly<Record<string, string>>, step: string): ProjectFile[] {
  const all = stepsOf(Object.keys(sources));
  if (!all.includes(step)) throw new Error(`The project has no step "${step}" (in src/course/; steps: ${all.join(', ')})`);
  const steps = all.filter((s) => projectOf(s) === projectOf(step));
  const upTo = steps.indexOf(step);
  const latest = new Map<string, ProjectFile>();
  for (const s of steps.slice(0, upTo + 1))
    for (const [path, code] of Object.entries(sources)) {
      const p = parse(path);
      if (p?.step === s) latest.set(p.name, { name: p.name, code, changed: s === step });
    }
  if (!latest.has('main.ts')) throw new Error(`The project at "${step}" has no main.ts`);
  // main.ts first, then what this step changed, then the rest of the reader's code, and the book's tools last
  // (`herramientas/`: they make the example work, they are not the lesson; docs/tutorial-v3.md §4).
  const tool = (f: ProjectFile) => f.name.startsWith('herramientas/');
  const rank = (f: ProjectFile) => (f.name === 'main.ts' ? 0 : tool(f) ? 3 : f.changed ? 1 : 2);
  return [...latest.values()].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}
