import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';

/**
 * THE SCENE'S PASS, COUNTED (stage 5j): three counts what each `render` draws and starts again at the next;
 * with passes after the scene, the last count was the last pass's (one triangle over the screen). This
 * pass keeps what the scene alone cost, for the budgets (the counts are reset by the stage, once a frame).
 */
export class CountedRenderPass extends RenderPass {
  counted = { calls: 0, triangles: 0 };
  override render(...args: Parameters<RenderPass['render']>) {
    super.render(...args);
    const info = args[0].info.render;
    this.counted = { calls: info.calls, triangles: info.triangles };
  }
}

/**
 * WHAT CANNOT BE A COLOUR, MADE ONE (stage 5.5a), between the scene and the glow: a NaN, a colour below 0 or
 * an infinity. A shader that takes a power of something negative gives a NaN, and the glow, which blurs
 * the bright over its neighbours, spreads it until the screen is black (the forest's demo did, decision
 * 0032); a NaN becomes black here, a negative 0, an infinity the brightest a half float holds. (`isnan` is
 * GLSL ES 3.0's: three draws with WebGL 2.)
 */
export const SANITIZE_SHADER = {
  name: 'SanitizeShader',
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    float clean(float x) { return isnan(x) ? 0.0 : clamp(x, 0.0, 65504.0); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      gl_FragColor = vec4(clean(c.r), clean(c.g), clean(c.b), c.a);
    }`,
};

/** What the chain is made of: the glow's numbers, the vignette's, and how many samples a pixel of the scene takes. */
export interface PostOptions {
  glow: { strength: number; radius: number; threshold: number };
  vignette: { offset: number; darkness: number };
  samples: number;
}

/** The chain, made: its composer and the passes the stage changes or reads. */
export interface PostChain {
  composer: EffectComposer;
  scene: CountedRenderPass;
  bloom: UnrealBloomPass;
  vignette: ShaderPass;
}

/**
 * THE FINISHED IMAGE'S PASSES (stage 5j; made sound in 5.5a): the scene, what cannot be a colour made one,
 * the glow, the vignette, and the output (tone mapping and the screen's colour space).
 *   - **Anti-aliasing:** the scene is drawn into a target of `samples` samples a pixel (multisampling, as
 *     the canvas does without the chain). Three's composer makes its targets without, and from 5j to 5.5a
 *     every game with the atmosphere was drawn with jagged edges while the canvas paid for smooth ones.
 *   - **No colour below 0:** the vignette's darkness at most 1 (it mixes towards `1 − darkness`; at 1.1,
 *     towards −0.1, safe only because ACES clips it; a colour table after it, or another tone mapping,
 *     would take a power of it).
 */
export function createPostChain(
  renderer: Pick<THREE.WebGLRenderer, 'getSize' | 'getPixelRatio' | 'capabilities'>,
  scene: THREE.Scene,
  camera: THREE.Camera,
  o: PostOptions,
): PostChain {
  const size = renderer.getSize(new THREE.Vector2());
  const ratio = renderer.getPixelRatio();
  const samples = Math.max(0, Math.min(o.samples, renderer.capabilities.maxSamples));
  const target = new THREE.WebGLRenderTarget(size.x * ratio, size.y * ratio, { type: THREE.HalfFloatType, samples });
  target.texture.name = 'EffectComposer.rt1';
  const composer = new EffectComposer(renderer as THREE.WebGLRenderer, target);
  const scenePass = new CountedRenderPass(scene, camera);
  composer.addPass(scenePass);
  composer.addPass(new ShaderPass(SANITIZE_SHADER));
  const bloom = new UnrealBloomPass(size, o.glow.strength, o.glow.radius, o.glow.threshold);
  composer.addPass(bloom);
  const vignette = new ShaderPass(VignetteShader);
  vignette.uniforms.offset!.value = o.vignette.offset;
  vignette.uniforms.darkness!.value = Math.min(1, o.vignette.darkness);
  composer.addPass(vignette);
  composer.addPass(new OutputPass());
  composer.setSize(size.x, size.y);
  return { composer, scene: scenePass, bloom, vignette };
}
