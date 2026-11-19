import * as THREE from 'three';
import { vec3, type Vec3 } from '@manifold/common';
import { FLOOR } from './quality';

/**
 * HOW MANY REAL LIGHTS (stage 4.5f): every point light three.js has is worked out for every pixel of
 * every lit material, wherever it is, and each one more recompiles them all. The citadel's fourteen cost
 * a frame 9.5 ms on the author's Iris Plus, four of them 5.5 (0.4 ms a light, the screen full). So the
 * drawing keeps this many at most, and gives them each frame to what matters most to what the camera sees;
 * every lamp still glows, and the simulation's light (what a watcher sees by) is all of them, as always.
 */
export const MOST_LIGHTS = FLOOR.lights;

/**
 * How much nearer (m) a light asked for must be than one already lit to take its place (stage 5.5a): the
 * hysteresis that keeps two lamps about as near from trading their light on every step the camera takes.
 */
export const KEEP = 2;

/** A light a piece wants drawn this frame. */
export interface LightAsk {
  /** Who asks, the same every frame (`lamp:12`, `flash`): what keeps a light where it was. */
  key: string;
  at: Vec3;
  /** How far it reaches (three's `distance`). */
  radius: number;
  /** As three draws it. */
  intensity: number;
  color: number;
  /** How it falls with distance (three's `decay`: a lamp 1, as the simulation's light; a flash 2). */
  decay: number;
  /** Higher first, whatever the distance: a flash before the lamps. */
  priority: number;
}

/**
 * WHICH LIGHTS ARE DRAWN (stage 5.5a; the lamps' rule since 4.5f): at most `slots`, among those lit and
 * whose reach the camera sees some of (`seen`); the higher priority first, then the nearest (by how far
 * the camera is from their reach: inside it, 0), the ones already lit (`held`) counted `KEEP` m nearer;
 * of two as near, the brighter; then by key, so the same view gives the same choice. Pure, for the tests.
 */
export function chooseLights(
  asks: readonly LightAsk[],
  held: ReadonlySet<string>,
  camera: Vec3,
  seen: (a: LightAsk) => boolean,
  slots: number,
): LightAsk[] {
  const away = (a: LightAsk) => Math.max(0, vec3.length(vec3.sub(a.at, camera)) - a.radius) - (held.has(a.key) ? KEEP : 0);
  return asks
    .filter((a) => a.intensity > 0 && seen(a))
    .sort(
      (a, b) =>
        b.priority - a.priority || away(a) - away(b) || b.intensity - a.intensity || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
    )
    .slice(0, slots);
}

/**
 * THE LIGHT POOL (stage 5.5a): the scene's real lights, one owner for all of them. Before, the lamps' piece
 * kept as many as there were lamps and added or took one away whenever that changed (a flare thrown, one
 * burnt out: every lit material recompiled, a hitch while playing), and the muzzle flash kept a light of its
 * own outside the count: seven, where the budget says six (decision 0026). Now:
 *   - its size is set when a world is born (a level loaded: `resize`, with the lamps it starts with and
 *     the slots pieces reserved, the flash's one), at most `MOST_LIGHTS`, and never changes while playing;
 *   - every frame each piece asks for the lights it would like (`ask`), and the stage, before it draws,
 *     gives the slots out (`assign`) by `chooseLights`: a flash first, then the nearest lamps; a lamp made
 *     while playing competes for the slots there are;
 *   - a light asked for again stays in the slot it had, so what is lit does not jump from one to another.
 */
export interface LightPool {
  /** How many real lights there are now. */
  readonly size: number;
  /** Slots a piece needs besides the lamps (the flash: one), said once, when it is mounted. */
  reserve(key: string, slots: number): void;
  /** For a world being born: its lamps at the start, plus what is reserved, at most `MOST_LIGHTS`. */
  resize(lamps: number): void;
  /** A light wanted this frame. */
  ask(light: LightAsk): void;
  /** Gives the slots to this frame's asks (the stage, before it draws), and forgets them. */
  assign(camera: THREE.Camera): void;
  /** What each slot lights now (its key, or null): for the tests. */
  readonly lit: readonly (string | null)[];
  dispose(): void;
}

export function createLightPool(scene: THREE.Scene, most = MOST_LIGHTS): LightPool {
  const reserved = new Map<string, number>();
  const lights: THREE.PointLight[] = [];
  let holders: (string | null)[] = [];
  let asks: LightAsk[] = [];
  const frustum = new THREE.Frustum();
  const view = new THREE.Matrix4();
  const sphere = new THREE.Sphere();
  const center = new THREE.Vector3();
  return {
    get size() {
      return lights.length;
    },
    get lit() {
      return holders;
    },
    reserve(key, slots) {
      reserved.set(key, slots);
    },
    resize(lamps) {
      const extra = [...reserved.values()].reduce((a, b) => a + b, 0);
      const size = Math.min(most, Math.max(0, lamps) + extra);
      while (lights.length < size) {
        const light = new THREE.PointLight(0xffffff, 0, 1, 1);
        scene.add(light);
        lights.push(light);
      }
      while (lights.length > size) {
        const light = lights.pop()!;
        light.removeFromParent();
        light.dispose();
      }
      holders = lights.map(() => null);
    },
    ask(light) {
      asks.push(light);
    },
    assign(camera) {
      camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      const seen = (a: LightAsk) => frustum.intersectsSphere(sphere.set(center.set(...a.at), a.radius));
      const held = new Set(holders.filter((k): k is string => k !== null));
      const chosen = chooseLights(asks, held, camera.getWorldPosition(center).toArray(), seen, lights.length);
      asks = [];
      const byKey = new Map(chosen.map((a) => [a.key, a]));
      // Each one where it was, if it is still lit; the newcomers in the slots left free.
      const next: (string | null)[] = holders.map((k) => (k !== null && byKey.has(k) ? k : null));
      for (const a of chosen) if (!next.includes(a.key)) next[next.indexOf(null)] = a.key;
      lights.forEach((light, i) => {
        const a = next[i] === null ? undefined : byKey.get(next[i]!);
        light.intensity = a ? a.intensity : 0;
        if (!a) return;
        light.position.set(...a.at);
        light.distance = a.radius;
        light.decay = a.decay;
        light.color.setHex(a.color);
      });
      holders = next;
    },
    dispose() {
      for (const light of lights) {
        light.removeFromParent();
        light.dispose();
      }
      lights.length = 0;
      holders = [];
    },
  };
}
