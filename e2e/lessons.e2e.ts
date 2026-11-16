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

// ---------------------------------------------------------------- stage 2 (closing phase 2)

test('zones: balls come into the zones and leave them, each "left" after its "entered", and who is inside adds up', async ({
  page,
}) => {
  const f = await open(page, 'tutorial/etapa-2/01-zonas-que-notan-quien-entra/');
  await expect.poll(async () => Number(await value(f, 'left')), { timeout: 30_000 }).toBeGreaterThan(5);
  // The console from its first line (it keeps the last 200: none dropped yet): for every ball and zone,
  // "entered" and "left" take turns, starting with "entered".
  const lines = (await page.locator('.live-code .lc-console').first().innerText()).split('\n');
  expect(lines[0]).toContain('10 balls, and every zone empty');
  const inside = new Map<string, boolean>();
  let events = 0;
  for (const line of lines) {
    const m = /^ball (\d+) (entered|left) (\w+)$/.exec(line.trim());
    if (!m) continue;
    events++;
    const key = `ball ${m[1]} in ${m[3]}`;
    expect(inside.get(key) ?? false, `${line}: is it inside?`).toBe(m[2] === 'left');
    inside.set(key, m[2] === 'entered');
  }
  expect(events).toBeGreaterThan(10);
  // Paused, the counters hold still: whoever entered and has not left is inside a zone.
  await f
    .locator('.lil-gui .controller', { has: f.locator('.name', { hasText: 'pause' }) })
    .locator('input')
    .click();
  await expect
    .poll(async () => {
      const [entered, left] = [Number(await value(f, 'entered')), Number(await value(f, 'left'))];
      let now = 0;
      for (const zone of ['gate', 'pad', 'spot', 'drain']) now += Number(await value(f, `inside ${zone}`));
      return entered - left - now;
    })
    .toBe(0);
});

test('platforms that carry: on the carousel the character goes round and turns with it; without the carry, it stays', async ({
  page,
}) => {
  const f = await open(page, 'tutorial/etapa-2/04-plataformas-que-llevan/');
  await click(f, 'demo');
  await expect.poll(() => value(f, 'on'), { timeout: 30_000 }).toBe('carousel');
  await expect.poll(async () => Number(await value(f, 'carried (m/s)')), { timeout: 30_000 }).toBeGreaterThan(0.5);
  const turned = Number(await value(f, 'turned (°)'));
  await expect.poll(async () => Number(await value(f, 'turned (°)')), { timeout: 30_000 }).toBeGreaterThan(turned + 10);
  // Without the carry, the carousel turns under it: it is still on it, and nothing carries it.
  await f
    .locator('.lil-gui .controller', { has: f.locator('.name', { hasText: 'the platform carries it' }) })
    .locator('input')
    .click();
  await expect.poll(() => value(f, 'carried (m/s)'), { timeout: 30_000 }).toBe('0.00');
  expect(await value(f, 'on')).toBe('carousel');
});

test('a level as text: what is read is the level, the balls come to rest on its boxes, and a bad line says its number', async ({
  page,
}) => {
  const f = await open(page, 'tutorial/etapa-2/00-un-nivel-como-texto/');
  // The default level: 7 boxes and 2 zones, every line understood.
  expect(await value(f, 'title')).toBe('A small yard');
  expect(await value(f, 'boxes')).toBe('7');
  expect(await value(f, 'zones')).toBe('2');
  expect(await value(f, 'errors')).toBe('0');
  // The 8 balls dropped at the spawn roll down the ramp and come to rest: on the boxes the text made, none in the void.
  await expect.poll(async () => Number(await value(f, 'at rest')), { timeout: 30_000 }).toBe(8);
  expect(await value(f, 'fell off')).toBe('0');
  // A level with a line that is not understood: the rest is built, and the error says which line.
  const example = page.locator('.live-code').first();
  await example.locator('.lc-tabs button', { hasText: 'level.ts' }).click();
  await example.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(
    'export const LEVEL = `# Manifold level 1\nbox 0 -0.5 0  7 0.5 7\nbox 0 1 0  1 1\nsensor goal  0 0.5 0  1 0.5 1\n`;\n',
  );
  await example.locator('.lc-run').click();
  await expect(example.locator('.lc-console')).toContainText('line 3: a number is missing');
  await expect.poll(() => value(f, 'errors')).toBe('1');
  expect(await value(f, 'boxes')).toBe('1');
  expect(await value(f, 'zones')).toBe('1');
});

test('one mode per step: the demo walks, climbs, jumps and glides, and every mode is seen', async ({ page }) => {
  const f = await open(page, 'tutorial/etapa-2/02-un-modo-por-paso/');
  await expect.poll(() => value(f, 'mode'), { timeout: 30_000 }).toBe('walk');
  await click(f, 'demo');
  // The demo starts over from the start, and "modes seen" lists only what it visits: all four.
  await expect
    .poll(async () => (await value(f, 'modes seen')).split(', ').sort().join(' '), { timeout: 60_000 })
    .toBe('air climb glide walk');
});

test('capabilities as data: the demo takes the three stars; without climbing, the same inputs miss the wall’s', async ({
  page,
}) => {
  test.slow();
  const f = await open(page, 'tutorial/etapa-2/03-capacidades-como-datos/');
  await click(f, 'demo');
  // (It waits on "demos played": "stars" goes back to 0 when a demo starts, and could be read too early.)
  await expect.poll(async () => Number(await value(f, 'demos played')), { timeout: 60_000 }).toBe(1);
  expect(await value(f, 'stars')).toBe('3');
  expect(await value(f, 'taken')).toBe('wall, gap, ledge');
  await f
    .locator('.lil-gui .controller', { has: f.locator('.name', { hasText: 'climb' }) })
    .locator('input')
    .click();
  await click(f, 'demo');
  await expect.poll(async () => Number(await value(f, 'demos played')), { timeout: 60_000 }).toBe(2);
  expect(Number(await value(f, 'stars'))).toBeLessThan(3);
  expect(await value(f, 'taken')).not.toContain('wall');
});

