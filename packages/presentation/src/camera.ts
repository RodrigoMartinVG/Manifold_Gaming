import * as THREE from 'three';
import type { CommandInfo, VariableInfo } from '@manifold/commands';
import type { Quat, Vec3 } from '@manifold/common';
import { upAt, type World } from '@manifold/core';
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

/** What the camera lets people change, as data (the site's console reference reads it). */
export const CAMERA_VARIABLES = {
  camera: {
    name: 'view.camera',
    description:
      "With a character to drive: `follow` follows it as if on a leash: it keeps its distance, and turns little by little when the character goes to a side (dragging turns it around); `chase` goes back behind the character by itself (dragging looks around, and it comes back when you let go: for `controls.scheme tank`); `aim` takes the mouse with a click, the mouse turns the camera and the character looks where the camera looks, walking sideways without turning (a shooter's way; Esc lets the mouse go); `free` leaves the camera where it is. A gamepad's right stick turns it too.",
    scope: 'view',
    type: { kind: 'option', options: ['follow', 'chase', 'aim', 'free'] },
    default: 'follow',
  },
  // The player's settings (stage 3i): the menu shows them, and they are kept in the browser.
  mouse: {
    name: 'view.mouse',
    description: 'How fast the mouse turns the camera, dragging or aiming (stage 3i): 1 as it comes, 2 twice as fast.',
    scope: 'view',
    type: { kind: 'number', min: 0.2, max: 3 },
    default: 1,
  },
  stick: {
    name: 'view.stick',
    description:
      "How fast a gamepad's right stick turns the camera (stage 3i): 1 as it comes (2.5 radians per second, pushed all the way).",
    scope: 'view',
    type: { kind: 'number', min: 0.2, max: 3 },
    default: 1,
  },
  invert: {
    name: 'view.invert',
    description:
      'Up is down (stage 3i): moving the mouse while aiming, or the right stick, up turns the camera to look down, like a plane. Dragging is not inverted: what is dragged follows the finger.',
    scope: 'view',
    type: { kind: 'boolean' },
    default: false,
  },
  calm: {
    name: 'view.calm',
    description:
      'Less camera motion, for whoever gets dizzy (stage 3i): a drag does not keep turning it once let go, and coming back behind the character, or turning where a zone says, goes half as fast.',
    scope: 'view',
    type: { kind: 'boolean' },
    default: false,
  },
} as const satisfies Record<string, VariableInfo>;
export const CAMERA_COMMANDS = {
  reset: {
    name: 'camera.reset',
    description:
      'The camera back to where it started, or behind the character (drag to look around; the wheel, or a pinch, gets closer).',
  },
} as const satisfies Record<string, CommandInfo>;

/**
 * In the air, how far up and down the screen the head can go before the camera follows it: a share
 * of the way from the screen's center to its top edge, and to its bottom one. On the screen, not in
 * meters: a band in meters said nothing about what is seen (1.2 m held a step, but not the Dojo's
 * own jump, 2.1 m: the camera still rose 0.9 m with it); this one holds as much as the lens and the
 * distance let be seen.
 */
const DEAD_ZONE = { above: 0.8, below: 0.6 };

/** Where it starts, and where `camera.reset` brings it without a character. */
const START = { position: new THREE.Vector3(3.2, 2.4, 4.2), target: new THREE.Vector3(0, 1, 0) };
/** How close to and how far from what it looks at the wheel or a pinch can take it, in meters. */
const NEAREST = 0.5;
/** Against walls (stage 3h): how far it keeps from them (the ball swept from the head, m), how close to the head it may come, and how fast it goes back out (per second). */
const CLEARANCE = 0.25;
const CLOSEST = 0.35;
const OUT = 3;
/** How fast a zone's suggestion turns the camera (per second: gentler than `chase` coming back behind). */
const SUGGESTED = 2;

