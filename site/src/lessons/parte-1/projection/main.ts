import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { createScene } from './scene';
import { createLabels, createPicture } from './overlay';
import {
  depthOf,
  fromEye,
  halfHeight,
  horizontalFov,
  normalized,
  onPlane,
  toPixels,
  vanishingPoint,
  type Flat,
  type Point,
} from './projection';

// THE FIGURE, seen from behind the eye and to its left. The camera looks at a point to the right
// of it, so the figure stays left of the panel. Drag to look around.
const { scene, camera, controls, onFrame } = createScene({
  camera: [-3.31, 2.38, 4.34],
  target: [0.65, 0.5, 1.01],
});
camera.layers.enable(1); // the figure (layer 1) too; the eye's own picture shows only the world
const { label, place } = createLabels(camera);

// THE EYE, at E, not turned: it looks along −Z. Its image plane is 1 m in front of it.
const EYE: Point = { x: 0, y: 1, z: 2 };
const eyeAt = new THREE.Vector3(EYE.x, EYE.y, EYE.z);
/** A point of the image plane (x', y' from its center) as a point of the world. */
const atPlane = (q: Flat) => new THREE.Vector3(EYE.x + q.x, EYE.y + q.y, EYE.z - 1);

// THE PANEL
const PICTURES: Record<string, [number, number]> = {
  '800 × 450': [800, 450],
  '1600 × 900': [1600, 900],
  '600 × 600': [600, 600],
  '450 × 800': [450, 800],
};
const settings = {
  autopilot: true,
  'point x (m)': 0,
  'point y (m)': 1.63,
  'point z (m)': -1.5,
  'vertical fov (°)': 55,
  'picture (px)': '800 × 450',
  'rails turn (°)': 20,
};
const shown = {
  'from the eye (m)': '',
  'depth d (m)': 0,
  'on the plane': '',
  'normalized u, v': '',
  'our pixel': '',
  'three.js pixel': '',
  'vanishing point': '',
  'horizontal fov (°)': 0,
};
const byHand = () => {
  settings.autopilot = false;
};
const gui = new GUI({ title: 'the projection' });
gui.add(settings, 'autopilot').listen();
gui.add(settings, 'point x (m)', -3, 3, 0.01).listen().onChange(byHand);
gui.add(settings, 'point y (m)', 0, 3, 0.01).listen().onChange(byHand);
gui.add(settings, 'point z (m)', -8, 3, 0.01).listen().onChange(byHand);
gui.add(settings, 'vertical fov (°)', 20, 120, 1);
gui.add(settings, 'picture (px)', Object.keys(PICTURES));
gui.add(settings, 'rails turn (°)', -35, 35, 1);
gui.add(shown, 'from the eye (m)').disable().listen();
gui.add(shown, 'depth d (m)').disable().listen();
gui.add(shown, 'on the plane').disable().listen();
gui.add(shown, 'normalized u, v').disable().listen();
gui.add(shown, 'our pixel').disable().listen();
gui.add(shown, 'three.js pixel').disable().listen();
gui.add(shown, 'vanishing point').disable().listen();
gui.add(shown, 'horizontal fov (°)').disable().listen();

/** LINES OF THE FIGURE (layer 1), always with as many points; call what it returns to move them. */
function lines(color: number, o: { opacity?: number; dashed?: boolean; pairs?: boolean } = {}) {
  const material = o.dashed
    ? new THREE.LineDashedMaterial({ color, dashSize: 0.08, gapSize: 0.06 })
    : new THREE.LineBasicMaterial({ color });
  material.transparent = true;
  material.opacity = o.opacity ?? 1;
  const geometry = new THREE.BufferGeometry();
  const object = o.pairs
    ? new THREE.LineSegments(geometry, material)
    : new THREE.Line(geometry, material);
  object.layers.set(1);
  object.frustumCulled = false; // its points move; the bounds measured once would not
  scene.add(object);
  return (points: THREE.Vector3[]) => {
    geometry.setFromPoints(points);
    if (o.dashed) object.computeLineDistances();
  };
}
/** A small ball of the figure (layer 1), lit or not. */
function ball(radius: number, color: number) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 8),
    new THREE.MeshBasicMaterial({ color }),
  );
  mesh.layers.set(1);
  scene.add(mesh);
  return mesh;
}

