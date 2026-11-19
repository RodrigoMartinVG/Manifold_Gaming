import * as THREE from 'three';
import type { VariableInfo } from '@manifold/commands';
import type { Bodies } from './bodies';
import type { GamePage, Piece } from './page';

/** Whether the view sways with the walk in first person (stage 5k): a comfort setting, on as it comes. */
export const SWAY_VARIABLE = {
  name: 'view.bob',
  description:
    'In first person, the view sways with the walk (stage 5k, decision 0031): it dips at each step and leans to the foot it stands on, more running; it sinks a little on landing; what it holds swings. Off, the view glides, for whoever gets dizzy (`view.calm` turns it off too).',
  scope: 'view',
  type: { kind: 'boolean' },
  default: true,
} as const satisfies VariableInfo;

/**
 * THE WALK'S SWAY'S NUMBERS (stage 5k): at walking speed, how far the eyes dip at each step (m), how far
 * they go to each side (m) and lean (degrees); running, up to `run` times as much. Leaning into a walk
 * to the side (degrees at walking speed: Quake's view roll, `cl_rollangle`, made smaller). Landing: how
 * deep the eyes sink per m/s it came down at (m), at most how deep, and how quickly (the time of its
 * lowest point, s). What it holds: how far it swings (m), and how far it trails a turn (m per rad/s).
 */
export const SWAY = Object.freeze({
  bob: 0.022,
  side: 0.014,
  roll: 0.3,
  run: 1.45,
  crouched: 0.6,
  lean: 0.6,
  land: { per: 0.012, most: 0.1, time: 0.07 },
  hold: { swing: 0.012, trail: 0.006, most: 0.025 },
  /**
   * (Stage 5o: the author found it unbalanced, walking and running.) Its cadence, steps a second: walking
   * (at the walk's speed) and running (at the run's), between them by the speed. Until 5o the dips were the
   * steps heard, one each 0.8 m: at a jog, 5.6 a second, a tremor rather than a walk. Quake's sways once in
   * 0.6 s whatever the speed (`cl_bobcycle`); a person walks at about two steps a second.
   */
  cadence: { walk: 1.9, run: 2.6 },
});

/**
 * THE SWAY AT A POINT OF THE WALK (stage 5k), `steps` the steps walked (a whole number at each step heard:
 * a foot on the ground), as much as `amount` (1 at walking speed). The eyes are lowest when a foot lands
 * and highest between steps, a dip of (1 + cos 2πs)/2; they go to the side of the foot it stands on, and
 * lean there, by sin πs: one way on one step and the other way on the next, smooth across each (sin π(k+s)
 * = −sin πs for an odd k). What it holds swings on a U, as Doom's weapon does: to the side by sin πs, down
 * by |sin πs|. All in meters (up, side) and degrees (roll).
 */
export function swayAt(steps: number, amount: number) {
  const across = Math.sin(Math.PI * steps);
  return {
    up: (-amount * SWAY.bob * (1 + Math.cos(2 * Math.PI * steps))) / 2,
    side: amount * SWAY.side * across,
    roll: amount * SWAY.roll * across,
    hold: { side: amount * SWAY.hold.swing * across, up: -amount * SWAY.hold.swing * 0.6 * Math.abs(across) },
  };
}

/** (Stage 5o) The walk's steps a second at a speed (m/s), for a walk's and a run's speeds: by the speed, between them. */
export function cadenceAt(speed: number, walk: number, run: number): number {
  const k = Math.max(0, Math.min(1, (speed - walk) / Math.max(0.1, run - walk)));
  return SWAY.cadence.walk + (SWAY.cadence.run - SWAY.cadence.walk) * k;
}

/**
 * HOW DEEP THE EYES ARE, `t` seconds after landing at `speed` m/s (stage 5k): a spring that is let go at
 * once, critically damped, y = −v t e^(−t/τ): it sinks, is lowest at t = τ (there y = −v τ / e), and comes
 * back without passing. v is such that the lowest point is SWAY.land.per · speed, at most SWAY.land.most.
 */
export function dipAt(t: number, speed: number): number {
  const tau = SWAY.land.time;
  // (Long after, nothing: and never t · e^(−t/τ) at t = ∞, which is ∞ · 0, not a number.)
  if (!(t >= 0 && t < 40 * tau)) return 0;
  const deepest = Math.min(SWAY.land.most, SWAY.land.per * speed);
  return -((deepest * Math.E) / tau) * t * Math.exp(-t / tau);
}

/**
 * THE WALK'S SWAY (stage 5k, decision 0031: the author asked for "el balanceo al ir caminando cuando la
 * cámara es de primera persona"): in first person only, after the camera placed the eyes, before the
 * kick and the shake (fire.ts). Its steps go at a cadence of their own (since 5o: `SWAY.cadence`, by the
 * speed), smooth, as much as the speed asks. Running, more; crouched, less; in the air, it fades.
 * Landing, the eyes sink (by how fast it came down) and come back. Walking to the side, it leans into
 * it. What it holds swings with the steps and trails a turn. A setting turns it off (`view.bob`), and
 * so does `view.calm`. For the browser tests: `data-bob` (how deep the walk dips at a step, the most so far, cm) and
 * `data-dip` (the deepest landing so far, cm).
 */
