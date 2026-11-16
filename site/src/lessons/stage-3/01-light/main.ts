import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { createScene } from './scene';
import { blocked, lightAt, transmission, type Box, type Lamp } from './light';

const { scene, onFrame } = createScene({ camera: [0, 13, 9], target: [0, 0, 0] });

// THE ROOM: a pillar (solid: it casts a shadow, and hides), a bank of fog (it lets a part through).
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const pillar: Box = { min: v(-0.6, 0, -0.6), max: v(0.6, 3, 0.6) };
const fog = { box: { min: v(2, 0, -4), max: v(5, 1.2, 4) }, opacity: 1 };
const drawBox = (b: Box, material: THREE.Material) => {
  const size = b.max.clone().sub(b.min);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
  mesh.position.copy(b.min).addScaledVector(size, 0.5);
  scene.add(mesh);
  return mesh;
};
drawBox(pillar, new THREE.MeshStandardMaterial({ color: 0x6f6a62 }));
const fogMesh = drawBox(
  fog.box,
  new THREE.MeshBasicMaterial({
    color: 0xb8c0c8,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  }),
);

// THE LAMPS: where, how far they reach, how bright at their center. (What is drawn of them, a ball and a
// three.js light, only shows: the simulation reads `lightAt`.)
const lamps: Lamp[] = [
  { at: v(-3.5, 2.5, 2.5), radius: 6, intensity: 1, on: true },
  { at: v(3.5, 2.5, -2.5), radius: 6, intensity: 1, on: true },
  { at: v(0, 2.5, 4.5), radius: 5, intensity: 0.8, on: true },
];
const lampMeshes = lamps.map((l) => {
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.18),
    new THREE.MeshBasicMaterial({ color: 0xffd27a }),
  );
  ball.position.copy(l.at);
  const light = new THREE.PointLight(0xffd27a, 6, l.radius * 1.5);
  light.position.copy(l.at);
  scene.add(ball, light);
  return { ball, light };
});

// THE WATCHER: an eye that looks along a direction, as far as its range, within its field of view, and
// sees what looks lit at least its threshold, with nothing in between.
const eye = { at: v(0, 1.6, -5), look: v(0, 0, 1), range: 11, degrees: 70, threshold: 0.35 };
const eyeMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.25),
  new THREE.MeshBasicMaterial({ color: 0x9a4a4a }),
);
eyeMesh.position.copy(eye.at);
scene.add(eyeMesh);

// THE CHARACTER: it walks a loop around the pillar and through the fog, by itself.
const hero = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.3, 1),
  new THREE.MeshStandardMaterial({ color: 0x93d9c9 }),
);
scene.add(hero);
const at = v(0, 0.8, 0);

// The rays, from each lamp to the character (yellow: it lights it; red: something is in the way) and
// from the eye (green while it sees).
const rays = lamps.map(
  () =>
    new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffd27a })),
);
const sight = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0x98c379 }),
);
scene.add(...rays, sight);

const settings = { ambient: 0.08, 'fog opacity': 1, 'lamp 2 on': true, walking: true };
const shown = { light: 0, seen: false, 'lamp 1': 0, 'lamp 2': 0, 'lamp 3': 0 };
const gui = new GUI({ title: 'the light' });
gui.add(settings, 'ambient', 0, 1, 0.01);
gui.add(settings, 'fog opacity', 0, 4, 0.1);
gui.add(settings, 'lamp 2 on');
gui.add(settings, 'walking');
gui.add(shown, 'light').disable().listen();
gui.add(shown, 'seen').disable().listen();
const parts = gui.addFolder('each lamp');
for (const name of ['lamp 1', 'lamp 2', 'lamp 3'] as const)
  parts.add(shown, name).disable().listen();

let time = 0;
onFrame((dt) => {
  if (settings.walking) time += dt;
  // A figure of eight around the pillar, through the fog.
  at.set(Math.sin(time * 0.5) * 4, 0.8, Math.sin(time) * 3);
  hero.position.copy(at);
  fog.opacity = settings['fog opacity'];
  fogMesh.visible = fog.opacity > 0;
  lamps[1]!.on = settings['lamp 2 on'];
  lampMeshes[1]!.light.visible = lamps[1]!.on;
  (lampMeshes[1]!.ball.material as THREE.MeshBasicMaterial).color.set(
    lamps[1]!.on ? 0xffd27a : 0x3a3428,
  );

  // How lit the character is, at its center.
  const lit = lightAt(at, settings.ambient, lamps, [pillar], [fog]);
  shown.light = +lit.light.toFixed(3);
  lit.parts.forEach((p, i) => (shown[`lamp ${i + 1}` as 'lamp 1'] = +p.toFixed(3)));
  lamps.forEach((l, i) => {
    rays[i]!.geometry.setFromPoints([l.at, at]);
    rays[i]!.visible = l.on && l.at.distanceTo(at) < l.radius;
    (rays[i]!.material as THREE.LineBasicMaterial).color.set(
      lit.parts[i]! > 0 ? 0xffd27a : 0xe06c75,
    );
  });

  // Whether the eye sees it: in range, in its field of view, nothing in between, and lit enough as seen
  // from there (through the fog too).
  const to = at.clone().sub(eye.at);
  const inView =
    to.length() < eye.range &&
    to.clone().normalize().dot(eye.look) >= Math.cos(((eye.degrees / 2) * Math.PI) / 180);
  const looks = lit.light * transmission(eye.at, at, [fog]);
  shown.seen = inView && !blocked(eye.at, at, [pillar]) && looks >= eye.threshold;
  sight.geometry.setFromPoints([eye.at, at]);
  sight.visible = shown.seen;
  (eyeMesh.material as THREE.MeshBasicMaterial).color.set(shown.seen ? 0xff4040 : 0x9a4a4a);
});
