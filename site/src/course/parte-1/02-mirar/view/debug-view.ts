import * as THREE from 'three';
import type { Primitive } from '../debug';

/**
 * WHAT DRAWS THE DEBUG REQUESTS (lesson 1.7): every frame, the queue's primitives (debug.ts), made with
 * three.js and kept from one frame to the next (one object per place in the list, made once, moved,
 * hidden when the list is shorter). Text goes in boxes of the page over the picture, where the camera
 * sees its point. Over everything when a request asks it (`depth: false`): the material does not test
 * the depth, and it is drawn last.
 */
export function createDebugView(scene: THREE.Scene, camera: THREE.Camera) {
  const arrows: THREE.ArrowHelper[] = [];
  const lines: THREE.Line[] = [];
  const points: THREE.Mesh[] = [];
  const texts: HTMLDivElement[] = [];
  const ball = new THREE.SphereGeometry(0.06, 12, 8);
  const v = (p: { x: number; y: number; z: number }) => new THREE.Vector3(p.x, p.y, p.z);
  /** Over everything, or hidden by solids, as asked. */
  const depthOf = (object: THREE.Object3D, depth: boolean) => {
    object.traverse((o) => {
      const material = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (material) material.depthTest = depth;
      o.renderOrder = depth ? 0 : 10;
    });
  };

  function draw(primitives: readonly Primitive[]) {
    let [na, nl, np, nt] = [0, 0, 0, 0];
    for (const p of primitives) {
      if (p.kind === 'arrow') {
        const length = Math.hypot(p.vector.x, p.vector.y, p.vector.z);
        if (length < 1e-6) continue; // an arrow of no length has no direction to draw
        const a = (arrows[na++] ??= (() => {
          const made = new THREE.ArrowHelper();
          scene.add(made);
          return made;
        })());
        a.visible = true;
        a.position.copy(v(p.from));
        a.setDirection(v(p.vector).divideScalar(length));
        a.setLength(length, Math.min(0.25, 0.3 * length), Math.min(0.12, 0.15 * length));
        a.setColor(p.color);
        depthOf(a, p.depth);
      } else if (p.kind === 'line') {
        const l = (lines[nl++] ??= (() => {
          const made = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial());
          made.frustumCulled = false;
          scene.add(made);
          return made;
        })());
        l.visible = true;
        l.geometry.setFromPoints([v(p.from), v(p.to)]);
        (l.material as THREE.LineBasicMaterial).color.setHex(p.color);
        depthOf(l, p.depth);
      } else if (p.kind === 'point') {
        const m = (points[np++] ??= (() => {
          const made = new THREE.Mesh(ball, new THREE.MeshBasicMaterial());
          scene.add(made);
          return made;
        })());
        m.visible = true;
        m.position.copy(v(p.at));
        (m.material as THREE.MeshBasicMaterial).color.setHex(p.color);
        depthOf(m, p.depth);
      } else {
        const box = (texts[nt++] ??= (() => {
          const made = document.createElement('div');
          made.style.cssText =
            'position:fixed;transform:translate(-50%,-100%);font:12px/1.3 system-ui,sans-serif;white-space:nowrap;' +
            'padding:1px 5px;border-radius:3px;background:rgb(20 16 12 / 0.7);pointer-events:none';
          document.body.append(made);
          return made;
        })());
        // Where the camera sees the point, in pixels of the window (nothing if it is behind the camera).
        const seen = v(p.at).project(camera);
        box.hidden = seen.z > 1;
        box.style.left = `${((seen.x + 1) / 2) * innerWidth}px`;
        box.style.top = `${((1 - seen.y) / 2) * innerHeight}px`;
        box.style.color = `#${p.color.toString(16).padStart(6, '0')}`;
        box.textContent = p.text;
      }
    }
    // What the list no longer has, hidden (kept for the next frame that needs it).
    for (let i = na; i < arrows.length; i++) arrows[i]!.visible = false;
    for (let i = nl; i < lines.length; i++) lines[i]!.visible = false;
    for (let i = np; i < points.length; i++) points[i]!.visible = false;
    for (let i = nt; i < texts.length; i++) texts[i]!.hidden = true;
  }

  /** Everything it made, freed (the window's shut-down calls it before its own). */
  function dispose() {
    for (const a of arrows) {
      scene.remove(a);
      a.dispose();
    }
    for (const o of [...lines, ...points]) {
      scene.remove(o);
      if (o instanceof THREE.Line) o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
    ball.dispose();
    for (const t of texts) t.remove();
  }

  return { draw, dispose };
}
