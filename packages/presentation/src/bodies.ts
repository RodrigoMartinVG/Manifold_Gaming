import * as THREE from 'three';
import type { Quat, Vec3 } from '@manifold/common';
import type { Appearance, Entity, EntityId, World } from '@manifold/core';
import type { VariableInfo } from '@manifold/commands';
import type { GamePage, Piece } from './page';

/** An entity's pose at the previous step: it is drawn halfway between that one and the current one. */
interface Pose {
  position: Vec3;
  rotation: Quat;
}

export interface Bodies extends Piece {
  /** Each entity's mesh, by entity (the ones that have an appearance). */
  readonly meshes: ReadonlyMap<EntityId, THREE.Mesh>;
  /** Each character's carried turn at the previous step (stage 2d): the aiming camera turns with it, drawn between steps. */
  readonly previousTurn: ReadonlyMap<EntityId, Quat>;
  /** A mesh for an appearance (the ghost's, for instance). */
  meshFor(a: Appearance): THREE.Mesh;
  /** The entity whose mesh is under a point of the screen (x and y from −1 to 1), if any. */
  entityAt(x: number, y: number): EntityId | undefined;
}

const ZONE_COLORS: Record<string, number> = { checkpoint: 0x5ad87a, goal: 0xe0c05a, fall: 0xd85a5a };

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
 */
export function mountBodies(page: GamePage): Bodies {
  const { scene, camera } = page.stage;
  const meshes = new Map<EntityId, THREE.Mesh>();
  const previous = new Map<EntityId, Pose>();
  const previousTurn = new Map<EntityId, Quat>();
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
   * A mesh for an appearance. Boxes and spheres are one shared shape, scaled; a capsule is built at
   * its size (scaling would squash its round ends), with a visor that shows where it looks (−Z).
   */
  const meshFor = (a: Appearance) => {
    const material = new THREE.MeshLambertMaterial({ color: a.color, wireframe });
    if (a.shape !== 'capsule') {
      const mesh = new THREE.Mesh(geometries[a.shape], material);
      mesh.scale.set(...a.size);
      return mesh;
    }
    const radius = a.size[0] / 2;
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, a.size[1] - a.size[0], 6, 16), material);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 1.2, radius * 0.45, radius * 0.5),
      new THREE.MeshLambertMaterial({ color: 0x1a1714, wireframe }),
    );
    visor.position.set(0, a.size[1] * 0.28, -radius * 0.85);
    mesh.add(visor);
    return mesh;
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
    const mesh = meshFor(e.appearance);
    scene.add(mesh);
    meshes.set(e.id, mesh);
  };
  const remove = (id: EntityId) => {
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
      mesh.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        (o.material as THREE.Material).dispose();
        // Shared shapes (boxes, spheres) stay; a capsule's own shape and its visor's go.
        if (o.geometry !== geometries.box && o.geometry !== geometries.sphere) o.geometry.dispose();
      });
    }
    meshes.delete(id);
    previous.delete(id);
    previousTurn.delete(id);
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
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();

  return {
    meshes,
    previousTurn,
    meshFor,
    entityAt(x, y) {
      pointer.set(x, y);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects([...meshes.values()], false)[0];
      return hit && [...meshes].find(([, mesh]) => mesh === hit.object)?.[0];
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
    frame({ world, alpha }) {
      for (const [id, mesh] of meshes) {
        const t = world.entities.get(id)?.transform;
        const before = previous.get(id) ?? t;
        if (!t || !before) continue;
        mesh.position.set(...before.position).lerp(new THREE.Vector3(...t.position), alpha);
        mesh.quaternion.slerpQuaternions(qa.set(...before.rotation), qb.set(...t.rotation), alpha);
      }
    },
  };
}
