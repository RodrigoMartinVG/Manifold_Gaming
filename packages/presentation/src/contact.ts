import * as THREE from 'three';
import { upAt, type EntityId, type Event } from '@manifold/core';
import { dustEffect, wallDustEffect, type Effect } from './effects';
import type { GamePage, Piece } from './page';
import { createParticles } from './particles';

/**
 * CONTACT (stage 5p, decision 0031: "depth and contact", what the platformer's research asks first): where
 * a body meets what it stands on or slides down, seen. The world's events and its characters' state,
 * shown, never changing them:
 *
 *   - its feet strike the ground (the world's `land` sound): a ring of dust, more the faster it came down;
 *   - its feet leave it in a jump: a smaller one;
 *   - it comes against a wall in the air, to slide down it: a puff off the wall; sliding, a puff every
 *     tenth of a second or so where it touches.
 *
 * Its shadow (bodies.ts) and its landing's sound (audio.ts) were already the world's; the slide's sound is
 * the audio's too. One draw for all the dust, at the world's pace (paused, it holds). For the browser
 * tests: `data-dust` (the rings thrown) and `data-scrapes` (the puffs off walls).
 */
export function mountContact(page: GamePage, o: { timeScale(): number } = { timeScale: () => 1 }): Piece {
  const { scene, camera } = page.stage;
  const covers = createParticles(400, false);
  scene.add(covers.mesh);
  const throwing = (e: Effect) => {
    for (const p of e.covers) covers.spawn(p);
  };
  const placeLight = new THREE.Color();
  const lit = new THREE.Color();
  /** What each character was at the last frame: on the ground, its way of moving; and how long since its last puff off a wall. */
  const was = new Map<EntityId, { grounded: boolean; mode: string; scrape: number }>();
  let dust = 0;
  let scrapes = 0;
  const v = new THREE.Vector3();
  const up = new THREE.Vector3();

  return {
    welcome() {
      covers.clear();
      was.clear();
    },
    event(ev: Event) {
      // Its feet on the ground, coming down at `speed`: dust by how hard (none for a step off a curb).
      if (ev.type !== 'sound' || ev.sound !== 'land' || ev.speed < 2.5) return;
      const world = page.session.world;
      up.set(...upAt(world, ev.at));
      throwing(dustEffect(new THREE.Vector3(...ev.at), up, ev.speed / 10));
      page.container.dataset.dust = String(++dust);
    },
    frame({ dt, world }) {
      const pace = dt * o.timeScale();
      const seen = new Set<EntityId>();
      for (const e of world.entities.values()) {
        const c = e.character;
        if (!c || !e.transform || !e.body) continue;
        seen.add(e.id);
        const before = was.get(e.id);
        const now = { grounded: c.grounded, mode: c.mode, scrape: before?.scrape ?? 0 };
        up.set(...upAt(world, e.transform.position));
        const shape = e.body.shape;
        const radius = shape.kind === 'capsule' ? shape.radius : 0.3;
        const below = shape.kind === 'capsule' ? shape.halfHeight + shape.radius : 0.8;
        const at = v.set(...e.transform.position);
        // Off the ground in a jump (going up faster than a step down would): a little dust where it left.
        const rising = c.velocity[0] * up.x + c.velocity[1] * up.y + c.velocity[2] * up.z;
        if (before?.grounded && !c.grounded && rising > 3 && pace > 0) {
          throwing(dustEffect(at.clone().addScaledVector(up, -below), up, 0.25));
          page.container.dataset.dust = String(++dust);
        }
        // Against a wall, sliding down it: where it touches (its chest's height), a puff as it comes on,
        // and one every 0.08 s as it slides.
        const wall = c.nearWall?.wall;
        if (c.mode === 'slide' && wall && pace > 0) {
          now.scrape += pace;
          if (before?.mode !== 'slide' || now.scrape >= 0.08) {
            now.scrape = 0;
            const out = new THREE.Vector3(-wall[0], -wall[1], -wall[2]);
            throwing(wallDustEffect(at.clone().addScaledVector(out, -radius).addScaledVector(up, 0.1), out));
            page.container.dataset.scrapes = String(++scrapes);
          }
        } else now.scrape = 0;
        was.set(e.id, now);
      }
      for (const id of was.keys()) if (!seen.has(id)) was.delete(id);
      // The place's light, for the dust (as fire.ts's smoke): the sky's fill, the sun, the moon.
      placeLight.setRGB(0, 0, 0);
      for (const l of scene.children) {
        if (l instanceof THREE.HemisphereLight)
          placeLight.add(
            lit
              .copy(l.color)
              .lerp(l.groundColor, 0.5)
              .multiplyScalar(l.intensity * 0.7),
          );
        else if (l instanceof THREE.AmbientLight) placeLight.add(lit.copy(l.color).multiplyScalar(l.intensity));
        else if (l instanceof THREE.DirectionalLight) placeLight.add(lit.copy(l.color).multiplyScalar(l.intensity * 0.35));
      }
      covers.light(placeLight);
      covers.update(pace, camera);
    },
    stop() {
      scene.remove(covers.mesh);
      covers.dispose();
    },
  };
}
