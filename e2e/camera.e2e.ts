import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { levelFromText } from '@manifold/core';
import { afterSteps, position, settled, errors, typeInConsole } from './helpers';

/**
 * THE CAMERA (stages 1c2, 3h, 4.5d): against walls, following, chasing, steady, locked on someone.
 */

// ---------------------------------------------------------------- the camera before the levels (stage 4.5d)

/** A gamepad of the test's: its left stick (x, y) as `window.__stick`, nothing pressed. */
async function withPad(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __left: [number, number] };
    w.__left = [0, 0];
    const pad = () => ({
      id: 'test pad',
      index: 0,
      connected: true,
      mapping: 'standard',
      timestamp: performance.now(),
      axes: [w.__left[0], w.__left[1], 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    });
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad(), null, null, null] });
  });
}

const azimuth = async (page: Page) => {
  const [p, c] = [await position(page, 'player'), await position(page, 'camera')];
  return (Math.atan2(c[0]! - p[0]!, c[2]! - p[2]!) * 180) / Math.PI;
};

const turnOf = (a: number, b: number) => Math.abs(((b - a + 540) % 360) - 180);

// ---------------------------------------------------------------- the camera against walls (stage 3h)

// Holding W the whole way: in the tunnels the camera is behind the character, and at each turn a zone
// says where to look, the camera turns there, and W, which goes where the camera looks, goes with it.
// On every frame the camera has to be out of every box of the level, and a little more (the ball it
// sweeps keeps 25 cm), and see the character's head: nothing in between. Before 3h, in the tunnels, it
// was above the ceiling, which hid the character; at the turns, inside the walls.
test('the corridor: holding W walks it all, and the camera never ends inside a wall or a ceiling (stage 3h)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const level = levelFromText(readFileSync(path.join(process.cwd(), 'games/dojo/levels/corridor.level'), 'utf8'));
  expect(level.boxes.every((b) => !b.turn)).toBe(true);
  await page.goto('jugar/dojo/corridor/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 20_000 }).toBe(3);
  await settled(page, 'player');
  // The camera and the character, from the same frame (the page writes both before the observer runs).
  type Seen = { camera: number[]; player: number[] };
  await page.locator('#game').evaluate((el) => {
    const seen: Seen[] = [];
    (window as unknown as { seen: Seen[] }).seen = seen;
    const numbers = (v: string | undefined) => (v ?? '').split(' ').map(Number);
    new MutationObserver(() => seen.push({ camera: numbers(el.dataset.camera), player: numbers(el.dataset.player) })).observe(
      el,
      { attributes: true, attributeFilter: ['data-camera'] },
    );
  });
  await page.keyboard.down('KeyW');
  // Into the room at the end, past both turns.
  await expect.poll(async () => (await position(page, 'player'))[2], { timeout: 80_000 }).toBeLessThan(-16);
  await page.keyboard.up('KeyW');
  const seen = await page.evaluate(() => (window as unknown as { seen: Seen[] }).seen);
  expect(seen.length).toBeGreaterThan(30);
  type Box = (typeof level.boxes)[number];
  /** How far a point is from a box (0 inside it). */
  const away = (p: number[], b: Box) =>
    Math.hypot(...[0, 1, 2].map((k) => Math.max(0, Math.abs(p[k]! - b.center[k]!) - b.half[k]!)));
  /** Whether the segment from `a` to `b` goes through a box made `shrink` smaller on every side (slabs). */
  const through = (a: number[], z: number[], b: Box, shrink: number) => {
    let [from, to] = [0, 1];
    for (let k = 0; k < 3; k++) {
      const [lo, hi] = [b.center[k]! - b.half[k]! + shrink, b.center[k]! + b.half[k]! - shrink];
      const d = z[k]! - a[k]!;
      if (Math.abs(d) < 1e-9) {
        if (a[k]! < lo || a[k]! > hi) return false;
        continue;
      }
      const [t0, t1] = [(lo - a[k]!) / d, (hi - a[k]!) / d].sort((x, y) => x - y);
      [from, to] = [Math.max(from, t0!), Math.min(to, t1!)];
      if (from > to) return false;
    }
    return true;
  };
  const nearest = Math.min(...seen.map(({ camera }) => Math.min(...level.boxes.map((b) => away(camera, b)))));
  // (Rounded to the centimeter as the page writes it: 25 cm, less a little.)
  expect(nearest, 'how near a box the camera came').toBeGreaterThan(0.2);
  // The head, 60 cm above the character's center (as the camera looks at it). The character is where
  // the last step put it, and drawn up to a step behind (7.5 cm walking): boxes 5 cm smaller.
  const hidden = seen.filter(({ camera, player }) =>
    level.boxes.some((b) => through(camera, [player[0]!, player[1]! + 0.6, player[2]!], b, 0.05)),
  );
  expect(hidden, 'frames where something was between the camera and the head').toEqual([]);
  // And it did come in: under the ceilings (at 3 m), where without walls it would be at 3.6.
  expect(seen.some(({ camera }) => camera[1]! < 2.9 && camera[2]! < 0)).toBe(true);
  expect(list).toEqual([]);
});

