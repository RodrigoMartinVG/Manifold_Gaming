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

  test('every reference replay has its recorder in its game’s references/, and every game with replays plays them back', () => {
    for (const [dir, w] of Object.entries(WORKSPACES).filter(([, w]) => w.layer === 'cartridge')) {
      const folder = join(root, dir, 'replays');
      if (!existsSync(folder)) continue;
      const recorders = join(root, dir, 'src', 'references');
      const written = readdirSync(recorders)
        .filter((f) => f.endsWith('.test.ts'))
        .flatMap((f) =>
          [...readFileSync(join(recorders, f), 'utf8').matchAll(/toMatchFileSnapshot\('\.\.\/\.\.\/replays\/([^']+)'\)/g)].map(
            (m) => m[1],
          ),
        );
      for (const replay of readdirSync(folder).filter((f) => f.endsWith('.replay')))
        expect(written, `${dir}/replays/${replay}: no test in src/references/ records it`).toContain(replay);
      expect(readFileSync(join(root, dir, 'src', 'replays.test.ts'), 'utf8'), `${w.name} plays its references back`).toMatch(
        /describeReferences\(/,
      );
    }
  });

  test('each game’s versions name its own rules and every library package they use, through the others too', () => {
    const library = Object.entries(WORKSPACES).filter(([, w]) => w.layer === 'library');
    const short = (name: string) => name.replace('@manifold/', '');
    /** The rules files of a workspace: what is not named as view, brain or tool, and not a test. */
    const rulesOf = (dir: string) => {
      const w = WORKSPACES[dir]!;
      return readdirSync(join(root, dir, 'src'))
        .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && (w.files?.[f] ?? 'rules') === 'rules')
        .map((f) => readFileSync(join(root, dir, 'src', f), 'utf8'));
    };
    /** The library packages some sources import (by name), and those these import in turn. */
    const used = (sources: string[], seen = new Set<string>()): Set<string> => {
      for (const text of sources)
        for (const [, name] of text.matchAll(/from '(@manifold\/[a-z]+)(?:\/[^']*)?'/g)) {
          const lib = library.find(([, w]) => w.name === name);
          if (!lib || seen.has(name!)) continue;
          seen.add(name!);
          used(rulesOf(lib[0]), seen);
        }
      return seen;
    };
    for (const [dir, w] of Object.entries(WORKSPACES).filter(([, w]) => w.layer === 'cartridge')) {
      const sources = rulesOf(dir);
      const declared = sources.map((t) => /versions: \{([^}]*)\}/.exec(t)?.[1]).find((v) => v !== undefined);
      expect(declared, `${w.name} declares its versions`).toBeDefined();
      const names = [...declared!.matchAll(/(?:^|,)\s*(?:\.\.\.([A-Z]+)_VERSION|([a-z]+):)/g)]
        .map((m) => (m[1] ?? m[2])!.toLowerCase())
        .sort();
      expect(names, w.name).toEqual([short(w.name), ...[...used(sources)].map(short)].sort());
    }
  });

  test('versions that must move together do (stage 5.5d): Rapier, the core’s and the site’s; Playwright, the lock’s and continuous integration’s image', () => {
    const json = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));
    const rapier = '@dimforge/rapier3d-deterministic-compat';
    expect(json('packages/core/package.json').dependencies[rapier]).toMatch(/^\d+\.\d+\.\d+$/);
    const site = json('site/package.json');
    expect({ ...site.dependencies, ...site.devDependencies }[rapier]).toBe(
      json('packages/core/package.json').dependencies[rapier],
    );
    const playwright = json('package-lock.json').packages['node_modules/@playwright/test'].version;
    expect(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')).toContain(
      `mcr.microsoft.com/playwright:v${playwright}-`,
    );
  });

  test('every listed asset is the bytes its list says (stage 5.5d): made by its script, its hash recorded', async () => {
    const { createHash } = await import('node:crypto');
    for (const top of ['packages', 'games'])
      for (const dir of readdirSync(join(root, top))) {
        const list = join(root, top, dir, 'assets', 'assets.json');
        if (!existsSync(list)) continue;
        const entries: Record<string, { madeBy?: string; sha256?: string }> = JSON.parse(readFileSync(list, 'utf8'));
        for (const [file, entry] of Object.entries(entries)) {
          const at = `${top}/${dir}/assets/${file}`;
          if (entry.madeBy) expect(existsSync(join(root, entry.madeBy)), `${at}: its script`).toBe(true);
          expect(entry.sha256, `${at}: its hash (npm run art:hashes)`).toMatch(/^[0-9a-f]{64}$/);
          expect(
            createHash('sha256')
              .update(readFileSync(join(root, at)))
              .digest('hex'),
            `${at}: other bytes than its list says`,
          ).toBe(entry.sha256);
        }
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
    // (5.5h) But the shell's headless subpaths, its level's run, by their own names.
    expect(
      await broken('games/wall/src/newrules.ts', "import { notice } from '@manifold/shell/run';\nexport const n = notice;\n"),
    ).toEqual([]);
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
