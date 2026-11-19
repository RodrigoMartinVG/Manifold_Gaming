import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { CHECKED_DUNGEONS, dungeon, textHash } from '@manifold/adventure/dungeon';

/**
 * THE DETERMINISM CHECK (stage 2.5a; every game's since 5.5c): the page "La misma huella" plays the reference
 * replays of every game (each game's `replays/` folder: the Dojo's, one per phase, and each level of the tower, the
 * fortress and the wall) without drawing anything, and compares each final hash with the one Node gave when
 * it was recorded. It needs no WebGL: it is the simulation alone, so it runs in every browser, also in
 * continuous integration (Chromium, Firefox and WebKit). Until 5.5c it played the Dojo's alone.
 */
const games = path.join(import.meta.dirname, '..', 'games');
// In the order the page plays them: the Dojo first, then the games as it lists them; in each, by name
// (`phase-3` before `phase-3-light`: by the files' names, with `.replay`, it would be the other way round).
const ORDER = ['dojo', 'tower', 'fortress', 'wall'];
const references = ORDER.flatMap((game) => {
  const folder = path.join(games, game, 'replays');
  return readdirSync(folder)
    .filter((f) => f.endsWith('.replay'))
    .map((f) => ({
      name: `${game}/${f.replace(/\.replay$/, '')}`,
      hash: /^end \d+ ([0-9a-f]{8})$/m.exec(readFileSync(path.join(folder, f), 'utf8'))![1]!,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

test('this browser plays every game’s reference replays to the hash Node recorded, without drawing anything', async ({
  page,
}) => {
  // Every level of every game, in a browser that may draw on the CPU: minutes, not seconds.
  test.setTimeout(480_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('jugar/la-misma-huella/');
  const check = page.locator('.same-hash');
  await expect(check).toHaveAttribute('data-state', 'done', { timeout: 420_000 });
  // Every replay of every game, none left out (a game with none would show here).
  expect(new Set(references.map((r) => r.name.split('/')[0]))).toEqual(new Set(ORDER));
  await expect(check).toHaveAttribute('data-total', String(references.length));
  // Each row: its game and name, and the hash in this browser, the same as the file's.
  const rows = check.locator('tbody tr');
  await expect(rows).toHaveCount(references.length);
  for (const [i, r] of references.entries()) {
    await expect(rows.nth(i)).toHaveAttribute('data-name', r.name);
    await expect(rows.nth(i).locator('td').nth(3)).toHaveText(r.hash);
  }
  await expect(check).toHaveAttribute('data-same', String(references.length));
  // And it drew nothing: no WebGL context on the page.
  expect(await page.locator('canvas').count()).toBe(0);
  expect(errors).toEqual([]);
});

// Stage 3k: a seed gives the same dungeon in Node and in every browser. The same page makes the
// adventure's dungeons from their seeds; each one's level text has the hash Node gives it.
test('this browser makes the adventure dungeons Node makes, from the same seeds', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('jugar/la-misma-huella/');
  const box = page.locator('.same-dungeon');
  await expect(box).toHaveAttribute('data-state', 'done', { timeout: 30_000 });
  const rows = box.locator('tbody tr');
  await expect(rows).toHaveCount(CHECKED_DUNGEONS.length);
  for (const [i, [seed, depth]] of CHECKED_DUNGEONS.entries())
    await expect(rows.nth(i).locator('td').nth(3), `seed ${seed}, depth ${depth}`).toHaveText(
      textHash(dungeon(seed, depth).text),
    );
  expect(errors).toEqual([]);
});
