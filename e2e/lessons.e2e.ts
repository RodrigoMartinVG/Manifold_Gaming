import { expect, test, type FrameLocator, type Page } from '@playwright/test';

/**
 * THE TUTORIAL SAYS SOMETHING, and these tests check that its figures show it (stage 1f; the tutorial is the book
 * since decision 0030). Running without errors is not enough (e2e/tutorial.e2e.ts checks that): a figure can run
 * "fine" and show nothing. Here each chapter's figures and project are read as a reader reads them, and the numbers
 * the text states are the ones they show.
 */

/** A value of the example's panel (lil-gui), by the name of its row. */
const value = async (f: FrameLocator, name: string) => {
  const row = f.locator('.lil-gui .controller', { has: f.locator('.name', { hasText: name }) }).first();
  return (await row.locator('input').first().inputValue()).trim();
};

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

/** Ticks or unticks a checkbox of the example's panel, by the name of its row. */
async function toggle(f: FrameLocator, name: string) {
  const row = f.locator('.lil-gui .controller', { has: f.locator('.name', { hasText: name }) }).first();
  await row.locator('input[type="checkbox"]').click();
}
const number = async (f: FrameLocator, name: string) => Number(await value(f, name));

/**
 * Scrolls the drawing of the n-th example of the page to the middle of the window, as a reader looks at it (not
 * just inside it, where the site's header covers its panel's top), and waits for it to run: the book's run as
 * they come into view.
 */
async function reach(page: Page, n: number): Promise<FrameLocator> {
  const example = page.locator('.live-code').nth(n);
  await example.locator('.lc-result').evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await expect(example).toHaveAttribute('data-state', 'running', { timeout: 20_000 });
  return example.frameLocator('.lc-result iframe');
}

test('chapter 1: a pixel, the grid in memory, a rectangle and a circle by their centres', async ({ page }) => {
  await page.goto('tutorial/dibujar/01-la-pantalla/');
  let f = await reach(page, 0);
  await expect.poll(() => value(f, 'in hexadecimal')).toBe('#e5c07b');
  await set(f, 'red', '255');
  await set(f, 'green', '255');
  await set(f, 'blue', '0');
  await expect.poll(() => value(f, 'in hexadecimal')).toBe('#ffff00');

  f = await reach(page, 1);
  await expect.poll(() => value(f, 'its place in the line')).toBe('19');
  expect(await value(f, 'where its red is')).toBe('76');

  // A rectangle at whole coordinates, both ways the same; half a pixel to the right, two columns of 7 differ.
  f = await reach(page, 2);
  await expect.poll(() => value(f, 'pixels that differ')).toBe('0');
  await set(f, 'x', '4.5');
  await expect.poll(() => value(f, 'pixels that differ')).toBe('14');

  // The circle of centre (10, 7) and radius 5: 80 pixels; pixel (13, 10) at 4.95, inside. By the corner, 81.
  f = await reach(page, 3);
  await expect.poll(() => value(f, 'pixels painted')).toBe('80');
  expect(await value(f, 'distance')).toBe('4.95');
  expect(await value(f, 'inside (distance ≤ r)')).toBe('yes');
  await toggle(f, 'test the corner, not the centre');
  await expect.poll(() => value(f, 'pixels painted')).toBe('81');
});

test('chapter 1: soft edges halve their error as the samples double; the canvas is another approximation', async ({ page }) => {
  await page.goto('tutorial/dibujar/01-la-pantalla/');
  const f = await reach(page, 4);
  for (const [n, off] of [
    ['1', '73'],
    ['2', '26'],
    ['4', '12'],
    ['8', '6'],
  ] as const) {
    await set(f, 'samples per side', n);
    await expect.poll(() => value(f, 'ours, off the true area by')).toBe(off);
  }
  // With 8 × 8 points ours is nearer the true area than the browser's own circle is.
  expect(await number(f, 'the canvas’s, off the true area by')).toBeGreaterThan(6);

  // The night sky: thousands of pixels differ, nearly all by one level (the canvas's gradient); the moon's edge
  // differs less with more samples.
  const p = await reach(page, 5);
  await set(p, 'samples per side', '1');
  await expect.poll(() => number(p, 'largest difference')).toBeGreaterThan(60);
  const hard = await number(p, 'largest difference');
  await set(p, 'samples per side', '8');
  await expect.poll(() => number(p, 'largest difference')).toBeLessThan(hard);
  expect(await number(p, 'by more than one level')).toBeLessThan(200);
});

