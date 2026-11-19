import * as THREE from 'three';
import type { ParticleSpec, Stop } from './particles';

/**
 * WHAT A WEAPON'S EFFECTS ARE MADE OF (stage 5k, decision 0031: explosions far better), as recipes: the
 * particles each one throws, from where it happened and how large. Pure (a source of randomness given),
 * so a test counts them without a screen. fire.ts throws them into the page's two systems.
 *
 * A BLAST, as visual-effects artists take one apart (the layers, in the order the eye meets them):
 *   1. a FLASH: a white-hot core and rays, a tenth of a second, larger than the ball (with a light, fire.ts);
 *   2. a FIREBALL: puffs flung out and stopped by the air at once (a strong drag), white to yellow to
 *      orange to a dark red, gone in half a second; they add light, so where they overlap it burns brighter;
 *   3. SPARKS and EMBERS: streaks thrown far and falling, a few slow embers that drift;
 *   4. SMOKE: the ball turns to smoke as it dies, lit from inside at first, rising (hot) and spreading,
 *      for two to three and a half seconds;
 *   5. on the GROUND, if it is near: the shock running along it (a ring), the dust it lifts (a ring of
 *      low puffs, outwards), and a scorch that stays (a dozen seconds).
 * The sizes go with its radius (the launcher's is 3.5 m: the ball about 2 m across, smoke to 3).
 */

/** Colors over a life (linear light: over 1 is brighter than white, and the glow blooms it). */
export const FIRE: readonly Stop[] = [
  [0, 6, 5.2, 3.6, 1],
  [0.12, 4.5, 2.4, 0.7, 1],
  [0.4, 2.2, 0.7, 0.12, 0.8],
  [0.75, 0.6, 0.12, 0.02, 0.4],
  [1, 0.1, 0.02, 0, 0],
];
const FLASH: readonly Stop[] = [
  [0, 9, 8.5, 7, 1],
  [1, 4, 2, 0.6, 0],
];
const SPARK: readonly Stop[] = [
  [0, 6, 4.5, 2.2, 1],
  [0.5, 3.5, 1.4, 0.3, 1],
  [1, 1.2, 0.2, 0, 0],
];
const EMBER: readonly Stop[] = [
  [0, 4, 1.6, 0.3, 1],
  [0.7, 2, 0.5, 0.05, 0.8],
  [1, 0.6, 0.1, 0, 0],
];
const SMOKE: readonly Stop[] = [
  [0, 0.5, 0.3, 0.16, 0],
  [0.06, 0.3, 0.2, 0.14, 0.62],
  [0.3, 0.12, 0.11, 0.1, 0.5],
  [1, 0.1, 0.1, 0.1, 0],
];
const DUST: readonly Stop[] = [
  [0, 0.36, 0.33, 0.28, 0],
  [0.08, 0.36, 0.33, 0.28, 0.4],
  [1, 0.34, 0.32, 0.28, 0],
];
const RING: readonly Stop[] = [
  [0, 3, 2.4, 1.6, 0.9],
  [1, 1.5, 0.8, 0.3, 0],
];
const SCORCH: readonly Stop[] = [
  [0, 0.03, 0.025, 0.02, 0],
  [0.01, 0.03, 0.025, 0.02, 0.8],
  [0.75, 0.03, 0.025, 0.02, 0.8],
  [1, 0.03, 0.025, 0.02, 0],
];

/** The ground under a blast, if it is near enough to touch: where (its height) and how far below. */
export interface Ground {
  y: number;
}

/** A direction at random over the sphere, leaning up by `up` (0: even). */
function direction(random: () => number, up = 0): THREE.Vector3 {
  const z = Math.min(1, random() * 2 - 1 + up);
  const a = random() * Math.PI * 2;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return new THREE.Vector3(r * Math.cos(a), z, r * Math.sin(a)).normalize();
}
const between = (random: () => number, a: number, b: number) => a + (b - a) * random();

export interface Effect {
  adds: ParticleSpec[];
  covers: ParticleSpec[];
}

