import * as THREE from 'three';

/**
 * THE WINDOW INTO THE WORLD: what draws it. A renderer, which talks to the graphics card; a scene, with what
 * there is to draw; a camera, from where it is seen; some light; and a loop that draws it all again on every
 * frame. The camera starts looking along −Z, without any turn. It only draws: the world is data, in
 * world.ts, and the drawing reads it.
 */
export function createView(o: { eye: [number, number, number]; fov: number }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  document.body.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x221d18);
  const camera = new THREE.PerspectiveCamera(o.fov, 1, 0.1, 200);
  camera.position.set(...o.eye);
  scene.add(new THREE.HemisphereLight(0xc8d4ff, 0x3a3028, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(3, 6, 2);
  scene.add(sun);

  // The picture takes the whole window, and keeps its proportions when the window changes.
  const fit = () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', fit);
  fit();

  let next = 0; // the frame asked for
  /** Calls `update` on every frame with the seconds since the previous one, then draws. */
  function onFrame(update: (dt: number) => void) {
    let before = performance.now();
    const frame = (now: number) => {
      update(Math.min(0.25, (now - before) / 1000));
      before = now;
      renderer.render(scene, camera);
      next = requestAnimationFrame(frame);
    };
    next = requestAnimationFrame(frame);
  }

  /** SHUT-DOWN, the start-up in reverse: no more frames, no more listening, the graphics card's memory freed. */
  function dispose() {
    cancelAnimationFrame(next);
    removeEventListener('resize', fit);
    renderer.dispose();
    renderer.domElement.remove();
  }

  return { scene, camera, renderer, onFrame, dispose };
}
