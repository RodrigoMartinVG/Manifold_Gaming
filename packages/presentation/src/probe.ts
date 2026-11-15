import * as THREE from 'three';
import type { PageMatch } from './match';
import type { GamePage, Piece } from './page';

/**
 * WHAT THE BROWSER TESTS READ (Playwright): the page's state, in `data-` attributes of the element
 * the game is mounted in. Where the character is, ON EVERY FRAME (stage 2c): every 10 frames was too
 * coarse without a GPU, where a frame can take 5 steps, and a whole jump (about 36 steps above a
 * meter) could happen between two readings. The match too (a test that waits for "joined" should not
 * wait ten frames). The rest, every 10 frames: how many frames were drawn, how many meshes are really
 * in the scene (not in a map: a bug of step 0 did not show there), and the other players.
 * (Other pieces write what they own when it happens: `notice`, `replay`, `ghost`, `contacts`, `desyncs`.)
 */
export function mountProbe(page: GamePage, match: PageMatch): Piece {
  const data = page.container.dataset;
  const fixed = (v: readonly number[]) => v.map((n) => n.toFixed(2)).join(' ');
  let frames = 0;
  return {
    afterRender({ world, hero }) {
      data.step = String(world.tick);
      if (hero?.transform) data.player = fixed(hero.transform.position);
      if (hero?.character) data.facing = fixed(hero.character.facing);
      data.camera = fixed(page.stage.camera.position.toArray());
      data.net = match.net;
      data.me = String(match.me);
      if (++frames % 10 !== 0) return;
      data.frames = String(frames);
      data.meshes = String(page.stage.scene.children.filter((x) => x instanceof THREE.Mesh).length);
      data.checks = String(match.checks);
      data.others = [...world.entities.values()]
        .filter((e) => e.character && e.character.player !== match.me && e.transform)
        .map((e) => `${e.character!.player}:${fixed(e.transform!.position)}`)
        .join('|');
    },
  };
}