// ---------------------------------------------------------------- the lessons of stage 3 (closing phase 3)

/** A checkbox of the example's panel, by the name of its row. */
const box = (f: FrameLocator, name: string) =>
  f
    .locator('.lil-gui .controller', { has: f.locator('.name', { hasText: name }) })
    .first()
    .locator('input[type="checkbox"]');
test('signals: from a cause to the door, one step; computed backwards, three', async ({ page }) => {
  const f = await open(page, 'tutorial/etapa-3/00-entidades-y-senales/');
  await box(f, 'crate a on its plate').check();
  await box(f, 'crate b on its plate').check();
  await expect.poll(() => value(f, 'cause to door (steps)'), { timeout: 15_000 }).toBe('1');
  expect(await value(f, 'both')).toBe('1');
  await box(f, 'computed backwards').check();
  await box(f, 'crate b on its plate').uncheck();
  await expect.poll(() => value(f, 'open'), { timeout: 15_000 }).toBe('0');
  await box(f, 'crate b on its plate').check();
  await expect.poll(() => value(f, 'cause to door (steps)'), { timeout: 15_000 }).toBe('3');
});

test('logical light: walking its loop, the character is seen in the light and not behind the pillar or in the dark', async ({
  page,
}) => {
  const f = await open(page, 'tutorial/etapa-3/01-la-luz-como-logica/');
  const seen = () => box(f, 'seen').isChecked();
  await expect.poll(seen, { timeout: 30_000 }).toBe(true);
  await expect.poll(seen, { timeout: 30_000 }).toBe(false);
  // Still, the light is the ambient plus each lamp's part (the rows by their whole name: "lamp 2" is
  // also in "lamp 2 on").
  await box(f, 'walking').uncheck();
  const exact = (name: string) =>
    f
      .locator('.lil-gui .controller', { has: f.locator('.name', { hasText: new RegExp(`^${name}$`) }) })
      .first()
      .locator('input')
      .first()
      .inputValue()
      .then(Number);
  await page.waitForTimeout(300);
  const parts = await Promise.all(['lamp 1', 'lamp 2', 'lamp 3'].map(exact));
  expect(await exact('light')).toBeCloseTo(0.08 + parts.reduce((a, b) => a + b, 0), 2);
});

test('breakables: a slow ball does not break the vase; a faster one does, with three pieces and fragments apart', async ({
  page,
}) => {
  const f = await open(page, 'tutorial/etapa-3/02-lo-que-se-rompe/');
  // At 4 m/s, about 38 J: less than its 60.
  await click(f, 'throw');
  await expect.poll(async () => Number(await value(f, 'last hit (J)')), { timeout: 15_000 }).toBeGreaterThan(30);
  expect(Number(await value(f, 'last hit (J)'))).toBeLessThan(60);
  expect(await box(f, 'broken').isChecked()).toBe(false);
  await set(f, 'speed (m/s)', '7');
  await click(f, 'throw');
  await expect.poll(() => box(f, 'broken').isChecked(), { timeout: 15_000 }).toBe(true);
  expect(await value(f, 'pieces (simulation)')).toBe('3');
  expect(Number(await value(f, 'fragments (drawing)'))).toBeGreaterThan(0);
});

test('sound from events: steps on each floor, heard as far as it says; a dropped ball hits the metal', async ({ page }) => {
  const f = await open(page, 'tutorial/etapa-3/03-el-sonido-sale-de-los-eventos/');
  await expect.poll(() => value(f, 'last sound'), { timeout: 15_000 }).toMatch(/^step on (wood|stone|metal)$/);
  const heard = { wood: '7', stone: '6', metal: '10' } as Record<string, string>;
  await expect
    .poll(
      async () => {
        const [, surface] = /^step on (\w+)$/.exec(await value(f, 'last sound')) ?? [];
        return surface ? heard[surface] === (await value(f, 'heard (m)')) : false;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  await click(f, 'drop a ball');
  // (The steps write over the last sound right away: the hits are counted apart.)
  await expect.poll(async () => Number(await value(f, 'hits')), { timeout: 15_000 }).toBeGreaterThan(0);
  await expect.poll(async () => Number(await value(f, 'the guard heard')), { timeout: 30_000 }).toBeGreaterThan(0);
});

test('saving as data: the progress loads after the engine changes, the photo does not; an old save is brought forward', async ({
  page,
}) => {
  const f = await open(page, 'tutorial/etapa-3/04-guardar-como-datos/');
  await expect.poll(async () => Number(await value(f, 'gems')), { timeout: 30_000 }).toBeGreaterThan(0);
  await click(f, 'save the progress');
  await expect.poll(() => value(f, 'message')).toMatch(/^saved/);
  await set(f, 'engine version', '23');
  await click(f, 'load the photo');
  await expect.poll(() => value(f, 'message')).toMatch(/cannot be read/);
  await click(f, 'load the progress');
  await expect.poll(() => value(f, 'message')).toMatch(/^loaded the progress/);
  await click(f, 'load an old save (v1)');
  await expect.poll(() => value(f, 'message')).toMatch(/version 1 save, brought forward/);
});
