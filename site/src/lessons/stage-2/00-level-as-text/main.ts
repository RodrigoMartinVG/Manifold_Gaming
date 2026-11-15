import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import { createScene } from './scene';
import { LEVEL } from './level';

type Vec3 = [number, number, number];
/** A turn around one axis, as a person writes it: `rotate x 20`. */
interface Turn {
  axis: 'x' | 'y' | 'z';
  degrees: number;
}
interface Box {
  center: Vec3;
  half: Vec3;
  turn: Turn | null;
  color: number;
}
interface Zone {
  kind: string;
  center: Vec3;
  half: Vec3;
  turn: Turn | null;
}
interface Level {
  title: string;
  spawn: Vec3;
  facing: Vec3;
  boxes: Box[];
  zones: Zone[];
  errors: string[];
}

/**
 * THE READER: text in, data out. One piece per line and nothing nested, so a line that is not
 * understood is reported with its number and skipped, and the next one is read as usual.
 */
function readLevel(text: string): Level {
  const level: Level = {
    title: '',
    spawn: [0, 1, 0],
    facing: [0, 0, -1],
    boxes: [],
    zones: [],
    errors: [],
  };
  const lines = text.split('\n');
  // The first line says the format's version. Another version may mean other things: read nothing.
  const first = lines[0]!.trim();
  if (first !== '# Manifold level 1') {
    level.errors.push(`line 1: this reads "# Manifold level 1", not "${first}"`);
    return level;
  }
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return; // empty, or a comment (the header is one too)
    const words = line.split(/\s+/);
    let at = 1; // the next word to read
    const fail = (why: string): never => {
      throw new Error(why);
    };
    const number = (): number => {
      const word = words[at++];
      if (word === undefined) return fail('a number is missing');
      const x = Number(word);
      return Number.isFinite(x) ? x : fail(`"${word}" is not a number`);
    };
    const vector = (): Vec3 => [number(), number(), number()];
    const half = (): Vec3 => {
      const h = vector();
      return h.every((x) => x > 0) ? h : fail('half sizes must be more than 0');
    };
    const turn = (): Turn => {
      const axis = words[at++];
      if (axis === 'x' || axis === 'y' || axis === 'z') return { axis, degrees: number() };
      return fail(`"${axis ?? ''}" is not an axis (x, y or z)`);
    };
    const color = (): number => {
      const hex = words[at++] ?? '';
      if (!/^#[0-9a-f]{6}$/i.test(hex)) fail(`"${hex}" is not a color (#rrggbb)`);
      return parseInt(hex.slice(1), 16);
    };
    /** Nothing may be left over at the end of a line. */
    const end = () => {
      if (at < words.length) fail(`"${words[at]}" is extra`);
    };
    try {
      switch (words[0]) {
        case 'title':
          level.title = line.slice('title'.length).trim(); // the rest of the line
          break;
        case 'spawn': {
          const spawn = vector();
          end();
          level.spawn = spawn;
          break;
        }
        case 'facing': {
          const facing = vector();
          end();
          level.facing = facing;
          break;
        }
        case 'box': {
          const box: Box = { center: vector(), half: half(), turn: null, color: 0x6f6a62 };
          while (at < words.length) {
            const word = words[at++];
            if (word === 'rotate') box.turn = turn();
            else if (word === 'color') box.color = color();
            else fail(`"${word}" is not understood here (rotate, color)`);
          }
          level.boxes.push(box);
          break;
        }
        case 'sensor': {
          const kind = words[at++] ?? '';
          if (!/^[a-z][a-z0-9.-]*$/.test(kind)) fail('a zone needs what it is for, in one word');
          const zone: Zone = { kind, center: vector(), half: half(), turn: null };
          if (words[at] === 'rotate') {
            at++;
            zone.turn = turn();
          }
          end();
          level.zones.push(zone);
          break;
        }
        default:
          fail(`"${words[0]}" is not understood (title, spawn, facing, box, sensor)`);
      }
    } catch (e) {
      level.errors.push(`line ${i + 1}: ${(e as Error).message}`);
    }
  });
  return level;
}

await RAPIER.init();
const { scene, onFrame } = createScene({ camera: [-8, 7, 11], target: [0.5, 0.5, 0.5] });
const STEP = 1 / 60;
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = STEP;

const level = readLevel(LEVEL);
const { title, boxes, zones, errors } = level;
console.log(`"${title}": boxes ${boxes.length}, zones ${zones.length}, errors ${errors.length}.`);
for (const error of errors) console.error(error);

