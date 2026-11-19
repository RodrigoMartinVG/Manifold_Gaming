import * as THREE from 'three';
import { createLightPool } from './light-pool';
import type { CameraEffects, Stage } from './page';
import { FLOOR, type Tier } from './quality';
import { createPostChain, type PostChain } from './post';
import { skyAt, type Rgb } from './sky';

/**
 * A LOOK (stage 5.5g, the audit's V4: until then a boolean and a block of constants), as data: at full
 * night, a cool fill of at least `nightFill`, of `coolFill`'s hue; a moonlight for silhouettes; the fog's
 * near and far (m) by day and at night, the night's amount mixing them; the exposure the same way; the
 * glow (how strong, how wide, from how bright) and the vignette. A game or a level gives one (`Stage.atmosphere`);
 * the camera's far plane and the sky's dome come from its fog, so the three no longer agree by picking.
 */
export interface Look {
  readonly nightFill: number;
  readonly coolFill: number;
  readonly moonlight: number;
  readonly fog: { readonly day: readonly [number, number]; readonly night: readonly [number, number] };
  readonly exposure: { readonly day: number; readonly night: number };
  readonly glow: { readonly strength: number; readonly radius: number; readonly threshold: number };
  readonly vignette: { readonly offset: number; readonly darkness: number };
}

/**
 * THE GAMES' LOOK (stage 5j, decision 0031; the research's "make it feel dark, don't make it dark"): at
 * full night, a cool fill, a moonlight for silhouettes, fog nearer, the exposure a little up; by day, the
 * fog farther. The glow from what gives light (lamps, the flame, flashes, the sun's disc).
 */
export const ATMOSPHERE: Look = Object.freeze({
  nightFill: 0.5,
  coolFill: 0x8fa6d8,
  moonlight: 0.45,
  fog: { day: [60, 180], night: [18, 85] } as const,
  exposure: { day: 1, night: 1.15 } as const,
  glow: { strength: 0.55, radius: 0.45, threshold: 0.82 } as const,
  // (Stage 5.5a) Its darkness at most 1: it mixes towards 1 − darkness, and at 1.1 it made colours negative.
  vignette: { offset: 1, darkness: 1 } as const,
});

/**
 * The camera's far plane for a fog's end (stage 5.5g): the fog's end 90% of the way, so nothing the fog has
 * not hidden is cut, and nothing it has hidden is drawn (at night, the games' fog ends at 85 m: the 200 m the
 * far plane was drew the rest of a level only to cover it with fog); and the sky's dome three quarters of
 * the way, inside it. Without a look, 200 m, as it was. `farOf(look)`: its farthest, by day (200 m).
 */
export const farFor = (fogEnd: number | null): number => (fogEnd === null ? 200 : fogEnd / 0.9);
export const farOf = (look: Look | null): number => farFor(look ? Math.max(look.fog.day[1], look.fog.night[1]) : null);
const domeOf = (far: number) => far * 0.75;

/** Whether the glow is drawn (stage 5j): a setting, on as it comes; off for looks, or a slow machine. */
export const GLOW_VARIABLE = {
  name: 'view.glow',
  description:
    "A glow over the finished image (stage 5j): what gives light (lamps, the flame, flashes) glows round it, and the screen's edges darken a little. Off, it is drawn plainer, and faster on a slow machine.",
  scope: 'view',
  type: { kind: 'boolean' },
  default: true,
} as const;

/** How much it is night at an hour's sky, from the sun's height (0 by day, 1 with the sun 15° below). */
export const nightOf = (sunUp: number) => Math.max(0, Math.min(1, -sunUp * 4));

/** The sky's dome's mesh (m), scaled to three quarters of the camera's far plane (`farOf`), wherever the camera goes. */
const DOME = 150;

/**
 * THE SKY'S DOME (stage 5a): a sphere round the camera, painted from inside by `skyAt`'s look. Up, from
 * the horizon's color to the zenith's (quickly near the horizon, as a real sky); down, the ground's; the
 * sun's glow round it and its disc, the moon's, and the stars, each a cell of a grid of directions that
 * a hash lights or not (they stay where they are as the camera turns).
 *
 * As cheap as it can be (stage 5b: on the CPU's WebGL, the browser tests', the first one, worked out
 * pixel by pixel and drawn under everything, about halved the frames a second). What changes slowly
 * across the sky is worked out at the dome's corners (64 × 48) and blended between them; a pixel does
 * only what is sharp, and only where it can be: near the sun, near the moon, the stars at night. And
 * it is drawn after everything solid, at the far plane: the depth test leaves out every pixel
 * something already covers.
 */
