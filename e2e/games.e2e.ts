import { expect, test } from '@playwright/test';
import { errors } from './helpers';

/**
 * THE GAMES TOGETHER (stage 5j): the atmosphere every game shares.
 */

test('the games’ atmosphere: a night with fog near, glow, crickets and an owl in the fortress; dusk birds at the tower', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const game = page.locator('#game');
  await page.goto('jugar/fortaleza/');
  await expect(game).toHaveAttribute('data-dialog', 'La fortaleza', { timeout: 20_000 });
  await expect(game).toHaveAttribute('data-atmosphere', 'on');
  await expect(game).toHaveAttribute('data-glow', 'on');
  // At 22 h: the night's fog, near (18 to 85 m), and the night's background sounds.
  await expect(game).toHaveAttribute('data-fog', '18 85');
  await expect(game).toHaveAttribute('data-ambience', '0.35 1.00 0.00 1.00');
  await page.goto('jugar/torre/');
  await expect(game).toHaveAttribute('data-dialog', 'La torre', { timeout: 20_000 });
  await expect(game).toHaveAttribute('data-atmosphere', 'on');
  await expect.poll(async () => Number((await game.getAttribute('data-ambience'))?.split(' ')[2])).toBeGreaterThan(0);
  expect(list).toEqual([]);
});
