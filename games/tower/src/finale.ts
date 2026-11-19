import type { GamePage, Piece } from '@manifold/presentation';
import { runner } from './rules';

/**
 * THE FINALE (stage 5p, decision 0031: "a finale: the camera pulls out over the land at sunset"): once the
 * climber reaches the summit, the top floor's goal, the camera lets go of it and pulls out, up and back,
 * turning slowly round it, until the climber is small on the summit and the land lies below in the last
 * light. Only the view: the world is done. Over the camera's own place each frame, given back to it before
 * the next (as the walk's sway is: the camera never takes it for its own). For the browser tests:
 * `data-finale`, the seconds it has pulled out.
 */
export const FINALE = {
  /** The floor it plays on. */
  floor: 'floor-6',
  /** How long it takes to pull all the way out (s), and how far and how high it ends (m from the climber). */
  seconds: 7,
  distance: 26,
  height: 11,
  /** How fast it turns round the climber meanwhile (rad/s). */
  turn: 0.12,
  /** Over every other effect on the camera (stage 5.5g: the camera's effects take the highest). */
  priority: 10,
} as const;

/** Eased in and out: slow to start, slow to end. */
const ease = (t: number) => t * t * (3 - 2 * t);

export function mountFinale(page: GamePage): Piece {
  const camera = page.stage.camera;
  let pulled = -1;
  let from: { offset: [number, number, number]; azimuth: number } | null = null;
  return {
    welcome() {
      pulled = -1;
      from = null;
    },
    frame({ dt, hero }) {
      const run = hero && runner(hero);
      const done = !!run && run.finish >= 0 && page.registry.value('tower.floor') === FINALE.floor;
      if (!done || !hero?.transform) {
        if (pulled >= 0) delete page.container.dataset.finale;
        pulled = -1;
        from = null;
        return;
      }
      const [cx, cy, cz] = hero.transform.position;
      if (!from) {
        const offset: [number, number, number] = [camera.position.x - cx, camera.position.y - cy, camera.position.z - cz];
        from = { offset, azimuth: Math.atan2(offset[0], offset[2]) };
        pulled = 0;
      }
      pulled += dt;
      page.container.dataset.finale = pulled.toFixed(1);
      const k = ease(Math.min(1, pulled / FINALE.seconds));
      const flat = Math.hypot(from.offset[0], from.offset[2]);
      const distance = flat + (FINALE.distance - flat) * k;
      const height = from.offset[1] + (FINALE.height - from.offset[1]) * k;
      const azimuth = from.azimuth + FINALE.turn * pulled;
      // Through the camera's effects (stage 5.5g), which give the camera piece its own pose back at the next frame.
      page.stage.effects.look(
        [cx + distance * Math.sin(azimuth), cy + height, cz + distance * Math.cos(azimuth)],
        [cx, cy + 1.2, cz],
        FINALE.priority,
      );
    },
  };
}
