import * as THREE from 'three';
import type { Quat, Vec3 } from '@manifold/common';
import { upAt, type Appearance, type Entity, type EntityId, type Shape, type World } from '@manifold/core';
import type { VariableInfo } from '@manifold/commands';
import { surroundingsOf } from './hands';
import { animate, motion, turnBody, type ModelInstance, type Models } from './models';
import { own, ownMaterial, release } from './owned';
import type { GamePage, Piece } from './page';

/** An entity's pose at the previous step: it is drawn halfway between that one and the current one. */
interface Pose {
  position: Vec3;
  rotation: Quat;
}

export interface Bodies extends Piece {
  /** What is drawn for each entity that has an appearance: a mesh, or a model's copy (stage 2e). */
  readonly meshes: ReadonlyMap<EntityId, THREE.Object3D>;
  /** Each character's carried turn at the previous step (stage 2d): the aiming camera turns with it, drawn between steps. */
  readonly previousTurn: ReadonlyMap<EntityId, Quat>;
  /** What is drawn for an appearance (the ghost's, for instance): its model, if it has one and it loaded, or its shape. */
  meshFor(a: Appearance): { object: THREE.Object3D; model: ModelInstance | null };
  /** The entity whose mesh is under a point of the screen (x and y from −1 to 1), if any. */
  entityAt(x: number, y: number): EntityId | undefined;
  /** Each character drawn with a model, its copy (its limbs, feet and hands: the `show.ik` view reads them). */
  readonly models: ReadonlyMap<EntityId, ModelInstance>;
}

const ZONE_COLORS: Record<string, number> = { checkpoint: 0x5ad87a, goal: 0xe0c05a, fall: 0xd85a5a };

/** How far a shape reaches below its center: a standing character's feet. */
const below = (s: Shape): number =>
  s.kind === 'capsule'
    ? s.halfHeight + s.radius
    : s.kind === 'ball'
      ? s.radius
      : s.kind === 'compound'
        ? Math.max(...s.parts.map((p) => p.halfExtents[1] - p.offset[1]))
        : s.halfExtents[1];
/** A shadow's disc lies on +Y; it is turned to the surface it falls on. */
const FLAT = new THREE.Vector3(0, 1, 0);
const normal = new THREE.Vector3();

/** What the bodies let people change, as data (the site's console reference reads it). */
export const BODIES_VARIABLES = {
  wireframe: {
    name: 'show.wireframe',
    description: 'Meshes as wire: the triangles the graphics card draws.',
    scope: 'view',
    type: { kind: 'boolean' },
    default: false,
  },
  sensors: {
    name: 'show.sensors',
    description:
      "The level's zones, as wire boxes: checkpoints in green, the goal in gold, the void that brings you back in red (stage 2a).",
    scope: 'view',
    type: { kind: 'boolean' },
    default: false,
  },
} as const satisfies Record<string, VariableInfo>;

/**
 * THE BODIES: a mesh for every entity with an appearance, drawn between its last two steps (by
 * `alpha`: interpolation), created and removed as the world says; and the level's zones as wire
 * boxes. Two views of their own: `show.wireframe` and `show.sensors`.
 *
 * MODELS (stage 2e): an appearance that names a model (`model`) is drawn with a copy of it, once it
 * loaded (its shape meanwhile), and a character's copy plays the animations its state asks for,
 * mixed by where it really goes compared with where it looks (stage 2e2: locomotion.ts). A
 * character's body is drawn turning at most 900°/s towards where the world has it (models.ts:
 * `turnBody`): the simulation turns it at once. Every character has a soft shadow straight under it,
 * on whatever is there: to read where it will land.
 */
