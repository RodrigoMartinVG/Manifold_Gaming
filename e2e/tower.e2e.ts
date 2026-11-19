import { expect, test } from '@playwright/test';
import { afterSteps, position, settled, errors, typeInConsole, heading } from './helpers';

/**
 * THE TOWER (stages 5b, 5d, 5p): the platformer, as the shell plays it.
 */

// ---------------------------------------------------------------- the games' shell (stage 5b)

/**
 * The tower's goal on a floor, reached at once (stage 5d: its floors are played to the end by
 * games/tower/src/floors.test.ts; here, the shell around them): a link's recipe, run after each floor's,
 * puts the climber on the goal a step after the floor is born.
 */
const atGoal = (x: number, y: number, z: number) => `recipe=wait+1;set+climber+transform.position+${x}+${y}+${z}`;

test('the tower: its title and credits, its lines, a floor done (its gold time) and kept, and its ghost as a link', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const game = page.locator('#game');
  await page.goto(`jugar/torre/#${atGoal(0, 15.9, -46)}`);
  await expect(game).toHaveAttribute('data-dialog', 'La torre', { timeout: 20_000 });
  await expect(game).toHaveAttribute('data-sky', '18.6');
  // Its credits, from the asset lists of what it draws, and the engine's.
  await page.getByRole('button', { name: 'Créditos' }).click();
  await expect(page.locator('.mg-panel')).toContainText('kit.glb: lo hace un guion de este proyecto, art/kit.py');
  await expect(page.locator('.mg-panel')).toContainText('La física: Rapier (licencia Apache-2.0)');
  await page.getByRole('button', { name: 'Volver' }).click();
  // From the beginning: the thread's two lines, and the first floor, done at once by the link.
  await page.getByRole('button', { name: 'Jugar', exact: true }).click();
  await expect(game).toHaveAttribute('data-dialog', 'La guardiana');
  await page.getByRole('button', { name: 'Seguir' }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(game).toHaveAttribute('data-level', 'floor-1');
  await expect(game).toHaveAttribute('data-dialog', 'La entrada: listo', { timeout: 60_000 });
  await expect(page.locator('.mg-panel')).toContainText('Tiempo de oro: 0:20,0');
  await expect(page.locator('.mg-panel')).toContainText('¡Mejor que el tiempo de oro!');
  expect(JSON.parse((await game.getAttribute('data-progress'))!)).toMatchObject({ version: 1, started: true, reached: 1 });
  // Its ghost, as a link: shown (copied, where the browser lets).
  await page.getByRole('button', { name: 'Compartir tu fantasma' }).click();
  await expect(game).toHaveAttribute('data-dialog', 'El enlace de tu fantasma');
  await expect(game).toHaveAttribute('data-ghost-link', /\/jugar\/torre\/#ghost=/);
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(game).toHaveAttribute('data-level', 'floor-2');
  await expect(game).toHaveAttribute('data-sky', '19');
  expect(list).toEqual([]);
});

test('the tower: a ghost’s link races it on its floor, and opens no floor', async ({ page }) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const game = page.locator('#game');
  // A run of the first floor, its ghost's link made by the page.
  await page.goto(`jugar/torre/#${atGoal(0, 15.9, -46)}`);
  await expect(game).toHaveAttribute('data-dialog', 'La torre', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Jugar', exact: true }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(game).toHaveAttribute('data-dialog', 'La entrada: listo', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Compartir tu fantasma' }).click();
  // (Made deflated, a moment later.)
  await expect(game).toHaveAttribute('data-ghost-link', /#ghost=/);
  const link = (await game.getAttribute('data-ghost-link'))!;
  // Someone else (nothing kept): the title offers the race; the floor, with the ghost beside.
  await page.evaluate(() => localStorage.clear());
  await page.goto('about:blank');
  await page.goto(link);
  await expect(game).toHaveAttribute('data-dialog', 'La torre', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Correr contra un fantasma: La entrada' }).click();
  await expect(game).toHaveAttribute('data-level', 'floor-1');
  await expect.poll(() => game.getAttribute('data-ghost'), { timeout: 20_000 }).toMatch(/^-?\d/);
  expect(JSON.parse((await game.getAttribute('data-progress'))!).reached).toBe(0);
  expect(list).toEqual([]);
});

test('the camera, steady: running to a side and jumping it does not turn, as following does, so forward stays put', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  // (The course: open ground in front of where the character is born.)
  await page.goto('jugar/dojo/course/');
  await expect.poll(() => page.locator('#game').getAttribute('data-player'), { timeout: 20_000 }).toBeTruthy();
  /** How much the camera turned along the ground while the character ran to its right and jumped. */
  const turned = async (mode: string) => {
    await page.keyboard.press('Backquote');
    await typeInConsole(page, `view.camera ${mode}`, 'camera.reset');
    await page.keyboard.press('Escape');
    await settled(page, 'camera');
    const before = heading(await position(page, 'look'));
    await page.keyboard.down('KeyD');
    await afterSteps(page, 50);
    await page.keyboard.press('Space');
    await afterSteps(page, 40);
    await page.keyboard.up('KeyD');
    // Read at once: left alone, following turns back to where the course's zone suggests looking (stage
    // 3h), more the longer it waits (a reading after it settled was a matter of timing: 0.086 one run).
    return Math.abs(heading(await position(page, 'look')) - before);
  };
  // Following, a step to a side turns it round the character, and with it where forward is (the tower's
  // wall jumps, after phase 5); steady, it goes along with the character without turning.
  expect(await turned('follow')).toBeGreaterThan(0.1);
  expect(await turned('steady')).toBeLessThan(0.01);
  expect(list).toEqual([]);
});