/** A blast's particles, from its place and radius, and the ground if it is near. */
export function blastEffect(
  at: THREE.Vector3,
  radius: number,
  ground: Ground | null,
  random: () => number = Math.random,
): Effect {
  const R = Math.max(0.5, radius) / 3.5;
  const adds: ParticleSpec[] = [];
  const covers: ParticleSpec[] = [];
  adds.push({ kind: 'flash', at, life: 0.12, size: [3 * R, 4.5 * R], stops: FLASH });
  // The fireball.
  for (let i = 0; i < 16; i++) {
    const d = direction(random, 0.25);
    adds.push({
      kind: 'puff',
      at: at.clone().addScaledVector(d, 0.15 * R),
      velocity: d.multiplyScalar(between(random, 7, 13) * R),
      drag: 7,
      gravity: -2,
      life: between(random, 0.35, 0.65),
      size: [0.9 * R, between(random, 1.6, 2.3) * R],
      spin: between(random, -1.5, 1.5),
      stops: FIRE,
    });
  }
  // Sparks, and a few embers.
  for (let i = 0; i < 30; i++) {
    const d = direction(random, 0.35);
    adds.push({
      kind: 'spark',
      at: at.clone(),
      velocity: d.multiplyScalar(between(random, 9, 20) * Math.sqrt(R)),
      drag: 1.2,
      gravity: 9.8,
      life: between(random, 0.35, 1.1),
      size: [0.05, 0.03],
      stretch: 0.035,
      stops: SPARK,
    });
  }
  for (let i = 0; i < 10; i++) {
    const d = direction(random, 0.5);
    adds.push({
      kind: 'puff',
      at: at.clone().addScaledVector(d, 0.4 * R),
      velocity: d.multiplyScalar(between(random, 1.5, 4)),
      drag: 1.5,
      gravity: between(random, -0.6, 1.5),
      life: between(random, 1.2, 2.4),
      size: [0.09, 0.05],
      stops: EMBER,
    });
  }
  // The smoke, as the ball dies.
  for (let i = 0; i < 14; i++) {
    const d = direction(random, 0.4);
    covers.push({
      kind: 'puff',
      at: at.clone().addScaledVector(d, 0.3 * R),
      velocity: d.multiplyScalar(between(random, 2, 4.5) * R),
      delay: between(random, 0.04, 0.22),
      drag: 2.2,
      gravity: -between(random, 0.8, 1.6),
      life: between(random, 2.2, 3.6),
      size: [0.9 * R, between(random, 2.2, 3.2) * R],
      spin: between(random, -0.4, 0.4),
      stops: SMOKE,
    });
  }
  if (ground) {
    const floor = new THREE.Vector3(at.x, ground.y + 0.04, at.z);
    adds.push({ kind: 'ring', at: floor, life: 0.3, size: [0.6 * R, 6 * R], stops: RING });
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + between(random, -0.15, 0.15);
      const d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      covers.push({
        kind: 'puff',
        at: floor
          .clone()
          .addScaledVector(d, 0.4 * R)
          .setY(ground.y + 0.25),
        velocity: d.multiplyScalar(between(random, 7, 11) * R).setY(between(random, 0.3, 1.2)),
        drag: 3,
        gravity: -0.3,
        life: between(random, 1.2, 2),
        size: [0.4 * R, between(random, 1, 1.5) * R],
        stops: DUST,
      });
    }
    covers.push({
      kind: 'scorch',
      at: floor.clone().setY(ground.y + 0.02),
      life: 12,
      size: [2.4 * R, 2.4 * R],
      linear: true,
      stops: SCORCH,
    });
  }
  return { adds, covers };
}

/** A weapon's flash at its end (`size`, m: FEEL's), a few sparks forward for the large ones, and a breath of smoke. */
export function muzzleEffect(
  at: THREE.Vector3,
  forward: THREE.Vector3 | null,
  size: number,
  random: () => number = Math.random,
): Effect {
  const adds: ParticleSpec[] = [{ kind: 'flash', at, life: 0.05, size: [size * 2.6, size * 3.2], stops: FLASH }];
  const covers: ParticleSpec[] = [];
  if (forward && size >= 0.25)
    for (let i = 0; i < 6; i++)
      adds.push({
        kind: 'spark',
        at: at.clone(),
        velocity: forward
          .clone()
          .add(direction(random).multiplyScalar(0.25))
          .normalize()
          .multiplyScalar(between(random, 12, 22)),
        drag: 3,
        gravity: 4,
        life: between(random, 0.08, 0.18),
        size: [0.025, 0.015],
        stretch: 0.02,
        stops: SPARK,
      });
  covers.push({
    kind: 'puff',
    at: at.clone(),
    velocity: (forward?.clone() ?? new THREE.Vector3()).multiplyScalar(1.5).add(new THREE.Vector3(0, 0.4, 0)),
    drag: 2,
    gravity: -0.5,
    life: between(random, 0.6, 1) * (0.6 + size),
    size: [size * 0.8, size * 3.5],
    stops: [
      [0, 0.5, 0.48, 0.45, 0],
      [0.1, 0.5, 0.48, 0.45, 0.35],
      [1, 0.5, 0.48, 0.45, 0],
    ],
  });
  return { adds, covers };
}

