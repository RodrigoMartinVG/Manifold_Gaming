import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { configDefaults, defineConfig, type Plugin } from 'vitest/config';

/**
 * A STEP OF THE TUTORIAL'S PROJECT keeps only the files it changed (site/src/course.ts): the `./screen` its
 * `line.ts` imports may live in an earlier step. The reader's project is put together from every step up to
 * this one; so is a step's test: an import a step's folder does not have resolves to the latest earlier step
 * of the same project that has it.
 */
function courseSteps(): Plugin {
  const course = resolve('site/src/course');
  // The course's own code, loaded when a step first asks (stage 5.5c): before, this file imported it, and a
  // fault in the tutorial's code stopped every engine test from starting. (Node runs the TypeScript itself.)
  let steps: Promise<typeof import('./site/src/course')> | null = null;
  const load = () => (steps ??= import(/* @vite-ignore */ pathToFileURL(resolve('site/src/course.ts')).href));
  const files = (folder: string): string[] =>
    readdirSync(folder, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(join(folder, e.name)) : e.name.endsWith('.ts') ? [join(folder, e.name)] : [],
    );
  return {
    name: 'course-steps',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!importer || !source.startsWith('./') || !importer.startsWith(course)) return null;
      const step = /^([^/]+\/[^/]+)\//.exec(relative(course, importer))?.[1];
      if (!step) return null;
      const name = relative(join(course, step), join(dirname(importer), source)) + (source.endsWith('.ts') ? '' : '.ts');
      if (existsSync(join(course, step, name))) return null;
      const { projectOf, stepsOf } = await load();
      const ordered = stepsOf(files(course)).filter((s) => projectOf(s) === projectOf(step));
      for (let i = ordered.indexOf(step) - 1; i >= 0; i--)
        if (existsSync(join(course, ordered[i]!, name))) return join(course, ordered[i]!, name);
      return null;
    },
  };
}

/** Each game's reference replays: their recorders (one level a file), and their playback (stage 5.5c). */
const PLAYTHROUGHS = ['games/*/src/references/**/*.test.ts', 'games/*/src/replays.test.ts'];

/**
 * The headless tests: `*.test.ts` files next to the code they test (decision 0001), in three projects (stage
 * 5.5c): `units`, the engine's, the library's and the games' own; `playthroughs`, every level of every game
 * played to its end and its reference replay played back (the slow ones, each level a file so they run side by
 * side); `site`, the tutorial's, with its steps' resolver. `npm test` runs units and the site, `npm run
 * test:all` all three (continuous integration, `verify`), `npm run references` records the references again.
 */
export default defineConfig({
  // Models (stage 2e): files to serve or read as they are, not modules.
  assetsInclude: ['**/*.glb'],
  test: {
    environment: 'node',
    // Each test's time: 20 s, not the usual 5. The heavy ones take about a second alone (two worlds and
    // their hashes for 600 steps; a snapshot gone back to and played on); with every test file at once,
    // and other work on the machine, five times that or more.
    testTimeout: 20_000,
    projects: [
      {
        extends: true,
        test: {
          name: 'units',
          // (And the repository's own: the table of layers, stage 5.5b.)
          include: ['packages/*/src/**/*.test.ts', 'games/*/src/**/*.test.ts', 'layers.test.ts', 'status.test.ts'],
          exclude: [...configDefaults.exclude, ...PLAYTHROUGHS],
        },
      },
      { extends: true, test: { name: 'playthroughs', include: PLAYTHROUGHS } },
      { extends: true, plugins: [courseSteps()], test: { name: 'site', include: ['site/src/**/*.test.ts'] } },
    ],
  },
});
