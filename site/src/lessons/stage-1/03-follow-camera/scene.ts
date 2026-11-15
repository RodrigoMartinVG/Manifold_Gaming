import * as THREE from 'three';

/**
 * The usual (renderer, scene, camera, lights, floor and the loop), and a MAP: a second camera, from
 * above, drawn in a corner. The map also sees layer 1, where `main.ts` puts what only it shows (the
 * camera and its leash).
 */
export function createScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setScissorTest(true);
  document.body.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x15120f);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  camera.position.set(0, 2.5, 6);
  scene.add(new THREE.HemisphereLight(0xc8d4ff, 0x3a3028, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(3, 6, 2);
  scene.add(sun);
  scene.add(new THREE.GridHelper(40, 40, 0x3a4050, 0x262a33));

  // The map: looking straight down, with "up" on the screen towards −Z (forward).
  const map = new THREE.OrthographicCamera(-9, 9, 9, -9, 0.1, 100);
  map.up.set(0, 0, -1);
  map.position.set(0, 30, 0);
  map.lookAt(0, 0, 0);
  map.layers.enable(1);

  const fit = () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', fit);
  fit();

  /** Calls `update` on every frame with the seconds since the previous one, and draws: the view, then the map. */
  function onFrame(update: (dt: number) => void) {
    let before = performance.now();
    const frame = (now: number) => {
      update(Math.min(0.25, (now - before) / 1000));
      before = now;
      renderer.setViewport(0, 0, innerWidth, innerHeight);
      renderer.setScissor(0, 0, innerWidth, innerHeight);
      renderer.render(scene, camera);
      const side = Math.round(Math.min(innerWidth, innerHeight) * 0.32);
      renderer.setViewport(8, 8, side, side);
      renderer.setScissor(8, 8, side, side);
      renderer.render(scene, map);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  return { scene, camera, map, onFrame };
}
