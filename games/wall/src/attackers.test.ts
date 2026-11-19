import { beforeAll, describe, expect, test } from 'vitest';
import { initPhysics } from '@manifold/core';
import { raised } from '@manifold/arms';
import { levelOf } from './play';

beforeAll(initPhysics);

describe('the wall’s attackers, fair (stage 5i)', () => {
  test('the wall walk: one who only watches is hit, after warnings; never more than two raised', () => {
    const f = levelOf(0);
    // (Stage 5o) In the yard's door, within the sentries' range; walking there, not fighting.
    f.walkTo(0, -5);
    const full = f.me().health!.points;
    let readies = 0;
    let most = 0;
    let firstHurt = -1;
    for (let k = 0; k < 900 && (f.me().health?.down ?? -1) < 0; k++) {
      f.step();
      const world = f.session.world;
      readies += world.stepEvents.filter((e) => e.type === 'sound' && e.sound === 'ready').length;
      most = Math.max(most, [...world.entities.values()].filter((e) => e.brain && raised(e)).length);
      if (firstHurt < 0 && f.me().health!.points < full) firstHurt = readies;
    }
    expect(f.me().health!.points).toBeLessThan(full);
    expect(firstHurt, 'warned before the first hit').toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(2);
    f.session.world.dispose();
  });
});