export function mountSway(page: GamePage, bodies: Bodies): Piece {
  const { camera } = page.stage;
  let on = true;
  /** Whether `view.calm` is on (the camera's; read each frame, if the page has a camera). */
  let hasCalm: boolean | null = null;
  const calm = () => {
    hasCalm ??= page.registry.names().includes('view.calm');
    return hasCalm && page.registry.value('view.calm') === true;
  };
  let steps = 0;
  let amount = 0;
  let lean = 0;
  let landed = Infinity;
  let landSpeed = 0;
  let deepestBob = 0;
  let deepestDip = 0;
  const trail = new THREE.Vector2();
  const lastLook = new THREE.Vector3();
  let looked = false;
  page.registry.declareVariable({ ...SWAY_VARIABLE, onChange: (v) => (on = v === true) });
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const look = new THREE.Vector3();
  /**
   * How far it moved the eyes this frame: put back as the next frame begins (`beforeSteps`, before the camera
   * places them: all of this frame, its drawing and what reads it, has them moved). The camera starts each frame from
   * where it left the eyes (taking back only its own move to them), so a dip left in place became where the
   * camera was, and it looked up at its target a little more each frame: walking ahead, the aim rose by
   * itself (the author found it).
   */
  const moved = new THREE.Vector3();

  return {
    welcome() {
      steps = 0;
      amount = 0;
      landed = Infinity;
      trail.set(0, 0);
      looked = false;
    },
    event(ev) {
      const hero = page.player();
      if (!hero || ev.type !== 'sound' || ev.source !== hero.id) return;
      if (ev.sound === 'land') {
        landed = 0;
        landSpeed = ev.speed;
      }
    },
    frame({ dt, hero }) {
      const holding = hero ? bodies.models.get(hero.id)?.holding : undefined;
      if (holding) holding.viewSway.set(0, 0, 0);
      if (!hero?.character || !holding?.inView || !on || calm()) {
        looked = false;
        return;
      }
      const c = hero.character;
      // How much: by how fast it goes on the ground (1 walking, up to `run` running); crouched, less; fading in the air.
      const v = c.velocity;
      const flat = Math.hypot(v[0], v[2]);
      const wants = c.grounded
        ? Math.min(SWAY.run, flat / Math.max(0.1, c.movement.walk.speed)) * (c.mode === 'crouch' ? SWAY.crouched : 1)
        : 0;
      amount += (wants - amount) * (1 - Math.exp(-dt / 0.1));
      // Where in the walk: its steps at their cadence, by the speed (walking, about two a second; running,
      // a little more), on while it moves and holding where they were when it stops.
      if (c.grounded && flat > 0.3) steps += dt * cadenceAt(flat, c.movement.walk.speed, c.movement.walk.run);
      const sway = swayAt(steps, amount);
      // Leaning into a walk to the side.
      camera.matrixWorld.extractBasis(right, up, look);
      const sideways = flat > 0.1 ? (v[0] * right.x + v[2] * right.z) / Math.max(0.1, c.movement.walk.speed) : 0;
      lean += (Math.max(-1.5, Math.min(1.5, sideways)) * SWAY.lean - lean) * (1 - Math.exp(-dt / 0.15));
      // Landing.
      landed += dt;
      const dip = dipAt(landed, landSpeed);
      moved
        .copy(up)
        .multiplyScalar(sway.up + dip)
        .addScaledVector(right, sway.side);
      // (Through the camera's effects, stage 5.5g: applied as it is drawn, and gone at the next frame.)
      page.stage.effects.move(moved);
      page.stage.effects.turn('z', THREE.MathUtils.degToRad(-sway.roll - lean));
      // (How deep the walk dips at a step, by how much it sways now: not the dip a frame happened to draw.)
      deepestBob = Math.max(deepestBob, amount * SWAY.bob);
      deepestDip = Math.max(deepestDip, -dip);
      page.container.dataset.bob = (100 * deepestBob).toFixed(1);
      page.container.dataset.dip = (100 * deepestDip).toFixed(1);
      // What it holds: its swing, and its trail behind a turn (the turn's rate, eased back).
      camera.getWorldDirection(look);
      if (looked && dt > 0) {
        const yaw = Math.atan2(look.x, look.z) - Math.atan2(lastLook.x, lastLook.z);
        const pitch = Math.asin(Math.max(-1, Math.min(1, look.y))) - Math.asin(Math.max(-1, Math.min(1, lastLook.y)));
        const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
        const most = SWAY.hold.most;
        const target = new THREE.Vector2(
          Math.max(-most, Math.min(most, (wrap(yaw) / dt) * SWAY.hold.trail)),
          Math.max(-most, Math.min(most, (-pitch / dt) * SWAY.hold.trail)),
        );
        trail.lerp(target, 1 - Math.exp(-dt / 0.08));
      }
      lastLook.copy(look);
      looked = true;
      holding.viewSway.set(sway.hold.side + trail.x, sway.hold.up + trail.y + 0.3 * dip, 0);
    },
  };
}
