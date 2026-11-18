import { expect, test, type FrameLocator, type Page } from '@playwright/test';
import type * as THREE from 'three';

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
  const f = await open(page, 'tutorial/archivo/etapa-1/05-repeticiones/');
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
  const f = await open(page, 'tutorial/archivo/etapa-1/06-instantaneas/');
  await expect.poll(async () => Number(await value(f, 'step')), { timeout: 30_000 }).toBeGreaterThan(200);
  expect(await value(f, 'the twin is')).toBe('the same');
  await click(f, 'nudge the twin');
  await expect.poll(() => value(f, 'the twin is'), { timeout: 30_000 }).toMatch(/another world since step/);
});

test('server and client: the hash checks agree; an input lost by the client is a desync', async ({ page }) => {
  const f = await open(page, 'tutorial/archivo/etapa-1/07-servidor-y-cliente/');
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
  const f = await open(page, 'tutorial/archivo/etapa-0/06-numeros-que-no-son-exactos/');
  expect(await value(f, 'a step moves')).toBe('0.0167 m');
  await expect.poll(() => value(f, 'the red one moved'), { timeout: 30_000 }).toMatch(/^-?0\.0167 m$/);
  await set(f, 'far: 10^', '6');
  await expect.poll(() => value(f, 'next 32-bit number'), { timeout: 30_000 }).toBe('0.0625 m');
  await expect.poll(() => value(f, 'the red one moved'), { timeout: 30_000 }).toBe('0.00 m');
});

test('matrices and spaces: the tip stays the same in the ship’s space, not in the world’s', async ({ page }) => {
  const f = await open(page, 'tutorial/archivo/etapa-0/07-matrices-y-espacios/');
  await expect.poll(() => value(f, 'the ship’s'), { timeout: 30_000 }).toBe('0.00  0.00  -0.70');
  const world = await value(f, 'the world’s');
  await expect.poll(() => value(f, 'the world’s'), { timeout: 30_000 }).not.toBe(world);
  expect(await value(f, 'the ship’s')).toBe('0.00  0.00  -0.70');
  expect(await value(f, 'row4')).toBe('0.00  0.00  0.00 |  1.00'); // (`value` trims the row)
});

test('finding collisions: the grid finds the same pairs as every pair, with fewer tests', async ({ page }) => {
  const f = await open(page, 'tutorial/archivo/etapa-1/01-como-se-encuentra-un-choque/');
  await expect.poll(() => value(f, 'the same pairs as every pair'), { timeout: 30_000 }).toBe('yes');
  expect(Number(await value(f, 'box tests'))).toBeLessThan((300 * 299) / 2 / 5);
  await set(f, 'broad phase', 'every pair');
  await expect.poll(async () => Number(await value(f, 'box tests')), { timeout: 30_000 }).toBe((300 * 299) / 2);
});

test('inputs as actions: a bot asks for actions, and only the changes are kept, with their player', async ({ page }) => {
  const f = await open(page, 'tutorial/archivo/etapa-1/04-entradas-como-acciones/');
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
  const f = await open(page, 'tutorial/archivo/etapa-2/01-zonas-que-notan-quien-entra/');
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
  const f = await open(page, 'tutorial/archivo/etapa-2/04-plataformas-que-llevan/');
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
  const f = await open(page, 'tutorial/archivo/etapa-2/00-un-nivel-como-texto/');
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
  const f = await open(page, 'tutorial/archivo/etapa-2/02-un-modo-por-paso/');
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
  const f = await open(page, 'tutorial/archivo/etapa-2/03-capacidades-como-datos/');
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
  const f = await open(page, 'tutorial/archivo/etapa-3/00-entidades-y-senales/');
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
  const f = await open(page, 'tutorial/archivo/etapa-3/01-la-luz-como-logica/');
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
  // (Read until the panel has caught up with the stop: on a loaded machine a frame can come between
  // two readings, with the character still moving. Waiting for the relation, not for a clock.)
  const ambient = async () => {
    const parts = await Promise.all(['lamp 1', 'lamp 2', 'lamp 3'].map(exact));
    return (await exact('light')) - parts.reduce((a, b) => a + b, 0);
  };
  await expect.poll(ambient).toBeCloseTo(0.08, 2);
});

