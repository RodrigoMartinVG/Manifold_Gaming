import { devices, expect, test } from '@playwright/test';
import { position, errors } from './helpers';

/**
 * THE SITE (decision 0001): the home page and its showcase; a game on a phone (decision 0028).
 */

// The site's texts are in Spanish (decision 0011): the links and headings are looked for in Spanish.
test('the home page opens and leads to the Dojo, the tutorial and the project', async ({ page }) => {
  const list = errors(page);
  await page.goto('./');
  await expect(page).toHaveTitle(/Manifold/);
  await expect(page.getByRole('link', { name: 'Entrar al Dojo' })).toBeVisible();
  await page.getByRole('link', { name: 'Empezar el tutorial' }).click();
  // (The tutorial is the book, decision 0030: its first page carries the book's title.)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Construir un mundo');
  await page.locator('header nav.mg-sections').getByRole('link', { name: 'Proyecto' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('El proyecto');
  expect(list).toEqual([]);
});

test("the home page's showcase lights up and its simulation advances", async ({ page }) => {
  const list = errors(page);
  await page.goto('./');
  // Three.js arrives after the page (dynamic import): the showcase goes from "loading" to "ready"
  // once it drew its first frame. With a GPU it takes less than 1 s; without one (as in continuous
  // integration) about 3 s, and with another test running alongside, more than 15 s once in a while.
  await expect(page.locator('.showcase')).toHaveAttribute('data-state', 'ready', { timeout: 40_000 });
  // Then it has to keep DRAWING and its simulation to ADVANCE: progress, not a frame rate. Without a
  // GPU, with other tests drawing alongside, it drew 10 frames in 15 s (it used to be asked for 30,
  // and failed there). The showcase writes its frames and its step on every frame.
  const view = page.locator('.showcase-window');
  const read = async (name: 'frames' | 'step') => Number(await view.getAttribute(`data-${name}`));
  const [frames, step] = [await read('frames'), await read('step')];
  await expect.poll(() => read('frames')).toBeGreaterThanOrEqual(frames + 3);
  await expect.poll(() => read('step')).toBeGreaterThan(step); // (a frame shorter than a step takes none)
  // The plate shows a step the simulation went through (it is written every 10 frames, to be read).
  const plate = Number((await page.locator('.showcase-step b').textContent())?.replace(/\D/g, ''));
  expect(plate).toBeGreaterThan(0);
  expect(plate).toBeLessThanOrEqual(await read('step'));
  expect(list).toEqual([]);
});

// What is drawn in the empty Dojo: the big cube, the floor (its grid, since stage 3b) and the cubes.
for (const [address, drawn] of [
  ['jugar/dojo/empty/', 2],
  ['jugar/dojo/empty/#recipe=dojo.cubes+20;seed+3', 22],
  // An old link (before 2026-11-14 the empty Dojo was `/jugar/dojo/`): it goes to the empty room, recipe and all.
  ['jugar/dojo/#recipe=dojo.cubes+20;seed+3', 22],
] as const) {
  test(`the Dojo draws without errors, one thing drawn per entity (${address})`, async ({ page }) => {
    const list = errors(page);
    await page.goto(address);
    await expect(page.locator('#game canvas')).toBeVisible();
    // The client writes down how many frames it drew: at least 30 must go by (half a second).
    await expect
      .poll(async () => Number(await page.locator('#game').getAttribute('data-frames')), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(30);
    // One mesh per entity, not one more (in step 0, every cube was drawn twice).
    expect(Number(await page.locator('#game').getAttribute('data-meshes'))).toBe(drawn);
    expect(list).toEqual([]);
  });
}

// ---------------------------------------------------------------- on a phone (decision 0028)

test.describe('on a phone', () => {
  // A phone's screen, touch and coarse pointer (its browser type is the project's: a group cannot change it).
  const { defaultBrowserType: _, ...phone } = devices['Pixel 7']!;
  test.use(phone);

  test('a game tells a phone it is played with a keyboard or a gamepad, and lets you look anyway', async ({ page }) => {
    const list = errors(page);
    await page.goto('jugar/dojo/course/');
    await expect.poll(async () => (await position(page, 'player')).length, { timeout: 20_000 }).toBe(3);
    await expect(page.locator('#game')).toHaveAttribute('data-touch', 'told');
    await expect(page.locator('.mg-touch')).toContainText('teclado y mouse, o con un gamepad');
    await page.locator('.mg-touch button').tap();
    await expect(page.locator('.mg-touch')).toHaveCount(0);
    await expect(page.locator('#game')).not.toHaveAttribute('data-touch', /./);
    expect(list).toEqual([]);
  });
});

test('on a computer (a fine pointer), no such notice', async ({ page }) => {
  await page.goto('jugar/dojo/course/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 20_000 }).toBe(3);
  await expect(page.locator('.mg-touch')).toHaveCount(0);
});
