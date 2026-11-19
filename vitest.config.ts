import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import { projectOf, stepsOf } from './site/src/course';

/**
 * A STEP OF THE TUTORIAL'S PROJECT keeps only the files it changed (site/src/course.ts): the `./screen` its
 * `line.ts` imports may live in an earlier step. The reader's project is put together from every step up to
 * this one; so is a step's test: an import a step's folder does not have resolves to the latest earlier step
 * of the same project that has it.
 */
function courseSteps(): Plugin {
  const course = resolve('site/src/course');
  const files = (folder: string): string[] =>
    readdirSync(folder, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(join(folder, e.name)) : e.name.endsWith('.ts') ? [join(folder, e.name)] : [],
    );
  return {
    name: 'course-steps',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !source.startsWith('./') || !importer.startsWith(course)) return null;
      const step = /^([^/]+\/[^/]+)\//.exec(relative(course, importer))?.[1];
      if (!step) return null;
      const name = relative(join(course, step), join(dirname(importer), source)) + (source.endsWith('.ts') ? '' : '.ts');
      if (existsSync(join(course, step, name))) return null;
      const steps = stepsOf(files(course)).filter((s) => projectOf(s) === projectOf(step));
      for (let i = steps.indexOf(step) - 1; i >= 0; i--)
        if (existsSync(join(course, steps[i]!, name))) return join(course, steps[i]!, name);
      return null;
    },
  };
}

/** The headless tests: `*.test.ts` files next to the code they test (decision 0001). */
export default defineConfig({
  plugins: [courseSteps()],
  // Models (stage 2e): files to serve or read as they are, not modules.
  assetsInclude: ['**/*.glb'],
  test: {
    // (And the repository's own: the table of layers, stage 5.5b.)
    include: ['packages/*/src/**/*.test.ts', 'games/*/src/**/*.test.ts', 'site/src/**/*.test.ts', 'layers.test.ts'],
    environment: 'node',
    // Each test's time: 20 s, not the usual 5. The heavy ones take about a second alone (two worlds and
    // their hashes for 600 steps; a snapshot gone back to and played on); with every test file at once,
    // and other work on the machine, five times that or more.
    testTimeout: 20_000,
  },
});
