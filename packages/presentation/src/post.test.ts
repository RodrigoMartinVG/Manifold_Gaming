import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { describe, expect, test } from 'vitest';
import { createPostChain, CountedRenderPass, SANITIZE_SHADER } from './post';
import { FLOOR } from './quality';
import { ATMOSPHERE } from './stage';

/** What the chain asks of a renderer, without a GPU: its size, its ratio, how many samples it can take. */
const renderer = (maxSamples = 8) => ({
  getSize: (v: THREE.Vector2) => v.set(640, 360),
  getPixelRatio: () => 1,
  capabilities: { maxSamples } as THREE.WebGLRenderer['capabilities'],
});
const chain = (maxSamples?: number) =>
  createPostChain(renderer(maxSamples), new THREE.Scene(), new THREE.PerspectiveCamera(), {
    ...ATMOSPHERE,
    samples: FLOOR.samples,
  });

describe('the finished image’s passes (stage 5j; made sound in 5.5a)', () => {
  test('three’s composer, as it comes, draws the scene with one sample a pixel: no anti-aliasing (5j to 5.5a)', () => {
    const plain = new EffectComposer(renderer() as unknown as THREE.WebGLRenderer);
    expect(plain.renderTarget1.samples).toBe(0);
  });

  test('the scene drawn with samples (as many as the GPU takes, at most the atmosphere’s), into half floats', () => {
    const { composer } = chain();
    expect([composer.renderTarget1.samples, composer.renderTarget2.samples]).toEqual([4, 4]);
    expect(composer.renderTarget1.texture.type).toBe(THREE.HalfFloatType);
    expect(chain(2).composer.renderTarget1.samples).toBe(2);
    expect(chain(0).composer.renderTarget1.samples).toBe(0);
  });

  test('what cannot be a colour is made one before the glow spreads it; the vignette never goes below 0', () => {
    const { composer, vignette } = chain();
    const kinds = composer.passes.map((p) =>
      p instanceof CountedRenderPass
        ? 'scene'
        : p instanceof UnrealBloomPass
          ? 'glow'
          : p === vignette
            ? 'vignette'
            : p instanceof ShaderPass && (p.material as THREE.ShaderMaterial).fragmentShader === SANITIZE_SHADER.fragmentShader
              ? 'sanitize'
              : p.constructor.name,
    );
    expect(kinds).toEqual(['scene', 'sanitize', 'glow', 'vignette', 'OutputPass']);
    expect(SANITIZE_SHADER.fragmentShader).toMatch(/isnan/);
    expect(vignette.uniforms.darkness!.value).toBeLessThanOrEqual(1);
    expect(ATMOSPHERE.vignette.darkness).toBeLessThanOrEqual(1);
  });
});
