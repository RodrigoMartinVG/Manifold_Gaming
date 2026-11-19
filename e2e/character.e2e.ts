import { expect, test } from '@playwright/test';
import { afterSteps, position, settled, errors, typeInConsole } from './helpers';

/**
 * THE CHARACTER (stage 1b) AND ITS MODEL (stage 2e): the keys that drive it, and the mannequin that shows how it moves.
 */

// ---------------------------------------------------------------- the character (stage 1b)

test('in the course, the keys drive the character: it walks where the camera looks, jumps, and the camera follows', async ({
  page,
}) => {
  const list = errors(page);
  await page.goto('jugar/dojo/course/');
  // It falls onto the floor and stands still (its position stops changing).
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await settled(page, 'player');
  const [, y0, z0] = await position(page, 'player');
  const camera0 = await position(page, 'camera');
  // W held: the camera is behind it, looking at the course (−Z), so it walks towards −Z. (Held until it
  // advances 2 m, not for a fixed time: without a GPU, as in these tests, there are few frames per
  // second, and the fixed step runs at most 5 steps per frame, so the world goes slower than the clock.)
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await position(page, 'player'))[2], { timeout: 20_000 }).toBeLessThan(z0! - 2);
  await page.keyboard.up('KeyW');
  // The camera came along: as far as the character, less what drawing between two steps lags (the
  // camera follows the body as drawn, at most one step behind: 7.5 cm walking). Both read from the
  // same frame. (It asked for 2 m from both: the character just past them, the camera a step short.)
  const [player, camera] = await page
    .locator('#game')
    .evaluate((el) => [el.dataset.player!, el.dataset.camera!].map((v) => v.split(' ').map(Number)));
  expect(camera0[2]! - camera![2]!).toBeGreaterThan(z0! - player![2]! - 0.1);
  // Space, pressed and released at once (maybe between two frames): it jumps all the same.
  await page.keyboard.press('Space');
  // (With time: without a GPU and after many tests, a frame can take long.)
  await expect.poll(async () => (await position(page, 'player'))[1], { timeout: 15_000 }).toBeGreaterThan(y0! + 1);
  expect(list).toEqual([]);
});

// ---------------------------------------------------------------- models and animations (stage 2e)

test("in the course, the character is the games' mannequin: its animation follows how it moves, and a jump does not bounce the camera", async ({
  page,
}) => {
  const list = errors(page);
  await page.goto('jugar/dojo/course/');
  // The model loaded (through the site's own build, as a visitor gets it), and it stands quiet.
  await expect.poll(() => page.locator('#game').getAttribute('data-clip'), { timeout: 15_000 }).toBe('idle');
  await settled(page, 'player');
  // Everything the page writes from now on, frame by frame: a jump fits between two readings.
  type Seen = { clip: string; player: number; camera: number };
  await page.locator('#game').evaluate((el) => {
    const seen: Seen[] = [];
    (window as unknown as { seen: Seen[] }).seen = seen;
    const height = (v: string | undefined) => Number(v?.split(' ')[1]);
    new MutationObserver(() =>
      seen.push({ clip: el.dataset.clip!, player: height(el.dataset.player), camera: height(el.dataset.camera) }),
    ).observe(el, { attributes: true, attributeFilter: ['data-clip', 'data-player', 'data-camera'] });
  });
  const seen = () => page.evaluate(() => (window as unknown as { seen: Seen[] }).seen);
  const last = async () => (await seen()).at(-1)?.clip;
  // Walking, it walks (or runs); stopping, it is quiet again.
  await page.keyboard.down('KeyW');
  await expect
    .poll(async () => (await seen()).some((s) => s.clip === 'walk' || s.clip === 'run'), { timeout: 20_000 })
    .toBe(true);
  await page.keyboard.up('KeyW');
  await expect.poll(last, { timeout: 20_000 }).toBe('idle');
  // A jump from standing: in the air, its own animations (rising, falling). The character rises 2 m; the camera does
  // not go with it (the vertical dead zone: before it, the whole world bounced on the screen).
  await settled(page, 'player');
  const from = (await seen()).length;
  await page.keyboard.press('Space');
  await expect
    .poll(async () => (await seen()).slice(from).some((s) => s.clip === 'rise' || s.clip === 'fall'), { timeout: 15_000 })
    .toBe(true);
  await expect.poll(last, { timeout: 20_000 }).toBe('idle');
  const jump = (await seen()).slice(from);
  const rise = (key: 'player' | 'camera') => Math.max(...jump.map((s) => s[key])) - Math.min(...jump.map((s) => s[key]));
  expect(rise('player')).toBeGreaterThan(1.5);
  expect(rise('camera'), 'the camera, during the jump').toBeLessThan(0.1);
  expect(list).toEqual([]);
});