test('follow: walking nearly straight at the camera (within 15°), it goes back without turning; further off, it turns', async ({
  page,
}) => {
  await withPad(page);
  const walk = async (x: number) => {
    await page.goto('jugar/dojo/course/#recipe=view.camera+follow');
    await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
    await afterSteps(page, 60);
    const from = await azimuth(page);
    // The stick back (towards the camera), a little to a side.
    await page.evaluate((x) => ((window as unknown as { __left: [number, number] }).__left = [x, 1]), x);
    await afterSteps(page, 60);
    await page.evaluate(() => ((window as unknown as { __left: [number, number] }).__left = [0, 0]));
    return turnOf(from, await azimuth(page));
  };
  // 11° off straight at it: it goes back, without turning; 31° off, it turns.
  expect(await walk(0.2)).toBeLessThan(2);
  expect(await walk(0.6)).toBeGreaterThan(3);
});

test('chase: turning on the spot, the camera stays; walking, it comes back behind where the character goes', async ({ page }) => {
  await page.goto('jugar/dojo/course/#recipe=view.camera+chase;controls.scheme+tank');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 60);
  const from = await azimuth(page);
  await page.keyboard.down('KeyA');
  await afterSteps(page, 45);
  await page.keyboard.up('KeyA');
  await afterSteps(page, 30);
  // It turned on its axis (tank: A turns it), and the camera stayed (it came back behind where it LOOKED).
  expect(turnOf(from, await azimuth(page))).toBeLessThan(5);
  await page.keyboard.down('KeyW');
  // Walking where it looks now, the camera comes behind it: looking along where it goes. (Eased by the
  // clock: on a loaded machine, it takes more of the world's steps.)
  const along = async () => {
    const [look, facing] = [await position(page, 'look'), await position(page, 'facing')];
    return (look[0]! * facing[0]! + look[2]! * facing[2]!) / Math.hypot(look[0]!, look[2]!);
  };
  await expect.poll(along, { timeout: 30_000 }).toBeGreaterThan(Math.cos((25 * Math.PI) / 180));
  await page.keyboard.up('KeyW');
});

test('over a wall: a wall right behind the character, with the sky above, and the camera rises to see over it', async ({
  page,
}) => {
  await page.goto('jugar/dojo/course/#recipe=view.camera+follow');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 60);
  const [x, , z] = await position(page, 'player');
  // A wall 3 m tall a meter behind it (the camera follows from +Z, behind it as it starts, looking −Z).
  await page.keyboard.press('Backquote');
  await typeInConsole(page, `add box ${x!.toFixed(2)} 1.5 ${(z! + 1.2).toFixed(2)}  3 1.5 0.1`);
  await page.keyboard.press('Escape');
  await afterSteps(page, 90);
  const [p, c] = [await position(page, 'player'), await position(page, 'camera')];
  // Above the wall's top (3 m), and not brought in to its back.
  expect(c[1]!).toBeGreaterThan(3);
  expect(Math.hypot(c[0]! - p[0]!, c[1]! - p[1]!, c[2]! - p[2]!)).toBeGreaterThan(2);
});

