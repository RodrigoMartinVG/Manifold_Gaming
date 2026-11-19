import { quat, vec3, type Vec3 } from '@manifold/common';
import { CHARACTER_GAP, CHARACTER_SETTINGS } from '../physics';
import { STRIDE, stepRadius } from '../sound';
import { axisOf, vectorOf } from '../input';
import type { Entity } from '../types';
import type { World } from '../world';
import { crouchPoseOf } from './body';
import { CONTRIBUTIONS } from './contributions';
import { push } from './hands';
import { MODE_NAMES, modeFor, MODES, type Motion } from './modes';
import { sense, wallToLeap } from './senses';
import { approach, carriedBy, isZero } from './steer';

/**
 * A CHARACTER (stage 1b), in parts since stage 5.5e: its body and its numbers (`body.ts`), what it finds
 * around it (`around.ts`: walls, ledges, its floor), its hands (`hands.ts`: holding, pushing), the math of
 * steering, turning and falling (`steer.ts`), its ways of moving, each a record (`modes.ts`), what it
 * senses at its step's start (`senses.ts`), what adds to its motion (`contributions.ts`), and here, its
 * step, in their order.
 */
export { DEFAULT_MOVEMENT, newCharacter, HISTORY, CROUCHED, crouchPoseOf, frameOf, handsOf } from './body';
export { LOCK_RANGE } from './around';
export { HOLD, PUSH } from './hands';
export { airStrafe, arcOf, pulled, upAt, carriedBy, faceFor, aimOf, turned } from './steer';
export { MODE_NAMES, seenOf, poseOf, hitPartsOf, eyeHeightOf } from './modes';

/** The horizontal ways a corner correction tries (stage 5c), in this order: the axes, then the diagonals. */
const NUDGES: readonly Vec3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
  [Math.SQRT1_2, 0, Math.SQRT1_2],
  [-Math.SQRT1_2, 0, Math.SQRT1_2],
  [Math.SQRT1_2, 0, -Math.SQRT1_2],
  [-Math.SQRT1_2, 0, -Math.SQRT1_2],
];

/**
 * THE CHARACTER SYSTEM, one step of one character (stage 1b; in modes since 2b; their records, what it
 * senses and the contributions as a list since 5.5e). All its math is additions, multiplications and
 * square roots (no trigonometry): the same bits in every browser. Everything is resolved here, in this
 * order:
 *
 *   1. what it senses (`sense`): what it holds, its turn, its lock, what is asked, walls, its floor;
 *   2. THE MODE (only one, the first in `CHOICE` that applies): its velocity splits into "up" (along its
 *      up) and "along the ground" (the rest), and the mode steers the part along the ground;
 *   3. a jump: asked for (pressed, not held), kept a few steps if it was too early, allowed a few
 *      steps after leaving an edge; or the mode's own (off a wall it climbs), or from a wall, or one
 *      more in the air, if it can (stage 2c);
 *   4. THE CONTRIBUTIONS, whatever the mode (`CONTRIBUTIONS`): gravity (unless the mode holds itself, as
 *      climbing; a mode may slow the fall, as gliding), what the game makes it carry, and what it stands
 *      on, if it moves (stage 2d);
 *   5. the character controller says how much of the desired movement it can really do: it slides
 *      along walls, climbs steps, stays on slopes and on the ground, and pushes what can be pushed;
 *   6. what it learned: whether it stands on something, whether it hit a ceiling, where it looks.
 *
 * The body moves there during the physics step (it is a kinematic body moved by position).
 */
