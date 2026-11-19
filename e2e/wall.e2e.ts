import { expect, test } from '@playwright/test';
import { afterSteps, position, errors, typeInConsole } from './helpers';

/**
 * THE WALL (stages 5h, 5i, 5k, 5n, 5o): the shooter, as the shell plays it, and its weapons' feel.
 */

/**
 * The wall's link recipe (stage 5h; levels to advance through since 5n): every attacker standing down at once,
 * and the defender at the first level's way out (since 5o, past the round tower's red door).
 */
const allDown = 'recipe=wait+30;wall.down;wait+5;set+defender+transform.position+12+0.9+-44.5';

test('the wall: its title, in first person, a level done (its gold time, its recap) and kept, at dawn’s edge', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const list = errors(page);
  const game = page.locator('#game');
  await page.goto(`jugar/muralla/#${allDown}`);
  await expect(game).toHaveAttribute('data-dialog', 'La muralla', { timeout: 20_000 });
  await expect(game).toHaveAttribute('data-sky', '4.5');
  await page.getByRole('button', { name: 'Créditos' }).click();
  await expect(page.locator('.mg-panel')).toContainText('weapons.glb: lo hace un guion de este proyecto, art/weapons.py');
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Jugar', exact: true }).click();
  await expect(game).toHaveAttribute('data-dialog', 'La guardiana');
  await page.getByRole('button', { name: 'Seguir' }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(game).toHaveAttribute('data-level', 'walk');
  await expect(page.locator('.mg-crosshair')).toBeVisible();
  // (Stage 5n) Its HUD: the weapon in its hands and its darts (5o: in its magazine, and carried besides).
  await expect(page.locator('.mg-hud')).toContainText('saeta 12/28');
  await expect(game).toHaveAttribute('data-dialog', 'El adarve: listo', { timeout: 200_000 });
  await expect(page.locator('.mg-panel')).toContainText('Tiempo de oro: 1:22,0');
  await expect(page.locator('.mg-panel')).toContainText('Sin caer');
  // Its recap: the secret not found; the attackers it brought down (the command's are not its own).
  await expect(page.locator('.mg-panel')).toContainText('Secretos: ninguno de 1');
  await expect(page.locator('.mg-panel')).toContainText('Atacantes: 0 de 12');
  expect(JSON.parse((await game.getAttribute('data-progress'))!)).toMatchObject({ version: 1, started: true, reached: 1 });
  await page.getByRole('button', { name: 'Seguir', exact: true }).click();
  await expect(game).toHaveAttribute('data-level', 'gatehouse');
  expect(list).toEqual([]);
});

// (`@quiet`, stage 5.5d: its attackers must think at speed to raise their weapons; with three game pages drawing
// at once on the CPU none did, passing alone. It runs after the rest, alone: playwright.config.ts.)
test(
  'the wall’s attackers are fair: each raises its weapon, seen and heard, before it shoots; a hit shakes the view',
  { tag: '@quiet' },
  async ({ page }) => {
    test.setTimeout(240_000);
    const list = errors(page);
    const game = page.locator('#game');
    // In the yard's door, within the sentries' range (stage 5n: a fair gunner fires only within it, and a
    // page drawn without a GPU takes some ten steps a second: from the start they would take minutes).
    await page.goto('jugar/muralla/#recipe=wait+1;set+defender+transform.position+0+0.9+-5');
    await expect(game).toHaveAttribute('data-dialog', 'La muralla', { timeout: 20_000 });
    await page.getByRole('button', { name: 'Jugar', exact: true }).click();
    await page.getByRole('button', { name: 'Seguir' }).click();
    await page.getByRole('button', { name: 'Seguir' }).click();
    await expect(game).toHaveAttribute('data-level', 'walk');
    // (Stage 5o) A dart fired from its magazine; R, a reload (heard: its subtitle), and the magazine full again.
    await expect(page.locator('.mg-hud')).toContainText('saeta 12/28');
    await page.keyboard.press('KeyX');
    await expect(page.locator('.mg-hud')).toContainText('saeta 11/28', { timeout: 20_000 });
    await page.keyboard.press('KeyR');
    await expect(page.locator('.mg-hud')).toContainText('saeta recargando…', { timeout: 20_000 });
    await expect(page.locator('.mg-hud')).toContainText('saeta 12/27', { timeout: 60_000 });
    // There, the defender only watches: the yard's sentries see it in the door, and each raises its weapon
    // (a glint, `data-readies`; and its sound, heard and in subtitles) before the first hit.
    await expect.poll(() => game.getAttribute('data-hurt').then(Number), { timeout: 200_000 }).toBeGreaterThan(0);
    expect(Number(await game.getAttribute('data-readies')), 'warned before the first hit').toBeGreaterThan(0);
    // The hit shook the view (a trauma that decays in under a second: it was there).
    expect(await game.getAttribute('data-trauma')).not.toBeNull();
    // (Stage 5k) In first person, the camera is somewhere: three numbers (the walk's sway once made it "not a number").
    expect((await position(page, 'camera')).every(Number.isFinite)).toBe(true);
    expect(list).toEqual([]);
  },
);