export function mountBodies(page: GamePage, models: Models, o: { timeScale(): number }): Bodies {
  const { scene, camera } = page.stage;
  const meshes = new Map<EntityId, THREE.Object3D>();
  /** The model copies, by entity (their animations move on every frame). */
  const instances = new Map<EntityId, ModelInstance>();
  /** The shadows under the characters, by entity. */
  const shadows = new Map<EntityId, THREE.Mesh>();
  const shadowShape = new THREE.CircleGeometry(0.38, 24).rotateX(-Math.PI / 2);
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
  const previous = new Map<EntityId, Pose>();
  const previousTurn = new Map<EntityId, Quat>();
  /** Each character's body as drawn (stage 2e2: it turns towards the world's, not at once), and how fast it turned last frame (degrees per second). */
  const drawnTurn = new Map<EntityId, THREE.Quaternion>();
  const turning = new Map<EntityId, number>();
  /** The zones, as wire boxes (show.sensors), by entity: they have no appearance, they are only shown on request. */
  const zones = new Map<EntityId, THREE.LineSegments>();
  let wireframe = false;
  let showZones = false;
  const geometries = { box: new THREE.BoxGeometry(1, 1, 1), sphere: new THREE.SphereGeometry(0.5, 24, 16) };

  page.registry.declareVariable({
    ...BODIES_VARIABLES.wireframe,
    onChange(v) {
      wireframe = v === true;
      for (const mesh of meshes.values())
        mesh.traverse((o) => {
          if (o instanceof THREE.Mesh) (o.material as THREE.MeshLambertMaterial).wireframe = wireframe;
        });
    },
  });
  page.registry.declareVariable({
    ...BODIES_VARIABLES.sensors,
    onChange: (v) => {
      showZones = v === true;
      for (const zone of zones.values()) zone.visible = showZones;
    },
  });

  /**
   * Its model's copy, if it names one that loaded; if not, its shape. A model's body takes the
   * appearance's color (each player's), in a material of its own; the rest stays shared.
   */
  const meshFor = (a: Appearance) => {
    const model = a.model ? models.instance(a.model) : null;
    if (!model) return { object: shapeFor(a), model: null };
    let color: THREE.MeshStandardMaterial | null = null;
    model.object.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || (o.material as THREE.Material).name !== 'body') return;
      if (!color) {
        color = (o.material as THREE.MeshStandardMaterial).clone();
        color.color.setHex(a.color);
        color.wireframe = wireframe;
      }
      ownMaterial(o, color);
    });
    return { object: model.object, model };
  };
  /**
   * A mesh for an appearance's shape. Boxes and spheres are one shared shape, scaled; a capsule is
   * built at its size (scaling would squash its round ends), with a visor that shows where it looks
   * (−Z); a grid, its lines (stage 3b).
   */
  const shapeFor = (a: Appearance): THREE.Object3D => {
    if (a.shape === 'grid') return gridFor(a);
    const material = new THREE.MeshLambertMaterial({ color: a.color, wireframe });
    // Translucent (stage 3d: a fog bank): what is behind shows through, and it does not hide what is in it.
    if (a.opacity !== undefined) Object.assign(material, { transparent: true, opacity: a.opacity, depthWrite: false });
    // Several boxes (stage 4a: a compound body, as a map's floor), each the shared box, scaled and placed.
    if (a.shape === 'boxes') {
      const group = new THREE.Group();
      // (Their one material is theirs, freed once: `release` frees each thing once.)
      for (const p of a.parts ?? []) {
        const mesh = own(new THREE.Mesh(geometries.box, material), { material: true });
        mesh.scale.set(...p.size);
        mesh.position.set(...p.offset);
        group.add(mesh);
      }
      return group;
    }
    if (a.shape !== 'capsule') {
      const mesh = own(new THREE.Mesh(geometries[a.shape], material), { material: true });
      mesh.scale.set(...a.size);
      return mesh;
    }
    const radius = a.size[0] / 2;
    const capsule = new THREE.CapsuleGeometry(radius, a.size[1] - a.size[0], 6, 16);
    const mesh = own(new THREE.Mesh(capsule, material), { geometry: true, material: true });
    const visor = own(
      new THREE.Mesh(
        new THREE.BoxGeometry(radius * 1.2, radius * 0.45, radius * 0.5),
        new THREE.MeshLambertMaterial({ color: 0x1a1714, wireframe }),
      ),
      { geometry: true, material: true },
    );
    visor.position.set(0, a.size[1] * 0.28, -radius * 0.85);
    mesh.add(visor);
    return mesh;
  };

  /**
   * A GRID (stage 3b): lines a meter apart over the top of a box of the appearance's size, in its
   * color; the two through its center, a little lighter. The Dojo's floor is drawn so (before, the
   * stage drew one, 20 m square, under any level: in the plane of a level's floor at y = 0, its lines
   * fought with it). A line every meter from the center out, as far as the edges, and the edges.
   */
  const gridFor = (a: Appearance) => {
    const [sx, sy, sz] = a.size;
    const top = sy / 2;
    const points: number[] = [];
    const colors: number[] = [];
    const line = new THREE.Color(a.color);
    const middle = line.clone().lerp(new THREE.Color(0xffffff), 0.1);
    /** Where the lines go along one side: every meter from the center out, and the two edges. */
    const marks = (size: number) => {
      const half = size / 2;
      const out = new Set<number>([-half, half]);
      for (let m = 0; m < half; m++) out.add(m).add(-m);
      return [...out].sort((p, q) => p - q);
    };
    const add = (x0: number, z0: number, x1: number, z1: number, color: THREE.Color) => {
      points.push(x0, top, z0, x1, top, z1);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    };
    for (const x of marks(sx)) add(x, -sz / 2, x, sz / 2, x === 0 ? middle : line);
    for (const z of marks(sz)) add(-sx / 2, z, sx / 2, z, z === 0 ? middle : line);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return own(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true })), {
      geometry: true,
      material: true,
    });
  };

  const createZone = (e: Entity) => {
    if (!e.sensor || !e.transform || zones.has(e.id)) return;
    const [x, y, z] = e.sensor.half;
    const box = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(x * 2, y * 2, z * 2)),
      new THREE.LineBasicMaterial({ color: ZONE_COLORS[e.sensor.kind] ?? 0xb0a890 }),
    );
    box.position.set(...e.transform.position);
    box.quaternion.set(...e.transform.rotation);
    box.visible = showZones;
    scene.add(box);
    zones.set(e.id, box);
  };
  const create = (e: Entity) => {
    createZone(e);
    // Only once per entity. (Bug found in step 0: the ones the cartridge put at the start arrived
    // TWICE, when walking the world and through their `entityCreated` event; the second mesh hid
    // the first one in the map, and the first stayed in the scene, forgotten at the origin.)
    if (!e.appearance || !e.transform || meshes.has(e.id)) return;
    const { object, model } = meshFor(e.appearance);
    // Which entity it is, for a click on it and for what the tests count.
    object.userData.entity = e.id;
    scene.add(object);
    meshes.set(e.id, object);
    if (model) instances.set(e.id, model);
    if (e.character && !shadows.has(e.id)) {
      const shadow = new THREE.Mesh(shadowShape, shadowMaterial.clone());
      shadow.renderOrder = 1;
      scene.add(shadow);
      shadows.set(e.id, shadow);
    }
  };
  // A model that loads after its bodies were drawn with their shapes: they are drawn again, with it.
  models.onLoad((name) => {
    const world = page.session.world;
    for (const [id] of meshes) {
      const e = world.entities.get(id);
      if (e?.appearance?.model !== name || instances.has(id)) continue;
      remove(id, false);
      create(e);
    }
  });
  const remove = (id: EntityId, all = true) => {
    const zone = zones.get(id);
    if (zone) {
      scene.remove(zone);
      zone.geometry.dispose();
      (zone.material as THREE.Material).dispose();
      zones.delete(id);
    }
    const mesh = meshes.get(id);
    if (mesh) {
      scene.remove(mesh);
      // Only what is its own (owned.ts): not the shared box or sphere, not its model's geometry or materials.
      release(mesh);
    }
    instances.get(id)?.mixer.stopAllAction();
    instances.delete(id);
    meshes.delete(id);
    if (!all) return;
    const shadow = shadows.get(id);
    if (shadow) {
      scene.remove(shadow);
      (shadow.material as THREE.Material).dispose();
      shadows.delete(id);
    }
    previous.delete(id);
    previousTurn.delete(id);
    drawnTurn.delete(id);
    turning.delete(id);
  };
  const savePrevious = (world: World) => {
    for (const e of world.entities.values()) {
      if (!e.transform) continue;
      previous.set(e.id, { position: [...e.transform.position], rotation: [...e.transform.rotation] });
      if (e.character) previousTurn.set(e.id, [...e.character.carriedTurn]);
    }
  };

  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const qt = new THREE.Quaternion();
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();

  return {
    meshes,
    previousTurn,
    models: instances,
    meshFor,
    entityAt(x, y) {
      pointer.set(x, y);
      raycaster.setFromCamera(pointer, camera);
      // (A model is many meshes: the one hit belongs to whichever of them says its entity.)
      let hit: THREE.Object3D | null = raycaster.intersectObjects([...meshes.values()], true)[0]?.object ?? null;
      while (hit && hit.userData.entity === undefined) hit = hit.parent;
      return hit?.userData.entity as EntityId | undefined;
    },
    welcome(session) {
      for (const id of new Set([...meshes.keys(), ...zones.keys()])) remove(id);
      for (const e of session.world.entities.values()) create(e);
      savePrevious(session.world);
    },
    beforeStep: () => savePrevious(page.session.world),
    event(ev, world) {
      if (ev.type === 'entityCreated') {
        const e = world.entities.get(ev.id);
        if (e) create(e);
      }
      if (ev.type === 'entityRemoved') remove(ev.id);
    },
    frame({ world, alpha, dt, hero }) {
      // (How much time passed for the world: paused, none; at half speed, half.)
      const time = dt * o.timeScale();
      for (const [id, mesh] of meshes) {
        const e = world.entities.get(id);
        const t = e?.transform;
        const before = previous.get(id) ?? t;
        if (!e || !t || !before) continue;
        // What breaks, drawn whole or broken (stage 3e): a model with both (the lamp) shows one.
        if (e.breakable) {
          const whole = mesh.getObjectByName('whole');
          const broken = mesh.getObjectByName('broken');
          if (whole && broken) {
            whole.visible = !e.breakable.broken;
            broken.visible = e.breakable.broken;
          }
        }
        mesh.position.set(...before.position).lerp(new THREE.Vector3(...t.position), alpha);
        const target = qt.slerpQuaternions(qa.set(...before.rotation), qb.set(...t.rotation), alpha);
        if (!e.character) {
          mesh.quaternion.copy(target);
          continue;
        }
        // A character's body turns towards the world's, quickly but not at once (stage 2e2).
        let drawn = drawnTurn.get(id);
        if (!drawn) drawnTurn.set(id, (drawn = target.clone()));
        turning.set(id, turnBody(drawn, target, upAt(world, t.position), time));
        mesh.quaternion.copy(drawn);
      }
      // A character's animations, from its state and how it really moved in its last step (the view
      // reads the world, never writes it).
      for (const [id, model] of instances) {
        const e = world.entities.get(id);
        const t = e?.transform;
        if (!e?.character || !t) continue;
        const before = previous.get(id);
        const moved = before ? motion(before.position, t.position, e.character) : ([0, 0, 0] as const);
        const around = surroundingsOf(world, e, (other) => meshes.get(other));
        animate(model, e.character, upAt(world, t.position), [...moved], turning.get(id) ?? 0, time, around);
      }
      // For the browser tests (probe.ts): the animation that weighs most in the player's model ('' while
      // it is drawn with its shape), written when it changes.
      const clip = (hero && instances.get(hero.id)?.playing) || '';
      if (page.container.dataset.clip !== clip) page.container.dataset.clip = clip;
      // And what its hands hold (stage 4a: hands.ts), left and right ('-', nothing), written when it changes.
      const hands = hero && instances.get(hero.id)?.hands;
      const holds = hands ? `${hands.L.kind ?? '-'} ${hands.R.kind ?? '-'}` : '';
      if (page.container.dataset.holds !== holds) page.container.dataset.holds = holds;
      // And each gesture as it starts (stage 3b), numbered: a landing is 0.3 s, and at a few frames per
      // second it may never weigh most in any frame, but it started.
      const started = hero ? instances.get(hero.id)?.gait.started : undefined;
      const gesture = started?.clip ? `${started.count} ${started.clip}` : '';
      if (page.container.dataset.gesture !== gesture) page.container.dataset.gesture = gesture;
      // Its shadow, straight under it ("down" is where the world says): on what a ray down from its
      // center finds, lying on that surface (a ramp too), smaller and fainter the higher its feet are
      // (as far as 20 m; beyond, none). From inside something (another character's capsule), the ray
      // finds no surface (it hits at 0, with no normal): no shadow.
      for (const [id, shadow] of shadows) {
        const e = world.entities.get(id);
        const drawn = meshes.get(id);
        if (!e?.transform || !drawn) continue;
        const up = upAt(world, e.transform.position);
        const from = drawn.position.toArray();
        const hit = world.castRay(from, [-up[0], -up[1], -up[2]], 20, { skip: id });
        shadow.visible = hit !== null && hit.distance > 0;
        if (!hit || !shadow.visible) continue;
        const height = Math.max(0, hit.distance - (e.body ? below(e.body.shape) : 0));
        const [nx, ny, nz] = hit.normal;
        shadow.position.set(hit.point[0] + nx * 0.01, hit.point[1] + ny * 0.01, hit.point[2] + nz * 0.01);
        shadow.quaternion.setFromUnitVectors(FLAT, normal.set(nx, ny, nz));
        shadow.scale.setScalar(1 / (1 + height * 0.25));
        (shadow.material as THREE.MeshBasicMaterial).opacity = 0.35 / (1 + height * 0.4);
      }
    },
  };
}
