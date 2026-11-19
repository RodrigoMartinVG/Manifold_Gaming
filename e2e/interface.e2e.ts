import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { initPhysics, levelFromText, levelOfWorld, levelToText, playRecipe } from '@manifold/core';
import { createDojo } from '@manifold/dojo/rules';
import { dungeon } from '@manifold/adventure/dungeon';
import { afterSteps, position, settled, errors, consoleLog, typeInConsole } from './helpers';

/**
 * THE GAME'S INTERFACE (stage 3i), MAKING LEVELS (3j) AND SAVING THE GAME (3k).
 */

// ---------------------------------------------------------------- the game's interface (stage 3i)

test('pausing (stage 3i): Escape opens the menu and the steps stop; Enter on "Seguir" resumes; P too', async ({ page }) => {
  const list = errors(page);
  const game = page.locator('#game');
  await page.goto('jugar/dojo/circuit/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 20_000 }).toBe(3);
  await page.keyboard.press('Escape');
  await expect.poll(() => game.getAttribute('data-menu')).toBe('pause');
  await expect(page.getByRole('dialog', { name: 'Pausa' })).toBeVisible();
  // While the page keeps drawing (20 frames more), the world takes no step.
  const step = await game.getAttribute('data-step');
  const frames = Number(await game.getAttribute('data-frames'));
  await expect.poll(async () => Number(await game.getAttribute('data-frames')), { timeout: 30_000 }).toBeGreaterThan(frames + 20);
  expect(await game.getAttribute('data-step')).toBe(step);
  // The focus is on "Seguir": Enter, and the world goes on.
  await expect(page.getByRole('button', { name: 'Seguir' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => game.getAttribute('data-menu')).toBe(null);
  await afterSteps(page, 10);
  // P opens it too, and closes it.
  await page.keyboard.press('KeyP');
  await expect.poll(() => game.getAttribute('data-menu')).toBe('pause');
  await page.keyboard.press('KeyP');
  await expect.poll(() => game.getAttribute('data-menu')).toBe(null);
  expect(list).toEqual([]);
});

test('the menus work with the keyboard alone, and the settings are still there next time (stage 3i)', async ({ page }) => {
  const list = errors(page);
  const game = page.locator('#game');
  await page.goto('jugar/dojo/circuit/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 20_000 }).toBe(3);
  // Escape, down to "Ajustes", Enter.
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Ajustes' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => game.getAttribute('data-menu')).toBe('settings');
  // The volume first: four steps to the left (0.6 → 0.4). Then down to "invert", and Space ticks it.
  const volume = page.locator('input[name="view.volume"]');
  await expect(volume).toBeFocused();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
  await expect(volume).toHaveValue('0.4');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  const invert = page.locator('input[name="view.invert"]');
  await expect(invert).toBeFocused();
  await page.keyboard.press('Space');
  await expect(invert).toBeChecked();
  // Escape goes back, and Escape again resumes.
  await page.keyboard.press('Escape');
  await expect.poll(() => game.getAttribute('data-menu')).toBe('pause');
  await page.keyboard.press('Escape');
  await expect.poll(() => game.getAttribute('data-menu')).toBe(null);
  // Kept in this browser, for this game, and there after a reload.
  const kept = () => page.evaluate(() => JSON.parse(localStorage.getItem('manifold.dojo.settings') ?? 'null'));
  expect(await kept()).toEqual({ 'view.volume': 0.4, 'view.invert': true });
  await page.reload();
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 20_000 }).toBe(3);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await expect(volume).toHaveValue('0.4');
  await expect(invert).toBeChecked();
  // Back at its default, it is forgotten.
  await invert.press('Space');
  expect(await kept()).toEqual({ 'view.volume': 0.4 });
  expect(list).toEqual([]);
});

test("the HUD (stage 3i): the course's time, falls and stars, in Spanish; at the goal, a box that starts it over", async ({
  page,
}) => {
  const list = errors(page);
  const game = page.locator('#game');
  const hud = () => game.getAttribute('data-hud');
  await page.goto('jugar/dojo/course/');
  await expect.poll(hud, { timeout: 20_000 }).toMatch(/^Tiempo \d:\d\d,\d \| Caídas 0 \| Estrellas 0 de 3$/);
  // A fall into the void: one more.
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.goto 20 -6 20');
  await page.locator('.mg-console input').press('Escape');
  await expect.poll(hud).toContain('Caídas 1');
  // The goal: the time stops, and a box says how it went; its first button, "Otra vez", starts over.
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.goto -3 4.4 -7');
  await page.locator('.mg-console input').press('Escape');
  await expect.poll(() => game.getAttribute('data-dialog')).toBe('¡Llegaste!');
  const box = page.getByRole('dialog', { name: '¡Llegaste!' });
  await expect(box).toContainText('caídas 1 · estrellas 0 de 3');
  await expect(page.getByRole('button', { name: 'Otra vez' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => game.getAttribute('data-dialog')).toBe(null);
  await expect.poll(hud).toContain('Caídas 0');
  expect(list).toEqual([]);
});

test('subtitles for sounds (stage 3i): walking on stone, written with where it comes from, with or without sound', async ({
  page,
}) => {
  const list = errors(page);
  const game = page.locator('#game');
  await page.goto('jugar/dojo/surfaces/#recipe=view.subtitles+on');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 20_000 }).toBe(3);
  await settled(page, 'player');
  // (Each line stays a couple of seconds: the start is stone for 4 m, then the rink, ice.)
  await page.keyboard.down('KeyW');
  await expect(page.locator('.mg-subtitles')).toContainText('Pasos en piedra', { timeout: 20_000 });
  await page.keyboard.up('KeyW');
  // Ahead of the camera, below it: an arrow up.
  await expect(page.locator('.mg-subtitles')).toContainText(/Pasos en piedra ↑/);
  expect(await game.getAttribute('data-subtitle')).toMatch(/^Pasos en /);
  expect(list).toEqual([]);
});

// ---------------------------------------------------------------- making levels (stage 3j)

// The workshop builds itself on the yard after its first step (add, clone, set), checks itself
// (assert), and writes back what it built (level.export): the same text as Node writes, playing the same
// recipe without a screen, and level.diff says what was added.
test('the workshop (stage 3j): built from the console, it checks itself, and exports what it built, as Node does', async ({
  page,
}) => {
  const list = errors(page);
  await page.goto('jugar/dojo/workshop/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 20_000 }).toBe(3);
  await expect(consoleLog(page)).toContainText('assert crate.transform.position.y < 2: yes', { timeout: 30_000 });
  await expect(consoleLog(page)).toContainText('assert lamp.lamp.intensity = 1.5: yes');
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'level.export');
  await expect(consoleLog(page)).toContainText('name bench');
  // (The last thing in the console: the level, from its first line.)
  const log = await consoleLog(page).innerText();
  const text = log.slice(log.lastIndexOf('# Manifold level')).trim();
  // Node plays the same recipe and writes the same level.
  await initPhysics();
  const dojo = createDojo(
    Object.fromEntries(
      readdirSync(path.join(process.cwd(), 'games/dojo/levels'))
        .filter((f) => f.endsWith('.level'))
        .map((f) => [
          f.replace(/\.level$/, ''),
          levelFromText(readFileSync(path.join(process.cwd(), 'games/dojo/levels', f), 'utf8')),
        ]),
    ),
  );
  const { session } = playRecipe(dojo, readFileSync(path.join(process.cwd(), 'games/dojo/recipes/workshop.txt'), 'utf8'));
  expect(text).toBe(levelToText(levelOfWorld(session.world)).trim());
  session.world.dispose();
  // What changed since it was born: the four lines it added, and the clone.
  await typeInConsole(page, 'level.diff');
  await expect(consoleLog(page)).toContainText('+ box 0 0.75 -6  2 0.75 0.3  material wood  color #8a6a42');
  await expect(consoleLog(page)).toContainText('+ lamp 3 3 -4.5  8 1.5  name lamp');
  expect(list).toEqual([]);
});

// ---------------------------------------------------------------- saving the game (stage 3k)

// The adventure's start: a gem taken (the console puts the character on it), the game saved from the
// menu; the page opened again (a new world: nothing taken), the game loaded: the gem in the inventory,
// the character where it was, and the gem not in the dungeon.
test('the adventure (stage 3k): a gem taken, the game saved; the page again, the game loaded: as it was', async ({ page }) => {
  const list = errors(page);
  const game = page.locator('#game');
  const hud = () => game.getAttribute('data-hud');
  await page.goto('jugar/aventura/');
  await expect.poll(hud, { timeout: 20_000 }).toBe('Profundidad 1 | Gemas 0 | Llave no');
  // The first gem of the dungeon of seed 1 (the default), from Node's own generator.
  const d = dungeon(1, 1);
  const row = d.rows.findIndex((r) => r.includes('*'));
  const col = d.rows[row]!.indexOf('*');
  await page.keyboard.press('Backquote');
  await typeInConsole(page, `set hero transform.position ${(col + 0.5) * 2} 1 ${(row + 0.5) * 2}`);
  await page.locator('.mg-console input').press('Escape');
  await expect.poll(hud).toBe('Profundidad 1 | Gemas 1 | Llave no');
  await settled(page, 'player');
  const where = await position(page, 'player');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Guardar la partida' }).click();
  await expect.poll(() => game.getAttribute('data-saved')).toMatch(/^Partida guardada/);
  await page.keyboard.press('Escape');
  // Again: a new world.
  await page.reload();
  await expect.poll(hud, { timeout: 20_000 }).toBe('Profundidad 1 | Gemas 0 | Llave no');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Cargar la partida' }).click();
  await expect.poll(hud, { timeout: 20_000 }).toBe('Profundidad 1 | Gemas 1 | Llave no');
  const back = await position(page, 'player');
  expect(Math.hypot(back[0]! - where[0]!, back[2]! - where[2]!)).toBeLessThan(0.1);
  expect(list).toEqual([]);
});