/**
 * (Stage 5p, decision 0031: contact) A BODY'S DUST where its feet strike the ground or leave it: a ring of
 * low puffs pushed out along the ground (perpendicular to `up`), rising a little, more and larger the harder
 * (`strength`: 0, a step off; 1, a landing at 10 m/s; more, harder still).
 */
export function dustEffect(at: THREE.Vector3, up: THREE.Vector3, strength: number, random: () => number = Math.random): Effect {
  const s = Math.max(0, Math.min(1.5, strength));
  const count = Math.round(4 + 8 * s);
  const side = Math.abs(up.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const a = side.clone().cross(up).normalize();
  const b = up.clone().cross(a).normalize();
  const covers: ParticleSpec[] = [];
  for (let i = 0; i < count; i++) {
    const turn = ((i + random() * 0.6) / count) * Math.PI * 2;
    const out = a.clone().multiplyScalar(Math.cos(turn)).addScaledVector(b, Math.sin(turn));
    covers.push({
      kind: 'puff',
      at: at.clone().addScaledVector(out, 0.15).addScaledVector(up, 0.05),
      velocity: out.multiplyScalar(between(random, 1, 2.2) * (0.6 + s)).addScaledVector(up, between(random, 0.2, 0.6)),
      drag: 3.5,
      gravity: -0.3,
      life: between(random, 0.45, 0.8) * (0.8 + 0.4 * s),
      size: [0.12, between(random, 0.35, 0.55) + 0.3 * s],
      spin: between(random, -1.5, 1.5),
      stops: DUST,
    });
  }
  return { adds: [], covers };
}

/**
 * (Stage 5p) WHAT A WALL GIVES OFF where a body slides down it (`out`: from the wall towards the body): a
 * puff or two blown off it, drifting up a little as it slides on.
 */
export function wallDustEffect(at: THREE.Vector3, out: THREE.Vector3, random: () => number = Math.random): Effect {
  const covers: ParticleSpec[] = [];
  for (let i = 0; i < 2; i++)
    covers.push({
      kind: 'puff',
      at: at.clone().addScaledVector(out, 0.05),
      velocity: out
        .clone()
        .multiplyScalar(between(random, 0.4, 0.9))
        .add(direction(random).multiplyScalar(0.25))
        .add(new THREE.Vector3(0, between(random, 0.3, 0.7), 0)),
      drag: 3,
      gravity: -0.2,
      life: between(random, 0.35, 0.65),
      size: [0.08, between(random, 0.25, 0.4)],
      spin: between(random, -2, 2),
      stops: DUST,
    });
  return { adds: [], covers };
}

/**
 * (Stage 5o) THE FLAME LANCE'S BREATH, one of fifteen a second: puffs of fire thrown along `forward` and
 * slowed by the air (a strong drag: thrown at 14 m/s, they stop about 6 m out, the lance's reach), growing
 * as they go, rising a little (hot), white-yellow to red to nothing; a wisp of smoke after.
 */
export function flameEffect(at: THREE.Vector3, forward: THREE.Vector3, random: () => number = Math.random): Effect {
  const adds: ParticleSpec[] = [];
  for (let i = 0; i < 5; i++)
    adds.push({
      kind: 'puff',
      at: at.clone().addScaledVector(forward, 0.1 * random()),
      velocity: forward
        .clone()
        .add(direction(random).multiplyScalar(0.12))
        .normalize()
        .multiplyScalar(between(random, 11, 15)),
      drag: 2.2,
      gravity: -1.5,
      life: between(random, 0.4, 0.58),
      size: [0.1, between(random, 0.6, 0.9)],
      spin: between(random, -3, 3),
      stops: FIRE,
    });
  const covers: ParticleSpec[] = [];
  if (random() < 0.4)
    covers.push({
      kind: 'puff',
      at: at.clone().addScaledVector(forward, 4),
      velocity: forward
        .clone()
        .multiplyScalar(1.5)
        .add(new THREE.Vector3(0, 1.2, 0)),
      drag: 1.5,
      gravity: -0.8,
      life: between(random, 0.8, 1.3),
      size: [0.4, 1.2],
      stops: SMOKE,
    });
  return { adds, covers };
}

/**
 * Where a shot struck: off what does not live, sparks bouncing away from where it came from, a small
 * flash, and a puff of the surface's dust (stone grey, wood brown); off whoever it hurt, a pale burst.
 */
export function impactEffect(
  at: THREE.Vector3,
  back: THREE.Vector3,
  living: boolean,
  surface: string | null,
  random: () => number = Math.random,
): Effect {
  if (living)
    return {
      adds: [
        {
          kind: 'flash',
          at,
          life: 0.08,
          size: [0.25, 0.45],
          stops: [
            [0, 2, 1.9, 1.8, 0.9],
            [1, 1, 0.9, 0.8, 0],
          ],
        },
      ],
      covers: [
        {
          kind: 'puff',
          at,
          velocity: back.clone().multiplyScalar(0.8),
          drag: 3,
          life: 0.35,
          size: [0.15, 0.5],
          stops: [
            [0, 0.9, 0.85, 0.8, 0.6],
            [1, 0.9, 0.85, 0.8, 0],
          ],
        },
      ],
    };
  const dust = surface === 'wood' ? [0.42, 0.3, 0.18] : surface === 'metal' ? [0.3, 0.3, 0.32] : [0.5, 0.47, 0.42];
  const adds: ParticleSpec[] = [{ kind: 'flash', at, life: 0.04, size: [0.18, 0.28], stops: FLASH }];
  for (let i = 0; i < (surface === 'wood' ? 3 : 8); i++)
    adds.push({
      kind: 'spark',
      at: at.clone(),
      velocity: back
        .clone()
        .add(direction(random).multiplyScalar(0.8))
        .normalize()
        .multiplyScalar(between(random, 3, 8)),
      drag: 2,
      gravity: 9.8,
      life: between(random, 0.15, 0.4),
      size: [0.025, 0.015],
      stretch: 0.03,
      stops: SPARK,
    });
  const covers: ParticleSpec[] = [
    {
      kind: 'puff',
      at: at.clone().addScaledVector(back, 0.05),
      velocity: back.clone().multiplyScalar(between(random, 1, 2)),
      drag: 3.5,
      gravity: -0.2,
      life: between(random, 0.5, 0.9),
      size: [0.12, 0.6],
      stops: [
        [0, dust[0]!, dust[1]!, dust[2]!, 0.7],
        [1, dust[0]!, dust[1]!, dust[2]!, 0],
      ],
    },
  ];
  return { adds, covers };
}

/** A rocket's trail, from where it was to where it is: thin puffs of smoke every 25 cm, and its flame at its back. */
export function trailEffect(from: THREE.Vector3, to: THREE.Vector3, random: () => number = Math.random): Effect {
  const covers: ParticleSpec[] = [];
  const d = to.clone().sub(from);
  const n = Math.min(10, Math.floor(d.length() / 0.25));
  for (let i = 0; i < n; i++)
    covers.push({
      kind: 'puff',
      at: from.clone().addScaledVector(d, (i + random()) / Math.max(1, n)),
      velocity: direction(random).multiplyScalar(0.3),
      drag: 1,
      gravity: -0.4,
      life: between(random, 0.7, 1.2),
      size: [0.08, between(random, 0.4, 0.6)],
      stops: [
        [0, 0.7, 0.45, 0.25, 0.35],
        [0.1, 0.32, 0.31, 0.3, 0.25],
        [1, 0.3, 0.3, 0.3, 0],
      ],
    });
  return { adds: [{ kind: 'flash', at: to.clone(), life: 0.04, size: [0.35, 0.3], stops: FIRE }], covers };
}