// THE EYE, a small white ball, and THE IMAGE PLANE, 1 m in front of it: as tall as the field of
// view lets in, as wide as the picture's proportions say.
const BLUE = 0x9fc2e8;
ball(0.06, 0xf2ece0).position.copy(eyeAt);
label('eye').at.copy(eyeAt);
const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({
    color: 0x7aa2d0,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
);
plane.position.copy(atPlane({ x: 0, y: 0 }));
plane.layers.set(1);
scene.add(plane);
const outline = lines(BLUE);
const pyramid = lines(BLUE, { opacity: 0.35, pairs: true }); // from the eye to the corners
const planeLabel = label('image plane, 1 m');

// TWO POSTS, 1 m tall, at 2.5 m and 5 m in front of the eye: the far one, twice as far. Their
// lines to the eye, top and bottom, and their pictures on the plane: the far one, half as tall.
const TEAL = 0x93d9c9;
for (const depth of [2.5, 5]) {
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 1, 12),
    new THREE.MeshStandardMaterial({ color: TEAL }),
  );
  post.position.set(-1.3, 0.5, EYE.z - depth);
  scene.add(post);
  const bottom: Point = { x: -1.3, y: 0, z: EYE.z - depth };
  const top: Point = { x: -1.3, y: 1, z: EYE.z - depth };
  const rays = lines(TEAL, { opacity: 0.35 });
  rays([new THREE.Vector3(top.x, top.y, top.z), eyeAt, new THREE.Vector3(bottom.x, 0, bottom.z)]);
  const image = lines(TEAL);
  const ends = [onPlane(fromEye(bottom, EYE)), onPlane(fromEye(top, EYE))];
  image(ends.flatMap((q) => (q ? [atPlane(q)] : [])));
}

// TWO RAILS on the floor, parallel and 1 m apart, from 2.5 m in front of the eye to 40 m farther.
// Turned `rails turn` (α) from −Z, they go along w = (sin α, 0, −cos α): per meter along them,
// sin α of x and −cos α of z.
const VIOLET = 0xc678dd;
const RAIL = 40;
// Where they start, between the two; y is the rails' middle, 2.5 cm up.
const START = { x: 0.6, y: 0.025, z: EYE.z - 2.5 };
const rails = [-0.5, 0.5].map((side) => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.05, RAIL),
    new THREE.MeshStandardMaterial({ color: VIOLET }),
  );
  scene.add(mesh);
  return { side, mesh, image: lines(VIOLET), onward: lines(VIOLET, { dashed: true }) };
});
const railRays = lines(VIOLET, { opacity: 0.35, pairs: true }); // from the eye to each rail's start
const parallel = lines(VIOLET, { dashed: true, opacity: 0.6 }); // from the eye, along the rails
const vanishing = new THREE.Mesh(
  new THREE.RingGeometry(0.025, 0.045, 24),
  new THREE.MeshBasicMaterial({ color: 0xf0d0ff, side: THREE.DoubleSide }),
);
vanishing.layers.set(1);
scene.add(vanishing);
const vanishingLabel = label('vanishing point');

// THE POINT P, which the autopilot moves (drag it, or use the sliders); its line to the eye; and
// P′, where that line crosses the image plane.
const GOLD = 0xe5c07b;
const point = new THREE.Mesh(
  new THREE.SphereGeometry(0.08, 24, 12),
  new THREE.MeshStandardMaterial({ color: GOLD, emissive: 0x4a3510 }),
);
scene.add(point);
const pointLabel = label('P');
const ray = lines(GOLD);
const drop = lines(GOLD, { dashed: true, opacity: 0.5 }); // down to the floor, to see where it is
const dot = ball(0.025, GOLD);
const dotLabel = label('P′');