test('a shot that misses near the ears is heard going by (stage 5k): strafing before a guard of the arena, its aim behind', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const game = page.locator('#game');
  await page.goto('jugar/dojo/arena/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  // On the east guard's beat, in its sight; going from side to side, its aim, which follows, trails behind.
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'view.camera first', 'dojo.goto 8 1 1');
  await page.keyboard.press('Escape');
  await expect
    .poll(
      async () => {
        for (const key of ['KeyD', 'KeyA']) {
          await page.keyboard.down(key);
          await afterSteps(page, 36);
          await page.keyboard.up(key);
        }
        return Number(await game.getAttribute('data-whizzes'));
      },
      { timeout: 60_000 },
    )
    .toBeGreaterThan(0);
  expect(list).toEqual([]);
});

test('explosions (stage 5k): the launcher’s rocket leaves a trail, and blows into a flash, fire, sparks, smoke, rubble and a flare of light', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const game = page.locator('#game');
  await page.goto('jugar/dojo/armory/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.goto 5 1 8.5');
  await page.keyboard.press('Escape');
  await expect(page.locator('.mg-hud')).toContainText('lanzador');
  // At a tenth of the speed, to see it as it happens (the effects go at the world's pace).
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'view.timescale 0.1');
  await page.keyboard.press('Escape');
  await page.keyboard.press('KeyX');
  // In flight: its trail.
  await expect.poll(() => game.getAttribute('data-particles').then(Number), { timeout: 20_000 }).toBeGreaterThan(5);
  await expect.poll(() => game.getAttribute('data-blasts'), { timeout: 60_000 }).toBe('1');
  // Its particles (a blast throws about ninety), its light, its rubble, its sound.
  expect(Number(await game.getAttribute('data-particles'))).toBeGreaterThan(60);
  expect(Number(await game.getAttribute('data-flare'))).toBeGreaterThan(0);
  await expect.poll(() => game.getAttribute('data-fragments').then(Number)).toBeGreaterThan(0);
  await expect(game).toHaveAttribute('data-sound', 'blast');
  // Paused, they hold; and at the world's own pace, they are gone in a few seconds but the scorch, if it struck the floor.
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'view.timescale 1');
  await page.keyboard.press('Escape');
  await expect.poll(() => game.getAttribute('data-particles').then(Number), { timeout: 20_000 }).toBeLessThanOrEqual(1);
  expect(list).toEqual([]);
});

test('the walk’s sway (stage 5k): in first person the eyes dip with each step and sink on landing; with view.bob off they glide', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const game = page.locator('#game');
  await page.goto('jugar/dojo/course/');
  await expect.poll(() => game.getAttribute('data-player'), { timeout: 20_000 }).toBeTruthy();
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'view.camera first');
  await page.keyboard.press('Escape');
  /**
   * How far up and down the eyes went while it walked ahead for a second and a half of the world (m). (Stage
   * 5o: read every four of the world's steps, not by the clock: its cadence is about two steps a second of
   * the world, and a page drawn without a GPU takes some ten a second of the clock.)
   */
  const swayWalking = async () => {
    const heights: number[] = [];
    await page.keyboard.down('KeyW');
    await afterSteps(page, 20);
    for (let i = 0; i < 24; i++) {
      heights.push((await position(page, 'camera'))[1]!);
      await afterSteps(page, 4);
    }
    await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyS');
    await afterSteps(page, 60);
    await page.keyboard.up('KeyS');
    return Math.max(...heights) - Math.min(...heights);
  };
  const pitchBefore = (await position(page, 'look'))[1]!;
  // (Stage 5o: the dip at a walk is 2.2 cm, rebalanced from 3.5.)
  expect(await swayWalking()).toBeGreaterThan(0.012);
  expect(Number(await game.getAttribute('data-bob'))).toBeGreaterThan(1.5);
  // Walking ahead, the mouse still, where it looks up or down stays (the sway's dips once stayed in the
  // camera, frame after frame, and the aim rose by itself: the author found it).
  expect(Math.abs((await position(page, 'look'))[1]! - pitchBefore)).toBeLessThan(0.01);
  // A jump, and the eyes sink a few centimeters as it lands.
  await page.keyboard.press('Space');
  await expect.poll(() => game.getAttribute('data-dip').then(Number), { timeout: 10_000 }).toBeGreaterThan(2);
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'view.bob false');
  await page.keyboard.press('Escape');
  // (The probe writes centimeters: gliding, the eyes move at most one of its steps, from rounding.)
  expect(await swayWalking()).toBeLessThan(0.015);
  expect((await position(page, 'camera')).every(Number.isFinite)).toBe(true);
  expect(list).toEqual([]);
});
