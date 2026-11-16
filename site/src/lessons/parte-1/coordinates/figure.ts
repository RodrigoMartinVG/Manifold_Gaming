import * as THREE from 'three';

/**
 * THE PIECES OF THE FIGURE: segments (solid or dashed), rods, filled triangles and right-angle
 * marks, all inside `parent`, and all moved every frame with `set`. Not part of the lesson: how
 * lines are drawn.
 */
export function createFigure(parent: THREE.Object3D) {
  /** A segment from a to b; dashed, if asked. */
  function segment(color: number, dashed = false) {
    const material = dashed
      ? new THREE.LineDashedMaterial({ color, dashSize: 0.1, gapSize: 0.07 })
      : new THREE.LineBasicMaterial({ color });
    const ends = [new THREE.Vector3(), new THREE.Vector3(0, 1, 0)];
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ends), material);
    // Dashes are drawn by the distance along the line: 0 at a, the length at b.
    line.computeLineDistances();
    const along = line.geometry.getAttribute('lineDistance');
    line.frustumCulled = false; // it moves: never skip it for an old bounding box
    parent.add(line);
    return {
      set(a: THREE.Vector3, b: THREE.Vector3) {
        line.geometry.setFromPoints([a, b]);
        along.setX(1, a.distanceTo(b));
        along.needsUpdate = true;
      },
    };
  }

  /** A rod from a to b: a thick segment. */
  function rod(color: number, radius: number) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 1, 12),
      new THREE.MeshStandardMaterial({ color }),
    );
    parent.add(mesh);
    const UP = new THREE.Vector3(0, 1, 0);
    const direction = new THREE.Vector3();
    return {
      set(a: THREE.Vector3, b: THREE.Vector3) {
        const length = a.distanceTo(b);
        mesh.visible = length > 0.01;
        // A cylinder is born standing, 1 m tall: put it halfway, turn its axis from up to the
        // direction from a to b, and stretch it to the length.
        mesh.position.copy(a).add(b).multiplyScalar(0.5);
        if (mesh.visible)
          mesh.quaternion.setFromUnitVectors(UP, direction.subVectors(b, a).normalize());
        mesh.scale.set(1, Math.max(length, 0.01), 1);
      },
    };
  }

  /** A triangle, filled and see-through. */
  function triangle(color: number) {
    const corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const geometry = new THREE.BufferGeometry().setFromPoints(corners);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    parent.add(mesh);
    return {
      set(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) {
        geometry.setFromPoints([a, b, c]);
      },
    };
  }

  /** The little square that marks a right angle at `corner`, between the sides towards a and b. */
  function rightAngle(color: number, size = 0.22) {
    const points = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color }),
    );
    line.frustumCulled = false;
    parent.add(line);
    const u = new THREE.Vector3();
    const v = new THREE.Vector3();
    return {
      set(corner: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) {
        u.subVectors(a, corner);
        v.subVectors(b, corner);
        // On a side shorter than the mark, there is no room for it.
        line.visible = u.length() > 2 * size && v.length() > 2 * size;
        u.setLength(size);
        v.setLength(size);
        points[0].copy(corner).add(u);
        points[1].copy(corner).add(u).add(v);
        points[2].copy(corner).add(v);
        line.geometry.setFromPoints(points);
      },
    };
  }

  return { segment, rod, triangle, rightAngle };
}
