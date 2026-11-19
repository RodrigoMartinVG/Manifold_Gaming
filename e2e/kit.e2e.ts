import { expect, test } from '@playwright/test';
import { afterSteps, position, errors, typeInConsole } from './helpers';

/**
 * THE KIT (stage 4.5e), THE CITADEL (4.5f), THE METRICS GYM AND THE SKY (5a).
 */

// ---------------------------------------------------------------- turning and the camera (stage 1c2)

// ---------------------------------------------------------------- the kit (stage 4.5e)

test('the kit room: every piece of the games’ kit drawn with its model, each a node of one file', async ({ page }) => {
  const list = errors(page);
  const warnings: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'warning' && /model/.test(m.text())) warnings.push(m.text());
  });
  await page.goto('jugar/dojo/kit/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  // Its 32 pieces (the 24 kinds, some twice), the floor, the box that holds the stairs' landing up, the player.
  await expect.poll(async () => Number(await page.locator('#game').getAttribute('data-meshes')), { timeout: 20_000 }).toBe(35);
  // Drawn with their models (they loaded: no piece fell back to its box), and few triangles for so much.
  await afterSteps(page, 30);
  const triangles = Number(await page.locator('#game').getAttribute('data-triangles'));
  expect(triangles).toBeGreaterThan(3000);
  expect(warnings).toEqual([]);
  expect(list).toEqual([]);
});

// ---------------------------------------------------------------- the citadel (stage 4.5f)

test('the citadel: built with the kit, drawn within its budget everywhere in it, with six lights for its fourteen lamps', async ({
  page,
}) => {
  const list = errors(page);
  const warnings: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'warning' && /model/.test(m.text())) warnings.push(m.text());
  });
  await page.goto('jugar/dojo/citadel/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await expect
    .poll(async () => Number(await page.locator('#game').getAttribute('data-meshes')), { timeout: 20_000 })
    .toBeGreaterThan(300);
  await expect(page.locator('#game')).toHaveAttribute('data-lights', '6');
  // At dusk (stage 5a): its sky's hour, its level's.
  await expect(page.locator('#game')).toHaveAttribute('data-sky', '19.5');
  // The budget (decision 0026, set in stage 4.5f from what it measured): at most 300 draw calls and
  // 50,000 triangles a frame, wherever you stand, as the page's quality tier says it (stage 5.5g). Measured
  // where it draws the most: the courtyard, the hall from its gate, the library, the roofs, the tower's top.
  const budget = await Promise.all(
    ['data-budget-draws', 'data-budget-triangles'].map(async (a) => Number(await page.locator('#game').getAttribute(a))),
  );
  expect(budget).toEqual([300, 50_000]);
  await page.keyboard.press('Backquote');
  for (const at of ['-2 1 9', '2 1 -2', '11 4 1.5', '13 7 4', '0 8 -24']) {
    await typeInConsole(page, `dojo.goto ${at}`);
    await afterSteps(page, 30);
    const [draws, triangles] = await Promise.all(
      ['data-draws', 'data-triangles'].map(async (a) => Number(await page.locator('#game').getAttribute(a))),
    );
    expect(draws, `draws at ${at}`).toBeLessThanOrEqual(budget[0]!);
    expect(triangles, `triangles at ${at}`).toBeLessThanOrEqual(budget[1]!);
    expect(triangles, `drawn at ${at}`).toBeGreaterThan(2000);
    // (Stage 5m) Its still pieces drawn in batches by squares of 16 m: up to 300 before, 39 to 81 measured.
    expect(draws, `batched at ${at}`).toBeLessThanOrEqual(150);
  }
  expect(Number(await page.locator('#game').getAttribute('data-batches'))).toBeGreaterThan(0);
  expect(warnings).toEqual([]);
  expect(list).toEqual([]);
});

// ---------------------------------------------------------------- the metrics gym and the sky (stage 5a)

test('the metrics gym: `metrics` says what the character can do in meters, under the afternoon sky its level says', async ({
  page,
}) => {
  const list = errors(page);
  await page.goto('jugar/dojo/gym/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await expect(page.locator('#game')).toHaveAttribute('data-sky', '15.5');
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'metrics');
  await expect(page.locator('.mg-console')).toContainText(
    'jump: its feet rise 2.10 m (2.15 without steps), at the top at step 39',
  );
  await expect(page.locator('.mg-console')).toContainText('its middle goes 5.92 m walking, 9.88 m running');
  await expect(page.locator('.mg-console')).toContainText('1.60 m tall, 1.10 m crouched');
  // `inspect me` says how to change the jump, and how to ask again.
  await typeInConsole(page, 'inspect me');
  await expect(page.locator('.mg-console')).toContainText(/set (\d+) character\.movement\.jump\.speed 6\.5\s+metrics \1/);
  // Another hour on this page only, and back to the level's.
  await typeInConsole(page, 'view.sky 0');
  await expect(page.locator('#game')).toHaveAttribute('data-sky', '0');
  await typeInConsole(page, 'view.sky -1');
  await expect(page.locator('#game')).toHaveAttribute('data-sky', '15.5');
  expect(list).toEqual([]);
});

test('a level without a sky keeps the flat background of before', async ({ page }) => {
  await page.goto('jugar/dojo/course/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await expect(page.locator('#game')).toHaveAttribute('data-sky', 'none');
});