test('the tower’s camera is steady: a run to a side and a jump on its first floor leave forward where it was', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const game = page.locator('#game');
  await page.goto('jugar/torre/');
  await expect(game).toHaveAttribute('data-dialog', 'La torre', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Jugar', exact: true }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(game).toHaveAttribute('data-level', 'floor-1');
  await settled(page, 'camera');
  const before = heading(await position(page, 'look'));
  const from = await position(page, 'player');
  await page.keyboard.down('KeyD');
  await afterSteps(page, 50);
  await page.keyboard.press('Space');
  await afterSteps(page, 40);
  await page.keyboard.up('KeyD');
  await settled(page, 'camera');
  expect(Math.abs((await position(page, 'player'))[0]! - from[0]!), 'it ran to its right').toBeGreaterThan(0.5);
  expect(Math.abs(heading(await position(page, 'look')) - before)).toBeLessThan(0.01);
  // (Stage 5p) Its feet left the ground and struck it again: dust, seen.
  expect(Number(await game.getAttribute('data-dust'))).toBeGreaterThan(0);
  expect(list).toEqual([]);
});

test('the tower’s end: the top done, the camera pulled out over the land (5p), the thread’s last lines, the credits, and the title again', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const game = page.locator('#game');
  // Five floors already done, kept in this browser (stage 5p: six floors).
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('kept')) {
      localStorage.setItem('manifold.tower.progress', JSON.stringify({ version: 1, started: true, reached: 5, best: {} }));
      sessionStorage.setItem('kept', '1');
    }
  });
  await page.goto(`jugar/torre/#${atGoal(0, 27.9, -45.5)}`);
  await expect(game).toHaveAttribute('data-dialog', 'La torre', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Seguir: La cima' }).click();
  await expect(game).toHaveAttribute('data-level', 'floor-6');
  await expect(game).toHaveAttribute('data-sky', '19.7');
  await expect(game).toHaveAttribute('data-dialog', 'La cima: listo', { timeout: 60_000 });
  // (Stage 5p) The summit reached: the camera pulls out over the land, behind the panel.
  await expect.poll(() => game.getAttribute('data-finale').then(Number), { timeout: 30_000 }).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Seguir', exact: true }).click();
  await expect(game).toHaveAttribute('data-dialog', 'La guardiana');
  await page.getByRole('button', { name: 'Seguir' }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(game).toHaveAttribute('data-dialog', 'Créditos');
  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(game).toHaveAttribute('data-dialog', 'La torre');
  expect(JSON.parse((await game.getAttribute('data-progress'))!).reached).toBe(6);
  expect(list).toEqual([]);
});
