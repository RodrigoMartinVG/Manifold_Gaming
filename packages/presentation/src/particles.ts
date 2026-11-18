import * as THREE from 'three';

/**
 * PARTICLES (stage 5k, decision 0031: explosions far better): many small quads, each always facing the
 * camera, drawn in ONE call (an instanced geometry: the quad once, and per particle its place, size,
 * turn, color and kind). Two systems on a page: one that ADDS light (fire, flashes, sparks: where they
 * overlap they grow brighter, and the glow of 5j blooms them) and one that COVERS (smoke, dust, a scorch:
 * drawn far to near, so the nearer covers the farther, and lit by the place: its colors times the
 * place's light, which a blast's flash raises for an instant). Each particle moves on its own (its velocity, a
 * drag, a gravity, negative to rise as hot smoke does), and over its life goes through its color stops
 * and from its first size to its last. Only the view: the world never knows.
 *
 * The kinds, drawn in the fragment shader (no textures to load):
 *   0 a PUFF: a soft disc with a ragged edge, from two octaves of value noise (fire, smoke, dust);
 *   1 a SPARK: a streak along its own velocity on the screen, as long as `stretch` seconds of it;
 *   2 a FLASH: a bright core and a few rays (a muzzle's, a blast's first instant);
 *   3 a RING: flat on the ground (the blast's shock running along the floor);
 *   4 a SCORCH: flat on the ground, a dark ragged disc that stays.
 */
export type ParticleKind = 'puff' | 'spark' | 'flash' | 'ring' | 'scorch';
const KINDS: Record<ParticleKind, number> = { puff: 0, spark: 1, flash: 2, ring: 3, scorch: 4 };

/** A color stop over a particle's life: at `t` (0 its birth, 1 its end), this color (linear, may be over 1: it glows) and this opacity. */
export type Stop = readonly [t: number, r: number, g: number, b: number, a: number];

export interface ParticleSpec {
  kind: ParticleKind;
  at: THREE.Vector3;
  velocity?: THREE.Vector3;
  /** How long it lives (s), and how long it waits before it shows (s). */
  life: number;
  delay?: number;
  /** Its size (m across) at birth and at its end; eased out (fast first) unless `linear`. */
  size: readonly [number, number];
  linear?: boolean;
  stops: readonly Stop[];
  /** How quickly its velocity dies (per second), and the gravity on it (m/s², down; negative rises). */
  drag?: number;
  gravity?: number;
  /** Its turn, and how fast it turns (rad, rad/s). */
  turn?: number;
  spin?: number;
  /** A spark's streak: as long as this many seconds of its velocity. */
  stretch?: number;
}

interface Particle extends Required<Omit<ParticleSpec, 'velocity' | 'at'>> {
  at: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  seed: number;
}