const SKY_VERTEX = /* glsl */ `
  uniform vec3 zenith;
  uniform vec3 horizon;
  uniform vec3 ground;
  uniform vec3 sunColor;
  uniform vec3 sun;
  uniform vec3 moon;
  uniform float sunGlow;
  varying vec3 vDirection;
  varying vec3 vColor;
  varying float vSun;
  varying float vMoon;
  void main() {
    vec3 d = normalize(position);
    vDirection = position;
    // What changes slowly across the sky, worked out at the dome's corners: from the horizon's color to
    // the zenith's (quickly near the horizon), the ground's under it with a soft edge, and the sun's
    // wide glow. And how near each corner is to the sun and the moon, for the pixels to know whether
    // there is more to do.
    float up = d.y;
    vec3 color = mix(horizon, zenith, sqrt(clamp(up, 0.0, 1.0)));
    float s = max(dot(d, sun), 0.0);
    float s2 = s * s;
    color += sunColor * 0.3 * s2 * s2 * s2 * sunGlow;
    vColor = mix(color, ground, smoothstep(0.0, -0.06, up));
    vSun = dot(d, sun);
    vMoon = dot(d, moon);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // At the far plane: behind whatever is drawn.
    gl_Position.z = gl_Position.w;
  }
`;
const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 sunColor;
  uniform vec3 sun;
  uniform vec3 moon;
  uniform float sunGlow;
  uniform float moonGlow;
  uniform float stars;
  varying vec3 vDirection;
  varying vec3 vColor;
  varying float vSun;
  varying float vMoon;
  // A hash of a point (Dave Hoskins's "hash13", without a sine: the same on every GPU's precision).
  float hash(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  void main() {
    vec3 color = vColor;
    // Near the sun: its tight glow and its disc, 2.4° across (the real one is half a degree: larger, to
    // be seen). Powers as products: a power is a logarithm and an exponential.
    if (sunGlow > 0.0 && vSun > 0.92) {
      float s = max(dot(normalize(vDirection), sun), 0.0);
      float s2 = s * s;
      float s6 = s2 * s2 * s2;
      float s12 = s6 * s6;
      float s24 = s12 * s12;
      color += sunColor * 0.6 * s24 * s24 * s24 * s12 * s6 * sunGlow;
      color = mix(color, sunColor * 1.5 + 0.2, smoothstep(0.99974, 0.99982, s) * sunGlow);
    }
    // Near the moon: a pale disc 2° across and a faint halo, as it clears the horizon.
    if (moonGlow > 0.0 && vMoon > 0.92) {
      float m = dot(normalize(vDirection), moon);
      float m2 = m * m;
      float m6 = m2 * m2 * m2;
      float m12 = m6 * m6;
      color += vec3(0.6, 0.66, 0.8) * 0.12 * m12 * m12 * m12 * m12 * m12 * moonGlow;
      color = mix(color, vec3(0.86, 0.88, 0.94), smoothstep(0.99981, 0.99988, m) * moonGlow);
    }
    // At night, the stars: a few cells of a grid of directions, each its own brightness, fainter near the horizon.
    if (stars > 0.0 && vDirection.y > 0.0) {
      vec3 d = normalize(vDirection);
      vec3 p = d * 170.0;
      vec3 cell = floor(p);
      float h = hash(cell);
      if (h > 0.986) {
        vec3 at = cell + 0.5 + (vec3(hash(cell + 1.7), hash(cell + 3.1), hash(cell + 5.3)) - 0.5) * 0.6;
        float b = smoothstep(0.4, 0.0, length(p - at)) * (0.35 + 0.65 * (h - 0.986) / 0.014);
        color += vec3(0.9, 0.92, 1.0) * b * stars * smoothstep(0.0, 0.2, d.y);
      }
    }
    // A dither of half a step: an 8-bit gradient this smooth would show bands.
    color += (hash(vec3(gl_FragCoord.xy, 7.0)) - 0.5) / 255.0;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

/**
 * THE STAGE: the renderer, the scene with its lights (as much of them as the world's ambient light
 * says, stage 3d) and, if the level has one, its sky (stage 5a), and the camera, fitted to the element
 * it is in (and refitted when it changes size). Where the camera goes is the camera's piece. (Until
 * stage 3b it drew a grid too, 20 m square, under any level; now a floor is drawn as one, if it says so.)
 */
export function createStage(container: HTMLElement, quality: Tier = FLOOR): Stage {
  // The tier's resolution (the floor's: 1×, an integrated GPU like the Iris Plus struggles with 2×).
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(quality.pixelRatio);
  // What a frame may cost, said on the page (stage 5.5g): what the browser tests check against.
  container.dataset.quality = quality.name;
  container.dataset.budgetDraws = String(quality.budget.draws);
  container.dataset.budgetTriangles = String(quality.budget.triangles);
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  const flat = new THREE.Color(0x14161c);
  scene.background = flat.clone();
  let day = 1;
  let hour: number | null = null;
  let renderMs = 0;
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, farOf(null));
  // The scene's real lights, one owner (stage 5.5a): given out before each frame is drawn.
  const lights = createLightPool(scene, quality.lights);
  const fill = new THREE.HemisphereLight(0xc8d4ff, 0x3a3028, 1.4);
  scene.add(fill);
  const sun = new THREE.DirectionalLight(0xfff2e0, 1.8);
  sun.position.set(4, 8, 3);
  scene.add(sun);
  // (Stage 5j) The moonlight: always there (the scene's lights never change in number), lit only by the
  // atmosphere at night.
  const moonlight = new THREE.DirectionalLight(0x9fb4e8, 0);
  scene.add(moonlight);
  // One fog and one cool color, changed in place: the light changes with the day, every frame in a cycle.
  const fog = new THREE.Fog(0x000000, ATMOSPHERE.fog.day[0], ATMOSPHERE.fog.day[1]);
  const cool = new THREE.Color(ATMOSPHERE.coolFill);
  let atmosphere: Look | null = null;
  let glowOn = true;
  let composer: PostChain['composer'] | null = null;
  let bloom: PostChain['bloom'] | null = null;
  let vignette: PostChain['vignette'] | null = null;
  let scenePass: PostChain['scene'] | null = null;
  let drawn = { calls: 0, triangles: 0 };
  // (The counts, reset once a frame by the stage, not by each pass: stage 5j.)
  renderer.info.autoReset = false;
  // Without a sky, the background darkens with them: a dark room is dark all round, not only on what it lights.
  const night = new THREE.Color(0x07080b);

  const uniforms = {
    zenith: { value: new THREE.Color() },
    horizon: { value: new THREE.Color() },
    ground: { value: new THREE.Color() },
    sunColor: { value: new THREE.Color() },
    sun: { value: new THREE.Vector3(0, 1, 0) },
    moon: { value: new THREE.Vector3(0, -1, 0) },
    sunGlow: { value: 0 },
    moonGlow: { value: 0 },
    stars: { value: 0 },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(DOME, 64, 48),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  dome.name = 'sky';
  dome.frustumCulled = false;
  // After everything solid (before what is see-through, which shows the sky behind it).
  dome.renderOrder = 1000;
  dome.visible = false;
  scene.add(dome);

  /** A color as the sky gives it (sRGB, as written), into three's (linear: it converts it). */
  const rgb = (c: THREE.Color, v: Rgb) => c.setRGB(v[0], v[1], v[2], THREE.SRGBColorSpace);
  /** The lights and the background, from the day's light and the sky's hour. */
  const light = () => {
    scene.fog = null;
    moonlight.intensity = 0;
    renderer.toneMapping = atmosphere ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    const reach = (far: number) => {
      camera.far = far;
      camera.updateProjectionMatrix();
      dome.scale.setScalar(domeOf(far) / DOME);
      container.dataset.far = far.toFixed(0);
    };
    reach(farFor(null));
    renderer.toneMappingExposure = 1;
    delete container.dataset.fog;
    if (hour === null) {
      dome.visible = false;
      scene.background = (scene.background instanceof THREE.Color ? scene.background : flat.clone()).copy(night).lerp(flat, day);
      fill.color.setHex(0xc8d4ff);
      fill.groundColor.setHex(0x3a3028);
      fill.intensity = 1.4 * day;
      sun.color.setHex(0xfff2e0);
      sun.position.set(4, 8, 3);
      sun.intensity = 1.8 * day;
      return;
    }
    const look = skyAt(hour);
    dome.visible = true;
    scene.background = null;
    rgb(uniforms.zenith.value, look.zenith);
    rgb(uniforms.horizon.value, look.horizon);
    rgb(uniforms.ground.value, look.ground);
    rgb(uniforms.sunColor.value, look.sunColor);
    uniforms.sun.value.set(...look.sun);
    uniforms.moon.value.set(...look.moon);
    uniforms.sunGlow.value = look.sunGlow;
    uniforms.moonGlow.value = look.moonGlow;
    uniforms.stars.value = look.stars;
    // The lights: the hour's hues and way, as bright as the day's light says (the level's ambient,
    // what a watcher sees by too), at any hour. What the ground sends back up stays the ground's.
    rgb(fill.color, look.fill);
    fill.groundColor.setHex(0x3a3028);
    fill.intensity = 1.4 * day;
    rgb(sun.color, look.key.color);
    sun.position.set(look.key.from[0] * 10, look.key.from[1] * 10, look.key.from[2] * 10);
    sun.intensity = 1.8 * day * look.key.share;
    if (!atmosphere) return;
    // (Stage 5j) Dark, and readable: the fill does not go below a floor at night, turned cool; the moon
    // lights silhouettes; fog of the horizon's color, nearer at night; the exposure a little up.
    const n = nightOf(look.sun[1]);
    const a = atmosphere;
    cool.setHex(a.coolFill);
    fill.intensity = Math.max(fill.intensity, a.nightFill * n);
    fill.color.lerp(cool, 0.6 * n);
    moonlight.position.set(look.moon[0] * 10, Math.max(0.2, look.moon[1]) * 10, look.moon[2] * 10);
    moonlight.intensity = a.moonlight * n * (0.4 + 0.6 * look.moonGlow);
    rgb(fog.color, look.horizon).lerp(night, 0.4 * n);
    fog.near = a.fog.day[0] + (a.fog.night[0] - a.fog.day[0]) * n;
    fog.far = a.fog.day[1] + (a.fog.night[1] - a.fog.day[1]) * n;
    scene.fog = fog;
    container.dataset.fog = `${fog.near.toFixed(0)} ${fog.far.toFixed(0)}`;
    // The far plane from this fog, by the night's amount (stage 5.5g).
    reach(farFor(fog.far));
    renderer.toneMappingExposure = a.exposure.day + (a.exposure.night - a.exposure.day) * n;
  };
  // The camera's effects (`effects`): asked this frame, and the base pose they were applied over.
  const moves: { by: THREE.Vector3; weight: number }[] = [];
  const turns: { axis: 'x' | 'y' | 'z'; angle: number }[] = [];
  let taken: { position: THREE.Vector3; quaternion: THREE.Quaternion; priority: number } | null = null;
  /**
   * What was applied over the camera's base pose, to give it back at `settle`: the base pose itself if one took
   * the camera, else only what the moves added. (Not the turns: the camera piece turns the camera anew every
   * frame, as before. And not more: what moves it between frames, the wheel, a drag, the mouse aiming, stays.)
   */
  const base = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    moved: new THREE.Vector3(),
    applied: 'none' as 'none' | 'take' | 'moves',
  };
  const looking = new THREE.Matrix4();
  const effects: CameraEffects = {
    move: (by, weight = 1) => void moves.push({ by: by.clone(), weight }),
    turn: (axis, angle, weight = 1) => void turns.push({ axis, angle: angle * weight }),
    take(position, quaternion, priority) {
      if (!taken || priority > taken.priority) taken = { position: position.clone(), quaternion: quaternion.clone(), priority };
    },
    look(from, to, priority) {
      // (As a camera looks: along its −Z, its up the camera's.)
      const at = new THREE.Vector3(...from);
      effects.take(
        at,
        new THREE.Quaternion().setFromRotationMatrix(looking.lookAt(at, new THREE.Vector3(...to), camera.up)),
        priority,
      );
    },
  };
  /** Every effect asked, applied once over the camera's base pose (kept, to be given back at `settle`). */
  const applyEffects = () => {
    base.applied = 'none';
    if (taken) {
      base.position.copy(camera.position);
      base.quaternion.copy(camera.quaternion);
      base.applied = 'take';
      camera.position.copy(taken.position);
      camera.quaternion.copy(taken.quaternion);
    } else {
      base.moved.set(0, 0, 0);
      for (const m of moves) base.moved.addScaledVector(m.by, m.weight);
      if (moves.length) {
        camera.position.add(base.moved);
        base.applied = 'moves';
      }
      for (const t of turns)
        if (t.axis === 'x') camera.rotateX(t.angle);
        else if (t.axis === 'y') camera.rotateY(t.angle);
        else camera.rotateZ(t.angle);
    }
    moves.length = 0;
    turns.length = 0;
    taken = null;
  };
  // The place's light, worked out once a frame (`placeLight`): the frame it was for.
  const place = new THREE.Color();
  const part = new THREE.Color();
  let frames = 0;
  let placeFrame = -1;
  /** The finished image's passes (stage 5j; `post.ts` since 5.5a): made the first time the atmosphere is on. */
  const passes = () => {
    if (composer) return composer;
    const chain = createPostChain(renderer, scene, camera, { ...(atmosphere ?? ATMOSPHERE), samples: quality.samples });
    ({ composer, bloom, vignette } = chain);
    scenePass = chain.scene;
    bloom.enabled = glowOn;
    return composer;
  };

  const fitSize = () => {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height);
    composer?.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(fitSize);
  observer.observe(container);
  fitSize();
  light();
  container.dataset.sky = 'none';

  return {
    quality,
    renderer,
    scene,
    camera,
    lights,
    daylight(amount) {
      const a = Math.max(0, Math.min(1, amount));
      if (a === day) return;
      day = a;
      light();
    },
    sky(h) {
      if (h === hour) return;
      hour = h;
      container.dataset.sky = h === null ? 'none' : String(h);
      light();
    },
    atmosphere(on) {
      const look = on === true ? ATMOSPHERE : on === false ? null : on;
      if (look === atmosphere) return;
      atmosphere = look;
      container.dataset.atmosphere = look ? 'on' : 'off';
      if (look) passes();
      container.dataset.glow = look && glowOn ? 'on' : 'off';
      light();
    },
    glow(on) {
      glowOn = on;
      if (bloom) bloom.enabled = on;
      container.dataset.glow = on ? 'on' : 'off';
    },
    placeLight() {
      if (placeFrame === frames) return place;
      placeFrame = frames;
      place.copy(
        part
          .copy(fill.color)
          .lerp(fill.groundColor, 0.5)
          .multiplyScalar(fill.intensity * 0.7),
      );
      place.add(part.copy(sun.color).multiplyScalar(sun.intensity * 0.35));
      place.add(part.copy(moonlight.color).multiplyScalar(moonlight.intensity * 0.35));
      return place;
    },
    effects,
    settle() {
      if (base.applied === 'take') {
        camera.position.copy(base.position);
        camera.quaternion.copy(base.quaternion);
      } else if (base.applied === 'moves') camera.position.sub(base.moved);
      base.applied = 'none';
    },
    render() {
      frames++;
      applyEffects();
      const start = performance.now();
      lights.assign(camera);
      camera.getWorldPosition(dome.position);
      renderer.info.reset();
      if (atmosphere && composer && scenePass) {
        composer.render();
        drawn = scenePass.counted;
      } else {
        renderer.render(scene, camera);
        drawn = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
      }
      // A moving average over about 30 frames: one frame's time jitters too much to read.
      renderMs += (performance.now() - start - renderMs) / 30;
    },
    get renderMs() {
      return renderMs;
    },
    get drawn() {
      return drawn;
    },
    stop() {
      observer.disconnect();
      lights.dispose();
      bloom?.dispose();
      vignette?.dispose();
      composer?.dispose();
      dome.geometry.dispose();
      dome.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
