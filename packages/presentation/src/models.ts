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
  footing,
  newGait,
  type CharacterClip,
  type Gait,
} from './locomotion';
import { footPaths, LEGS, newFeet, plant, type Feet, type FootPaths } from './feet';
import { ARMS, grip, newHands, type Hands, type Surroundings } from './hands';
import { holdTool, newHolding, type Holding } from './tools';
import { limbOf, rotateInWorld, type Limb } from './ik';
import { inertialize, newInertia, type Inertia } from './inertia';
import type { Ragdoll } from './ragdoll';

/** A copy of a model, ready to draw, and the animations it plays. */
export interface ModelInstance {
  readonly object: THREE.Object3D;
  readonly mixer: THREE.AnimationMixer;
  readonly actions: ReadonlyMap<string, THREE.AnimationAction>;
  /** How it moves (stage 2e2: locomotion.ts), from one frame to the next. */
  readonly gait: Gait;
  /** Where its feet stand (feet.ts), from one frame to the next. */
  readonly feet: Feet;
  /** Its ground animations' foot paths (read once for every copy of the model). */
  readonly paths: FootPaths;
  /** Its legs and arms as the solver takes them (ik.ts), if the model has those bones. */
  readonly legs: Readonly<Record<'L' | 'R', Limb>> | null;
  readonly arms: Readonly<Record<'L' | 'R', Limb>> | null;
  /** What its hands hold (hands.ts), from one frame to the next. */
  readonly hands: Hands;
  /** What it carries (stage 4c: tools.ts), where it was drawn. */
  readonly holding: Holding;
  /** Its bones, and what dies out of the pose it showed when a gesture starts (stage 4b: inertia.ts). */
  readonly bones: readonly THREE.Object3D[];
  /**
   * The pose the mixer last wrote into its bones (their turns and places, in the bones' order). Put back
   * before each update: the mixer writes a bone only when its animation's value changes, and what the
   * layers after it did to a bone that holds still (the IK, the aim, a fall) would otherwise stay, and
   * add up (stage 4c found it: a ragdoll's hips stayed lying; the aim's head, running, turned on).
   */
  readonly animated: { turns: THREE.Quaternion[]; places: THREE.Vector3[] };
  readonly inertia: Inertia;
  /** How many gestures it has seen start (the gait's count): one more, and the pose changes by inertia. */
  gestures: number;
  /**
   * Its fall (stage 4c: ragdoll.ts), while it is down: its bones are the ragdoll's, and its animations
   * wait. `getUp`: it came back, and the pose its fall left dies out by inertia at its next frame.
   */
  ragdoll: Ragdoll | null;
  getUp: boolean;
  /** A hit, drawn (stage 4c): the spine's spring, its axis in the body's frame, its angle and its speed. */
  readonly flinch: { axis: THREE.Vector3; angle: number; speed: number };
  /** Its aim as drawn (stage 4b): the pitch it shows (degrees), and the bones it is spread over. */
  readonly aim: { pitch: number; readonly spine: THREE.Object3D | null; readonly head: THREE.Object3D | null };
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
      return model ? modelInstance(model) : null;
    },
    onLoad: (listener) => listeners.push(listener),
  };
}

/** A copy's bones, in its tree's order. */
const bonesOf = (object: THREE.Object3D) => {
  const bones: THREE.Object3D[] = [];
  object.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones.push(o);
  });
  return bones;
};

/** Each model's foot paths (feet.ts), by its animations: read with its first copy, shared by the rest. */
const pathsOf = new WeakMap<readonly THREE.AnimationClip[], FootPaths>();