test('the mannequin moves where it really goes: backwards, to a side, and against a wall it does not walk in place (stage 2e2)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  // Tank controls: S goes back from where it looks, E to its right, and neither turns it.
  await page.goto('jugar/dojo/course/#recipe=controls.scheme+tank;view.camera+chase');
  const clip = () => page.locator('#game').getAttribute('data-clip');
  await expect.poll(clip, { timeout: 15_000 }).toBe('idle');
  await settled(page, 'player');
  for (const [key, cycle] of [
    ['KeyS', 'walk_back'],
    ['KeyE', 'walk_right'],
    ['KeyQ', 'walk_left'],
  ] as const) {
    await page.keyboard.down(key);
    await expect.poll(clip, { timeout: 20_000, message: key }).toBe(cycle);
    await page.keyboard.up(key);
    await expect.poll(clip, { timeout: 20_000 }).toBe('idle');
  }
  // In front of the tower (climbing is off), still looking at it (−Z): W walks into it, and pushing on
  // against it, it stands. In 2e it walked in place: the view read the velocity it asked for.
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.goto 8 1 5');
  await page.keyboard.press('Escape');
  await settled(page, 'player');
  // Every animation it plays from now on, in order: it walks only 1.5 m before the tower (a third of a
  // second), which a poll can miss on a loaded machine (it did, once).
  await page.locator('#game').evaluate((el) => {
    const seen: string[] = [];
    (window as unknown as { clipsSeen: string[] }).clipsSeen = seen;
    new MutationObserver(() => {
      if (seen.at(-1) !== el.dataset.clip) seen.push(el.dataset.clip!);
    }).observe(el, { attributes: true, attributeFilter: ['data-clip'] });
  });
  const seen = () => page.evaluate(() => (window as unknown as { clipsSeen: string[] }).clipsSeen);
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await seen()).includes('walk'), { timeout: 20_000 }).toBe(true);
  await expect.poll(async () => (await position(page, 'player'))[2], { timeout: 30_000 }).toBeLessThan(3.8);
  await expect.poll(clip, { timeout: 20_000 }).toBe('idle');
  await afterSteps(page, 60);
  expect(await clip(), 'pushing on against the tower').toBe('idle');
  expect((await seen()).at(-1), (await seen()).join(' → ')).toBe('idle');
  await page.keyboard.up('KeyW');
  expect(list).toEqual([]);
});

test('a jump in the air is a somersault, and coming down from high up, the landing weighs (stage 2e2)', async ({ page }) => {
  const list = errors(page);
  await page.goto('jugar/dojo/course/#recipe=dojo.doublejump+on');
  await expect.poll(() => page.locator('#game').getAttribute('data-clip'), { timeout: 15_000 }).toBe('idle');
  await settled(page, 'player');
  // Every animation the page says it plays, in order; and every gesture it starts (stage 3b: a landing
  // lasts 0.3 s and comes in from nothing, and at a few frames per second it never weighed most in a
  // frame: the test failed one time in three).
  await page.locator('#game').evaluate((el) => {
    const seen: string[] = [];
    const gestures: string[] = [];
    (window as unknown as { seen: string[]; gestures: string[] }).seen = seen;
    (window as unknown as { seen: string[]; gestures: string[] }).gestures = gestures;
    // At the jump's top (rising no more: falling), the second jump, pressed from here the moment the page
    // says so: pressed by the test after it polled that, under load (polls back off to a second) it came
    // after the landing, a jump from the ground, and no somersault (two runs in six, stage 4b).
    const space = (type: 'keydown' | 'keyup') => document.dispatchEvent(new KeyboardEvent(type, { code: 'Space', key: ' ' }));
    new MutationObserver(() => {
      if (seen.at(-1) !== el.dataset.clip) {
        seen.push(el.dataset.clip!);
        if (el.dataset.clip === 'fall' && seen.filter((c) => c === 'fall').length === 1) {
          space('keydown');
          setTimeout(() => space('keyup'), 50);
        }
      }
      const gesture = el.dataset.gesture?.split(' ')[1];
      if (gesture && el.dataset.gesture !== gestures.at(-1)) gestures.push(el.dataset.gesture!);
    }).observe(el, { attributes: true, attributeFilter: ['data-clip', 'data-gesture'] });
  });
  const gestures = () => page.evaluate(() => (window as unknown as { gestures: string[] }).gestures.map((g) => g.split(' ')[1]));
  const seen = () => page.evaluate(() => (window as unknown as { seen: string[] }).seen);
  // A jump; at its top, the second one, in the air (above).
  await page.keyboard.press('Space');
  await expect.poll(async () => (await gestures()).includes('flip'), { timeout: 15_000 }).toBe(true);
  // Down from 4.7 m (about 9 m/s): the landing, over everything else; then quiet.
  await expect.poll(async () => (await gestures()).includes('land'), { timeout: 20_000 }).toBe(true);
  await expect.poll(async () => (await seen()).at(-1), { timeout: 20_000 }).toBe('idle');
  expect(await gestures()).toEqual(['flip', 'land']);
  expect(list).toEqual([]);
});

test('a link can leave the camera free: the character walks, and the camera stays', async ({ page }) => {
  const list = errors(page);
  // (A recipe runs before the world exists: view.camera must not need anything that comes later.)
  await page.goto('jugar/dojo/course/#recipe=view.camera+free');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 90);
  const [, , z0] = await position(page, 'player');
  const camera0 = await position(page, 'camera');
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await position(page, 'player'))[2], { timeout: 20_000 }).toBeLessThan(z0! - 1.5);
  await page.keyboard.up('KeyW');
  expect(await position(page, 'camera')).toEqual(camera0);
  expect(list).toEqual([]);
});
