import { readFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { initPhysics, levelFromText, registryFor, replayOf, replayToText, Session } from '@manifold/core';
import { createDojo, DOJO_ZONES } from '@manifold/dojo/rules';
import { afterSteps, position, errors, consoleLog, typeInConsole } from './helpers';

/**
 * REPLAYS, GHOSTS AND AIMING (stage 1c; ghosts as strips of poses since 4.5c).
 */

/** A ghost's or a replay's text as a link's fragment: deflated, in base64url (replay-link.ts). */
const fragmentOf = (prefix: string, text: string) => `${prefix}${deflateRawSync(Buffer.from(text)).toString('base64url')}`;

// ---------------------------------------------------------------- replays, ghosts and aiming (stage 1c)

test('ghost: the world starts over and a ghost does what you did, next to you', async ({ page }) => {
  await page.goto('jugar/dojo/course/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 90);
  const [, , z0] = await position(page, 'player');
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await position(page, 'player'))[2], { timeout: 30_000 }).toBeLessThan(z0! - 1.5);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'ghost');
  await expect(consoleLog(page)).toContainText('a ghost of');
  await page.keyboard.press('Escape');
  // Back at the start, the player waits; the ghost walks the same way again.
  await expect.poll(async () => (await position(page, 'player'))[2], { timeout: 15_000 }).toBeGreaterThan(z0! - 0.1);
  await expect.poll(async () => (await position(page, 'ghost'))[2] ?? 99, { timeout: 30_000 }).toBeLessThan(z0! - 1.5);
  expect((await position(page, 'player'))[2]).toBeGreaterThan(z0! - 0.1);
});

test('a ghost link carries a strip of poses (stage 4.5c, decision 0025): the ghost walks it, drawn, without a second world', async ({
  page,
}) => {
  // A strip by hand: from the course's start, 30 cm towards −Z every six steps (3 m/s), for two seconds.
  const lines = ['# Manifold ghost 1', 'game dojo', 'birth dojo.level course', 'every 6', 'pose 0 82 0 0 walk', '0 0 -30 0'];
  for (let k = 0; k < 19; k++) lines.push('0 0 0 0');
  lines.push('end 120');
  const errorsSeen = errors(page);
  await page.goto(`jugar/dojo/course/#${fragmentOf('ghost=', lines.join('\n'))}`);
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  // It goes 6 m along −Z over its two seconds, and stays at its end.
  await expect.poll(async () => (await position(page, 'ghost'))[2] ?? 99, { timeout: 30_000 }).toBeLessThan(-5.9);
  expect(errorsSeen).toEqual([]);
});

test('an older ghost link, carrying a replay (before 4.5c), is still raced: played once for its strip', async ({ page }) => {
  // A replay of walking −Z for a second and a half on the course, as the page recorded them before.
  await initPhysics();
  const course = levelFromText(readFileSync(path.join(process.cwd(), 'games/dojo/levels/course.level'), 'utf8'), {
    zones: DOJO_ZONES,
  });
  const dojo = createDojo({ course });
  const registry = registryFor(dojo);
  registry.run('dojo.level course', 'recipe');
  const session = new Session(dojo, { registry });
  for (let i = 0; i < 90; i++) {
    session.setInput(1, { move: [0, 0, -1] });
    session.step();
  }
  const text = replayToText(replayOf(session));
  session.world.dispose();
  await page.goto(`jugar/dojo/course/#${fragmentOf('ghost=', text)}`);
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  // (From the course's start, z = 6, to about 0: as far as the replay went.)
  await expect.poll(async () => (await position(page, 'ghost'))[2] ?? 99, { timeout: 30_000 }).toBeLessThan(1);
});

test('aim: the character looks where the camera looks, and walks sideways without turning', async ({ page }) => {
  await page.goto('jugar/dojo/course/#recipe=view.camera+aim');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 90);
  const [x0] = await position(page, 'player');
  // D: to the right of the camera (+X); the character keeps looking ahead (−Z).
  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await position(page, 'player'))[0], { timeout: 30_000 }).toBeGreaterThan(x0! + 1);
  await page.keyboard.up('KeyD');
  // It kept looking ahead (−Z) while it walked to the side.
  expect(await page.locator('#game').getAttribute('data-facing')).toBe('0.00 0.00 -1.00');
});
