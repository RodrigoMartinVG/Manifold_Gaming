import { expect, test, type FrameLocator, type Page } from '@playwright/test';

/**
 * THE LESSONS SAY SOMETHING, and these tests check that they show it (stage 1f). Running without
 * errors was not enough: a lesson ran "fine" while its ball flew off the floor, and showed nothing.
 * Here the panels of the stage 1 lessons are read, as a reader would read them.
 */

/** Opens a lesson and waits for its first example to run; its iframe, to read its panel. */
async function open(page: Page, path: string): Promise<FrameLocator> {
  await page.goto(path);
  const example = page.locator('.live-code').first();
  await example.locator('.lc-result').scrollIntoViewIfNeeded();
  await expect(example).toHaveAttribute('data-state', 'running', { timeout: 20_000 });
  return page.frameLocator('.live-code .lc-result iframe').first();
}
/** A value of the example's panel (lil-gui), by the name of its row. */
const value = async (f: FrameLocator, name: string) => {
  const row = f.locator('.lil-gui .controller', { has: f.locator('.name', { hasText: name }) }).first();
  return (await row.locator('input').first().inputValue()).trim();
};
const click = (f: FrameLocator, name: string) => f.locator('.lil-gui button', { hasText: name }).first().click();

test('replays: the ghost gives the same hash on every step; one step late, another', async ({ page }) => {
  const f = await open(page, 'tutorial/etapa-1/05-repeticiones/');
  await expect.poll(async () => Number(await value(f, 'steps')), { timeout: 30_000 }).toBeGreaterThan(120);
  await click(f, 'race your ghost');
  await expect.poll(async () => Number(await value(f, 'steps checked')), { timeout: 30_000 }).toBeGreaterThan(100);
  expect(await value(f, 'different hash')).toBe('0');
  await f
    .locator('.lil-gui .controller', { has: f.locator('.name', { hasText: 'one step late' }) })
    .locator('input')
    .click();
  await click(f, 'race your ghost');
  await expect.poll(async () => Number(await value(f, 'different hash')), { timeout: 30_000 }).toBeGreaterThan(0);
});

test('snapshots: the twin born from a snapshot is the same world, until it is nudged', async ({ page }) => {
  const f = await open(page, 'tutorial/etapa-1/06-instantaneas/');
  await expect.poll(async () => Number(await value(f, 'step')), { timeout: 30_000 }).toBeGreaterThan(200);
  expect(await value(f, 'the twin is')).toBe('the same');
  await click(f, 'nudge the twin');
  await expect.poll(() => value(f, 'the twin is'), { timeout: 30_000 }).toMatch(/another world since step/);
});

test('server and client: the hash checks agree; an input lost by the client is a desync', async ({ page }) => {
  const f = await open(page, 'tutorial/etapa-1/07-servidor-y-cliente/');
  await expect.poll(async () => Number(await value(f, 'hash checks')), { timeout: 30_000 }).toBeGreaterThan(2);
  expect(await value(f, 'desyncs')).toBe('0');
  await click(f, 'loses an input');
  await expect.poll(async () => Number(await value(f, 'desyncs')), { timeout: 30_000 }).toBeGreaterThan(0);
});

/** Sets a row of the panel: a number (its text box) or an option (its list). */
async function set(f: FrameLocator, name: string, to: string) {
  const row = f.locator('.lil-gui .controller', { has: f.locator('.name', { hasText: name }) }).first();
  const select = row.locator('select');
  if (await select.count()) await select.selectOption(to);
  else {
    await row.locator('input').first().fill(to);
    await row.locator('input').first().press('Enter');
  }
}

test('numbers that are not exact: far from the origin, a 32-bit step is lost', async ({ page }) => {
  const f = await open(page, 'tutorial/etapa-0/06-numeros-que-no-son-exactos/');
  expect(await value(f, 'a step moves')).toBe('0.0167 m');
  await expect.poll(() => value(f, 'the red one moved'), { timeout: 30_000 }).toMatch(/^-?0\.0167 m$/);
  await set(f, 'far: 10^', '6');
  await expect.poll(() => value(f, 'next 32-bit number'), { timeout: 30_000 }).toBe('0.0625 m');
  await expect.poll(() => value(f, 'the red one moved'), { timeout: 30_000 }).toBe('0.00 m');
});

test('matrices and spaces: the tip stays the same in the ship’s space, not in the world’s', async ({ page }) => {
  const f = await open(page, 'tutorial/etapa-0/07-matrices-y-espacios/');
  await expect.poll(() => value(f, 'the ship’s'), { timeout: 30_000 }).toBe('0.00  0.00  -0.70');
  const world = await value(f, 'the world’s');
  await expect.poll(() => value(f, 'the world’s'), { timeout: 30_000 }).not.toBe(world);
  expect(await value(f, 'the ship’s')).toBe('0.00  0.00  -0.70');
  expect(await value(f, 'row4')).toBe('0.00  0.00  0.00 |  1.00'); // (`value` trims the row)
});

test('finding collisions: the grid finds the same pairs as every pair, with fewer tests', async ({ page }) => {
  const f = await open(page, 'tutorial/etapa-1/01-como-se-encuentra-un-choque/');
  await expect.poll(() => value(f, 'the same pairs as every pair'), { timeout: 30_000 }).toBe('yes');
  expect(Number(await value(f, 'box tests'))).toBeLessThan((300 * 299) / 2 / 5);
  await set(f, 'broad phase', 'every pair');
  await expect.poll(async () => Number(await value(f, 'box tests')), { timeout: 30_000 }).toBe((300 * 299) / 2);
});

test('inputs as actions: a bot asks for actions, and only the changes are kept, with their player', async ({ page }) => {
  const f = await open(page, 'tutorial/etapa-1/04-entradas-como-acciones/');
  await expect.poll(async () => Number(await value(f, 'changes kept')), { timeout: 30_000 }).toBeGreaterThan(2);
  await expect(f.locator('pre')).toContainText('player 2');
  await expect.poll(async () => Number(await value(f, 'jumps, player 2')), { timeout: 30_000 }).toBeGreaterThan(0);
  // Player 1 is on the keyboard and nobody touches it: it asked for nothing.
  expect(await value(f, 'jumps, player 1')).toBe('0');
  expect(Number(await value(f, 'step'))).toBeGreaterThan(Number(await value(f, 'changes kept')));
});