/** Where a zone the character is in suggests looking (stage 3h: its `view`, a direction), if one does. */
function viewOf(world: World, id: number): THREE.Vector3 | null {
  for (const zone of world.entities.values()) {
    const view = zone.sensor?.params.view;
    if (view?.length === 3 && zone.sensor!.inside.includes(id)) return new THREE.Vector3(view[0], view[1], view[2]).normalize();
  }
  return null;
}
const FARTHEST = 120;
/**
 * How fast what is left of a drag dies out: e^(−4t), half of it in 0.17 s. Always, also while the drag
 * pauses: let go right after moving, it keeps turning; after holding still a second, it hardly does.
 */
const SETTLE = 4;
/** The most it keeps turning with, in radians per second (two turns): two moves a moment apart do not fling it. */
const FASTEST = 4 * Math.PI;

/**
 * THE CAMERA. `fixed` does not move. `orbit` is a lab's: dragging turns it around what it looks at,
 * the wheel (or a pinch) gets closer, the right button (or two fingers) moves it sideways; and with a
 * character to drive, it goes with it in one of four ways (`view.camera`: follow, chase, aim, free).
 * A gamepad's right stick turns it too.
 *
 * ITS OWN ORBIT (stage 2.5a). Before, three.js's OrbitControls turned it, and kept a turn of its own
 * inside, which it went on applying after a drag (the camera slowing down by itself): the camera went
 * where we put it (behind the character, back to the start), and then OrbitControls moved it again
 * with what it still had. `camera.reset` had to turn that off, apply the rest and turn it back on.
 * Here a drag, the mouse aiming, the stick and the leash all go through the same orbit, and what is
 * left of a drag is a velocity of ours: putting the camera somewhere sets it to zero.
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
  const canvas = renderer.domElement;
  const orbiting = o.kind === 'orbit';
  /** What it looks at, and turns around. */
  const target = START.target.clone();
  camera.position.copy(START.position);
  camera.lookAt(target);
  let mode: CameraMode = 'follow';
  /** The carried turn the aiming camera already turned by (null: none yet, it starts from the one there is). */
  let cameraTurn: THREE.Quaternion | null = null;
  /** How high (along "up") the leash looks: the head's height, but not a jump's (null: from the head, next frame). */
  let lookHeight: number | null = null;
  /** When the camera was last turned by hand (a drag, the right stick): `chase` waits a little before coming back. */
  let turnedByHand = -Infinity;
  /** What is left of a drag after letting go, in radians per second (right, down). */
  const drift = { x: 0, y: 0 };
  /** The pointers on the screen (a finger, the mouse), where they were at the last move, and their buttons. */
  const pointers = new Map<number, { x: number; y: number; buttons: number; at: number }>();
  /** The player's settings (stage 3i): how fast the mouse and the stick turn it, whether up is down, and less motion. */
  const settings = { mouse: 1, stick: 1, invert: false, calm: false };
  /**
   * AGAINST WALLS (stage 3h): how far the camera was brought in front of a wall at the last frame (taken
   * back at the start of the next, so the leash keeps its own distance: it never learns the wall's), and
   * how many meters in front of where it wants to be it is shown now (`cut`): what a wall took, given
   * back slowly. Without walls, 0: it is where it wants to be, however that changes (a first version
   * kept how far from the head instead, and eased every growth of it, walls or not: coming down from a
   * jump, the camera lagged 10 cm).
   */
  const pulled = new THREE.Vector3();
  let cut = 0;
  /** Back where it wants to be: what moves it (a drag, the wheel, the leash) moves that, never the pull. */
  const unpull = () => {
    camera.position.sub(pulled);
    pulled.set(0, 0, 0);
  };

  const turnAround = (axis: THREE.Vector3, angle: number) => {
    unpull();
    const offset = camera.position.clone().sub(target).applyAxisAngle(axis, angle);
    camera.position.copy(target).add(offset);
  };
  /**
   * Turns the camera around what it looks at, to look right (+dx) and down (+dy), in radians. To look
   * down the camera goes up (stage 1c2: it was the other way round, unlike dragging and most games).
   */
  const orbit = (dx: number, dy: number) => {
    const up = camera.up.clone().normalize();
    turnAround(up, -dx);
    // Without going past the top or the bottom (it would turn upside down).
    const offset = camera.position.clone().sub(target);
    const tilt = offset.angleTo(up) - dy;
    if (tilt > 0.15 && tilt < Math.PI - 0.15) {
      const right = new THREE.Vector3().crossVectors(up, offset).normalize();
      turnAround(right, -dy);
    }
    camera.lookAt(target);
  };
  /** Closer (scale < 1) or farther (> 1) from what it looks at. */
  const dolly = (scale: number) => {
    unpull();
    const offset = camera.position.clone().sub(target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() * scale, NEAREST, FARTHEST));
    camera.position.copy(target).add(offset);
  };
  /** Sideways and up or down, by pixels of the screen: what it looks at goes along under the pointer. */
  const pan = (dx: number, dy: number) => {
    unpull();
    const perPixel =
      (2 * camera.position.distanceTo(target) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / canvas.clientHeight;
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0).multiplyScalar(-dx * perPixel);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1).multiplyScalar(dy * perPixel);
    target.add(right).add(up);
    camera.position.add(right).add(up);
  };

  // ---------- By hand: a drag turns it, the wheel or a pinch gets closer, the right button or two fingers move it ----------
  /** A drag across the whole height of the screen turns it a whole turn (as OrbitControls did). */
  const perPixel = () => ((2 * Math.PI) / Math.max(1, canvas.clientHeight)) * settings.mouse;
  const spread = () => {
    const [a, b] = [...pointers.values()];
    return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, apart: Math.hypot(a.x - b.x, a.y - b.y) } : null;
  };
  const onDown = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, buttons: e.buttons, at: e.timeStamp });
    drift.x = drift.y = 0;
  };
  const onMove = (e: PointerEvent) => {
    const was = pointers.get(e.pointerId);
    if (!was) return;
    const before = spread();
    const dx = e.clientX - was.x;
    const dy = e.clientY - was.y;
    const dt = Math.max(1, e.timeStamp - was.at) / 1000;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, buttons: e.buttons, at: e.timeStamp });
    const after = spread();
    if (before && after) {
      // Two fingers: apart or together gets closer or farther; both moving, sideways.
      if (after.apart > 0) dolly(before.apart / after.apart);
      pan(after.x - before.x, after.y - before.y);
    } else if (was.buttons & 2 || e.shiftKey) pan(dx, dy);
    else if (mode !== 'aim') {
      // Aiming, the mouse turns it, not a drag.
      orbit(dx * perPixel(), dy * perPixel());
      // What it keeps turning with when let go: how fast it was turning (smoothed over the last moves).
      const clamp = (v: number) => THREE.MathUtils.clamp(v, -FASTEST, FASTEST);
      drift.x = clamp(0.5 * drift.x + 0.5 * ((dx * perPixel()) / dt));
      drift.y = clamp(0.5 * drift.y + 0.5 * ((dy * perPixel()) / dt));
    }
  };
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) turnedByHand = performance.now();
    // From two fingers to one: the one left starts from where it is (it does not jump).
    for (const [id, p] of pointers) pointers.set(id, { ...p, at: e.timeStamp });
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    dolly(Math.exp(THREE.MathUtils.clamp(e.deltaY, -100, 100) * 0.0015));
  };
  const noMenu = (e: Event) => e.preventDefault();
  // Aiming, a click takes the mouse (instead of inspecting): from then on, it turns the camera.
  const takesClick = () => mode === 'aim' && orbiting && page.player() !== undefined;
  let down: { x: number; y: number } | null = null;
  const onClickDown = (e: PointerEvent) => (down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null);
  const onClickUp = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 || !takesClick()) return;
    if (document.pointerLockElement !== canvas) void canvas.requestPointerLock();
  };
  if (orbiting) {
    // The browser does not scroll or zoom the page with gestures on it: they are the camera's.
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerdown', onClickDown);
    canvas.addEventListener('pointerup', onClickUp);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', noMenu);
    document.addEventListener('mousemove', onAimMove);
  }
  // Aiming, with the mouse taken (pointer lock), it turns the camera around the character's head, with
  // a button held or not (in a shooter, one aims while firing).
  function onAimMove(e: MouseEvent) {
    const turn = 0.0025 * settings.mouse;
    if (mode === 'aim' && document.pointerLockElement === canvas)
      orbit(e.movementX * turn, e.movementY * turn * (settings.invert ? -1 : 1));
  }

  /** Behind the character and a little above, looking at its head. Or, without a character, where it started. */
  function reset() {
    drift.x = drift.y = 0;
    pulled.set(0, 0, 0);
    cut = 0;
    lookHeight = null;
    const hero = page.player();
    if (hero?.transform && hero.character) {
      const up = new THREE.Vector3(...upAt(page.session.world, hero.transform.position));
      const head = new THREE.Vector3(...hero.transform.position).addScaledVector(up, 0.6);
      target.copy(head);
      camera.position
        .copy(head)
        .add(new THREE.Vector3(...hero.character.facing).multiplyScalar(-5.5))
        .addScaledVector(up, 2.2);
      camera.up.copy(up);
    } else {
      target.copy(START.target);
      camera.position.copy(START.position);
      camera.up.set(0, 1, 0);
    }
    camera.lookAt(target);
  }

  if (orbiting) {
    page.registry.declareVariable({
      ...CAMERA_VARIABLES.camera,
      onChange: (v) => {
        mode = v as CameraMode;
        cameraTurn = null;
        lookHeight = null;
        drift.x = drift.y = 0;
        if (mode !== 'aim' && document.pointerLockElement === canvas) document.exitPointerLock();
      },
    });
    page.registry.declareVariable({ ...CAMERA_VARIABLES.mouse, onChange: (v) => (settings.mouse = Number(v)) });
    page.registry.declareVariable({ ...CAMERA_VARIABLES.stick, onChange: (v) => (settings.stick = Number(v)) });
    page.registry.declareVariable({ ...CAMERA_VARIABLES.invert, onChange: (v) => (settings.invert = v === true) });
    page.registry.declareVariable({ ...CAMERA_VARIABLES.calm, onChange: (v) => (settings.calm = v === true) });
    page.registry.declareCommand({
      ...CAMERA_COMMANDS.reset,
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
      lookHeight = null;
      if (orbiting && page.player() && (!m.session || o.replaying())) reset();
    },
    frame({ now, dt, alpha, world, hero }) {
      if (!orbiting) return;
      // Where it wants to be, not where a wall brought it (stage 3h): the leash works from there.
      unpull();
      // A gamepad's right stick turns the camera (2.5 radians per second, pushed all the way).
      const [stickX, stickY] = o.stick();
      if (stickX || stickY) {
        const turn = 2.5 * settings.stick * dt;
        orbit(stickX * turn, stickY * turn * (settings.invert ? -1 : 1));
        turnedByHand = now;
      }
      // What is left of a drag: it turns the camera once let go, and it dies out (also while held).
      // With less motion (stage 3i), none.
      if (settings.calm) drift.x = drift.y = 0;
      if (drift.x || drift.y) {
        if (pointers.size === 0) {
          orbit(drift.x * dt, drift.y * dt);
          turnedByHand = now;
        }
        const keep = Math.exp(-SETTLE * dt);
        drift.x = Math.abs(drift.x * keep) < 1e-3 ? 0 : drift.x * keep;
        drift.y = Math.abs(drift.y * keep) < 1e-3 ? 0 : drift.y * keep;
      }
      const heroMesh = hero && bodies.meshes.get(hero.id);
      if (mode !== 'free' && heroMesh && hero?.transform && hero.character) {
        const up = new THREE.Vector3(...upAt(world, hero.transform.position));
        const head = heroMesh.position.clone().addScaledVector(up, 0.6);
        if (mode === 'aim') {
          // Aiming, it moves as much as the head moved (the mouse turns it).
          const moved = head.sub(target);
          target.add(moved);
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
            const offset = camera.position.clone().sub(target).applyQuaternion(change);
            camera.position.copy(target).add(offset);
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
          target.add(carried);
          const offset = camera.position.clone().sub(target);
          const height = offset.dot(up);
          const reach = offset.addScaledVector(up, -height).length();
          // A VERTICAL DEAD ZONE (stage 2e): a jump does not move the camera up and down with it (the
          // whole world bounced on the screen). It follows the head's height while the character
          // stands (smoothly: a step, a ramp), and in the air only when the head would leave a band of
          // the screen (a long fall, a climb up high). The camera keeps its height `c` above where it
          // looks and its reach `r` along the ground, so a head `h` above that point is seen
          // atan((h − c) / r) + atan(c / r) above the screen's center: the band, in meters, is where
          // that stays within its share of half the field of view.
          const headHeight = head.dot(up);
          if (lookHeight === null) lookHeight = headHeight;
          if (hero.character.grounded) lookHeight += (headHeight - lookHeight) * (1 - Math.exp(-8 * dt));
          else {
            const half = THREE.MathUtils.degToRad(camera.fov / 2);
            const down = Math.atan2(height, reach); // how far down it looks
            // (Short of a right angle: a camera right above or below would ask for an endless band.)
            const rise = height + reach * Math.tan(Math.min(half * DEAD_ZONE.above - down, 1.5));
            const fall = height + reach * Math.tan(Math.max(-half * DEAD_ZONE.below - down, -1.5));
            lookHeight = THREE.MathUtils.clamp(lookHeight, headHeight - rise, headHeight - fall);
          }
          head.addScaledVector(up, lookHeight - headHeight);
          const along = camera.position.clone().sub(head);
          along.addScaledVector(up, -along.dot(up));
          if (along.lengthSq() < 1e-6) along.copy(offset);
          // Chasing: and it comes back behind the character, unless it was just turned by hand. A zone the
          // character is in can suggest where to look instead (stage 3h: its `view`, a direction in the
          // world, what the level's author wants seen), in `follow` and `chase` alike: the camera turns,
          // little by little, to look along it, unless it was just turned by hand.
          const untouched = pointers.size === 0 && now - turnedByHand > 600;
          const suggested = untouched ? viewOf(world, hero.id) : null;
          const towards = suggested
            ? suggested.negate()
            : untouched && mode === 'chase'
              ? new THREE.Vector3(...hero.character.facing).negate()
              : null;
          if (towards) {
            towards.addScaledVector(up, -towards.dot(up));
            const angle = Math.atan2(new THREE.Vector3().crossVectors(along, towards).dot(up), along.dot(towards));
            const rate = (suggested ? SUGGESTED : 4) * (settings.calm ? 0.5 : 1);
            along.applyAxisAngle(up, angle * (1 - Math.exp(-rate * dt)));
          }
          along.setLength(reach);
          target.copy(head);
          camera.position.copy(head).add(along).addScaledVector(up, height);
        }
      }
      // AGAINST WALLS (stage 3h): a ball swept from the head to where the camera wants to be; if it meets
      // something (not what the physics moves, a ball would make it jump; nor a character), the camera is
      // shown before it, at once, and goes back out little by little once the way is clear. Free, it
      // goes where it is put.
      if (mode !== 'free' && heroMesh && hero?.transform) {
        const up = new THREE.Vector3(...upAt(world, hero.transform.position));
        const head = heroMesh.position.clone().addScaledVector(up, 0.6);
        const way = camera.position.clone().sub(head);
        const wants = way.length();
        if (wants > 1e-6) {
          way.divideScalar(wants);
          const hit = world.castShape({ kind: 'ball', radius: CLEARANCE }, head.toArray(), [0, 0, 0, 1], way.toArray(), wants, {
            skip: hero.id,
            dynamic: false,
            characters: false,
          });
          // What a wall takes now, at once; what it took before, given back slowly.
          const takes = hit ? wants - Math.max(Math.min(CLOSEST, wants), hit.distance) : 0;
          cut = Math.max(takes, cut * Math.exp(-OUT * dt));
          if (cut < 1e-4) cut = 0;
          const at = head.clone().addScaledVector(way, Math.max(0, wants - cut));
          pulled.copy(at).sub(camera.position);
          camera.position.copy(at);
        }
      } else cut = 0;
      camera.lookAt(target);
    },
    stop() {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerdown', onClickDown);
      canvas.removeEventListener('pointerup', onClickUp);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', noMenu);
      document.removeEventListener('mousemove', onAimMove);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    },
  };
}
