import * as THREE from 'three';
import { circle, createLab, draggable, figureOnly, inset, numbers, path, point as dot3 } from 'lab';
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

// THE FIGURE, seen from behind the eye and to its left: the tutorial's lab kit (its source is one click
// away, under the editor). Drag to look around. What only explains the scene (the plane, the lines, the
// eye) is `figureOnly`: the eye's own picture, in the corner, shows only the world.
const lab = createLab({
  title: 'the projection',
  camera: [-3.6, 2.4, 4.6],
  target: [-0.1, 0.7, 0.4],
});
const label = (text: string) => lab.label(text).lift(14);

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
const byHand = () => {
  settings.autopilot = false;
};
lab.gui.add(settings, 'autopilot').listen();
lab.gui.add(settings, 'point x (m)', -3, 3, 0.01).listen().onChange(byHand);
lab.gui.add(settings, 'point y (m)', 0, 3, 0.01).listen().onChange(byHand);
lab.gui.add(settings, 'point z (m)', -8, 3, 0.01).listen().onChange(byHand);
lab.gui.add(settings, 'vertical fov (°)', 20, 120, 1);
lab.gui.add(settings, 'picture (px)', Object.keys(PICTURES));
lab.gui.add(settings, 'rails turn (°)', -35, 35, 1);
// The panel's numbers, written on every frame (below) and shown by these rows.
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
numbers(
  lab.gui,
  Object.fromEntries(Object.keys(shown).map((k) => [k, () => shown[k as keyof typeof shown]])),
);

/** LINES OF THE FIGURE (only in it), set again on every frame. */
function lines(color: number, o: { opacity?: number; dashed?: boolean; pairs?: boolean } = {}) {
  const line = path(lab, { color, ...o });
  figureOnly(line);
  return line;
}
/** A small ball of the figure (only in it). */
function ball(radius: number, color: number) {
  const b = dot3(lab, { color, radius });
  figureOnly(b);
  return b;
}

// THE EYE, a small white ball, and THE IMAGE PLANE, 1 m in front of it: as tall as the field of
// view lets in, as wide as the picture's proportions say.
const BLUE = 0x9fc2e8;
ball(0.06, 0xf2ece0).set(eyeAt);
label('eye').at(eyeAt);
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
lab.world.add(plane);
figureOnly(plane);
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
  lab.world.add(post);
  const bottom: Point = { x: -1.3, y: 0, z: EYE.z - depth };
  const top: Point = { x: -1.3, y: 1, z: EYE.z - depth };
  const rays = lines(TEAL, { opacity: 0.35 });
  rays.set([top, eyeAt, bottom]);
  const image = lines(TEAL);
  const ends = [onPlane(fromEye(bottom, EYE)), onPlane(fromEye(top, EYE))];
  image.set(ends.flatMap((q) => (q ? [atPlane(q)] : [])));
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
  lab.world.add(mesh);
  return { side, mesh, image: lines(VIOLET), onward: lines(VIOLET, { dashed: true }) };
});
const railRays = lines(VIOLET, { opacity: 0.35, pairs: true }); // from the eye to each rail's start
const parallel = lines(VIOLET, { dashed: true, opacity: 0.6 }); // from the eye, along the rails
const vanishing = circle(lab, { color: 0xf0d0ff, radius: 0.035, width: 0.02 });
figureOnly(vanishing);
const vanishingLabel = label('vanishing point');

// THE POINT P, which the autopilot moves (drag it, or use the sliders); its line to the eye; and
// P′, where that line crosses the image plane.
const GOLD = 0xe5c07b;
const point = new THREE.Mesh(
  new THREE.SphereGeometry(0.08, 24, 12),
  new THREE.MeshStandardMaterial({ color: GOLD, emissive: 0x4a3510 }),
);
lab.world.add(point);
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
const picture = inset(lab, photo);

// DRAGGING P, on the horizontal plane at its height, y = h: the plane [n | d] with n = (0, 1, 0) and
// d = −h. x and z change (y, with its slider).
draggable(lab, point, {
  plane: () => ({ normal: { x: 0, y: 1, z: 0 }, d: -point.position.y }),
  move: (hit) => {
    settings['point x (m)'] = THREE.MathUtils.clamp(hit.x, -3, 3);
    settings['point z (m)'] = THREE.MathUtils.clamp(hit.z, -8, 3);
  },
  start: byHand,
});

/** Two numbers, as the panel shows them. */
const pair = (a: number, b: number, digits: number) => `${a.toFixed(digits)}, ${b.toFixed(digits)}`;

let time = 0;
lab.onFrame((dt) => {
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
  outline.set([topLeft, topRight, bottomRight, bottomLeft, topLeft]);
  pyramid.set([eyeAt, topLeft, eyeAt, topRight, eyeAt, bottomRight, eyeAt, bottomLeft]);
  planeLabel.at(topLeft);

  // P, STEP BY STEP: seen from the eye, its depth, on the plane, normalized, in pixels.
  const c = fromEye(P, EYE);
  const d = depthOf(c);
  const q = onPlane(c); // null if it is not in front of the eye
  const n = q && normalized(q, fov, aspect);
  const pixel = n && toPixels(n, W, H);
  point.position.set(P.x, P.y, P.z);
  pointLabel.at(point.position);
  drop.set([point.position, { x: P.x, y: 0, z: P.z }]);
  dot.show(q !== null);
  dotLabel.show(q !== null);
  if (q) {
    const onIt = atPlane(q);
    dot.set(onIt);
    dotLabel.at(onIt);
    // The line from the eye goes to P; on to the plane, if P is nearer than it.
    ray.set([eyeAt, d >= 1 ? point.position : onIt]);
  } else ray.set([eyeAt, point.position]);

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
    rail.image.set(image);
    if (vp) rail.onward.set([far, atPlane(vp)]); // on, towards where it is going
  }
  railRays.set(starts);
  vanishing.show(vp !== null);
  vanishingLabel.show(vp !== null);
  if (vp) {
    vanishing.set(atPlane(vp), { x: 0, y: 0, z: 1 });
    vanishingLabel.at(atPlane(vp));
    parallel.set([eyeAt, eyeAt.clone().add(new THREE.Vector3(w.x, w.y, w.z).multiplyScalar(RAIL))]);
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
});

console.log('Drag the gold point P, or move it with the sliders; the autopilot gives it back.');
