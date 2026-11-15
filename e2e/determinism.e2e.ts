import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * THE DETERMINISM CHECK (stage 2.5a): the page "La misma huella" plays the Dojo's reference replays
 * (games/dojo/replays/, one per phase) without drawing anything, and compares each final hash with
 * the one Node gave when it was recorded. It needs no WebGL: it is the simulation alone, so it runs
 * in every browser, also in continuous integration (Chromium, Firefox and WebKit).
 */
const folder = path.join(import.meta.dirname, '..', 'games', 'dojo', 'replays');
// In the order of their names, as the page lists them (`phase-3` before `phase-3-light`; by the files'
// names, with `.replay`, it would be the other way round).
const references = readdirSync(folder)
  .filter((f) => f.endsWith('.replay'))
  .map((f) => ({
    name: f.replace(/\.replay$/, ''),
    hash: /^end \d+ ([0-9a-f]{8})$/m.exec(readFileSync(path.join(folder, f), 'utf8'))![1]!,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

test('this browser plays every reference replay to the hash Node recorded, without drawing anything', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('jugar/la-misma-huella/');
  const check = page.locator('.same-hash');
  await expect(check).toHaveAttribute('data-state', 'done', { timeout: 60_000 });
  await expect(check).toHaveAttribute('data-total', String(references.length));
  // Each row: its name, and the hash in this browser, the same as the file's.
  const rows = check.locator('tbody tr');
  await expect(rows).toHaveCount(references.length);
  for (const [i, r] of references.entries()) {
    await expect(rows.nth(i).locator('td').first()).toHaveText(r.name.replace(/^phase-/, 'Fase ').replace(/-light$/, ', la luz'));
    await expect(rows.nth(i).locator('td').nth(3)).toHaveText(r.hash);
  }
  await expect(check).toHaveAttribute('data-same', String(references.length));
  // And it drew nothing: no WebGL context on the page.
  expect(await page.locator('canvas').count()).toBe(0);
  expect(errors).toEqual([]);
});