test('locked on someone: the camera behind the character, on the far side from the other, both in sight', async ({ page }) => {
  await page.goto('jugar/dojo/duel/#recipe=view.camera+follow');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 60);
  await page.keyboard.press('KeyT');
  await afterSteps(page, 120);
  const listed = await page.evaluate(() => (document.querySelector('#game') as HTMLElement).dataset.others ?? '');
  const [c, look, p] = [await position(page, 'camera'), await position(page, 'look'), await position(page, 'player')];
  // The character in sight: within the field of view's half (30° top to bottom; more across).
  const angle = (to: number[]) => {
    const d = [to[0]! - c[0]!, to[1]! + 0.6 - c[1]!, to[2]! - c[2]!];
    const cos = (d[0]! * look[0]! + d[1]! * look[1]! + d[2]! * look[2]!) / Math.hypot(...(d as [number, number, number]));
    return (Math.acos(Math.min(1, cos)) * 180) / Math.PI;
  };
  expect(angle(p)).toBeLessThan(30);
  // And the other: the guard, as the page lists the other characters (`data-others`: player:x y z, each).
  const others = listed
    .split('|')
    .map((t) => (t.split(':')[1] ?? '').trim().split(' ').map(Number))
    .filter((v) => v.length >= 3);
  expect(others.length).toBeGreaterThan(0);
  expect(Math.min(...others.map((o) => angle(o)))).toBeLessThan(30);
});

test('follow is a leash: going to a side turns the camera towards the character', async ({ page }) => {
  await page.goto('jugar/dojo/course/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 90);
  const [x0] = await position(page, 'player');
  // D: to the camera's right (+X). Before, the camera moved as much as the character and never turned.
  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await position(page, 'player'))[0], { timeout: 30_000 }).toBeGreaterThan(x0! + 3);
  await page.keyboard.up('KeyD');
  const [px, , pz] = await position(page, 'player');
  const [cx, , cz] = await position(page, 'camera');
  // Where the camera looks along the ground now has a good part of +X.
  expect((px! - cx!) / Math.hypot(px! - cx!, pz! - cz!)).toBeGreaterThan(0.3);
});

test('tank controls: A and D turn the character on its own axis, W goes where it looks, and chase puts the camera behind', async ({
  page,
}) => {
  const list = errors(page);
  await page.goto('jugar/dojo/course/#recipe=controls.scheme+tank;view.camera+chase');
  await expect.poll(async () => (await position(page, 'facing')).length, { timeout: 15_000 }).toBe(3);
  const [x0, , z0] = await settled(page, 'player');
  // D held: it turns right, from −Z towards +X, without going anywhere.
  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await position(page, 'facing'))[0], { timeout: 30_000 }).toBeGreaterThan(0.5);
  await page.keyboard.up('KeyD');
  const [fx, , fz] = await settled(page, 'facing');
  const [x1, , z1] = await position(page, 'player');
  expect(Math.hypot(x1! - x0!, z1! - z0!)).toBeLessThan(0.1);
  // W: forward, where it looks now.
  await page.keyboard.down('KeyW');
  await expect
    .poll(async () => Math.hypot((await position(page, 'player'))[0]! - x1!, (await position(page, 'player'))[2]! - z1!), {
      timeout: 30_000,
    })
    .toBeGreaterThan(2);
  await page.keyboard.up('KeyW');
  const [x2, , z2] = await settled(page, 'player');
  const along = ((x2! - x1!) * fx! + (z2! - z1!) * fz!) / Math.hypot(x2! - x1!, z2! - z1!);
  expect(along).toBeGreaterThan(0.95);
  // The chasing camera came back behind it: on the side opposite to where it looks.
  const [cx, , cz] = await settled(page, 'camera');
  expect(((cx! - x2!) * fx! + (cz! - z2!) * fz!) / Math.hypot(cx! - x2!, cz! - z2!)).toBeLessThan(-0.9);
  expect(list).toEqual([]);
});