test('chapter 2: the point that travels, three attempts, and the canvas’s half pixel', async ({ page }) => {
  await page.goto('tutorial/dibujar/02-lineas/');
  let f = await reach(page, 0);
  await expect.poll(() => value(f, 'P = (1 − t)·A + t·B')).toBe('4, 4');
  await set(f, 't', '0.5');
  await expect.poll(() => value(f, 'P = (1 − t)·A + t·B')).toBe('6, 5');

  // From pixel (3, 2) to pixel (8, 13): one per column leaves 5 holes in 6 pixels; the longer side, 12 and none.
  f = await reach(page, 1);
  await expect.poll(() => value(f, 'pixels painted')).toBe('6');
  expect(await value(f, 'holes')).toBe('5');
  await set(f, 'attempt', 'as many as the longer side');
  await expect.poll(() => value(f, 'pixels painted')).toBe('12');
  expect(await value(f, 'holes')).toBe('0');

  // At a whole y the canvas paints two rows at half; at y + ½, one row, the same as ours.
  f = await reach(page, 2);
  await expect.poll(() => value(f, 'rows the canvas paints')).toBe('2');
  expect(await value(f, 'how much of each row')).toBe('3: 50 %, 4: 50 %');
  await set(f, 'the line’s y', '4.5');
  await expect.poll(() => value(f, 'rows the canvas paints')).toBe('1');
  expect(await value(f, 'pixels that differ')).toBe('0');

  // The constellations: no lines of the reader's yet; the canvas's diagonal lines differ from ours by more than a level.
  const p = await reach(page, 3);
  await expect.poll(() => number(p, 'by more than one level')).toBeGreaterThan(0);
  expect(await value(p, 'lines joined')).toBe('0');
});

test('chapter 3: which side, inside, two neighbours and three corners', async ({ page }) => {
  await page.goto('tutorial/dibujar/03-triangulos/');
  // A (2, 6), B (10, 2), P (7, 7): the ways (8, −4) and (5, 1) give 28, twice the triangle's 14.
  let f = await reach(page, 0);
  await expect.poll(() => value(f, 'dx₁·dy₂ − dy₁·dx₂')).toBe('28');
  expect(await value(f, 'side')).toBe('positive');
  expect(await value(f, 'area of the triangle ABP')).toBe('14');

  // The triangle (3, 2), (20, 5), (8, 14): 95 pixels (one centre on an edge, counted), 204 asked; without the box, 384.
  f = await reach(page, 1);
  await expect.poll(() => value(f, 'pixels painted')).toBe('95');
  expect(await value(f, 'pixels asked')).toBe('204');
  await toggle(f, 'only the box round it');
  await expect.poll(() => value(f, 'pixels asked')).toBe('384');
  expect(await value(f, 'pixels painted')).toBe('95');

  // Two neighbours: the twelve centres on the diagonal, twice, never, or once each.
  f = await reach(page, 2);
  await expect.poll(() => value(f, 'pixels painted twice')).toBe('0');
  expect(await value(f, 'pixels painted by neither')).toBe('0');
  await set(f, 'rule', '≥ 0 (both take it)');
  await expect.poll(() => value(f, 'pixels painted twice')).toBe('12');
  await set(f, 'rule', '> 0 (neither takes it)');
  await expect.poll(() => value(f, 'pixels painted by neither')).toBe('12');
  // The canvas, the same colour twice: its seam's pixels never whole.
  expect(await number(f, 'the canvas: seam pixels not whole')).toBeGreaterThan(0);

  // Three corners: P (12, 10)'s weights, adding up to one.
  f = await reach(page, 3);
  await expect.poll(() => value(f, 'weight of A (red)')).toBe('0.346');
  expect(await value(f, 'weight of B (green)')).toBe('0.308');
  expect(await value(f, 'weight of C (blue)')).toBe('0.346');
  expect(await value(f, 'their sum')).toBe('1');

  // The project runs, and differs from the canvas by more than its gradient's dither (edges, seam, window).
  const p = await reach(page, 4);
  await expect.poll(() => number(p, 'by more than one level')).toBeGreaterThan(0);
});
