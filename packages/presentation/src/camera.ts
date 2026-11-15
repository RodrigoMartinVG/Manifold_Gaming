import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Quat, Vec3 } from '@manifold/common';
import { upAt } from '@manifold/core';
import type { Bodies } from './bodies';
import type { PageMatch } from './match';
import type { GamePage, Piece } from './page';

export type CameraMode = 'follow' | 'chase' | 'aim' | 'free';

export interface Rig extends Piece {
  /** How it goes with the character (`view.camera`). */
  readonly mode: CameraMode;
  /** Where it looks, in the world (length 1). */
  look(): Vec3;
  /** The carried turn it already turned by, aiming (stage 2d); null if none yet. */
  turn(): Quat | null;
  /** Whether it takes a click now (aiming with a character, a click takes the mouse). */
  takesClick(): boolean;
}

/** Where it starts, and where `camera.reset` brings it without a character. */
const START = { position: new THREE.Vector3(3.2, 2.4, 4.2), target: new THREE.Vector3(0, 1, 0) };

/**
 * THE CAMERA. `fixed` does not move. `orbit` is a lab's: dragging turns around the scene, the wheel
 * (or a pinch) gets closer; and with a character to drive, it goes with it in one of four ways
 * (`view.camera`: follow, chase, aim, free). A gamepad's right stick turns it too.
 */
