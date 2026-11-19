import { expect, test } from '@playwright/test';
import { errors } from './helpers';

/**
 * THE FORTRESS (stages 5f, 5l, 5m): the adventure, as the shell plays it.
 */

/** The fortress's link recipe (stage 5f): its intruder taken somewhere a step after the level is born. */
const intruderAt = (x: number, y: number, z: number) => `recipe=wait+1;set+intruder+transform.position+${x}+${y}+${z}`;

test('the fortress: its title, its lines, a level done unseen (its gold time) and kept, at night', async ({ page }) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const game = page.locator('#game');
  // (Stage 5m: the first level's way out, past the gate.)
  await page.goto(`jugar/fortaleza/#${intruderAt(-0.5, 0.9, -22)}`);
  await expect(game).toHaveAttribute('data-dialog', 'La fortaleza', { timeout: 20_000 });
  await expect(game).toHaveAttribute('data-sky', '22');
  await page.getByRole('button', { name: 'Créditos' }).click();
  await expect(page.locator('.mg-panel')).toContainText('kit.glb: lo hace un guion de este proyecto, art/kit.py');
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Jugar', exact: true }).click();
  await expect(game).toHaveAttribute('data-dialog', 'La guardiana');
  await page.getByRole('button', { name: 'Seguir' }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(game).toHaveAttribute('data-level', 'wall');
  await expect(game).toHaveAttribute('data-dialog', 'La muralla: listo', { timeout: 60_000 });
  await expect(page.locator('.mg-panel')).toContainText('Tiempo de oro: 0:32,0');
  // (Stage 5m) Its recap: the scrolls taken of the level's two, the guards taken down.
  await expect(page.locator('.mg-panel')).toContainText('Pergaminos: ninguno de 2');
  await expect(page.locator('.mg-panel')).toContainText('No volteaste a nadie');
  await expect(page.locator('.mg-panel')).toContainText('Nadie te vio');
  await expect(page.locator('.mg-panel')).toContainText('No te atraparon');
  expect(JSON.parse((await game.getAttribute('data-progress'))!)).toMatchObject({ version: 1, started: true, reached: 1 });
  await page.getByRole('button', { name: 'Seguir', exact: true }).click();
  await expect(game).toHaveAttribute('data-level', 'yard');
  expect(list).toEqual([]);
});

test('the fortress’s end: the flame carried out of the keep, the thread’s last lines, the credits, and the title again', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const game = page.locator('#game');
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('kept')) {
      localStorage.setItem('manifold.fortress.progress', JSON.stringify({ version: 1, started: true, reached: 3, best: {} }));
      sessionStorage.setItem('kept', '1');
    }
  });
  // The flame taken (its zone, behind the guard at its post since 5m), then before that guard, carried, lit,
  // for half a second (stage 5l: long enough to be sure, a quarter; three steps were a glimpse, let go),
  // and out of the postern.
  await page.goto(
    'jugar/fortaleza/#recipe=wait+1;set+intruder+transform.position+0.3+0.9+-36.4;wait+2;set+intruder+transform.position+0.3+0.9+-29.6;wait+30;set+intruder+transform.position+-15.5+0.9+-2',
  );
  await expect(game).toHaveAttribute('data-dialog', 'La fortaleza', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Seguir: La torre del homenaje' }).click();
  await expect(game).toHaveAttribute('data-level', 'keep');
  await expect(game).toHaveAttribute('data-dialog', 'La torre del homenaje: listo', { timeout: 60_000 });
  await expect(page.locator('.mg-panel')).toContainText('Te vieron');
  await page.getByRole('button', { name: 'Seguir', exact: true }).click();
  await expect(game).toHaveAttribute('data-dialog', 'La guardiana');
  await page.getByRole('button', { name: 'Seguir' }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(game).toHaveAttribute('data-dialog', 'Créditos');
  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(game).toHaveAttribute('data-dialog', 'La fortaleza');
  expect(JSON.parse((await game.getAttribute('data-progress'))!).reached).toBe(4);
  expect(list).toEqual([]);
});

// (`@quiet`, stage 5.5d: its guard must think at speed to fill its sign; with three game pages drawing at once
// on the CPU it did not, passing alone. It runs after the rest, alone: playwright.config.ts.)
test(
  'the fortress reads (stage 5l): in the dark the gem says hidden; under a lantern, in sight, a guard’s sign fills to “!”; its steps spread rings',
  { tag: '@quiet' },
  async ({ page }) => {
    test.setTimeout(120_000);
    const list = errors(page);
    const game = page.locator('#game');
    // Under the breach's lantern, in the yard guard's beat.
    await page.goto(`jugar/fortaleza/#${intruderAt(-2.4, 0.9, -2.2)}`);
    await expect(game).toHaveAttribute('data-dialog', 'La fortaleza', { timeout: 20_000 });
    await page.getByRole('button', { name: 'Jugar', exact: true }).click();
    await page.getByRole('button', { name: 'Seguir' }).click();
    await page.getByRole('button', { name: 'Seguir' }).click();
    await expect(game).toHaveAttribute('data-level', 'wall');
    await expect.poll(() => game.getAttribute('data-gem').then(Number), { timeout: 20_000 }).toBeGreaterThan(1);
    await expect(page.locator('.mg-gem')).toContainText('A la vista');
    await expect.poll(() => game.getAttribute('data-sign'), { timeout: 30_000 }).toBe('alerted');
    await expect(page.locator('.mg-wary:not([hidden])').first()).toContainText('!');
    // Walking: each step a ring as far as it is heard.
    await page.keyboard.down('KeyS');
    await expect.poll(() => game.getAttribute('data-rings').then(Number), { timeout: 10_000 }).toBeGreaterThan(0);
    await page.keyboard.up('KeyS');
    expect(list).toEqual([]);
  },
);

test('the fortress, in the dark: the gem says hidden, and a guard that glimpses nothing has no sign', async ({ page }) => {
  test.setTimeout(90_000);
  const list = errors(page);
  const game = page.locator('#game');
  // Outside the outer wall, east of the breach, in the dark.
  await page.goto(`jugar/fortaleza/#${intruderAt(6, 0.9, 5)}`);
  await expect(game).toHaveAttribute('data-dialog', 'La fortaleza', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Jugar', exact: true }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(game).toHaveAttribute('data-level', 'wall');
  await expect.poll(async () => Number(await game.getAttribute('data-gem')), { timeout: 20_000 }).toBeLessThan(0.6);
  await expect(page.locator('.mg-gem')).toContainText('Oculto');
  expect(await game.getAttribute('data-sign')).toBe('none');
  expect(list).toEqual([]);
});