export function moveCharacter(world: World, e: Entity, dt: number) {
  const c = e.character!;
  const body = e.body!;
  const m: Motion = { vH: [0, 0, 0], vUp: 0, leapt: false, own: null, rise: 0, ride: null };
  const s = sense(world, e, c, body, m, dt);
  const { input, up, move, wanted, jumping, here, under, before, radius, slope } = s;

  // 2: the mode; and the velocity along the ground, as the mode steers it.
  c.mode = modeFor(c, s, m);
  for (const name of MODE_NAMES) if (name !== c.mode) MODES[name].outside?.(c);
  // Going low or standing up, the controller moves the low body, or the standing one, from then on.
  if ((MODES[before].low === true) !== (MODES[c.mode].low === true)) {
    const pose = MODES[c.mode].low ? crouchPoseOf(c, body) : { shape: body.shape, offset: [0, 0, 0] as Vec3 };
    world.physics.setCharacterPose(body.handle, pose.shape, pose.offset);
  }
  // Down a slope too steep to stand on (stage 4.5b), its feet cannot hold it: what it goes down at, it
  // keeps (gravity adds to it through the controller, the floor's friction takes from it, step 6); it
  // can still push up it, and across it, as it walks.
  if (slope && MODES[c.mode].feet) {
    const downhill = vec3.normalize(vec3.onPlane(slope, up));
    const along = vec3.dot(m.vH, downhill);
    const across = vec3.sub(m.vH, vec3.scale(downhill, along));
    const wantedAlong = vec3.dot(wanted, downhill);
    const most = c.movement.walk.acceleration * s.traction * dt;
    const steered = approach(across, vec3.sub(wanted, vec3.scale(downhill, wantedAlong)), most);
    const up_ = wantedAlong < 0 ? Math.max(wantedAlong, along - most) : along;
    m.vH = vec3.add(steered, vec3.scale(downhill, up_));
  } else if (c.offSteps > 0) {
    // Just off a wall (stage 5c), for `wall.lock`: what takes it away from the wall it keeps (neither
    // steering back nor braking: the air's steering would have taken a third of it), and it steers along it.
    const n = c.offWall;
    const away = vec3.dot(m.vH, n);
    const along = MODES[c.mode].steer(
      c,
      vec3.sub(m.vH, vec3.scale(n, away)),
      vec3.sub(wanted, vec3.scale(n, vec3.dot(wanted, n))),
      move,
      dt,
      s.traction,
    );
    m.vH = vec3.add(along, vec3.scale(n, away));
  } else m.vH = MODES[c.mode].steer(c, m.vH, wanted, move, dt, s.traction);
  // Towards what the mode holds (climbing: its wall), and what leaving a mode does (the hop over a wall's top).
  const toward = MODES[c.mode].toward?.(c, s, body, dt);
  if (toward) m.vH = vec3.add(m.vH, toward);
  if (before !== c.mode) MODES[before].leave?.(world, e, c, s, m);

  // What it stands on, if it moves: how it moves in this step. It carries it (after the controller,
  // below), it turns it with it, and a jump keeps its velocity. Stepping from something that moves
  // onto something still, standing all the time (down the 30 cm of the course's ferry), it keeps that
  // velocity, as walking off an edge does: the walk steers it from there (before, it stopped dead).
  m.ride = under?.moves ? carriedBy(under.moves, here, dt) : null;
  if (under?.moves && m.ride) c.ground = { velocity: m.ride.velocity, spin: vec3.dot(under.moves.angular, up) };
  else {
    if (c.grounded && !isZero(c.ground.velocity)) m.vH = vec3.add(m.vH, vec3.onPlane(c.ground.velocity, up));
    c.ground = { velocity: [0, 0, 0], spin: 0 };
  }
  if (m.ride) {
    const looking = vec3.onPlane(quat.rotate(m.ride.turn, c.facing), up);
    if (vec3.length(looking) > 1e-6) c.facing = vec3.normalize(looking);
    // The turn it carries: where it is told to look turns with it too (`carriedTurn`, and step 6).
    c.carriedTurn = quat.normalize(quat.multiply(m.ride.turn, c.carriedTurn));
  }

  // 3: the jump: from the ground (or just after leaving it), the mode's own, from a wall, or one more in
  // the air. (Stage 5c: with the platformer's arc, its own speed and gravity: `arcOf`.)
  const { jump } = c.movement;
  if (jumping && !c.jumpHeld) c.jumpPending = jump.buffer;
  c.jumpHeld = jumping;
  if (c.grounded || MODES[c.mode].holdsOn) c.airJumps = jump.air;
  // A motion of the mode's own (hanging, stage 5c), which may leave it.
  MODES[c.mode].own?.(c, s, m, dt);
  if (c.jumpPending > 0) {
    const own = MODES[c.mode].jump;
    let leapOff: Vec3 | null;
    if (own) own(c, s, m);
    else if (c.grounded || c.stepsInAir <= jump.coyote) {
      // (From a moving platform, it keeps the platform's velocity: it leaves with it.)
      m.vH = vec3.add(m.vH, vec3.onPlane(c.ground.velocity, up));
      m.vUp = s.jumpSpeed + Math.max(0, vec3.dot(c.ground.velocity, up));
      m.leapt = true;
      c.leaping = true;
      c.jumpPending = 0;
      c.stepsInAir = jump.coyote + 1; // the coyote time is over: from now on, only a jump in the air
    } else if (!c.grounded && (leapOff = wallToLeap(world, e, c, s)) !== null) {
      // OFF A WALL (stage 5c): sliding down it, or beside it in the air: up as a jump, and away from it
      // at `wall.off`, keeping what it had along it; for `wall.lock` it cannot steer back towards it.
      m.vUp = s.jumpSpeed;
      m.vH = vec3.add(vec3.onPlane(m.vH, leapOff), vec3.scale(leapOff, -c.movement.wall.off));
      c.offWall = [...leapOff];
      c.offSteps = Math.round(c.movement.wall.lock / dt);
      c.leaping = true;
      c.mode = 'air';
      c.jumpPending = 0;
      delete c.nearWall;
    } else if (c.can.doubleJump && c.airJumps > 0) {
      m.vUp = s.jumpSpeed;
      c.airJumps--;
      c.leaping = true;
      c.jumpPending = 0;
    } else c.jumpPending--;
  }

  // How fast it was coming down (for the landing's sound, stage 3f).
  const fell = Math.max(0, -vec3.dot(c.velocity, up));

  // 4: the contributions before the controller: what changes the velocity it keeps (gravity), then what
  // moves it this step only (what the game makes it carry).
  for (const k of CONTRIBUTIONS) k.velocity?.(c, s, m, dt);
  let carried: Vec3 | null = null;
  for (const k of CONTRIBUTIONS) {
    const v = k.carry?.(c);
    if (v) carried = carried ? vec3.add(carried, v) : v;
  }
  carried ??= [0, 0, 0];
  let { vH, vUp } = m;

  // 5: what it can really do. (A motion of the mode's own, hanging, stage 5c: to where its hands hold the edge.)
  const desired = m.own
    ? m.own
    : vec3.add(vec3.scale(vec3.add(vec3.add(vH, vec3.scale(up, vUp)), carried), dt), vec3.scale(up, m.rise));
  const platform = under?.moves ? world.entities.get(under.entity)?.body?.handle : undefined;
  const { movement, grounded, ceiling, touched, walls } = world.physics.moveCharacter(
    body.handle,
    desired,
    up,
    platform,
    c.controller,
  );
  // What it ran into that the physics moves, it pushes (stage 3g), towards where it was asked to go.
  push(world, e, touched, vec3.onPlane(wanted, up), up, dt);

  // 6: what it learned. (A ceiling is what the controller says hit its head: rising a little less
  // than asked is not one; that happens brushing a wall, and it used to cut jumps short.)
  // CORNER CORRECTION (stage 5c, with the arc's `corner`): rising, its head clips an edge above it; if
  // moving it sideways a little (5 cm at a time, as far as `corner`, the axes before the diagonals)
  // frees the way up, it goes there and keeps rising. Else the ceiling stops it.
  const { arc } = c.movement;
  let nudge: Vec3 = [0, 0, 0];
  if (vUp > 0 && ceiling && arc && arc.corner > 0) {
    const at = vec3.add(world.physics.position(body.handle), movement);
    const rot = e.transform!.rotation;
    const free = (from: Vec3, way: Vec3, reach: number) =>
      world.castShape(body.shape, from, rot, way, reach, { skip: e.id, dynamic: false }) === null;
    search: for (let k = 0.05; k <= arc.corner + 1e-9; k += 0.05)
      for (const d of NUDGES) {
        const way = vec3.normalize(vec3.onPlane(d, up));
        const to = vec3.add(at, vec3.scale(way, k));
        if (free(at, way, k) && free(to, up, vUp * dt + CHARACTER_GAP)) {
          nudge = vec3.scale(way, k);
          break search;
        }
      }
  }
  if (vUp > 0 && ceiling && isZero(nudge)) vUp = 0;
  // Against a wall (stage 4.5b): what the controller did not let it do into a wall, it no longer has, at
  // most v − (v·n)n (before, the velocity it kept was the one it asked for: pushing a wall standing still,
  // 4.5 m/s, and it left the wall at full speed). Only what was refused: up a step, the controller
  // touches its face but takes it over, and it keeps its speed.
  // And only a wall: what reaches above a step's height (a ray towards it there); a step it goes up.
  const refused = vec3.sub(vec3.onPlane(desired, up), vec3.onPlane(movement, up));
  const feetNow = vec3.sub(world.physics.position(body.handle), vec3.scale(up, s.frame.waist + radius));
  for (const n of walls) {
    const into = vec3.onPlane(n, up);
    const length = vec3.length(into);
    if (length < 1e-6) continue;
    const mn = vec3.scale(into, 1 / length);
    const pressing = vec3.dot(vH, mn);
    const stopped = vec3.dot(refused, mn) / dt;
    if (pressing <= 0 || stopped <= 0) continue;
    const above = vec3.add(feetNow, vec3.scale(up, (c.controller ?? CHARACTER_SETTINGS).stepHeight + 0.05));
    if (!world.castRay(above, mn, radius + 0.1, { skip: e.id, dynamic: false, characters: false })) continue;
    vH = vec3.sub(vH, vec3.scale(mn, Math.min(pressing, stopped)));
  }
  // Sliding down a slope too steep to stand on: it goes as the controller took it, along the slope (its
  // velocity up too), and the floor's friction slows it there, μ g cos θ, never past standing still: a
  // grippy enough floor (μ ≥ tan θ) holds it.
  if (slope && grounded && !m.leapt && !MODES[c.mode].ownWay) {
    const got = vec3.sub(vec3.scale(movement, 1 / dt), carried);
    const downhill = vec3.normalize(vec3.onPlane(slope, up));
    const along = vec3.dot(vec3.onPlane(got, up), downhill);
    if (along > 0) {
      const friction = s.grip * s.gravity * s.cos * dt;
      const keep = Math.max(0, along - friction) / along;
      vH = vec3.add(vec3.sub(vec3.onPlane(got, up), vec3.scale(downhill, along)), vec3.scale(downhill, along * keep));
      vUp = vec3.dot(got, up) * keep;
    } else {
      vH = vec3.onPlane(got, up);
      vUp = Math.min(0, vec3.dot(got, up));
    }
  } else if (grounded && vUp < 0) vUp = 0;
  c.grounded = grounded;
  // (Landed: on the ground and no longer going up. Just thrown, a hair above it, it is still on its way.)
  if (grounded && vUp <= 0) c.thrown = false;
  c.stepsInAir = grounded ? 0 : c.stepsInAir + 1;
  // (Stage 5c: a jump's rise is over at its top or on the ground; the lock off a wall and the pause
  // before grabbing again count down, and end on the ground.)
  if (grounded || vUp <= 0) c.leaping = false;
  if (grounded && c.hung !== undefined) delete c.hung;
  if (c.nearWall && (grounded || (!s.againstWall && ++c.nearWall.since > c.movement.jump.coyote))) delete c.nearWall;
  c.offSteps = grounded ? 0 : Math.max(0, c.offSteps - 1);
  c.regrab = Math.max(0, c.regrab - 1);
  // 4b: the contributions after the controller, from where its walk left it (what it stands on, if it
  // moves). If it walked off the edge (it stood, and now it does not, without jumping), it keeps the
  // platform's velocity along the ground, as it would jumping; and from then on, it stands on nothing
  // that moves.
  const walked = vec3.add(vec3.add(world.physics.position(body.handle), movement), nudge);
  let position = walked;
  for (const k of CONTRIBUTIONS) if (k.after) position = vec3.add(position, k.after(world, e, s, m, walked));
  if (s.wasGrounded && !grounded && !m.leapt) {
    vH = vec3.add(vH, vec3.onPlane(c.ground.velocity, up));
    c.ground = { velocity: [0, 0, 0], spin: 0 };
  }
  c.velocity = vec3.add(vH, vec3.scale(up, vUp));
  // Where it looks: as its mode says, if it says so whatever it is told (rolling, stage 4b: the way it
  // rolls; told again after the roll); towards what it is locked on; where it is told to, if it is told;
  // as its mode says (climbing: at its wall); if not, where it moves in the world. (Moving by where it
  // looks does not change it: walking back would turn it around, and back again.) What it is told is
  // read inside the turn the platforms gave it (`carriedTurn`): told the same thing step after step, a
  // turning platform still turns it.
  const toldLooking = s.told ? vec3.onPlane(quat.rotate(c.carriedTurn, vectorOf(input, 'face')), up) : null;
  const facing = MODES[c.mode].facing;
  const own = facing?.way(c) ?? null;
  if (facing?.firm && own) c.facing = own;
  else if (c.lock !== null && s.toLocked && vec3.length(s.toLocked) > 1e-6) c.facing = vec3.normalize(s.toLocked);
  else if (toldLooking && vec3.length(toldLooking) > 1e-6) c.facing = vec3.normalize(toldLooking);
  else if (facing && !facing.firm && own) c.facing = own;
  else if (vec3.length(s.inWorld) > 0.1) c.facing = vec3.normalize(s.inWorld);
  // And where it aims, above or below that (stage 4b).
  c.pitch = 90 * Math.max(-1, Math.min(1, axisOf(input, 'pitch')));
  // A step of its roll gone (stage 4b).
  if (c.mode === 'roll') c.rolling--;
  world.physics.setNextPose(body.handle, position, quat.look(c.facing, up));

  // What is heard (stage 3f): a step every stride walked on the ground, on what it stands on (by its
  // material), louder running; and a landing, by how fast it came down.
  const floor_ = under ? world.entities.get(under.entity) : undefined;
  const surface = floor_?.body?.material ?? null;
  const feet_ = vec3.add(position, vec3.scale(up, -s.frame.bottom));
  if (grounded && !s.wasGrounded && fell > 3)
    world.emit({
      type: 'sound',
      sound: 'land',
      source: e.id,
      at: feet_,
      surface,
      speed: fell,
      energy: 0,
      radius: stepRadius(surface, fell, c.movement.walk.speed),
    });
  const along = vec3.length(vec3.onPlane(movement, up));
  if (grounded && s.wasGrounded && MODES[c.mode].steps && along > 0) {
    c.stride += along;
    if (c.stride >= STRIDE) {
      c.stride -= STRIDE;
      const speed = along / dt;
      world.emit({
        type: 'sound',
        sound: 'step',
        source: e.id,
        at: feet_,
        surface,
        speed,
        energy: 0,
        // (Crouched, less: stage 4b, its posture.)
        radius: stepRadius(surface, speed, c.movement.walk.speed) * (MODES[c.mode].heard?.(c) ?? 1),
      });
    }
  } else if (!grounded) c.stride = STRIDE / 2;
}
