import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, test } from 'vitest';
import { WORKSPACES } from './layers.js';

const root = import.meta.dirname;

/** The repository's workspaces, as its package.json lists them (`packages/*`, `games/*`, `site`). */
function workspaces(): string[] {
  const globs: string[] = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).workspaces;
  return globs.flatMap((glob) =>
    glob.endsWith('/*')
      ? readdirSync(join(root, glob.slice(0, -2)), { withFileTypes: true })
          .filter((d) => d.isDirectory() && existsSync(join(root, glob.slice(0, -2), d.name, 'package.json')))
          .map((d) => `${glob.slice(0, -2)}/${d.name}`)
      : [glob],
  );
}

describe('the layers, in one table (stage 5.5b, decision 0003 as amended)', () => {
  test('every workspace is in the table, by its package’s name; the table names no workspace that is not there', () => {
    const found = workspaces().sort();
    expect(Object.keys(WORKSPACES).sort()).toEqual(found);
    for (const dir of found)
      expect(WORKSPACES[dir]!.name, dir).toBe(JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8')).name);
  });

  test('every file the table names is there (a file renamed or gone would leave its role behind)', () => {
    for (const [dir, w] of Object.entries(WORKSPACES))
      for (const file of Object.keys(w.files ?? {}))
        expect(existsSync(join(root, dir, 'src', file)), `${dir}/src/${file}`).toBe(true);
  });

  test('the library’s rules compile without the DOM: each package’s rules configuration leaves out its view files and tests, no more', () => {
    for (const [dir, w] of Object.entries(WORKSPACES).filter(([, w]) => w.layer === 'library')) {
      // (A JSON with comments: its comments taken out before it is read.)
      const text = readFileSync(join(root, dir, 'tsconfig.rules.json'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
      const rules = JSON.parse(text);
      const views = Object.entries(w.files ?? {})
        .filter(([, role]) => role === 'view')
        .map(([file]) => `src/${file}`);
      expect(rules.compilerOptions, dir).toEqual({ lib: ['ES2023'], types: [] });
      expect([...rules.exclude].sort(), dir).toEqual(['src/**/*.test.ts', ...views].sort());
      expect(JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8')).scripts.check, dir).toMatch(
        /tsconfig\.rules\.json/,
      );
    }
  });

  test('a file added anywhere is guarded from its first line; the view and a brain keep what they may do', async () => {
    const eslint = new ESLint({ cwd: root });
    /** The rules a text breaks, as a file at that path (it need not exist). */
    const broken = async (filePath: string, code: string) =>
      (await eslint.lintText(code, { filePath: join(root, filePath) }))[0]!.messages.map((m) => m.ruleId).sort();
    const trig = 'export const a = Math.sin(1);\n';
    const drawing = "import * as THREE from 'three';\nexport const t = THREE;\n";
    // The simulation, the library and a game's rules: the same bits, no screen, no clock, no page, no game.
    expect(await broken('packages/core/src/newpiece.ts', trig)).toEqual(['no-restricted-properties']);
    expect(await broken('packages/arms/src/newweapon.ts', drawing)).toEqual(['no-restricted-imports']);
    expect(await broken('packages/kit/src/newthing.ts', 'export const d = Date.now();\n')).toEqual(['no-restricted-properties']);
    expect(await broken('games/tower/src/newrules.ts', 'export const w = window.innerWidth;\n')).toEqual([
      'no-restricted-globals',
    ]);
    expect(
      await broken('games/wall/src/newrules.ts', "import { startGame } from '@manifold/shell';\nexport const s = startGame;\n"),
    ).toEqual(['no-restricted-imports']);
    expect(await broken('games/tower/src/newharness.ts', "import { TOWER } from './game';\nexport const t = TOWER;\n")).toEqual([
      'no-restricted-imports',
    ]);
    expect(
      await broken('packages/core/src/newpiece.ts', "import { KIT } from '@manifold/kit';\nexport const k = KIT;\n"),
    ).toEqual(['no-restricted-imports']);
    // A package not in the table yet: the strictest, as rules (and the first test fails until it is in).
    expect(await broken('packages/newpackage/src/index.ts', drawing + trig)).toEqual([
      'no-restricted-imports',
      'no-restricted-properties',
    ]);
    // What may: the view draws and uses any arithmetic; a brain thinks with any arithmetic.
    expect(await broken('packages/presentation/src/neweffect.ts', drawing + trig)).toEqual([]);
    expect(await broken('packages/arms/src/brain.ts', 'export const a = Math.atan2(1, 2);\n')).toEqual([]);
  }, 60_000);
});
