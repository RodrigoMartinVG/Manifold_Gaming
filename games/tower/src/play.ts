import type { Vec3 } from '@manifold/common';
import { drive } from '@manifold/shell/drive';
import { TOWER_CARTRIDGE, TOWER_LEVEL_LIST, towerDone } from './cartridge';
import { runner } from './rules';

const STAND = 0.82;
/**
 * A FLOOR OF THE TOWER, PLAYED (stage 5d): its climber driven as a person would, in a few moves: walking
 * until somewhere, a jump held (let go at once, the platformer's is a short hop), up a chimney leaping
 * from wall to wall (the jump held, let go for a step on a wall and pressed again towards it), waiting
 * for what moves. What it took, by its runner; and the inputs, for its reference replay.
 */
export function floorOf(index: number) {
  // (The games' driver, stage 5.5h: drive.ts; what is the tower's alone, its chimneys and its stars, below.)
  const d = drive(TOWER_CARTRIDGE, TOWER_LEVEL_LIST[index]!.recipe, { done: (s, me) => towerDone(s.world, me) !== null });
  const { session, me, named, c, at, done, step, go, walkTo, jump } = d;
  const feet = () => at()[1]! - STAND;
  /** Up a chimney (its walls facing ±x), until its feet are at `top`; then on, `out`, onto what is there. */
  const chimney = (top: number, out: Vec3, most = 900) => {
    let way = 1;
    let held = true;
    let wait = 0;
    step({ move: [way, 0, 0], jump: true });
    for (let i = 0; i < most && feet() < top && !done(); i++) {
      let pressing: boolean = held;
      let pressed = false;
      if (c().mode === 'slide' && wait === 0) {
        if (held) held = pressing = false;
        else {
          held = pressing = pressed = true;
          way = -way;
          wait = 10;
        }
      }
      wait = Math.max(0, wait - 1);
      step({ move: [pressed ? -way : way, 0, 0], jump: pressing });
    }
    // Over the top: on, pushing (a ledge it grabs, it climbs).
    go({ move: out, jump: true }, () => c().grounded && feet() > top - 0.5, 240);
  };
  const stars = () => runner(me())!.stars;
  return { session, me, named, c, at, feet, done, step, go, walkTo, jump, chimney, stars };
}