export function mountCamera(
  page: GamePage,
  bodies: Bodies,
  match: PageMatch,
  o: {
    kind: 'orbit' | 'fixed';
    /** The right stick of a gamepad, from −1 to 1 on each axis. */
    stick(): [number, number];
    /** Whether a replay is playing (when one starts, the camera goes behind the character). */
    replaying(): boolean;
  },
): Rig {
  const { camera, renderer } = page.stage;
  camera.position.copy(START.position);
  camera.lookAt(START.target);
  const controls = o.kind === 'orbit' ? new OrbitControls(camera, renderer.domElement) : null;
  if (controls) {
    controls.target.copy(START.target);
    controls.enableDamping = true; // it slows down smoothly when released
    controls.update();
    controls.saveState(); // for camera.reset
  }
  let mode: CameraMode = 'follow';
  /** The carried turn the aiming camera already turned by (null: none yet, it starts from the one there is). */
  let cameraTurn: THREE.Quaternion | null = null;
  /** When the camera was last turned by hand (a drag, the right stick): `chase` waits a little before coming back. */
  let turnedByHand = -Infinity;
  let dragging = false;

  const turnAround = (axis: THREE.Vector3, angle: number) => {
    if (!controls) return;
    const offset = camera.position.clone().sub(controls.target).applyAxisAngle(axis, angle);
    camera.position.copy(controls.target).add(offset);
  };
  /**
   * Turns the camera around what it looks at, to look right (+dx) and down (+dy), in radians. To look
   * down the camera goes up (stage 1c2: it was the other way round, unlike dragging and most games).
   */
  const orbit = (dx: number, dy: number) => {
    if (!controls) return;
    const up = camera.up.clone().normalize();
    turnAround(up, -dx);
    // Without going past the top or the bottom (it would turn upside down).
    const offset = camera.position.clone().sub(controls.target);
    const tilt = offset.angleTo(up) - dy;
    if (tilt > 0.15 && tilt < Math.PI - 0.15) {
      const right = new THREE.Vector3().crossVectors(up, offset).normalize();
      turnAround(right, -dy);
    }
    camera.lookAt(controls.target);
  };
  // Aiming: with the mouse taken, it turns the camera around the character's head.
  const onMouseMove = (e: MouseEvent) => {
    if (mode !== 'aim' || !controls || document.pointerLockElement !== renderer.domElement) return;
    orbit(e.movementX * 0.0025, e.movementY * 0.0025);
  };
  document.addEventListener('mousemove', onMouseMove);
  // Aiming, a click takes the mouse (instead of inspecting): from then on, it turns the camera.
  let down: { x: number; y: number } | null = null;
  const takesClick = () => mode === 'aim' && controls !== null && page.player() !== undefined;
  const onDown = (e: PointerEvent) => (down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null);
  const onUp = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 || !takesClick()) return;
    if (document.pointerLockElement !== renderer.domElement) void renderer.domElement.requestPointerLock();
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);

  /**
   * Behind the character and a little above, looking at its head. Or, without a character, where it
   * started. (With damping, what is left of a turn keeps being applied after a reset, and the camera
   * drifts away again; without damping, update() applies that rest at once and throws it away: first
   * that, and then the new place.)
   */
  function reset() {
    if (!controls) return;
    controls.enableDamping = false;
    controls.update();
    const hero = page.player();
    if (hero?.transform && hero.character) {
      const up = upAt(page.session.world, hero.transform.position);
      const head = new THREE.Vector3(...hero.transform.position).addScaledVector(new THREE.Vector3(...up), 0.6);
      const behind = new THREE.Vector3(...hero.character.facing).multiplyScalar(-5.5);
      controls.target.copy(head);
      camera.position
        .copy(head)
        .add(behind)
        .addScaledVector(new THREE.Vector3(...up), 2.2);
      camera.up.set(...up);
      controls.update();
    } else controls.reset();
    controls.enableDamping = true;
  }

  if (controls) {
    page.registry.declareVariable({
      name: 'view.camera',
      description:
        "With a character to drive: `follow` follows it as if on a leash: it keeps its distance, and turns little by little when the character goes to a side (dragging turns it around); `chase` goes back behind the character by itself (dragging looks around, and it comes back when you let go: for `controls.scheme tank`); `aim` takes the mouse with a click, the mouse turns the camera and the character looks where the camera looks, walking sideways without turning (a shooter's way; Esc lets the mouse go); `free` leaves the camera where it is. A gamepad's right stick turns it too.",
      scope: 'view',
      type: { kind: 'option', options: ['follow', 'chase', 'aim', 'free'] },
      default: 'follow',
      onChange: (v) => {
        mode = v as CameraMode;
        cameraTurn = null;
        // In aim mode, the mouse turns the camera without dragging: OrbitControls does not rotate.
        controls.enableRotate = mode !== 'aim';
        if (mode !== 'aim' && document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      },
    });
    controls.addEventListener('start', () => (dragging = true));
    controls.addEventListener('end', () => {
      dragging = false;
      turnedByHand = performance.now();
    });
    page.registry.declareCommand({
      name: 'camera.reset',
      description:
        'The camera back to where it started, or behind the character (drag to look around; the wheel, or a pinch, gets closer).',
      run: (_, out) => {
        reset();
        out.write(page.player() ? 'the camera is behind the character' : 'the camera is back where it started');
      },
    });
  }

  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();

  return {
    get mode() {
      return mode;
    },
    look() {
      const v = camera.getWorldDirection(new THREE.Vector3());
      return [v.x, v.y, v.z];
    },
    turn: () => (cameraTurn ? [cameraTurn.x, cameraTurn.y, cameraTurn.z, cameraTurn.w] : null),
    takesClick,
    welcome(_, m) {
      cameraTurn = null;
      if (controls && page.player() && (!m.session || o.replaying())) reset();
    },
    frame({ now, dt, alpha, world, hero }) {
      if (!controls) return;
      // A gamepad's right stick turns the camera (2.5 radians per second, pushed all the way).
      const [stickX, stickY] = o.stick();
      if (stickX || stickY) {
        orbit(stickX * 2.5 * dt, stickY * 2.5 * dt);
        turnedByHand = now;
      }
      const heroMesh = hero && bodies.meshes.get(hero.id);
      if (mode !== 'free' && heroMesh && hero?.transform && hero.character) {
        const up = new THREE.Vector3(...upAt(world, hero.transform.position));
        const head = heroMesh.position.clone().addScaledVector(up, 0.6);
        if (mode === 'aim') {
          // Aiming, it moves as much as the head moved (the mouse turns it).
          const moved = head.sub(controls.target);
          controls.target.add(moved);
          camera.position.add(moved);
          // On a platform that turns (stage 2d), aiming, the camera IS where the character looks, and the
          // character reads where to look inside the turn the platforms gave it (`carriedTurn`, the
          // core): the platform turns it, exactly, step by step, in the simulation. The camera turns as
          // much as that turn changed since the last frame, read from the world and drawn between the
          // previous step's and this one's (by `alpha`, like everything else); and the player asks for
          // `face` inside it (drive.ts), so with the mouse still it asks for the same thing all the time.
          const turnNow = hero.character.carriedTurn;
          const before = bodies.previousTurn.get(hero.id) ?? turnNow;
          const drawn = new THREE.Quaternion().slerpQuaternions(qa.set(...before), qb.set(...turnNow), alpha);
          if (cameraTurn) {
            const change = drawn.clone().multiply(cameraTurn.clone().invert());
            const offset = camera.position.clone().sub(controls.target).applyQuaternion(change);
            camera.position.copy(controls.target).add(offset);
          }
          cameraTurn = drawn;
        } else {
          // ON A LEASH (stage 1c2): the camera keeps its height and its distance (along the ground) to
          // the head, but it stays where it is as long as it can. Going away pulls it along, coming
          // closer pushes it back, and going to a side turns it, little by little (before, it only moved
          // as much as the head: it never turned by itself).
          //
          // On a platform that moves or turns (stage 2d), the camera first goes along as far as the
          // platform carried the character this frame (`ground.velocity`, the platform's velocity under
          // it), so the leash does not take that for walking sideways. But it does NOT turn with the
          // platform: the world stays still on the screen, and what turns is the character, which the
          // platform turns with it (its visor goes round: it looks around). A first version turned the
          // camera with the platform: the character then stayed the same on the screen and the whole
          // world went round it, and the leash, which saw it carried sideways, made the camera fall
          // behind (16° in 3.5 s on the carousel). Chasing, the camera still comes back behind it.
          const carried = new THREE.Vector3(...hero.character.ground.velocity).multiplyScalar(
            match.paused ? 0 : dt * match.timescale,
          );
          camera.position.add(carried);
          controls.target.add(carried);
          const offset = camera.position.clone().sub(controls.target);
          const height = offset.dot(up);
          const reach = offset.addScaledVector(up, -height).length();
          const along = camera.position.clone().sub(head);
          along.addScaledVector(up, -along.dot(up));
          if (along.lengthSq() < 1e-6) along.copy(offset);
          // Chasing: and it comes back behind the character, unless it was just turned by hand.
          if (mode === 'chase' && !dragging && now - turnedByHand > 600) {
            const behind = new THREE.Vector3(...hero.character.facing).negate();
            behind.addScaledVector(up, -behind.dot(up));
            const angle = Math.atan2(new THREE.Vector3().crossVectors(along, behind).dot(up), along.dot(behind));
            along.applyAxisAngle(up, angle * (1 - Math.exp(-4 * dt)));
          }
          along.setLength(reach);
          controls.target.copy(head);
          camera.position.copy(head).add(along).addScaledVector(up, height);
        }
      }
      controls.update();
    },
    stop() {
      document.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      controls?.dispose();
    },
  };
}
