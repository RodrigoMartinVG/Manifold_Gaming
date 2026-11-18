import * as THREE from 'three';
import type { PageMatch } from './match';
import type { GamePage, Piece } from './page';

/**
 * WHAT THE BROWSER TESTS READ (Playwright): the page's state, in `data-` attributes of the element
 * the game is mounted in. Where the character is, ON EVERY FRAME (stage 2c): every 10 frames was too
 * coarse without a GPU, where a frame can take 5 steps, and a whole jump (about 36 steps above a
 * meter) could happen between two readings. The match too (a test that waits for "joined" should not
 * wait ten frames), how many entities are really drawn in the scene (not in a map: a bug of step 0 did
 * not show there) and what the last frame cost the GPU (draw calls, triangles: stage 3d), these two on
 * every frame since stage 4.5's close. The rest, every 10 frames: how many frames were drawn, what
 * drawing costs the page, and the other players.
 * (Other pieces write what they own when it happens: `notice`, `replay`, `ghost`, `contacts`, `desyncs`,
 * and the bodies `clip`, the animation the player's model plays, and `gesture`, the last gesture it
 * started, numbered.)
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
      // And where it looks (stage 4.5d: a lock-on frames both, a wall it rises over).
      const look = page.stage.camera.getWorldDirection(new THREE.Vector3());
      data.look = fixed([look.x, look.y, look.z]);
      data.net = match.net;
      data.me = String(match.me);
      // What is drawn for an entity (a mesh, or a model's copy), and the ghost: not shadows or lines. On
      // every frame too (stage 4.5's close): at a full run's start a frame took over a second, and ten of
      // them were more than a test waits for something it made to be drawn.
      data.meshes = String(page.stage.scene.children.filter((x) => x.userData.entity !== undefined || x.userData.ghost).length);
      // What the last frame cost the GPU (stage 3d: the budgets for what is drawn): its draw calls and
      // its triangles, as three.js counts them; on every frame with what is drawn, so that a test that
      // waits for the one finds the other (two numbers three.js keeps anyway).
      const drawn = page.stage.drawn;
      data.draws = String(drawn.calls);
      data.triangles = String(drawn.triangles);
      if (++frames % 10 !== 0) return;
      data.frames = String(frames);
      data.checks = String(match.checks);
      // And what handing them to the GPU costs the page (stage 4.5f), in milliseconds.
      data.render = page.stage.renderMs.toFixed(2);
      data.others = [...world.entities.values()]
        .filter((e) => e.character && e.character.player !== match.me && e.transform)
        .map((e) => `${e.character!.player}:${fixed(e.transform!.position)}`)
        .join('|');
    },
  };
}
