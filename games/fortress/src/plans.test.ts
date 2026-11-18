import { describe, expect, test } from 'vitest';
import { levelFromPlan } from '@manifold/kit';

/**
 * THE FORTRESS'S LEVELS, MADE FROM THEIR PLANS (stage 5m): each `plans/<name>.plan` makes
 * `levels/<name>.level` (levelFromPlan, @manifold/kit), line for line. A plan changed, its level is made
 * again with `npx vitest run games/fortress/src/plans.test.ts --update`; edited by hand, a level would
 * part from its plan, and this says so.
 */
const PLANS = import.meta.glob<string>('../plans/*.plan', { query: '?raw', import: 'default', eager: true });

describe('the fortress’s levels, made from their plans (stage 5m)', () => {
  test.each(Object.entries(PLANS))('%s makes its level', async (path, text) => {
    const name = path
      .split('/')
      .pop()!
      .replace(/\.plan$/, '');
    await expect(levelFromPlan(text, `plans/${name}.plan`)).toMatchFileSnapshot(`../levels/${name}.level`);
  });
});
