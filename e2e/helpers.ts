import { expect, type Page } from '@playwright/test';

/**
 * WHAT THE GAME IN THE PAGE SAYS, AS NUMBERS: its `data-<name>` ("1.00 2.00 3.00"), written on
 * every frame, with the step it is at (`data-step`).
 */
export async function position(page: Page, name: 'player' | 'camera' | 'ghost' | 'facing' | 'look') {
  return ((await page.locator('#game').getAttribute(`data-${name}`)) ?? '').split(' ').map(Number);
}

const step = (page: Page) => page.locator('#game').getAttribute('data-step').then(Number);

/**
 * WAITS FOR THE WORLD, NOT FOR THE CLOCK: until the game has taken `steps` more steps. A fixed wait
 * ("1.5 s, it has landed"; "W held for 600 ms") gives fewer steps on a slow machine without a GPU,
 * as in these tests (the fixed step runs at most 5 steps per frame, so the world goes slower than
 * the clock), and on a fast one it wastes time. 60 steps are a second of the world.
 */
export async function afterSteps(page: Page, steps: number, timeout = 30_000) {
  const from = await step(page);
  await expect.poll(async () => (await step(page)) - from, { timeout }).toBeGreaterThanOrEqual(steps);
}

/**
 * What the page says once it stops changing: two readings are compared only if the world took a
 * step in between (two readings in the same frame are always equal, and would say "still" too soon).
 */
export async function settled(page: Page, name: 'player' | 'camera' | 'facing', timeout = 30_000) {
  const until = Date.now() + timeout;
  let [at, a] = [await step(page), await position(page, name)];
  while (Date.now() < until) {
    await afterSteps(page, 1, timeout);
    const [now, b] = [await step(page), await position(page, name)];
    if (a.join() === b.join()) return b;
    [at, a] = [now, b];
  }
  throw new Error(`data-${name} did not settle in ${timeout} ms (last read at step ${at}: ${a.join(' ')})`);
}
