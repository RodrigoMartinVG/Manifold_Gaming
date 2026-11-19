import * as THREE from 'three';
import { createParticles, type Particles } from './particles';
import type { Stage } from './page';

/**
 * THE PAGE'S PARTICLES (stage 5.5g, the audit's V11). Before, the fire had its two systems (what adds light,
 * what covers) and the contact a third for its dust, each lit and moved on by its own piece, with the place's
 * light worked out twice. Now one pair for the page, as many as the stage's tier holds, made when the page is,
 * moved on once a frame (`update`, the page's), lit by the place's light and whatever a piece adds for the
 * frame (`glow`: the blast's flare near the smoke). A piece spawns into them and does nothing else.
 */
export interface ParticleService {
  readonly adds: Particles;
  readonly covers: Particles;
  /** Light added for this frame to what covers (a flare's), on top of the place's. */
  glow(color: THREE.Color): void;
  /** Every particle on, by `seconds` of the world's time, lit for this frame (the page calls it once a frame). */
  update(seconds: number): void;
  /** Every one gone (another world). */
  clear(): void;
  dispose(): void;
}

export function createParticleService(stage: Stage): ParticleService {
  const adds = createParticles(stage.quality.particles.adds, true);
  const covers = createParticles(stage.quality.particles.covers, false);
  stage.scene.add(covers.mesh, adds.mesh);
  const light = new THREE.Color();
  const extra = new THREE.Color();
  return {
    adds,
    covers,
    glow: (color) => void extra.add(color),
    update(seconds) {
      covers.light(light.copy(stage.placeLight()).add(extra));
      extra.setRGB(0, 0, 0);
      adds.update(seconds, stage.camera);
      covers.update(seconds, stage.camera);
    },
    clear() {
      adds.clear();
      covers.clear();
    },
    dispose() {
      adds.mesh.removeFromParent();
      covers.mesh.removeFromParent();
      adds.dispose();
      covers.dispose();
    },
  };
}
