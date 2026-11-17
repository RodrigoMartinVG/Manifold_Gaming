import * as THREE from 'three';
import type { Stage } from './page';
import { skyAt, type Rgb } from './sky';

/** The sky's dome (m): inside the camera's far plane (200), wherever the camera goes. */
const DOME = 150;

/**
 * THE SKY'S DOME (stage 5a): a sphere round the camera, painted from inside by `skyAt`'s look. Up, from
 * the horizon's color to the zenith's (quickly near the horizon, as a real sky); down, the ground's; the
 * sun's glow round it and its disc, the moon's, and the stars, each a cell of a grid of directions that
 * a hash lights or not (they stay where they are as the camera turns). Drawn first, and nothing is
 * hidden behind it.
 */
const SKY_VERTEX = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 zenith;
  uniform vec3 horizon;
  uniform vec3 ground;
  uniform vec3 sunColor;
  uniform vec3 sun;
  uniform vec3 moon;
  uniform float sunGlow;
  uniform float moonGlow;
  uniform float stars;
  varying vec3 vDirection;
  // A hash of a point (Dave Hoskins's "hash13", without a sine: the same on every GPU's precision).
  float hash(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  void main() {
    vec3 d = normalize(vDirection);
    float up = d.y;
    vec3 color = mix(horizon, zenith, sqrt(clamp(up, 0.0, 1.0)));
    // The sun's glow, wide and then tight round it; its disc, 2.4° across (the real one is half a degree: larger, to be seen).
    float s = max(dot(d, sun), 0.0);
    color += sunColor * (0.3 * pow(s, 6.0) + 0.6 * pow(s, 90.0)) * sunGlow;
    color = mix(color, sunColor * 1.5 + 0.2, smoothstep(0.99974, 0.99982, s) * sunGlow);
    // The moon: a pale disc 2° across and a faint halo, as it clears the horizon.
    float m = max(dot(d, moon), 0.0);
    color += vec3(0.6, 0.66, 0.8) * 0.12 * pow(m, 60.0) * moonGlow;
    color = mix(color, vec3(0.86, 0.88, 0.94), smoothstep(0.99981, 0.99988, m) * moonGlow);
    // The stars: a few cells of a grid of directions, each its own brightness, fainter near the horizon.
    if (stars > 0.0 && up > 0.0) {
      vec3 p = d * 170.0;
      vec3 cell = floor(p);
      float h = hash(cell);
      if (h > 0.986) {
        vec3 at = cell + 0.5 + (vec3(hash(cell + 1.7), hash(cell + 3.1), hash(cell + 5.3)) - 0.5) * 0.6;
        float b = smoothstep(0.4, 0.0, length(p - at)) * (0.35 + 0.65 * (h - 0.986) / 0.014);
        color += vec3(0.9, 0.92, 1.0) * b * stars * smoothstep(0.0, 0.2, up);
      }
    }
    // Under the horizon, the ground's color, with a soft edge.
    color = mix(color, ground, smoothstep(0.0, -0.06, up));
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
export function createStage(container: HTMLElement): Stage {
  // 1× resolution (an integrated GPU, like the Iris Plus, struggles with 2×: four times the pixels).
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  const flat = new THREE.Color(0x14161c);
  scene.background = flat.clone();
  let day = 1;
  let hour: number | null = null;
  let renderMs = 0;
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 200);
  const fill = new THREE.HemisphereLight(0xc8d4ff, 0x3a3028, 1.4);
  scene.add(fill);
  const sun = new THREE.DirectionalLight(0xfff2e0, 1.8);
  sun.position.set(4, 8, 3);
  scene.add(sun);
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
    new THREE.SphereGeometry(DOME, 48, 24),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
    }),
  );
  dome.name = 'sky';
  dome.frustumCulled = false;
  dome.renderOrder = -1;
  dome.visible = false;
  scene.add(dome);

  /** A color as the sky gives it (sRGB, as written), into three's (linear: it converts it). */
  const rgb = (c: THREE.Color, v: Rgb) => c.setRGB(v[0], v[1], v[2], THREE.SRGBColorSpace);
  /** The lights and the background, from the day's light and the sky's hour. */
  const light = () => {
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
  };

  const fitSize = () => {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(fitSize);
  observer.observe(container);
  fitSize();
  light();
  container.dataset.sky = 'none';

  return {
    renderer,
    scene,
    camera,
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
    render() {
      const start = performance.now();
      camera.getWorldPosition(dome.position);
      renderer.render(scene, camera);
      // A moving average over about 30 frames: one frame's time jitters too much to read.
      renderMs += (performance.now() - start - renderMs) / 30;
    },
    get renderMs() {
      return renderMs;
    },
    stop() {
      observer.disconnect();
      dome.geometry.dispose();
      dome.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
