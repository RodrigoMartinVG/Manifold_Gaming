import * as THREE from 'three';
import type { Quat, Vec3 } from '@manifold/common';
import { upAt, type Appearance, type Entity, type EntityId, type PhysicsBackend, type Shape, type World } from '@manifold/core';
import type { VariableInfo } from '@manifold/commands';
import { surroundingsOf } from './hands';
import { inertialize } from './inertia';
import { animate, flinch, motion, turnBody, type ModelInstance, type Models } from './models';
import { poseRagdoll, startRagdoll, stopRagdoll } from './ragdoll';
import type { Tools } from './tools';
import { own, ownMaterial, release } from './owned';
import type { GamePage, Piece } from './page';
import { weaponFeel } from './feel';

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
  meshFor(a: Appearance, shape?: Shape): { object: THREE.Object3D; model: ModelInstance | null };
  /** The entity whose mesh is under a point of the screen (x and y from −1 to 1), if any. */
  entityAt(x: number, y: number): EntityId | undefined;
  /** Each character drawn with a model, its copy (its limbs, feet and hands: the `show.ik` view reads them). */
  readonly models: ReadonlyMap<EntityId, ModelInstance>;
  /** (Stage 5g) A new copy of a tool's model, by its name; null until it loaded (meanwhile, its box). */
  toolModel(name: string): THREE.Object3D | null;
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
        : s.kind === 'heightfield'
          ? 0
          : s.halfExtents[1];
/**
 * A height field's surface (the forest's F0a): a vertex at each of its corners, two triangles a cell, facing up.
 * One mesh for the whole field; its levels of detail and patches are F3's.
 */
