import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { vec3, type Vec3 } from '@manifold/common';
import type { Character } from '@manifold/core';

/** A copy of a model, ready to draw, and the animations it plays. */
export interface ModelInstance {
  readonly object: THREE.Object3D;
  readonly mixer: THREE.AnimationMixer;
  readonly actions: ReadonlyMap<string, THREE.AnimationAction>;
  /** The animation it plays now (null: none yet). */
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
      const actions = new Map(model.clips.map((clip) => [clip.name, mixer.clipAction(clip)] as const));
      return { object, mixer, actions, playing: null };
    },
    onLoad: (listener) => listeners.push(listener),
  };
}

/** How fast each animation was made to move (m/s): played faster or slower with the character, its feet do not slide. */
const PACE: Record<string, number> = { walk: 4.5, run: 7.5, climb: 2.5 };

/**
 * WHICH ANIMATION a character plays (stage 2e): from its mode, and walking, from how fast it goes
 * (along its ground: what a platform carries it does not count). The view only reads the world: the
 * animation follows the character, never the other way round.
 */
export function clipFor(c: Character, up: Vec3): { clip: string; speed: number } {
  const speed = vec3.length(vec3.onPlane(c.velocity, up));
  if (c.mode === 'climb') return { clip: 'climb', speed: vec3.length(c.velocity) };
  if (c.mode === 'glide') return { clip: 'glide', speed };
  if (c.mode === 'air') return { clip: 'air', speed };
  return { clip: speed < 0.5 ? 'idle' : speed < 6 ? 'walk' : 'run', speed };
}

/** Moves a copy's animation on by `dt` seconds, towards the one the character asks for (a short blend). */
export function animate(model: ModelInstance, c: Character, up: Vec3, dt: number) {
  const { clip, speed } = clipFor(c, up);
  const next = model.actions.get(clip);
  if (next && model.playing !== clip) {
    next.reset().play();
    const before = model.playing ? model.actions.get(model.playing) : null;
    if (before) next.crossFadeFrom(before, 0.15, false);
    model.playing = clip;
  }
  const pace = PACE[clip];
  if (next) next.timeScale = pace ? THREE.MathUtils.clamp(speed / pace, 0, 1.6) : 1;
  model.mixer.update(dt);
}