test('breakables: a slow ball does not break the vase; a faster one does, with three pieces and fragments apart', async ({
  page,
}) => {
  const f = await open(page, 'tutorial/archivo/etapa-3/02-lo-que-se-rompe/');
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
  const f = await open(page, 'tutorial/archivo/etapa-3/03-el-sonido-sale-de-los-eventos/');
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
  const f = await open(page, 'tutorial/archivo/etapa-3/04-guardar-como-datos/');
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

/** Ticks or unticks a checkbox of the example's panel, by the name of its row. */
async function toggle(f: FrameLocator, name: string) {
  const row = f.locator('.lil-gui .controller', { has: f.locator('.name', { hasText: name }) }).first();
  await row.locator('input[type="checkbox"]').click();
}
const number = async (f: FrameLocator, name: string) => Number(await value(f, name));

test('rays and sweeps: the ball stops a radius before the ray, only the ray fits the slot, a new box is seen a step later', async ({
  page,
}) => {
  const f = await open(page, 'tutorial/archivo/etapa-2/05-rayos-y-barridos/');
  await expect.poll(() => value(f, 'west, the wall')).toBe('5.00 / 4.75');
  expect(await value(f, 'east, the slot')).toBe('5.00 / 2.75');
  expect(await value(f, 'north, the glass')).toBe('3.00 / 2.75');
  expect(await value(f, 'before the first step')).toBe('nothing');
  await set(f, 'ball radius', '0.15');
  await expect.poll(() => value(f, 'east, the slot')).toBe('5.00 / 4.85');
  // (With the 15 cm ball, the far wall is 15 cm before the ray.)
  await toggle(f, 'see the glass');
  await expect.poll(() => value(f, 'north, the glass')).toBe('5.00 / 4.85');
  await click(f, 'add a box in the way');
  await expect.poll(() => value(f, 'new box: seen at once')).toBe('no');
  await expect.poll(() => value(f, 'new box: seen after')).toBe('1');
});

// (`@quiet`: it runs after the rest, alone, playwright.config.ts: its measure is taken frame by frame,
// and a frame of a loaded machine holds half a step.)
test(
  'an animated character: with the phase by distance the planted foot barely slides; by the clock it slides',
  { tag: '@quiet' },
  async ({ page }) => {
    const f = await open(page, 'tutorial/archivo/etapa-2/06-un-personaje-animado/');
    // The first lap looks north: its north side walks to its right, one clip alone.
    await expect.poll(() => value(f, 'direction weights'), { timeout: 20_000 }).toBe('right 1.00');
    const slide = await number(f, 'foot slide');
    expect(slide).toBeGreaterThan(0);
    expect(slide).toBeLessThan(12);
    await toggle(f, 'phase by distance');
    await expect.poll(() => number(f, 'foot slide'), { timeout: 20_000 }).toBeGreaterThan(18);
  },
);

test('friction and bounce: ice slides where stone stays, rubber comes back up e² of the height, ice takes 65 steps to stop', async ({
  page,
}) => {
  const f = await open(page, 'tutorial/archivo/etapa-3/05-friccion-y-rebote/');
  await expect.poll(() => number(f, 'ice slid'), { timeout: 20_000 }).toBeGreaterThan(0.5);
  expect(await number(f, 'stone slid')).toBeLessThan(0.01);
  expect(await value(f, 'rubber: e²')).toBe('0.5');
  await expect.poll(() => number(f, 'rubber bounced'), { timeout: 20_000 }).toBeGreaterThan(0.45);
  expect(await number(f, 'rubber bounced')).toBeLessThan(0.5);
  await expect.poll(() => value(f, 'stops on stone'), { timeout: 20_000 }).toBe('6');
  await expect.poll(() => value(f, 'stops on ice'), { timeout: 20_000 }).toBe('65');
  await set(f, 'combine rule', 'max');
  await expect.poll(() => value(f, 'rubber: e²')).toBe('1.28');
});

test('mass: the capped push moves the crate and not the block; the crate is carried and stops at the wall', async ({ page }) => {
  const f = await open(page, 'tutorial/archivo/etapa-3/06-la-masa/');
  expect(await value(f, 'crate (kg)')).toBe('44.8');
  expect(await value(f, 'block (kg)')).toBe('1228.8');
  expect(await value(f, 'crate friction (N)')).toBe('242');
  expect(await value(f, 'block friction (N)')).toBe('7233');
  await expect.poll(() => number(f, 'crate pushed'), { timeout: 15_000 }).toBeGreaterThan(4);
  expect(await number(f, 'block pushed')).toBeLessThan(0.1);
  // Held against the see-through wall: the hand goes on, the crate does not go through.
  await expect.poll(() => number(f, 'hand to crate'), { timeout: 15_000 }).toBeGreaterThanOrEqual(30);
  expect(await number(f, 'into the wall')).toBeLessThanOrEqual(2);
  expect(await number(f, 'block lifted')).toBeLessThan(5);
  await toggle(f, 'cap the force');
  await expect.poll(() => value(f, 'push, hold at most')).toBe('no limit');
  await expect.poll(() => number(f, 'block lifted'), { timeout: 15_000 }).toBeGreaterThan(30);
});

test('the camera against walls: with the sweep it never gets near a wall or behind one; without it, it does', async ({
  page,
}) => {
  const f = await open(page, 'tutorial/archivo/etapa-3/07-la-camara-contra-las-paredes/');
  // Through the tunnel and round the first corners, the walls take something from the camera.
  await expect.poll(() => number(f, 'cut (m)'), { timeout: 15_000 }).toBeGreaterThan(2);
  expect(await number(f, 'closest to a wall')).toBeGreaterThanOrEqual(20);
  expect(await value(f, 'frames with a wall between')).toBe('0');
  await toggle(f, 'leash learns the wall');
  await expect.poll(() => number(f, 'leash (m)'), { timeout: 15_000 }).toBeLessThan(4);
  await toggle(f, 'leash learns the wall');
  await toggle(f, 'sweep');
  await expect.poll(() => number(f, 'frames with a wall between'), { timeout: 15_000 }).toBeGreaterThan(0);
});

test('the game’s interface: the language changes the words, never the key or the world', async ({ page }) => {
  // Two runs of 300 steps each: on a slow machine the world steps slower than the clock (the frames are
  // capped), so the waits are for the world's steps, with room.
  test.setTimeout(180_000);
  const f = await open(page, 'tutorial/archivo/etapa-3/08-la-interfaz-del-juego/');
  await expect.poll(() => value(f, 'last notice (key)')).toMatch(/^notice\.(star|goal) \[/);
  await expect.poll(() => value(f, 'last notice (words)')).toMatch(/estrella|Vuelta|La última/);
  expect(await value(f, 'keys missing')).toBe('none');
  await expect.poll(() => value(f, 'world hash'), { timeout: 60_000 }).toMatch(/^[0-9a-f]{8}$/);
  const spanish = await value(f, 'world hash');
  await set(f, 'language', 'en');
  await expect.poll(() => value(f, 'last notice (words)')).toMatch(/A star|Lap done|The last one/);
  await expect.poll(() => value(f, 'last subtitle')).toMatch(/^(Steps on (wood|metal)|A chime|A door) /);
  await click(f, 'restart');
  await expect.poll(() => value(f, 'world hash')).toBe('…');
  await expect.poll(() => value(f, 'world hash'), { timeout: 60_000 }).toMatch(/^[0-9a-f]{8}$/);
  expect(await value(f, 'world hash')).toBe(spanish);
});

test('a level that tests itself: few boxes, the export is the map, and its recipe passes; per cell, the ball hops', async ({
  page,
}) => {
  const f = await open(page, 'tutorial/archivo/etapa-3/09-un-nivel-que-se-prueba-solo/');
  expect(await value(f, 'cells')).toBe('135');
  expect(await value(f, 'boxes')).toBe('17');
  expect(await value(f, 'export = map')).toBe('yes');
  await expect.poll(() => value(f, 'asserts passed'), { timeout: 30_000 }).toBe('3 of 3');
  expect(await value(f, 'steps to the goal')).toBe('430');
  await toggle(f, 'merge rectangles');
  await expect.poll(() => value(f, 'boxes')).toBe('137');
  expect(await value(f, 'export = map')).toBe('yes');
  await expect.poll(() => value(f, 'asserts passed'), { timeout: 30_000 }).toBe('1 of 3');
  expect(await number(f, 'highest hop')).toBeGreaterThan(2);
});

test('a dungeon from a seed: the same seed gives the same dungeon, all connected; another generator, another one', async ({
  page,
}) => {
  const f = await open(page, 'tutorial/archivo/etapa-3/10-un-calabozo-con-una-semilla/');
  await expect.poll(() => value(f, 'hash (map)')).toBe('744db12f');
  expect(await value(f, 'rooms')).toBe('6 of 6');
  expect(await value(f, 'floor cells')).toBe('182');
  expect(await value(f, 'connected')).toBe('yes');
  await click(f, 'same seed again');
  await expect.poll(() => value(f, 'same as before')).toBe('yes');
  await toggle(f, 'generator v2');
  await expect.poll(() => value(f, 'hash (map)')).toBe('1a200ba1');
  expect(await value(f, 'same as before')).toBe('no');
  await toggle(f, 'generator v2');
  await expect.poll(() => value(f, 'hash (map)')).toBe('744db12f');
  await set(f, 'seed', '8');
  await expect.poll(() => value(f, 'hash (map)')).toBe('2c2d14c7');
});

test('a window into the world: each target at three.js’s pixel, and the drawing rebuilt frees what it made', async ({ page }) => {
  const f = await open(page, 'tutorial/parte-1/03-una-ventana-al-mundo/');
  // Both rows at once, in one task of the figure's frame (no frame can come in between).
  const frame = (await (await page.locator('.live-code .lc-result iframe').first().elementHandle())!.contentFrame())!;
  const both = () =>
    frame.evaluate(() => {
      const row = (name: string) =>
        [...document.querySelectorAll('.lil-gui .controller')]
          .find((c) => c.querySelector('.name')?.textContent?.startsWith(name))!
          .querySelector('input')!
          .value.split(',')
          .map(Number);
      const [[ox, oy], [tx, ty]] = [row('our pixel'), row('three.js pixel')];
      return Math.max(Math.abs(ox! - tx!), Math.abs(oy! - ty!));
    });
  for (const [target, depth] of [
    ['target 1', '9'],
    ['target 2', '4'],
    ['target 3', '10'],
  ] as const) {
    await set(f, 'target', target);
    await expect.poll(() => value(f, 'depth (m)')).toBe(depth);
    expect(await both()).toBeLessThan(1);
  }
  // Rebuilt twenty times and freed, the graphics card keeps as many geometries; not freed, 20 × 10 more.
  await expect.poll(() => number(f, 'renderer.info geometries')).toBeGreaterThan(0);
  const before = await number(f, 'renderer.info geometries');
  await click(f, 'rebuild ×20');
  await expect.poll(() => number(f, 'renderer.info geometries')).toBe(before);
  await toggle(f, 'skip dispose');
  await click(f, 'rebuild ×20');
  await expect.poll(() => number(f, 'renderer.info geometries')).toBe(before + 200);
});

test('the new tutorial, moving with vectors: normalized, 3 m/s straight and diagonally; without, the diagonal is √2 faster', async ({
  page,
}) => {
  const f = await open(page, 'tutorial/parte-1/18-moverse/');
  await expect.poll(() => number(f, 'straight speed'), { timeout: 20_000 }).toBeCloseTo(3, 2);
  await expect.poll(() => number(f, 'diagonal speed'), { timeout: 20_000 }).toBeCloseTo(3, 2);
  await toggle(f, 'normalize');
  await expect.poll(() => number(f, 'diagonal speed'), { timeout: 20_000 }).toBeCloseTo(4.24, 2);
});

test('the lab kit, in the vectors figure: a tip is dragged across the floor to a half meter, and the camera stays', async ({
  page,
}) => {
  const f = await open(page, 'tutorial/parte-1/04-vectores/');
  await expect.poll(() => value(f, 'vector a')).toMatch(/^-?\d/);
  await toggle(f, 'autopilot');
  // Where a point of the floor is seen, on the page: the figure's frame projects it with its camera
  // (the kit leaves the figure in the frame as `lab`), and the frame's place on the page is added.
  const frame = (await page.locator('.live-code .lc-result iframe').first().elementHandle())!;
  const inside = (await frame.contentFrame())!;
  const box = (await frame.boundingBox())!;
  const seen = async (x: number, z: number) => {
    const p = await inside.evaluate(
      ([x, z]) => {
        const { camera, renderer } = (globalThis as unknown as { lab: { camera: THREE.Camera; renderer: THREE.WebGLRenderer } })
          .lab;
        const q = camera.position.clone().set(x!, 0, z!).project(camera);
        const r = renderer.domElement.getBoundingClientRect();
        return { x: r.left + ((q.x + 1) / 2) * r.width, y: r.top + ((1 - q.y) / 2) * r.height };
      },
      [x, z],
    );
    return { x: box.x + p.x, y: box.y + p.y };
  };
  const camera = () =>
    inside.evaluate(() => (globalThis as unknown as { lab: { camera: THREE.Camera } }).lab.camera.position.toArray().join());
  const [ax, , az] = (await value(f, 'vector a')).split(',').map(Number);
  const before = await camera();
  const from = await seen(ax!, az!);
  const to = await seen(1.1, 1.4); // rounded to half meters: (1, 0, 1.5)
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => value(f, 'vector a')).toBe('1.00, 0.00, 1.50');
  expect(await value(f, 'unit â')).toBe('0.555, 0.000, 0.832');
  // b dropped on a's tip: their difference is the zero vector.
  const [bx, , bz] = (await value(f, 'vector b')).split(',').map(Number);
  const fromB = await seen(bx!, bz!);
  const onA = await seen(1, 1.5);
  await page.mouse.move(fromB.x, fromB.y);
  await page.mouse.down();
  await page.mouse.move(onA.x, onA.y, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => value(f, 'difference a − b')).toBe('0.00, 0.00, 0.00');
  await page.mouse.move(onA.x, onA.y);
  // Let go, the pointer moves on and the tip stays; the camera never turned.
  await page.mouse.move(box.x + 20, box.y + 20, { steps: 5 });
  expect(await value(f, 'vector a')).toBe('1.00, 0.00, 1.50');
  expect(await camera()).toBe(before);
  // a's tip on the origin: the zero vector has no direction, and its "unit" vector is zero.
  const origin = await seen(0, 0);
  await page.mouse.move(onA.x, onA.y);
  await page.mouse.down();
  await page.mouse.move(origin.x, origin.y, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => value(f, 'vector a')).toBe('0.00, 0.00, 0.00');
  expect(await value(f, 'length |â|')).toBe('0.000');
  // The panel covers the right: the picture's centre is moved left, and back when the panel closes.
  const shift = () =>
    inside.evaluate(() => (globalThis as unknown as { lab: { camera: THREE.PerspectiveCamera } }).lab.camera.view?.offsetX ?? 0);
  expect(await shift()).toBeGreaterThan(0);
  await f.locator('.lil-gui .title').first().click();
  await expect.poll(shift).toBe(0);
  await f.locator('.lil-gui .title').first().click();
  await expect.poll(shift).toBeGreaterThan(0);
});

test('the notation: a positive turn takes each axis to the next one, and three.js turns the same way', async ({ page }) => {
  const f = await open(page, 'tutorial/notacion/');
  await set(f, 'angle (deg)', '90');
  const expected = { X: '0.000, 0.000, 1.000', Y: '1.000, 0.000, 0.000', Z: '0.000, 1.000, 0.000' };
  for (const [axis, turned] of Object.entries(expected)) {
    await set(f, 'about', axis);
    await expect.poll(() => value(f, 'turned (ours)')).toBe(turned);
    expect(await value(f, 'turned (three.js)')).toBe(turned);
  }
  await set(f, 'angle (deg)', '-30');
  await expect.poll(() => value(f, 'turned (ours)')).toBe('0.866, -0.500, 0.000');
  expect(await value(f, 'turned (three.js)')).toBe('0.866, -0.500, 0.000');
});

test('TypeScript for JavaScript programmers: the example writes each section, and an unchecked type error is a NaN', async ({
  page,
}) => {
  await page.goto('tutorial/typescript/');
  const example = page.locator('.live-code').first();
  await example.locator('.lc-result').scrollIntoViewIfNeeded();
  const lines = example.locator('.lc-console .lc-line');
  await expect(lines).toHaveCount(9);
  const text = await lines.allInnerTexts();
  expect(text[0]).toContain('length(vec(3, 4, 0)) = 5');
  expect(text[1]).toContain('length(vec(3, 4)) = NaN');
  expect(text[2]).toContain('a Point where a Vec goes: 3');
  expect(text[5]).toContain('behind the camera, the depth or 0: 0');
  expect(text[6]).toContain('the third target: there is none');
  expect(await example.getAttribute('data-errors')).toBe('0');
});

test('coordinates: our distance is three.js’s, the worked example gives 5 and 5.2202, and the mirror keeps the numbers', async ({
  page,
}) => {
  const f = await open(page, 'tutorial/parte-1/01-coordenadas/');
  await click(f, 'worked example');
  await expect.poll(() => value(f, 'floor distance (m)')).toBe('5');
  expect(await value(f, 'our distance (m)')).toBe('5.2202');
  expect(await value(f, 'three.js distanceTo (m)')).toBe('5.2202');
  expect(await value(f, 'Δ = Q − P')).toBe('(-4.00, -1.50, -3.00)');
  // Left-handed, the same numbers: another picture, the same point.
  await toggle(f, 'left-handed');
  expect(await value(f, 'our distance (m)')).toBe('5.2202');
  // At the same height, the floor distance is the distance.
  await set(f, 'height of P (m)', '0.5');
  await expect.poll(() => value(f, 'our distance (m)')).toBe('5');
  expect(await value(f, 'three.js distanceTo (m)')).toBe('5');
});

test('the projection: at the worked example our pixel is three.js’s, and twice as deep is half as far from the centre', async ({
  page,
}) => {
  const f = await open(page, 'tutorial/parte-1/02-la-proyeccion/');
  // P where the page's example puts it (moving a slider stops the autopilot).
  await set(f, 'point x (m)', '1');
  await set(f, 'point y (m)', '1.5');
  await set(f, 'point z (m)', '-3');
  await expect.poll(() => value(f, 'depth d (m)')).toBe('5');
  expect(await value(f, 'on the plane')).toBe('0.2000, 0.1000');
  expect(await value(f, 'normalized u, v')).toBe('0.2161, 0.1921');
  expect(await value(f, 'our pixel')).toBe('486.4, 181.8');
  expect(await value(f, 'three.js pixel')).toBe('486.4, 181.8');
  expect(await value(f, 'vanishing point')).toBe('0.3640, 0.0000');
  expect(await value(f, 'horizontal fov (°)')).toBe('85.6');
  // Five meters farther: the depth doubles, and its place on the plane halves.
  await set(f, 'point z (m)', '-8');
  await expect.poll(() => value(f, 'depth d (m)')).toBe('10');
  expect(await value(f, 'on the plane')).toBe('0.1000, 0.0500');
});

test('vectors: the worked example’s numbers, ours and three.js’s', async ({ page }) => {
  const f = await open(page, 'tutorial/parte-1/04-vectores/');
  await click(f, 'worked example');
  await expect.poll(() => value(f, 'vector a')).toBe('3.00, 0.00, -1.00');
  expect(await value(f, 'vector b')).toBe('1.00, 0.00, -2.00');
  expect(await value(f, 'sum a + b')).toBe('4.00, 0.00, -3.00');
  expect(await value(f, 'difference a − b')).toBe('2.00, 0.00, 1.00');
  expect(await value(f, 'length |a|')).toBe('3.162');
  expect(await value(f, 'length |b|')).toBe('2.236');
  expect(await value(f, 'length |a + b|')).toBe('5.000');
  expect(await value(f, '|a| + |b|')).toBe('5.398');
  expect(await value(f, 'length |k a|')).toBe('1.581');
  expect(await value(f, 'unit â')).toBe('0.949, 0.000, -0.316');
  expect(await value(f, 'three.js a + b')).toBe('4.00, 0.00, -3.00');
  expect(await value(f, 'three.js â')).toBe('0.949, 0.000, -0.316');
});

test('the dot product: the worked example’s numbers; the projection ignores b’s length and sense; the naive cone lets a far target in', async ({
  page,
}) => {
  const f = await open(page, 'tutorial/parte-1/05-el-producto-escalar/');
  await click(f, 'worked example');
  await expect.poll(() => value(f, 'a · b')).toBe('5.00');
  expect(await value(f, '|a| |b| cos θ')).toBe('5.00');
  expect(await value(f, 'angle θ (°)')).toBe('45.00');
  expect(await value(f, 'projection a‖b')).toBe('1.00, 0.00, -2.00');
  expect(await value(f, 'rejection a⊥b')).toBe('2.00, 0.00, 1.00');
  expect(await value(f, '|a⊥b|')).toBe('2.236');
  expect(await value(f, '|a| sin θ')).toBe('2.236');
  // b flipped and doubled: the same line, the same projection.
  await toggle(f, 'flip b');
  await toggle(f, 'b × 2');
  await expect.poll(() => value(f, 'vector b')).toBe('-2.00, 0.00, 4.00');
  expect(await value(f, 'projection a‖b')).toBe('1.00, 0.00, -2.00');
  await toggle(f, 'flip b');
  await toggle(f, 'b × 2');
  // Looking along b at a: 45° off, outside a cone of 30°, inside one of 50°; naive (unnormalized), inside at 30°.
  await set(f, 'mode', 'look');
  await expect.poll(() => value(f, 'in front')).toBe('yes');
  expect(await value(f, 'inside the cone')).toBe('no');
  await set(f, 'cone half-angle α (°)', '50');
  await expect.poll(() => value(f, 'inside the cone')).toBe('yes');
  await set(f, 'cone half-angle α (°)', '30');
  await expect.poll(() => value(f, 'inside the cone')).toBe('no');
  await toggle(f, 'normalize');
  await expect.poll(() => value(f, 'inside the cone')).toBe('yes');
});

test('the cross product: the worked example on the floor (left), the naive order (right), and in space 7 long, perpendicular, a right-handed box', async ({
  page,
}) => {
  const f = await open(page, 'tutorial/parte-1/06-el-producto-vectorial/');
  await click(f, 'worked example');
  await expect.poll(() => value(f, 'a × b')).toBe('0.00, 5.00, 0.00');
  expect(await value(f, '|a × b|')).toBe('5.000');
  expect(await value(f, '|a| |b| sin θ')).toBe('5.000');
  expect(await value(f, 'area of triangle')).toBe('2.500');
  expect(await value(f, 'side (seen from above)')).toBe('left');
  await toggle(f, 'x then z');
  await expect.poll(() => value(f, 'side (seen from above)')).toBe('right');
  await toggle(f, 'x then z');
  await click(f, 'space example');
  await expect.poll(() => value(f, 'a × b')).toBe('3.00, -6.00, 2.00');
  expect(await value(f, '|a × b|')).toBe('7.000');
  expect(await value(f, '(a × b) · a')).toBe('0.000');
  expect(await value(f, '[a, b, c]')).toBe('10.000');
  expect(await value(f, 'right-handed')).toBe('yes');
  // c over the plane of a and b, on the other side: the box's volume changes sign.
  await set(f, 'c height (m)', '2');
  await expect.poll(() => value(f, '[a, b, c]')).toBe('-8.000');
  expect(await value(f, 'right-handed')).toBe('no');
});

test('the turret looks: in front, behind, which side, in its cone; an eighth to the right, target 1 comes in; unnormalized, the cone widens', async ({
  page,
}) => {
  const f = await open(page, 'tutorial/parte-1/07-mirar/');
  await expect.poll(() => value(f, 'target 1')).toBe('in front, right, outside');
  expect(await value(f, 'target 2')).toBe('behind, left, outside');
  expect(await value(f, 'target 3')).toBe('in front, left, inside');
  expect(await value(f, 'heading')).toBe('N');
  await click(f, 'turn right (E)');
  await expect.poll(() => value(f, 'heading')).toBe('NE');
  // (North-east is 45° to the right; target 1, at 33.7°, is now 11.3° to the left of it.)
  expect(await value(f, 'target 1')).toBe('in front, left, inside');
  // North-west: target 3 is 31.0° off (to the right: it is 14° left of north, north-west 45°), outside a
  // cone of 30°; with the forward √2 long, inside.
  await click(f, 'turn left (Q)');
  await click(f, 'turn left (Q)');
  await expect.poll(() => value(f, 'heading')).toBe('NW');
  expect(await value(f, 'target 3')).toBe('in front, right, outside');
  await toggle(f, 'normalize forward');
  await expect.poll(() => value(f, 'target 3')).toBe('in front, right, inside');
  // Tab faces the next target: the first, along north-east.
  await toggle(f, 'normalize forward');
  await click(f, 'next target (Tab)');
  await expect.poll(() => value(f, 'heading')).toBe('NE');
});