const VERTEX = /* glsl */ `
attribute vec3 offset;
attribute vec4 tint;
attribute vec4 shape; // size, turn, kind, seed
attribute vec3 streak;
varying vec2 vUv;
varying vec4 vTint;
varying float vKind;
varying float vSeed;
#include <fog_pars_vertex>
void main() {
  vUv = position.xy + 0.5;
  vTint = tint;
  vKind = shape.z;
  vSeed = shape.w;
  vec4 mvPosition;
  if (shape.z > 2.5) {
    // Flat on the ground.
    float c = cos(shape.y), s = sin(shape.y);
    vec2 p = mat2(c, s, -s, c) * position.xy * shape.x;
    mvPosition = modelViewMatrix * vec4(offset + vec3(p.x, 0.0, p.y), 1.0);
  } else {
    mvPosition = modelViewMatrix * vec4(offset, 1.0);
    vec2 corner;
    if (shape.z > 0.5 && shape.z < 1.5) {
      // A streak: along its velocity as the screen sees it.
      vec4 end = modelViewMatrix * vec4(offset - streak, 1.0);
      vec2 d = mvPosition.xy - end.xy;
      float len = length(d);
      vec2 along = len > 1e-5 ? d / len : vec2(1.0, 0.0);
      vec2 across = vec2(-along.y, along.x);
      corner = along * position.x * (shape.x + len) + across * position.y * shape.x;
      mvPosition.xy -= d * 0.5;
    } else {
      float c = cos(shape.y), s = sin(shape.y);
      corner = mat2(c, s, -s, c) * position.xy * shape.x;
    }
    mvPosition.xy += corner;
  }
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 light;
varying vec2 vUv;
varying vec4 vTint;
varying float vKind;
varying float vSeed;
#include <fog_pars_fragment>
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float a;
  vec3 color = vTint.rgb;
  if (vKind < 0.5 || vKind > 3.5) {
    // A puff (or a scorch): a soft disc, its edge ragged by noise.
    float n = 0.65 * noise(p * 2.3 + vSeed * 17.0) + 0.35 * noise(p * 5.1 + vSeed * 29.0);
    a = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.7);
    // Denser towards its middle: a little darker there, not a flat disc.
    color *= mix(0.75, 1.0, smoothstep(0.0, 0.8, r + 0.3 * n));
  } else if (vKind < 1.5) {
    a = smoothstep(1.0, 0.0, abs(p.y)) * smoothstep(1.0, 0.5, abs(p.x));
  } else if (vKind < 2.5) {
    float angle = atan(p.y, p.x);
    float rays = pow(abs(cos(angle * 2.5 + vSeed * 6.28)), 16.0) * exp(-r * 2.2);
    a = clamp(exp(-r * r * 7.0) + 0.8 * rays, 0.0, 1.0);
  } else {
    // A ring: a band near its edge.
    a = smoothstep(0.22, 0.0, abs(r - 0.78)) * smoothstep(1.0, 0.95, r);
  }
  #ifdef COVERS
  color *= light;
  #endif
  gl_FragColor = vec4(color, vTint.a * a);
  if (gl_FragColor.a < 0.003) discard;
  #ifdef USE_FOG
  #ifdef FOG_EXP2
  float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
  #else
  float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  #ifdef COVERS
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
  #else
  // Light in fog fades out; it does not turn into fog.
  gl_FragColor.a *= 1.0 - fogFactor;
  #endif
  #endif
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** A system of particles: what it holds, made into one draw. */
export interface Particles {
  readonly mesh: THREE.Mesh;
  /** How many live now. */
  readonly count: number;
  spawn(p: ParticleSpec): void;
  /** Moves them, ages them, and writes them for the frame, as `camera` sees them. */
  update(dt: number, camera: THREE.Camera): void;
  /** The place's light (what lit particles are multiplied by). */
  light(color: THREE.Color): void;
  clear(): void;
  dispose(): void;
}

/** Eased out: fast first, then slowly (a blast's ball grows at once, then hardly). */
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);

/** The color and opacity at `t` of a list of stops (between two, in a straight line). */
export function colorAt(
  stops: readonly Stop[],
  t: number,
  out: [number, number, number, number],
): [number, number, number, number] {
  let i = 0;
  while (i < stops.length - 1 && stops[i + 1]![0] < t) i++;
  const a = stops[i]!;
  const b = stops[Math.min(stops.length - 1, i + 1)]!;
  const span = b[0] - a[0];
  const k = span > 1e-9 ? Math.max(0, Math.min(1, (t - a[0]) / span)) : 0;
  for (let j = 0; j < 4; j++) out[j] = a[j + 1]! + (b[j + 1]! - a[j + 1]!) * k;
  return out;
}

/**
 * A system of up to `capacity` particles: `adds` light (fire, sparks), or covers (smoke, dust). When it is
 * full, a new one takes the place of the oldest.
 */
export function createParticles(capacity: number, adds: boolean): Particles {
  const geometry = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geometry.index = quad.index;
  geometry.setAttribute('position', quad.getAttribute('position'));
  const offset = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const shape = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const streak = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('offset', offset);
  geometry.setAttribute('tint', tint);
  geometry.setAttribute('shape', shape);
  geometry.setAttribute('streak', streak);
  geometry.instanceCount = 0;
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { light: { value: new THREE.Color(1, 1, 1) } }]),
    defines: adds ? {} : { COVERS: '' },
    transparent: true,
    depthWrite: false,
    blending: adds ? THREE.AdditiveBlending : THREE.NormalBlending,
    fog: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  // Its quads are placed by the shader: the base quad's bounds say nothing about where they are.
  mesh.frustumCulled = false;
  // Light over smoke: drawn after the smoke.
  mesh.renderOrder = adds ? 11 : 10;
  const live: Particle[] = [];
  const color: [number, number, number, number] = [0, 0, 0, 0];
  const order: number[] = [];
  const depth: number[] = [];
  const view = new THREE.Vector3();
  let seed = 0;

  return {
    mesh,
    get count() {
      return live.length;
    },
    spawn(p) {
      if (live.length >= capacity) live.shift();
      live.push({
        kind: p.kind,
        at: p.at.clone(),
        velocity: p.velocity?.clone() ?? new THREE.Vector3(),
        life: p.life,
        delay: p.delay ?? 0,
        size: p.size,
        linear: p.linear ?? false,
        stops: p.stops,
        drag: p.drag ?? 0,
        gravity: p.gravity ?? 0,
        turn: p.turn ?? Math.random() * Math.PI * 2,
        spin: p.spin ?? 0,
        stretch: p.stretch ?? 0,
        age: 0,
        seed: (seed = (seed + 0.6180339887) % 1),
      });
    },
    update(dt, camera) {
      for (let i = live.length - 1; i >= 0; i--) {
        const p = live[i]!;
        p.age += dt;
        if (p.age >= p.delay + p.life) {
          live.splice(i, 1);
          continue;
        }
        if (p.age < p.delay) continue;
        if (p.drag > 0) p.velocity.multiplyScalar(Math.exp(-p.drag * dt));
        p.velocity.y -= p.gravity * dt;
        p.at.addScaledVector(p.velocity, dt);
        p.turn += p.spin * dt;
      }
      // Drawn far to near, for what covers (the nearer smoke over the farther).
      order.length = 0;
      for (let i = 0; i < live.length; i++) if (live[i]!.age >= live[i]!.delay) order.push(i);
      if (!adds) {
        depth.length = live.length;
        for (const i of order) depth[i] = view.copy(live[i]!.at).applyMatrix4(camera.matrixWorldInverse).z;
        order.sort((a, b) => depth[a]! - depth[b]!);
      }
      let n = 0;
      for (const i of order) {
        const p = live[i]!;
        const t = (p.age - p.delay) / p.life;
        colorAt(p.stops, t, color);
        const grown = p.linear ? t : easeOut(t);
        offset.setXYZ(n, p.at.x, p.at.y, p.at.z);
        tint.setXYZW(n, color[0], color[1], color[2], color[3]);
        shape.setXYZW(n, p.size[0] + (p.size[1] - p.size[0]) * grown, p.turn, KINDS[p.kind], p.seed);
        streak.setXYZ(n, p.velocity.x * p.stretch, p.velocity.y * p.stretch, p.velocity.z * p.stretch);
        n++;
      }
      geometry.instanceCount = n;
      mesh.visible = n > 0;
      if (n > 0) {
        for (const a of [offset, tint, shape, streak]) {
          a.clearUpdateRanges();
          a.addUpdateRange(0, n * a.itemSize);
          a.needsUpdate = true;
        }
      }
    },
    light(c) {
      (material.uniforms.light!.value as THREE.Color).copy(c);
    },
    clear() {
      live.length = 0;
      geometry.instanceCount = 0;
      mesh.visible = false;
    },
    dispose() {
      geometry.dispose();
      quad.dispose();
      material.dispose();
    },
  };
}
