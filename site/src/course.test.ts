import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, posix, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { projectAt, stepsOf } from './course';

/**
 * THE TUTORIAL'S PROJECT COMPILES AT EVERY STEP (decision 0021). A step keeps only what it changed,
 * so its folder alone does not compile (its main.ts imports files of earlier steps): here each step's
 * whole project is put together, in memory, and type-checked as the site's own code is. A change to
 * an early file that breaks a later step fails here, not when a reader finds it.
 */
const SITE = join(import.meta.dirname, '..');
const COURSE = join(import.meta.dirname, 'course');

/** Every .ts under src/course, keyed as the live examples' glob keys them (`../course/…`). */
function sources(): Record<string, string> {
  const all: Record<string, string> = {};
  const walk = (folder: string) => {
    for (const e of readdirSync(folder, { withFileTypes: true })) {
      const file = join(folder, e.name);
      if (e.isDirectory()) walk(file);
      else if (e.name.endsWith('.ts')) all[`../course/${relative(COURSE, file)}`] = readFileSync(file, 'utf8');
    }
  };
  walk(COURSE);
  return all;
}

/**
 * The new tutorial's compiler options (site/tsconfig.tutorial.json: the site's, and an index into a list
 * may be undefined, as in the engine), so a step is checked as strictly as the rest of the tutorial.
 */
function options(): ts.CompilerOptions {
  const file = join(SITE, 'tsconfig.tutorial.json');
  const config = ts.readConfigFile(file, ts.sys.readFile).config as object;
  return { ...ts.parseJsonConfigFileContent(config, ts.sys, SITE).options, noEmit: true };
}

/** What a step's code may import: its own files and the libraries the live examples have. */
const LIBRARIES = /^(three|three\/addons\/.+|@dimforge\/rapier3d-deterministic-compat|lab)$/;

const all = sources();
const steps = stepsOf(Object.keys(all));

describe('the tutorial’s project, at every step', () => {
  it('there are steps', () => expect(steps.length).toBeGreaterThan(0));
  const compiler = options();
  for (const step of steps)
    it(`${step} compiles`, () => {
      const files = projectAt(all, step);
      // In memory, as if in a folder of the site (so `three` resolves from its node_modules).
      const root = join(SITE, 'src', '.course-check', step);
      const virtual = new Map(files.map((f) => [join(root, f.name), f.code]));
      const host = ts.createCompilerHost(compiler);
      const { fileExists, readFile, getSourceFile } = host;
      host.fileExists = (f) => virtual.has(f) || fileExists(f);
      // (Module resolution asks whether the folder exists before it looks for `./view.ts` in it.)
      const { directoryExists } = host;
      const folders = new Set([...virtual.keys()].map((f) => dirname(f)));
      host.directoryExists = (d) =>
        folders.has(d) || d === root || (directoryExists ? directoryExists(d) : ts.sys.directoryExists(d));
      host.readFile = (f) => virtual.get(f) ?? readFile(f);
      host.getSourceFile = (f, lang, ...rest) => {
        const code = virtual.get(f);
        return code !== undefined ? ts.createSourceFile(f, code, lang) : getSourceFile(f, lang, ...rest);
      };
      const program = ts.createProgram([...virtual.keys()], compiler, host);
      const problems = ts
        .getPreEmitDiagnostics(program)
        .filter((d) => d.file && virtual.has(d.file.fileName))
        .map((d) => `${relative(root, d.file!.fileName)}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
      expect(problems).toEqual([]);
      // Only its own files and the examples' libraries (a step cannot reach into the engine).
      for (const f of files)
        for (const [, spec] of f.code.matchAll(/^\s*import[^'"]*['"]([^'"]+)['"]/gm)) {
          if (spec!.startsWith('./') || spec!.startsWith('../'))
            expect(
              files.some((g) => g.name === `${posix.join(posix.dirname(f.name), spec!)}.ts`),
              `${f.name} imports ${spec}`,
            ).toBe(true);
          else expect(spec, `${f.name} imports ${spec}`).toMatch(LIBRARIES);
        }
    });
});
