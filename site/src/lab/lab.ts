import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { centreShift } from './geometry';
import { createLabels, type Label } from './labels';

/** What a figure starts with. */
export interface LabOptions {
  /** The panel's title. */
  title: string;
  /** Where the camera stands, and what it looks at (it can be dragged around it). */
  camera?: [number, number, number];
  target?: [number, number, number];
  /** A floor grid of this size in meters (1 m squares), or none. */
  grid?: number | false;
}

/** A figure: the scene, its camera, its panel, its labels and its loop. */
export interface Lab {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  renderer: THREE.WebGLRenderer;
  /** The panel: settings the reader changes, and the numbers the figure shows. */
  gui: GUI;
  /** A name over a point of the scene. */
  label(text?: string): Label;
  /** Calls `update` on every frame with the seconds since the previous one (at most 0.25), then draws. */
  onFrame(update: (dt: number) => void): void;
}

/**
 * A FIGURE TO PLAY WITH: the shared start of the tutorial's live figures (the "lab kit", decision 0021).
 * Renderer, scene, a camera the reader can turn around (drag), light, a floor grid, the panel and the
 * labels. The panel covers the right of the picture: the camera's centre is moved to the middle of what
 * it leaves, so what the camera looks at is never under the panel.
 */
export function createLab(o: LabOptions): Lab {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  document.body.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b1713);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 400);
  camera.position.set(...(o.camera ?? [6, 5, 8]));
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...(o.target ?? [0, 0.5, 0]));
  controls.enableDamping = true;
  scene.add(new THREE.HemisphereLight(0xd8e0ff, 0x3a3028, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(4, 8, 3);
  scene.add(sun);
  if (o.grid !== false) {
    const size = o.grid ?? 12;
    scene.add(new THREE.GridHelper(size, size, 0x5c5246, 0x3a332c));
  }

  const gui = new GUI({ title: o.title });
  const labels = createLabels(camera, renderer.domElement);

  // The picture takes the window; its centre moves left by half the panel (and back when it closes).
  const fit = () => {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    const panel = gui.domElement.classList.contains('closed') ? 0 : gui.domElement.offsetWidth;
    camera.setViewOffset(w, h, centreShift(w, panel), 0, w, h);
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', fit);
  // (The panel closes and opens by its title: lil-gui 0.17, the one three.js brings, does not announce it,
  // but it changes the panel's class.)
  new MutationObserver(fit).observe(gui.domElement, { attributes: true, attributeFilter: ['class'] });
  fit();

  function onFrame(update: (dt: number) => void) {
    let before = performance.now();
    const frame = (now: number) => {
      update(Math.min(0.25, (now - before) / 1000));
      before = now;
      controls.update();
      renderer.render(scene, camera);
      labels.place();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  const lab = { scene, camera, controls, renderer, gui, label: labels.label, onFrame };
  // In the browser's console, in the figure's frame, `lab` is the figure: `lab.camera.position`,
  // `lab.scene.children`... (and the browser tests read it there too).
  Object.assign(globalThis, { lab });
  return lab;
}
