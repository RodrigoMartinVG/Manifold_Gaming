import * as THREE from 'three';
import type { Stage } from './page';

/**
 * THE STAGE: the renderer, the scene with its lights (as much of them as the world's ambient light
 * says, stage 3d), and the camera, fitted to the element it is in
 * (and refitted when it changes size). Where the camera goes is the camera's piece. (Until stage 3b
 * it drew a grid too, 20 m square, under any level; now a floor is drawn as one, if it says so.)
 */
export function createStage(container: HTMLElement): Stage {
  // 1× resolution (an integrated GPU, like the Iris Plus, struggles with 2×: four times the pixels).
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14161c);
  let day = 1;
  let renderMs = 0;
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 200);
  const sky = new THREE.HemisphereLight(0xc8d4ff, 0x3a3028, 1.4);
  scene.add(sky);
  const sun = new THREE.DirectionalLight(0xfff2e0, 1.8);
  sun.position.set(4, 8, 3);
  scene.add(sun);
  // The background darkens with them: a dark room is dark all round, not only on what it lights.
  const background = new THREE.Color(0x14161c);
  const night = new THREE.Color(0x07080b);

  const fitSize = () => {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(fitSize);
  observer.observe(container);
  fitSize();

  return {
    renderer,
    scene,
    camera,
    daylight(amount) {
      const a = Math.max(0, Math.min(1, amount));
      if (a === day) return;
      day = a;
      sky.intensity = 1.4 * a;
      sun.intensity = 1.8 * a;
      (scene.background as THREE.Color).copy(night).lerp(background, a);
    },
    render() {
      const start = performance.now();
      renderer.render(scene, camera);
      // A moving average over about 30 frames: one frame's time jitters too much to read.
      renderMs += (performance.now() - start - renderMs) / 30;
    },
    get renderMs() {
      return renderMs;
    },
    stop() {
      observer.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