function fieldGeometry(s: Extract<Shape, { kind: 'heightfield' }>): THREE.BufferGeometry {
  const across = s.cols + 1;
  const points = new Float32Array(across * (s.rows + 1) * 3);
  for (let i = 0; i <= s.rows; i++)
    for (let j = 0; j <= s.cols; j++) {
      const k = (i * across + j) * 3;
      points[k] = -s.size[0] / 2 + (j * s.size[0]) / s.cols;
      points[k + 1] = s.heights[i * across + j]! * s.size[1];
      points[k + 2] = -s.size[2] / 2 + (i * s.size[2]) / s.rows;
    }
  const index: number[] = [];
  for (let i = 0; i < s.rows; i++)
    for (let j = 0; j < s.cols; j++) {
      const a = i * across + j;
      index.push(a, a + across, a + 1, a + 1, a + across, a + across + 1);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}
/** A shadow's disc lies on +Y; it is turned to the surface it falls on. (Stage 5p) Never smaller nor fainter than this. */
export const SHADOW = { smallest: 0.5, faintest: 0.15 } as const;
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
export function mountBodies(page: GamePage, models: Models, o: { timeScale(): number; tools?: Tools }): Bodies {
  const { scene, camera } = page.stage;
  const meshes = new Map<EntityId, THREE.Object3D>();
  /** The model copies, by entity (their animations move on every frame). */
  const instances = new Map<EntityId, ModelInstance>();
  /** The entities drawn with their model (a rig or a plain copy), not with their shape. */
  const withModel = new Set<EntityId>();
  // The falls (stage 4c: ragdoll.ts), in the page's physics of what is only seen (stage 5.5g: cosmetic.ts,
  // with the level's still pieces; the one they were started in); and the way each character's last hit went.
  let falls: PhysicsBackend | null = null;
  const lastHit = new Map<EntityId, THREE.Vector3>();
  const fallsOf = (world: World) => (falls = page.cosmetic.of(world));
  // What each character carries (stage 4c: tools.ts), a box drawn where its model holds it, by entity
  // (with its size and color, to make it again if they change); and each shot's tracer as it fades.
  const tools = new Map<EntityId, { mesh: THREE.Object3D; look: string }>();
  const tracers: { line: THREE.Mesh; left: number }[] = [];
  const dropTool = (id: EntityId) => {
    const tool = tools.get(id);
    if (!tool) return;
    scene.remove(tool.mesh);
    release(tool.mesh);
    tools.delete(id);
  };
  /** A copy of a tool's model (stage 5g): its meshes share the model's geometry and materials, and cast shadows. */
  const toolModel = (name: string): THREE.Object3D | null => {
    const object = (models.rigged(name) ? models.instance(name)?.object : models.copy(name)) ?? null;
    if (page.stage.quality.shadows) object?.traverse((o) => (o.castShadow = true));
    return object;
  };
  const drawTool = (id: EntityId, model: ModelInstance) => {
    const pose = model.holding.pose;
    // (In first person, stage 4g, the camera draws it.)
    if (!pose || model.holding.inView) return dropTool(id);
    // Its model if it has one and it loaded (stage 5g); its box until then. (A copy made once: drawn
    // already, it is only moved.)
    const box = `${pose.size.join(' ')} ${pose.color}`;
    let tool = tools.get(id);
    const drawn = pose.model && tool?.look !== `model ${pose.model}` ? toolModel(pose.model) : null;
    const look = drawn || tool?.look === `model ${pose.model}` ? `model ${pose.model}` : box;
    if (tool?.look !== look) {
      dropTool(id);
      const mesh =
        drawn ??
        own(new THREE.Mesh(new THREE.BoxGeometry(...pose.size), new THREE.MeshLambertMaterial({ color: pose.color })), {
          geometry: true,
          material: true,
        });
      mesh.castShadow = page.stage.quality.shadows;
      scene.add(mesh);
      tools.set(id, (tool = { mesh, look }));
    }
    tool.mesh.position.copy(pose.center);
    tool.mesh.quaternion.copy(pose.rotation);
  };
  /**
   * How long a tracer is seen (s), fading, and how thick it is (m): a thin box, glowing (a line is a
   * pixel wide, whatever width it asks for: WebGL draws no other).
   */
  const TRACER = 0.15;
  const TRACER_WIDTH = 0.02;
  const tracerShape = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
  const getUp = (model: ModelInstance) => {
    if (!model.ragdoll || !falls) return;
    stopRagdoll(falls, model.ragdoll);
    model.ragdoll = null;
    model.getUp = true;
  };
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
  // (And a simpler sphere for what is small, stage 4.5's close: a lamp's ball or a thrown one, 30 cm
  // across, drawn with 720 triangles was 3,072 of the keep's hall's 5,024 in stage 3d; 168 do.)
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.SphereGeometry(0.5, 24, 16),
    small: new THREE.SphereGeometry(0.5, 12, 8),
  };
  /** Up to this size (m), a sphere is drawn with the simpler one. */
  const SMALL = 0.5;
  /**
   * The primitives' materials (stage 5.5g, the audit's V2), one for each colour and opacity, shared by every
   * mesh of it: before, each mesh had its own (a level of 300 grey boxes, 300 materials). A mesh does not own
   * it (owned.ts): what glows takes a copy of its own (`ownedMaterials`), and the page frees them when it stops.
   */
  const materials = new Map<string, THREE.MeshLambertMaterial>();
  const materialFor = (color: number, opacity?: number) => {
    const key = `${color} ${opacity ?? 1}`;
    let material = materials.get(key);
    if (!material) {
      material = new THREE.MeshLambertMaterial({ color, wireframe });
      // Translucent (stage 3d: a fog bank): what is behind shows through, and it does not hide what is in it.
      if (opacity !== undefined) Object.assign(material, { transparent: true, opacity, depthWrite: false });
      materials.set(key, material);
    }
    return material;
  };
  /**
   * WHAT CAN MOVE (stage 5.5g): what the physics or a program moves, a character, a projectile. Only these
   * keep their pose of the step before, to be drawn between the two; the rest is drawn where it is.
   */
  const moves = (e: Entity) =>
    !!(e.character || e.projectile || e.mover || e.spin || e.mechanism || (e.body && e.body.type !== 'fixed'));

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
  const meshFor = (a: Appearance, shape?: Shape): { object: THREE.Object3D; model: ModelInstance | null; drawn: boolean } => {
    // (Stage 5.5g) A rig only for a model with animations (a character); a plain shared copy for the rest.
    const rigged = a.model ? models.rigged(a.model) : null;
    const model = rigged ? models.instance(a.model!) : null;
    const object = model ? model.object : rigged === false ? models.copy(a.model!) : null;
    if (!object) return { object: shapeFor(a, shape), model: null, drawn: false };
    let color: THREE.MeshStandardMaterial | null = null;
    object.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || (o.material as THREE.Material).name !== 'body') return;
      if (!color) {
        color = (o.material as THREE.MeshStandardMaterial).clone();
        color.color.setHex(a.color);
        color.wireframe = wireframe;
      }
      ownMaterial(o, color);
    });
    return { object, model, drawn: true };
  };
  /**
   * A mesh for an appearance's shape. Boxes and spheres are one shared shape, scaled; a capsule is
   * built at its size (scaling would squash its round ends), with a visor that shows where it looks
   * (−Z); a grid, its lines (stage 3b); (the forest's F0a) a field, the surface of its body's height field.
   */
  const shapeFor = (a: Appearance, shape?: Shape): THREE.Object3D => {
    if (a.shape === 'grid') return gridFor(a);
    const material = materialFor(a.color, a.opacity);
    if (a.shape === 'field')
      return shape?.kind === 'heightfield'
        ? own(new THREE.Mesh(fieldGeometry(shape), material), { geometry: true })
        : new THREE.Group();
    // Several boxes (stage 4a: a compound body, as a map's floor), each the shared box, scaled and placed.
    if (a.shape === 'boxes') {
      const group = new THREE.Group();
      for (const p of a.parts ?? []) {
        const mesh = new THREE.Mesh(geometries.box, material);
        mesh.scale.set(...p.size);
        mesh.position.set(...p.offset);
        group.add(mesh);
      }
      return group;
    }
    if (a.shape !== 'capsule') {
      const geometry = a.shape === 'sphere' && Math.max(...a.size) <= SMALL ? geometries.small : geometries[a.shape];
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.set(...a.size);
      return mesh;
    }
    const radius = a.size[0] / 2;
    const capsule = new THREE.CapsuleGeometry(radius, a.size[1] - a.size[0], 6, 16);
    const mesh = own(new THREE.Mesh(capsule, material), { geometry: true });
    const visor = own(new THREE.Mesh(new THREE.BoxGeometry(radius * 1.2, radius * 0.45, radius * 0.5), materialFor(0x1a1714)), {
      geometry: true,
    });
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

  /**
   * THE LEVEL'S STILL PIECES, BATCHED (stage 5m, decision 0031: levels larger than phase 5's within decision
   * 0026's budget of 300 draw calls a frame). What the physics never moves and a model draws (the kit's walls,
   * floors, crates: not what breaks, gives light, or is a zone) is drawn as instances, one draw for each of
   * its models' meshes in each square of the level `CHUNK` m on a side, however many pieces share it there
   * (by squares, so what is out of the camera's sight is left out a square at a time: one batch for the
   * whole citadel drew all its triangles from anywhere, 46,000 of the budget's 50,000); their copies stay,
   * hidden, for what reads them (a click on one, the tests' count). Batched again only the squares where one
   * comes, goes or is moved (the console's `set`; stage 5.5g: before, every batch on any change). For the
   * browser tests: `data-batches`, how many batches there are.
   */
  const CHUNK = page.stage.quality.cell;
  /** Each still piece, and where it was batched (null: not yet). */
  const still = new Map<EntityId, { position: Vec3; rotation: Quat } | null>();
  /** The batches, by square; and (stage 5.5g) the squares to batch again: only those, not every batch on any change. */
  const batches = new Map<string, THREE.InstancedMesh[]>();
  const dirty = new Set<string>();
  const squareOf = (p: readonly number[]) => `${Math.floor(p[0]! / CHUNK)} ${Math.floor(p[2]! / CHUNK)}`;
  const isStill = (e: Entity) =>
    e.body?.type === 'fixed' && !!e.appearance?.model && !e.character && !e.lamp && !e.breakable && !e.sensor;
  const batchCount = () => {
    let n = 0;
    for (const list of batches.values()) n += list.length;
    return n;
  };
  const unbatch = (square: string) => {
    for (const b of batches.get(square) ?? []) {
      scene.remove(b);
      b.dispose();
    }
    batches.delete(square);
  };
  const rebatch = (world: World) => {
    for (const square of dirty) unbatch(square);
    const groups = new Map<
      string,
      {
        square: string;
        geometry: THREE.BufferGeometry;
        material: THREE.Material;
        matrices: THREE.Matrix4[];
        cast: boolean;
        receive: boolean;
      }
    >();
    for (const id of still.keys()) {
      const object = meshes.get(id);
      const t = world.entities.get(id)?.transform;
      if (!object || !t) continue;
      const square = squareOf(t.position);
      if (!dirty.has(square)) continue;
      still.set(id, { position: [...t.position], rotation: [...t.rotation] });
      object.position.set(...t.position);
      object.quaternion.set(...t.rotation);
      object.updateMatrixWorld(true);
      object.traverse((o) => {
        if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
        const key = `${square} ${o.geometry.uuid} ${(o.material as THREE.Material).uuid}`;
        let g = groups.get(key);
        if (!g)
          groups.set(
            key,
            (g = {
              square,
              geometry: o.geometry,
              material: o.material as THREE.Material,
              matrices: [],
              cast: o.castShadow,
              receive: o.receiveShadow,
            }),
          );
        g.matrices.push(o.matrixWorld.clone());
        o.visible = false;
      });
    }
    for (const g of groups.values()) {
      const batch = new THREE.InstancedMesh(g.geometry, g.material, g.matrices.length);
      g.matrices.forEach((m, i) => batch.setMatrixAt(i, m));
      batch.instanceMatrix.needsUpdate = true;
      batch.castShadow = g.cast;
      batch.receiveShadow = g.receive;
      batch.computeBoundingSphere();
      scene.add(batch);
      batches.set(g.square, [...(batches.get(g.square) ?? []), batch]);
    }
    dirty.clear();
    page.container.dataset.batches = String(batchCount());
  };
  /** The still pieces no longer where they were batched (moved by the console): their squares, old and new, to batch again. */
  const stillMoved = (world: World) => {
    for (const [id, was] of still) {
      const t = world.entities.get(id)?.transform;
      if (!was || !t) continue;
      let moved = false;
      for (let k = 0; k < 3 && !moved; k++) moved = t.position[k] !== was.position[k];
      for (let k = 0; k < 4 && !moved; k++) moved = t.rotation[k] !== was.rotation[k];
      if (moved) {
        dirty.add(squareOf(was.position));
        dirty.add(squareOf(t.position));
      }
    }
    return dirty.size > 0;
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
    const { object, model, drawn } = meshFor(e.appearance, e.body?.shape);
    // Which entity it is, for a click on it and for what the tests count.
    object.userData.entity = e.id;
    scene.add(object);
    meshes.set(e.id, object);
    if (model) instances.set(e.id, model);
    if (drawn) withModel.add(e.id);
    // (Stage 5m) A still piece of the level: drawn in a batch.
    if (drawn && isStill(e)) {
      still.set(e.id, null);
      dirty.add(squareOf(e.transform.position));
    }
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
      if (e?.appearance?.model !== name || withModel.has(id)) continue;
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
    const model = instances.get(id);
    if (model) getUp(model);
    model?.mixer.stopAllAction();
    dropTool(id);
    instances.delete(id);
    withModel.delete(id);
    skipped.delete(id);
    lastHit.delete(id);
    meshes.delete(id);
    if (still.has(id)) {
      const was = still.get(id);
      if (was) dirty.add(squareOf(was.position));
      still.delete(id);
    }
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
  // (Only what can move, stage 5.5g: before, every entity's pose was copied at every step, the level's walls too.)
  const savePrevious = (world: World) => {
    for (const e of world.entities.values()) {
      if (!e.transform || !moves(e)) continue;
      previous.set(e.id, { position: [...e.transform.position], rotation: [...e.transform.rotation] });
      if (e.character) previousTurn.set(e.id, [...e.character.carriedTurn]);
    }
  };

  const at = new THREE.Vector3();
  /** The frames drawn, and each far character's time owed since it was last animated (stage 5.5g: its bands). */
  let frame = 0;
  const skipped = new Map<EntityId, number>();
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const qt = new THREE.Quaternion();
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();

  return {
    meshes,
    previousTurn,
    models: instances,
    toolModel,
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
      for (const t of tracers.splice(0)) {
        scene.remove(t.line);
        release(t.line);
      }
      // (Another world: the page makes its physics of what is only seen again.)
      falls = null;
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
      // A hit taken (stage 4c): the spine of whoever took it is kicked the way the hit went (from who
      // hit it, or, from nobody, from in front of it).
      if (ev.type === 'hurt') {
        const model = instances.get(ev.target);
        const target = world.entities.get(ev.target);
        if (!model || !target?.transform || !target.character) return;
        const at = new THREE.Vector3(...target.transform.position);
        const by = ev.from === null ? undefined : world.entities.get(ev.from)?.transform;
        const travel = by
          ? at.clone().sub(new THREE.Vector3(...by.position))
          : new THREE.Vector3(...target.character.facing).negate();
        const up = new THREE.Vector3(...upAt(world, target.transform.position));
        travel.addScaledVector(up, -travel.dot(up));
        if (travel.lengthSq() < 1e-9) travel.set(...target.character.facing).negate();
        flinch(model, travel.normalize(), up, ev.amount);
        lastHit.set(ev.target, travel.clone());
      }
      // Down (stage 4c): it falls, moving as it moved, pushed the way its last hit went.
      if (ev.type === 'down') {
        const model = instances.get(ev.target);
        const target = world.entities.get(ev.target);
        if (!model || model.ragdoll || !target?.character) return;
        const push = lastHit.get(ev.target) ?? new THREE.Vector3();
        const v = target.character.velocity;
        model.ragdoll = startRagdoll(fallsOf(world), model.object, [
          v[0] + 2.5 * push.x,
          v[1] + 2.5 * push.y,
          v[2] + 2.5 * push.z,
        ]);
      }
      if (ev.type === 'revived') {
        const model = instances.get(ev.target);
        if (model) getUp(model);
      }
      // A shot (stage 4c): its tracer, from the end of what fired it as drawn (or where the world fired
      // it from) to where it struck or ended, fading.
      // (Stage 5o: the flame lance's are its flames, fire.ts.)
      if (ev.type === 'shot' && !weaponFeel(page.feel, ev.kind).flames) {
        const holding = instances.get(ev.from)?.holding;
        const from = (holding?.inView ? holding.viewMuzzle : holding?.pose?.muzzle)?.clone() ?? new THREE.Vector3(...ev.start);
        const to = new THREE.Vector3(...ev.end);
        const material = new THREE.MeshBasicMaterial({
          color: 0xfff0b0,
          transparent: true,
          opacity: 1,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        // (The shared box, from its back face along +Z: put at the start, looking at the end, as long as the way.)
        const line = own(new THREE.Mesh(tracerShape, material), { material: true });
        line.position.copy(from);
        line.lookAt(to);
        line.scale.set(TRACER_WIDTH, TRACER_WIDTH, Math.max(1e-3, from.distanceTo(to)));
        scene.add(line);
        tracers.push({ line, left: TRACER });
      }
    },
    frame({ now, world, alpha, dt, hero }) {
      frame++;
      // (How much time passed for the world: paused, none; at half speed, half.)
      const time = dt * o.timeScale();
      for (const [id, mesh] of meshes) {
        // (A still piece drawn in a batch is not drawn itself: its copy stays hidden, and is not moved.)
        if (still.has(id)) continue;
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
        mesh.position.set(...before.position).lerp(at.set(...t.position), alpha);
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
      // (Stage 5m) The still pieces' batches: again only when one came, went or moved.
      if (dirty.size > 0 || stillMoved(world)) rebatch(world);
      else if (still.size === 0 && batches.size > 0) {
        for (const square of [...batches.keys()]) unbatch(square);
        page.container.dataset.batches = '0';
      }
      // A character's animations, from its state and how it really moved in its last step (the view
      // reads the world, never writes it).
      // The falls, on by the world's time (at most five steps a frame), and their bodies into their bones.
      if (falls && [...instances.values()].some((m) => m.ragdoll)) page.cosmetic.advance(now, time);
      for (const [id, model] of instances) {
        const e = world.entities.get(id);
        const t = e?.transform;
        if (!e?.character || !t) continue;
        if (model.ragdoll && falls) {
          // (Down, what it carried is not drawn.)
          model.holding.pose = null;
          dropTool(id);
          poseRagdoll(falls, model.ragdoll);
          // (What it drew, remembered: getting up starts from where it lies.)
          inertialize(model.bones, model.inertia, false, time);
          continue;
        }
        // Its band of detail (stage 5.5g, the audit's V12: every character at full cost, at any distance):
        // near (or the page's own), all of it; farther, without its hands' and feet's rays; far, a frame in
        // `every`, with the time of those it skipped.
        const d = id === hero?.id ? 0 : camera.position.distanceTo(at.set(...t.position));
        const band = page.stage.quality.animation;
        const owed = (skipped.get(id) ?? 0) + time;
        if (d > band.far && (frame + id) % band.every !== 0) {
          skipped.set(id, owed);
          continue;
        }
        skipped.delete(id);
        const before = previous.get(id);
        const moved = before ? motion(before.position, t.position, e.character) : ([0, 0, 0] as const);
        const around =
          d <= band.near ? surroundingsOf(world, e, (other) => meshes.get(other), o.tools?.(world, e) ?? null) : undefined;
        animate(model, e.character, upAt(world, t.position), [...moved], turning.get(id) ?? 0, owed, around);
        drawTool(id, model);
      }
      // The tracers fade by the world's time (paused, they stay).
      for (let i = tracers.length - 1; i >= 0; i--) {
        const t = tracers[i]!;
        t.left -= time;
        (t.line.material as THREE.MeshBasicMaterial).opacity = Math.max(0, t.left / TRACER);
        if (t.left <= 0) {
          scene.remove(t.line);
          release(t.line);
          tracers.splice(i, 1);
        }
      }
      // For the browser tests: how many fall now (stage 4c), written when it changes.
      const falling = String([...instances.values()].filter((m) => m.ragdoll).length);
      if (page.container.dataset.falls !== falling) page.container.dataset.falls = falling;
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
      // finds no surface (it hits at 0, with no normal): no shadow. (Stage 5p, decision 0031: "a blob
      // shadow under the climber always": never smaller than half, nor fainter than 0.15; at 10 m it
      // had faded to 0.07, just when where it would land mattered most.)
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
        shadow.scale.setScalar(Math.max(SHADOW.smallest, 1 / (1 + height * 0.25)));
        (shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(SHADOW.faintest, 0.35 / (1 + height * 0.4));
      }
    },
    // (Stage 5.5g, the audit's V9: it had none, and its meshes, batches, falls' physics and shared shapes
    // outlived the page.) Everything it added, taken out and freed.
    stop() {
      for (const id of new Set([...meshes.keys(), ...zones.keys(), ...shadows.keys()])) remove(id);
      for (const square of [...batches.keys()]) unbatch(square);
      for (const t of tracers.splice(0)) {
        scene.remove(t.line);
        release(t.line);
      }
      falls = null;
      for (const g of [geometries.box, geometries.sphere, geometries.small, tracerShape, shadowShape]) g.dispose();
      shadowMaterial.dispose();
      for (const m of materials.values()) m.dispose();
      materials.clear();
    },
  };
}