/** Degrees, as a person writes them, into a quaternion, as the machine turns things. */
const AXES = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};
const rotationOf = (turn: Turn | null) =>
  turn
    ? new THREE.Quaternion().setFromAxisAngle(AXES[turn.axis], (turn.degrees * Math.PI) / 180)
    : new THREE.Quaternion();

// EVERY BOX: a fixed body that collides (with HALF its sizes) and a mesh that is seen (with its
// WHOLE sizes), at the same place and with the same turn.
for (const b of level.boxes) {
  const rotation = rotationOf(b.turn);
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(...b.center)
      .setRotation(rotation),
  );
  world.createCollider(RAPIER.ColliderDesc.cuboid(...b.half), body);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(b.half[0] * 2, b.half[1] * 2, b.half[2] * 2),
    new THREE.MeshStandardMaterial({ color: b.color }),
  );
  mesh.position.set(...b.center);
  mesh.quaternion.copy(rotation);
  scene.add(mesh);
}

// EVERY ZONE: only a wire box. It pushes nothing; noticing who comes in is the next lesson's.
const ZONE_COLORS: Record<string, number> = {
  checkpoint: 0x5ad87a,
  goal: 0xe0c05a,
  fall: 0xd85a5a,
};
for (const z of level.zones) {
  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(z.half[0] * 2, z.half[1] * 2, z.half[2] * 2)),
    new THREE.LineBasicMaterial({ color: ZONE_COLORS[z.kind] ?? 0xffffff }),
  );
  wire.position.set(...z.center);
  wire.quaternion.copy(rotationOf(z.turn));
  scene.add(wire);
}

// THE SPAWN, where a player would start, with an arrow to where it would look (`facing`).
const facing = new THREE.Vector3(...level.facing).normalize();
scene.add(new THREE.ArrowHelper(facing, new THREE.Vector3(...level.spawn), 1.5, 0x93d9c9));

// THE BALLS: dropped at the spawn, to see that the text became something they land on.
const options = { balls: 8 };
const readout = {
  title: level.title,
  boxes: level.boxes.length,
  zones: level.zones.length,
  errors: level.errors.length,
  firstError: level.errors[0] ?? 'none',
  atRest: 0,
  fellOff: 0,
};
const ballShape = new THREE.SphereGeometry(0.2, 20, 12);
const ballPaint = new THREE.MeshStandardMaterial({ color: 0xe8e2d4 });
let balls: { body: RAPIER.RigidBody; mesh: THREE.Mesh }[] = [];

function drop() {
  for (const b of balls) {
    world.removeRigidBody(b.body);
    scene.remove(b.mesh);
  }
  balls = [];
  readout.fellOff = 0;
  const [x, y, z] = level.spawn;
  for (let i = 0; i < options.balls; i++) {
    // Three to a row, each row higher, so that no two start inside each other. And each row 2 cm
    // off the one below: a ball dropped exactly on top of another would balance there for ever.
    const row = Math.floor(i / 3);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x + ((i % 3) - 1) * 0.45, y + row * 0.5, z + (row % 2 ? 0.01 : -0.01))
        .setLinearDamping(0.3)
        .setAngularDamping(0.6),
    );
    world.createCollider(RAPIER.ColliderDesc.ball(0.2), body);
    const mesh = new THREE.Mesh(ballShape, ballPaint);
    scene.add(mesh);
    balls.push({ body, mesh });
  }
}
drop();

const gui = new GUI({ title: 'Level' });
gui.add(readout, 'title').disable();
gui.add(readout, 'boxes').disable();
gui.add(readout, 'zones').disable();
gui.add(readout, 'errors').disable();
gui.add(readout, 'firstError').name('first error').disable();
gui.add(options, 'balls', 1, 30, 1).onFinishChange(drop);
gui.add(readout, 'atRest').name('at rest').listen().disable();
gui.add(readout, 'fellOff').name('fell off').listen().disable();
gui.add({ drop }, 'drop').name('drop again');

let accumulator = 0;
onFrame((dt) => {
  accumulator += dt;
  while (accumulator >= STEP) {
    world.step();
    accumulator -= STEP;
  }
  // A ball at rest is one the physics put to sleep: it stayed still on something for a while.
  readout.atRest = 0;
  balls = balls.filter((b) => {
    const p = b.body.translation();
    if (p.y < -10) {
      world.removeRigidBody(b.body);
      scene.remove(b.mesh);
      readout.fellOff++;
      return false;
    }
    b.mesh.position.set(p.x, p.y, p.z);
    b.mesh.quaternion.copy(b.body.rotation());
    if (b.body.isSleeping()) readout.atRest++;
    return true;
  });
});

console.log('Edit level.ts and run it again (▶, or Ctrl/⌘ + Enter).');