// THREE.JS'S OWN CAMERA, at the eye, with the same field of view and picture: its numbers (its
// matrices), to compare with ours, and the picture in the corner.
const photo = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 100);
photo.position.copy(eyeAt);
photo.updateMatrixWorld();
const picture = createPicture(scene, photo);

// DRAGGING P, on the horizontal plane at its height: x and z change (y, with its slider). While
// dragging, the camera does not turn.
const raycaster = new THREE.Raycaster();
const level = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
let dragging = false;
function aim(e: PointerEvent) {
  const at = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, 1 - (e.clientY / innerHeight) * 2);
  raycaster.setFromCamera(at, camera);
  return raycaster.ray;
}
const onPoint = (e: PointerEvent) =>
  e.target === controls.domElement && aim(e).distanceToPoint(point.position) < 0.25;
addEventListener(
  'pointerdown',
  (e) => {
    if (!onPoint(e)) return;
    dragging = true;
    controls.enabled = false;
    settings.autopilot = false;
    level.constant = -point.position.y;
  },
  true, // before the camera's controls see it
);
addEventListener('pointermove', (e) => {
  if (!dragging) {
    document.body.style.cursor = onPoint(e) ? 'grab' : '';
    return;
  }
  if (!aim(e).intersectPlane(level, hit)) return;
  settings['point x (m)'] = THREE.MathUtils.clamp(hit.x, -3, 3);
  settings['point z (m)'] = THREE.MathUtils.clamp(hit.z, -8, 3);
});
addEventListener('pointerup', () => {
  dragging = false;
  controls.enabled = true;
});

/** Two numbers, as the panel shows them. */
const pair = (a: number, b: number, digits: number) => `${a.toFixed(digits)}, ${b.toFixed(digits)}`;

