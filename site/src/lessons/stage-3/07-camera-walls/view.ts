import * as THREE from 'three';

/** Where the camera wants to be and where it is shown, as camera.ts gives them. */
interface CameraView {
  wanted: THREE.Vector3;
  at: THREE.Vector3;
  hit: boolean;
}

/**
 * WHAT IS DRAWN about the camera: the marks only the view from above sees (layer 1, over the walls),
 * and, bottom left, what the player sees: the same scene from the camera on the leash, drawn by a
 * second renderer into a canvas of its own. That camera sees layer 2 (the solid ceiling), not the
 * marks.
 */
export function createViews(scene: THREE.Scene) {
  function mark(color: number, wireframe: boolean) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 16, 12),
      new THREE.MeshBasicMaterial({ color, wireframe, depthTest: false, transparent: true }),
    );
    mesh.layers.set(1);
    mesh.renderOrder = 1;
    scene.add(mesh);
    return mesh;
  }
  const wantedMark = mark(0x9ab0d0, true); // where it wants to be: a wire ball
  const cameraMark = mark(0xe0a040, false); // where it is shown: the ball it sweeps
  const sweepLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ depthTest: false, transparent: true }),
  );
  sweepLine.layers.set(1);
  sweepLine.renderOrder = 1;
  scene.add(sweepLine);

  // The engine's lens: 60° tall, and the near plane 5 cm in front of the eye.
  const eye = new THREE.PerspectiveCamera(60, 1 / 0.62, 0.05, 100);
  eye.layers.enable(2);
  const small = new THREE.WebGLRenderer({ antialias: true });
  small.setPixelRatio(Math.min(devicePixelRatio, 2));
  small.domElement.style.cssText =
    'position: fixed; left: 8px; bottom: 8px; outline: 1px solid #e0a040';
  document.body.append(small.domElement);
  const fit = () => {
    const width = Math.round(Math.min(innerWidth * 0.42, 440));
    small.setSize(width, Math.round(width * 0.62));
  };
  addEventListener('resize', fit);
  fit();

  /** One frame: the marks where they are (the sweep red when it meets something), and the view. */
  function draw(head: THREE.Vector3, view: CameraView) {
    wantedMark.position.copy(view.wanted);
    cameraMark.position.copy(view.at);
    sweepLine.geometry.setFromPoints([head, view.wanted]);
    sweepLine.material.color.set(view.hit ? 0xe06c5a : 0x93d9c9);
    eye.position.copy(view.at);
    eye.lookAt(head);
    small.render(scene, eye);
  }

  return { draw };
}
