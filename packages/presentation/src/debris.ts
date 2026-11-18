import * as THREE from 'three';
import { quat, Random, vec3, type Vec3 } from '@manifold/common';
import { gravityAt, RapierPhysics, STEP, type Body, type Transform, type World } from '@manifold/core';
import { own, release } from './owned';
import type { GamePage, Piece } from './page';

/** How many fragments a break makes, how long they last (s), and the last part of it, when they shrink away. */
const FRAGMENTS = 14;
/** (Stage 5k) How many chunks of rubble a blast throws, of what color (soot over stone). */
const RUBBLE = { count: 9, color: 0x3a342e };
const LIFE = 2.5;
const FADE = 0.6;

interface Fragment {
  body: Body;
  transform: Transform;
  mesh: THREE.Mesh;
  age: number;
  size: number;
}

/**
 * FRAGMENTS (stage 3e), the outer layer of what breaks: when something breaks, a handful of small
 * pieces fly from where it was, made from the break's seed (the same ones in every copy of the match),
 * in A PHYSICS OF THEIR OWN: a world of the presentation's, with the level's fixed boxes to fall on and
 * bounce off, that no gameplay ray sees and nobody hashes. Debris that really falls, in every profile,
 * without touching the match. They last a couple of seconds, and shrink away. (Stage 5k: a blast throws
 * rubble the same way, larger and faster, from a seed made of where and when it blew, so every copy of
 * the match throws the same.) (For the browser tests: how many there are, `data-fragments`.)
 */
export function mountDebris(page: GamePage, o: { timeScale(): number }): Piece {
  const { scene } = page.stage;
  let physics: RapierPhysics | null = null;
  const fragments: Fragment[] = [];
  const shape = new THREE.BoxGeometry(1, 1, 1);
  let pending = 0;

  /** Its physics, with the world's fixed boxes in it (once per world: the level does not move them). */
  const debrisWorld = (world: World) => {
    if (physics) return physics;
    physics = new RapierPhysics(gravityAt(world.gravity, [0, 0, 0]), STEP);
    for (const e of world.entities.values())
      if (e.body?.type === 'fixed' && (e.body.shape.kind === 'box' || e.body.shape.kind === 'compound') && e.transform)
        physics.addBody(
          { type: 'fixed', shape: e.body.shape },
          { position: [...e.transform.position], rotation: [...e.transform.rotation] },
        );
    return physics;
  };
  const clear = () => {
    for (const f of fragments) {
      scene.remove(f.mesh);
      release(f.mesh);
    }
    fragments.length = 0;
    physics?.dispose();
    physics = null;
  };
  const count = () => {
    const n = String(fragments.length);
    if (page.container.dataset.fragments !== n) page.container.dataset.fragments = n;
  };

  return {
    welcome() {
      clear();
      count();
    },
    event(ev, world) {
      if (ev.type !== 'broke' && ev.type !== 'blast') return;
      const p = debrisWorld(world);
      const blast = ev.type === 'blast';
      const random = new Random(
        blast
          ? (Math.imul(world.tick, 2654435761) ^ Math.round(ev.at[0] * 97 + ev.at[1] * 389 + ev.at[2] * 1543)) >>> 0
          : ev.seed,
      );
      const color = blast ? RUBBLE.color : (world.entities.get(ev.entity)?.appearance?.color ?? 0xb8b0a0);
      for (let i = 0; i < (blast ? RUBBLE.count : FRAGMENTS); i++) {
        const size = blast ? random.between(0.05, 0.14) : random.between(0.02, 0.06);
        const out: Vec3 = vec3.normalize([random.between(-1, 1), random.between(blast ? 0.3 : -0.2, 1), random.between(-1, 1)]);
        const transform: Transform = {
          position: vec3.add(ev.at, vec3.scale(out, random.between(0, 0.08))),
          rotation: quat.identity(),
        };
        const body = p.addBody(
          {
            type: 'dynamic',
            shape: { kind: 'box', halfExtents: [size / 2, size / 2, size / 2] },
            restitution: 0.4,
            linearVelocity: vec3.scale(out, blast ? random.between(4, 10) : random.between(2, 4.5)),
            angularVelocity: [random.between(-15, 15), random.between(-15, 15), random.between(-15, 15)],
          },
          transform,
        );
        const mesh = own(new THREE.Mesh(shape, new THREE.MeshLambertMaterial({ color })), { material: true });
        mesh.scale.setScalar(size);
        mesh.position.set(...transform.position);
        scene.add(mesh);
        fragments.push({ body, transform, mesh, age: 0, size });
      }
      count();
    },
    frame({ dt }) {
      if (!physics || fragments.length === 0) return;
      // Their own time, at the world's pace (paused, they stop; at half speed, they fall at half).
      pending = Math.min(pending + dt * o.timeScale(), STEP * 5);
      while (pending >= STEP) {
        physics.step();
        pending -= STEP;
      }
      for (let i = fragments.length - 1; i >= 0; i--) {
        const f = fragments[i]!;
        physics.read(f.body.handle, f.transform, f.body);
        f.age += dt * o.timeScale();
        f.mesh.position.set(...f.transform.position);
        f.mesh.quaternion.set(...f.transform.rotation);
        f.mesh.scale.setScalar(f.size * Math.min(1, (LIFE - f.age) / FADE));
        if (f.age >= LIFE) {
          physics.removeBody(f.body.handle);
          scene.remove(f.mesh);
          release(f.mesh);
          fragments.splice(i, 1);
        }
      }
      count();
    },
    stop() {
      clear();
      shape.dispose();
    },
  };
}