/** A new copy of a loaded model (its scene and its animations), with its own bones and animations. */
export function modelInstance(model: { scene: THREE.Object3D; clips: readonly THREE.AnimationClip[] }): ModelInstance {
  const object = cloneSkeleton(model.scene);
  // Its limbs, from its bones at rest, before any animation moves them.
  const limbs = (specs: typeof LEGS) => {
    const L = limbOf(object, specs.L);
    const R = limbOf(object, specs.R);
    return L && R ? { L, R } : null;
  };
  const legs = limbs(LEGS);
  const arms = limbs(ARMS);
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
  let paths = pathsOf.get(model.clips);
  if (!paths) pathsOf.set(model.clips, (paths = footPaths(object, mixer, actions)));
  return {
    object,
    mixer,
    actions,
    gait: newGait({ flip: length('flip', 0.45), land: length('land', 0.3) }),
    feet: newFeet(),
    paths,
    legs,
    arms,
    hands: newHands(),
    holding: newHolding(),
    bones: bonesOf(object),
    animated: { turns: bonesOf(object).map((b) => b.quaternion.clone()), places: bonesOf(object).map((b) => b.position.clone()) },
    inertia: newInertia(),
    gestures: 0,
    flinch: { axis: new THREE.Vector3(1, 0, 0), angle: 0, speed: 0 },
    ragdoll: null,
    getUp: false,
    aim: { pitch: 0, spine: object.getObjectByName('spine') ?? null, head: object.getObjectByName('head') ?? null },
    playing: null,
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

/** The spine's spring (stage 4c): how fast it swings back (2.5 times a second), how damped, and the kick of a hit that takes `FLINCH_FULL` points or more (rad/s). */
const FLINCH_RATE = 2 * Math.PI * 2.5;
const FLINCH_DAMPING = 0.35;
const FLINCH_KICK = 4;
const FLINCH_FULL = 20;
const kickAxis = new THREE.Vector3();
const bodyTurn = new THREE.Quaternion();

/**
 * A HIT, DRAWN (stage 4c): the spine is kicked away from where the hit came from (`travel`, the way it
 * went, in the world), as hard as the points it took (all of the kick at `FLINCH_FULL`), and swings
 * back on a damped spring. Only the view: the world keeps the capsule.
 */
export function flinch(model: ModelInstance, travel: THREE.Vector3, up: THREE.Vector3, points: number) {
  // About the axis across the hit and up: the chest goes the way the hit went.
  kickAxis.crossVectors(up, travel);
  if (kickAxis.lengthSq() < 1e-9) return;
  kickAxis.normalize().applyQuaternion(model.object.getWorldQuaternion(bodyTurn).invert());
  const f = model.flinch;
  // A hit while it still swings: the new kick, on what is left of the last one, along the new axis.
  f.speed = f.speed * kickAxis.dot(f.axis) + FLINCH_KICK * Math.min(1, points / FLINCH_FULL);
  f.angle *= kickAxis.dot(f.axis);
  f.axis.copy(kickAxis);
}

/** The spine's spring, a step of `dt` on (semi-implicit), and drawn. */
function springSpine(model: ModelInstance, dt: number) {
  const f = model.flinch;
  if (dt > 0) {
    f.speed += (-FLINCH_RATE * FLINCH_RATE * f.angle - 2 * FLINCH_DAMPING * FLINCH_RATE * f.speed) * dt;
    f.angle += f.speed * dt;
    if (Math.abs(f.angle) < 1e-4 && Math.abs(f.speed) < 1e-3) f.angle = f.speed = 0;
  }
  if (f.angle === 0 || !model.aim.spine?.parent) return;
  kickAxis.copy(f.axis).applyQuaternion(model.object.getWorldQuaternion(bodyTurn));
  rotateInWorld(model.aim.spine, kickAxis, f.angle);
}

/**
 * How far a character's roll has gone (stage 4b), 0 to 1: the steps gone of its roll's steps (its time,
 * over the step), from the simulation's state. Not rolling, 0.
 */
export function rollProgress(c: Pick<Character, 'mode' | 'rolling' | 'movement'>): number {
  if (c.mode !== 'roll') return 0;
  const steps = Math.max(1, Math.round(c.movement.roll.time / STEP));
  return Math.min(1, Math.max(0, 1 - c.rolling / steps));
}

/** How fast the drawn aim follows the world's (degrees per second): a flick of the mouse, quick but not a jump. */
const AIM_RATE = 720;
/**
 * How the pitch is spread over the body (stage 4b): the spine takes this much, the head the rest. A
 * person aiming up bends mostly at the neck (it extends to about 60°), the back giving some 25°; and the
 * mannequin's torso is one piece that turns at the waist, so at 0.4 aiming straight up leaned it back
 * like a limbo dancer. At 0.3, aiming 72° up, the chest takes 22° and the head 50°.
 */
export const AIM_SPINE = 0.3;
const side = new THREE.Vector3();

/**
 * THE AIM, SHOWN (stage 4b): the body faces along the ground (the world turns it about its "up" only),
 * and the aim's pitch is spread over the spine and the head, so that the head (its visor) looks where
 * the character aims and the chest goes part of the way (`AIM_SPINE`), the arms with it. Towards the world's pitch at
 * `AIM_RATE` at most. Only the view: the world is not touched.
 */
export function aimBody(model: ModelInstance, pitch: number, dt: number) {
  const { aim } = model;
  // (A character made by hand, in a test, may have none: level.)
  const wanted = Number.isFinite(pitch) ? pitch : 0;
  if (dt > 0) aim.pitch += Math.max(-AIM_RATE * dt, Math.min(AIM_RATE * dt, wanted - aim.pitch));
  if (aim.pitch === 0 || !aim.spine?.parent || !aim.head?.parent) return;
  model.object.updateMatrixWorld(true);
  // About the body's own right: a positive turn takes its forward (−Z) up.
  side.set(1, 0, 0).transformDirection(model.object.matrixWorld);
  const radians = THREE.MathUtils.degToRad(aim.pitch);
  rotateInWorld(aim.spine, side, radians * AIM_SPINE);
  rotateInWorld(aim.head, side, radians * (1 - AIM_SPINE));
}

/**
 * Moves a copy's animations on by `dt` seconds (already scaled by the match's speed), as the
 * character asks: its mode, how it really moved (`moved`, from `motion`), and how fast its body is
 * drawn turning (`turning`, degrees per second, from `turnBody`); its place and turn must already be
 * the frame's (its feet are planted in the world, its hands hold on to what `around` finds). The view
 * only reads the world.
 */
export function animate(
  model: ModelInstance,
  c: Character,
  up: Vec3,
  moved: Vec3,
  turning: number,
  dt: number,
  around?: Surroundings,
) {
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
      roll: rollProgress(c),
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
  // The mixer's last pose back in the bones, then its update; what it wrote, remembered.
  model.bones.forEach((b, i) => {
    b.quaternion.copy(model.animated.turns[i]!);
    b.position.copy(model.animated.places[i]!);
  });
  model.mixer.update(0);
  model.bones.forEach((b, i) => {
    model.animated.turns[i]!.copy(b.quaternion);
    model.animated.places[i]!.copy(b.position);
  });
  // A gesture started (a somersault, a landing): its pose at once, and the one drawn until now dying out
  // (inertia.ts: a cross-fade of 0.05 s from the fall's arms-up pose snapped the landing).
  const started = model.gait.started.count !== model.gestures || model.getUp;
  model.gestures = model.gait.started.count;
  model.getUp = false;
  inertialize(model.bones, model.inertia, started, dt);
  // And the feet where the cycles' feet are, mixed; on the ground, they stay there (feet.ts).
  const where = { L: footing(model.gait, 'L', c.grounded), R: footing(model.gait, 'R', c.grounded) };
  plant(model.object, model.legs, model.paths, model.actions, model.feet, where, up, dt);
  // Its aim, over the spine and the head (the arms go with the chest); rolling, none.
  aimBody(model, c.mode === 'roll' ? 0 : c.pitch, dt);
  // A hit's spring in the spine (stage 4c).
  springSpine(model, dt);
  // What it carries in its hands, along its aim (stage 4c: tools.ts); not while climbing or rolling.
  const carries = c.mode === 'climb' || c.mode === 'roll' ? null : (around?.tool ?? null);
  const tool = holdTool(model.object, model.arms, model.holding, carries, model.aim.pitch, up, dt);
  // And the hands on what they hold: a wall, a ledge, what is carried, a tool (hands.ts).
  grip(model.object, model.arms, model.hands, c, around, model.gait.climbPhase, moved, up, dt, tool);
  model.playing = dominant(weights);
}