let time = 0;
onFrame((dt) => {
  // THE AUTOPILOT: P wanders from 2 m to 5 m in front of the eye, side to side, up and down.
  if (settings.autopilot) {
    time += dt;
    settings['point x (m)'] = 0.9 * Math.sin(0.37 * time);
    settings['point y (m)'] = 1.25 + 0.45 * Math.sin(0.53 * time + 1);
    settings['point z (m)'] = -1.5 - 1.5 * Math.sin(0.23 * time);
  }
  const P: Point = {
    x: settings['point x (m)'],
    y: settings['point y (m)'],
    z: settings['point z (m)'],
  };
  const [W, H] = PICTURES[settings['picture (px)']] ?? [800, 450];
  const fov = settings['vertical fov (°)'];
  const aspect = W / H;
  const h = halfHeight(fov);

  // THE IMAGE PLANE: 2h tall, 2ah wide.
  plane.scale.set(2 * aspect * h, 2 * h, 1);
  const topLeft = atPlane({ x: -aspect * h, y: h });
  const topRight = atPlane({ x: aspect * h, y: h });
  const bottomRight = atPlane({ x: aspect * h, y: -h });
  const bottomLeft = atPlane({ x: -aspect * h, y: -h });
  outline([topLeft, topRight, bottomRight, bottomLeft, topLeft]);
  pyramid([eyeAt, topLeft, eyeAt, topRight, eyeAt, bottomRight, eyeAt, bottomLeft]);
  planeLabel.at.copy(topLeft);

  // P, STEP BY STEP: seen from the eye, its depth, on the plane, normalized, in pixels.
  const c = fromEye(P, EYE);
  const d = depthOf(c);
  const q = onPlane(c); // null if it is not in front of the eye
  const n = q && normalized(q, fov, aspect);
  const pixel = n && toPixels(n, W, H);
  point.position.set(P.x, P.y, P.z);
  pointLabel.at.copy(point.position);
  drop([point.position, new THREE.Vector3(P.x, 0, P.z)]);
  dot.visible = q !== null;
  dotLabel.element.hidden = q === null;
  if (q) {
    dot.position.copy(atPlane(q));
    dotLabel.at.copy(dot.position);
    // The line from the eye goes to P; on to the plane, if P is nearer than it.
    ray([eyeAt, d >= 1 ? point.position : dot.position]);
  } else ray([eyeAt, point.position]);

  // THE RAILS: where they are, their pictures on the plane, and where those meet. The direction
  // w is the same seen from the eye: subtracting E from every point changes no difference.
  const turn = (settings['rails turn (°)'] * Math.PI) / 180;
  const w = { x: Math.sin(turn), y: 0, z: -Math.cos(turn) };
  const vp = vanishingPoint(w);
  const starts: THREE.Vector3[] = [];
  for (const rail of rails) {
    // Each rail starts half a meter to one side, across the rails: (cos α, 0, sin α).
    const start = {
      x: START.x + rail.side * Math.cos(turn),
      y: START.y,
      z: START.z + rail.side * Math.sin(turn),
    };
    starts.push(eyeAt, new THREE.Vector3(start.x, start.y, start.z));
    rail.mesh.position.set(start.x + (w.x * RAIL) / 2, start.y, start.z + (w.z * RAIL) / 2);
    rail.mesh.rotation.y = -turn;
    // Its picture: 30 of its points, each one projected (closer together far away, where they crowd).
    const image: THREE.Vector3[] = [];
    let far = eyeAt;
    for (let k = 0; k < 30; k++) {
      const t = RAIL * (k / 29) ** 2;
      const r = onPlane(fromEye({ x: start.x + t * w.x, y: start.y, z: start.z + t * w.z }, EYE));
      if (!r) continue;
      far = atPlane(r);
      image.push(far);
    }
    rail.image(image);
    if (vp) rail.onward([far, atPlane(vp)]); // on, towards where it is going
  }
  railRays(starts);
  if (vp) {
    vanishing.position.copy(atPlane(vp));
    vanishingLabel.at.copy(vanishing.position);
    parallel([eyeAt, eyeAt.clone().add(new THREE.Vector3(w.x, w.y, w.z).multiplyScalar(RAIL))]);
  }

  // THE SAME, BY THREE.JS: its camera at the eye, with this field of view and this picture.
  photo.fov = fov;
  photo.aspect = aspect;
  photo.updateProjectionMatrix();
  const ndc = point.position.clone().project(photo);
  const theirs = { x: ((ndc.x + 1) / 2) * W, y: ((1 - ndc.y) / 2) * H };

  // THE PICTURE, in the corner: three.js's, with OUR marks on it. The dashed line is the horizon
  // (v = 0, the eye's height), where every horizontal line vanishes.
  picture.take(W, H);
  picture.line({ x: 0, y: H / 2 }, { x: W, y: H / 2 }, '#8a8070', true);
  if (vp) picture.ring(toPixels(normalized(vp, fov, aspect), W, H), '#e0b0f0', 4);
  if (pixel) picture.ring(pixel, '#e5c07b');

  shown['from the eye (m)'] = `${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)}`;
  shown['depth d (m)'] = +d.toFixed(2);
  shown['on the plane'] = q ? pair(q.x, q.y, 4) : 'behind the eye';
  shown['normalized u, v'] = n ? pair(n.u, n.v, 4) : 'behind the eye';
  shown['our pixel'] = pixel ? pair(pixel.x, pixel.y, 1) : 'behind the eye';
  shown['three.js pixel'] = pair(theirs.x, theirs.y, 1);
  shown['vanishing point'] = vp ? pair(vp.x, vp.y, 4) : 'none';
  shown['horizontal fov (°)'] = +horizontalFov(fov, aspect).toFixed(1);
  place();
});

console.log('Drag the gold point P, or move it with the sliders; the autopilot gives it back.');
