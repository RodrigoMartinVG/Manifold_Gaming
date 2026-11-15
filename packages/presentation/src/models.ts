import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { vec3, type Vec3 } from '@manifold/common';
import { STEP, type Character } from '@manifold/core';
import {
  advance,
  CHARACTER_CLIPS,
  cycleTime,
  dominant,
  finalWeights,
  newGait,
  type CharacterClip,
  type Gait,
} from './locomotion';

/** A copy of a model, ready to draw, and the animations it plays. */
export interface ModelInstance {
  readonly object: THREE.Object3D;
  readonly mixer: THREE.AnimationMixer;
  readonly actions: ReadonlyMap<string, THREE.AnimationAction>;
  /** How it moves (stage 2e2: locomotion.ts), from one frame to the next. */
  readonly gait: Gait;
  /** The animation that weighs most now (null: none yet). */
  playing: string | null;
}

export interface Models {
  /** A new copy of a model, by its name; null until it has loaded (meanwhile, the body draws its shape). */
  instance(name: string): ModelInstance | null;
  /** Told when a model finished loading: whoever drew a shape instead draws it now. */
  onLoad(listener: (name: string) => void): void;
}

/**
 * THE MODELS (stage 2e): glTF files a game gives by name (`MountOptions.models`), loaded once and
 * copied for each entity whose appearance names one. Their geometry and materials are shared by every
 * copy (one model on the GPU, however many characters); each copy has its own bones and its own
 * animations.
 */
export function loadModels(urls: Readonly<Record<string, string>> = {}): Models {
  const loaded = new Map<string, { scene: THREE.Object3D; clips: THREE.AnimationClip[] }>();
  const listeners: ((name: string) => void)[] = [];
  const loader = new GLTFLoader();
  for (const [name, url] of Object.entries(urls))
    loader.load(
      url,
      (gltf) => {
        // Its geometry and materials are shared by every copy: a copy owns none of them, so removing
        // it does not free them (owned.ts).
        loaded.set(name, { scene: gltf.scene, clips: gltf.animations });
        for (const listen of listeners) listen(name);
      },
      undefined,
      (error) => console.warn(`the model "${name}" (${url}) did not load: ${(error as Error).message ?? error}`),
    );
  return {
    instance(name) {
      const model = loaded.get(name);
      if (!model) return null;
      const object = cloneSkeleton(model.scene);
      const mixer = new THREE.AnimationMixer(object);
      // Every animation plays at once, each with its weight, at the time the gait says (stage 2e2):
      // the mixer does not move them on by itself.
      const actions = new Map(
        model.clips.map((clip) => {
          const action = mixer.clipAction(clip);
          action.play();
          action.timeScale = 0;
          action.setEffectiveWeight(clip.name === 'idle' ? 1 : 0);
          return [clip.name, action] as const;
        }),
      );
      // (A gesture lasts as long as its animation: the model says how long.)
      const length = (clip: string, otherwise: number) => model.clips.find((c) => c.name === clip)?.duration ?? otherwise;
      return { object, mixer, actions, gait: newGait({ flip: length('flip', 0.45), land: length('land', 0.3) }), playing: null };
    },
    onLoad: (listener) => listeners.push(listener),
  };
}

/**
 * HOW A CHARACTER REALLY MOVED during its last step (m/s), apart from what carries it (a platform
 * under it): from where it was before the step and where it is. Not its `velocity`, which is what it
 * asks for on the ground: against a wall it asks for 4.5 m/s and goes nowhere. More than a meter in a
 * step is not moving, it is being put somewhere (a checkpoint, `dojo.goto`).
 */
export function motion(before: Vec3, now: Vec3, c: Character): Vec3 {
  const d = vec3.sub(now, before);
  if (vec3.length(d) > 1) return [0, 0, 0];
  return vec3.sub(vec3.scale(d, 1 / STEP), c.ground.velocity);
}

/** How fast the drawn body turns at most (radians per second): a turn of the world's in a step reads as a quick turn, not a jump. */
const TURN_RATE = THREE.MathUtils.degToRad(900);
const FORWARD = new THREE.Vector3(0, 0, -1);
const ahead = new THREE.Vector3();
const before = new THREE.Vector3();
const upAxis = new THREE.Vector3();

/**
 * THE BODY'S TURN, as drawn (stage 2e2): towards where the world has it, at most `TURN_RATE`. The
 * simulation turns a character at once (to where it walks, to the wall it climbs: 90° or 180° in one
 * step); drawn like that, it flipped. Anything slower is drawn exactly as it is (a platform's turn, the
 * mouse aiming). Returns how fast it turned around "up" (degrees per second), for the steps of turning
 * on the spot. Only the view: the world is not touched.
 */
export function turnBody(drawn: THREE.Quaternion, target: THREE.Quaternion, up: Vec3, dt: number): number {
  before.copy(FORWARD).applyQuaternion(drawn);
  drawn.rotateTowards(target, TURN_RATE * dt);
  if (dt <= 0) return 0;
  ahead.copy(FORWARD).applyQuaternion(drawn);
  upAxis.set(...up);
  const sin = new THREE.Vector3().crossVectors(before, ahead).dot(upAxis);
  return THREE.MathUtils.radToDeg(Math.atan2(sin, before.dot(ahead))) / dt;
}

/**
 * Moves a copy's animations on by `dt` seconds (already scaled by the match's speed), as the
 * character asks: its mode, how it really moved (`moved`, from `motion`), and how fast its body is
 * drawn turning (`turning`, degrees per second, from `turnBody`). The view only reads the world.
 */
export function animate(model: ModelInstance, c: Character, up: Vec3, moved: Vec3, turning: number, dt: number) {
  const spin = THREE.MathUtils.radToDeg(c.ground.spin);
  advance(
    model.gait,
    {
      mode: c.mode,
      grounded: c.grounded,
      up,
      facing: c.facing,
      velocity: moved,
      vertical: vec3.dot(c.velocity, up),
      airJumps: c.airJumps,
      // (What a turning platform turns it is not turning on its feet.)
      turning: turning - spin,
    },
    dt,
  );
  const weights = finalWeights(model.gait);
  for (const [name, action] of model.actions) {
    const clip = name as CharacterClip;
    if (!(CHARACTER_CLIPS as readonly string[]).includes(name)) {
      action.setEffectiveWeight(0);
      continue;
    }
    action.setEffectiveWeight(weights[clip]);
    const length = action.getClip().duration;
    const at = cycleTime(model.gait, clip);
    action.time =
      'phase' in at ? at.phase * length : clip === 'flip' || clip === 'land' ? Math.min(at.seconds, length) : at.seconds % length;
  }
  model.mixer.update(0);
  model.playing = dominant(weights);
}
