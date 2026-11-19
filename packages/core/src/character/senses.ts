import { vec3, type Vec3 } from '@manifold/common';
import { gravityAt } from '../gravity';
import { tractionOf } from '../materials';
import { STANDS_ON } from '../physics';
import { axisOf, isDown, NO_INPUT, pressed, vectorOf } from '../input';
import type { Body, Character, Entity } from '../types';
import type { World } from '../world';
import { fits, ledgeAhead, LOCK_RANGE, lockTarget, standingOn, steepFace, wallAhead } from './around';
import { frameOf, handsOf } from './body';
import { hold } from './hands';
import { MODES, type Motion, type Senses } from './modes';
import { arcOf, circling, isZero, turned, upAt } from './steer';

/**
 * WHAT A CHARACTER SENSES (stage 5.5e, S1), with what it does on the way, in the order it always did:
 * what it holds (stage 3g: grabbed or let go, pulled towards in front of it), turning on its own axis,
 * locking on, the wall it climbs, what it stands on, a roll that starts, a wall beside it and a ledge it
 * grabs, falling past one. `m` has its velocity as it comes into the step.
 */
export function sense(world: World, e: Entity, c: Character, body: Body, m: Motion, dt: number): Senses {
  // Down (stage 4c: its points ran out), it asks for nothing until it comes back.
  const down = (e.health?.down ?? -1) >= 0;
  const input = down ? NO_INPUT : (world.inputs.get(c.player) ?? NO_INPUT);
  const gravity = vec3.length(gravityAt(world.gravity, e.transform!.position));
  const up = upAt(world, e.transform!.position);

  // 0: what it holds (stage 3g): grabbed or let go, and pulled towards in front of it (down, nothing).
  if (!down) hold(world, e, c, up, dt);

  // 1: turning on its own axis (where it looks may be told instead: that comes first).
  const face = vec3.onPlane(vectorOf(input, 'face'), up);
  const told = vec3.length(face) > 0.1;
  const turn = axisOf(input, 'turn');
  if (!told && turn !== 0) c.facing = turned(c.facing, up, turn, c.movement.turn, dt);
  // 1b: LOCKED ON (stage 4f): `lock` takes the nearest one in front, or lets go; gone, down or too far,
  // it lets go by itself.
  if (!down && pressed(world, c.player, 'lock')) c.lock = c.lock === null ? lockTarget(world, e, up) : null;
  const locked = c.lock === null ? undefined : world.entities.get(c.lock);
  const toLocked = locked?.transform ? vec3.onPlane(vec3.sub(locked.transform.position, e.transform!.position), up) : null;
  if (c.lock !== null && (!toLocked || (locked!.health?.down ?? -1) >= 0 || vec3.length(toLocked) > LOCK_RANGE)) c.lock = null;

  // 2: what is asked for (in the world, plus forward and to the side by where it looks now).
  m.vUp = vec3.dot(c.velocity, up);
  m.vH = vec3.onPlane(c.velocity, up);
  const inWorld = vec3.onPlane(vectorOf(input, 'move'), up);
  // (Locked on, ahead is towards it, now: where it looked a step ago is a little off as it goes round.)
  const ahead =
    c.lock !== null && toLocked && vec3.length(toLocked) > 1e-6
      ? vec3.normalize(toLocked)
      : vec3.normalize(vec3.onPlane(c.facing, up));
  const right = vec3.cross(ahead, up);
  let move = vec3.add(inWorld, vec3.add(vec3.scale(ahead, axisOf(input, 'ahead')), vec3.scale(right, axisOf(input, 'side'))));
  const asked = vec3.length(move);
  if (asked > 1) move = vec3.scale(move, 1 / asked);
  if (c.lock !== null && toLocked)
    move = circling(move, toLocked, up, isDown(input, 'run') ? c.movement.walk.run : c.movement.walk.speed, dt);
  const wanted = vec3.scale(move, isDown(input, 'run') ? c.movement.walk.run : c.movement.walk.speed);
  const jumping = isDown(input, 'jump');
  // A wall, if it can climb: from its feet, towards the wall it climbs, or towards where it is asked
  // to go (a little beyond its radius). From its feet, so it keeps climbing until they pass the top.
  const climbed = c.wall;
  const frame = frameOf(body.shape);
  const feet = vec3.add(e.transform!.position, vec3.scale(up, -frame.waist));
  let wallDistance = 0;
  if (c.can.climb) {
    const towards = isZero(c.wall) ? (vec3.length(move) > 0.1 ? vec3.normalize(move) : null) : c.wall;
    const found = towards ? wallAhead(world, e, feet, towards, 0.55, up) : null;
    c.wall = found ? found.wall : [0, 0, 0];
    wallDistance = found ? found.distance : 0;
  } else c.wall = [0, 0, 0];
  // What it stands on (stage 2d; with its whole capsule since 2.5b), if it stands: below, what moves
  // carries it; here, its surface's friction decides how much its feet push (stage 3b: the floor's
  // material). On nothing found, or on what the physics moves (a cube), they hold.
  const here = e.transform!.position;
  const wasGrounded = c.grounded;
  const under = c.grounded ? standingOn(world, e, up) : null;
  const floor = under ? world.entities.get(under.entity)?.body : undefined;
  const traction = floor ? tractionOf(floor.friction) : 1;
  const before = c.mode;
  // A roll (stage 4b): pressed on the ground (walking or crouched), it starts, the way it is asked to go
  // (or where it looks), for its time; off the ground, it is over.
  if (!c.grounded) c.rolling = 0;
  else if (
    !down &&
    c.rolling === 0 &&
    c.can.roll &&
    (before === 'walk' || before === 'crouch') &&
    pressed(world, c.player, 'roll')
  ) {
    c.rolling = Math.max(1, Math.round(c.movement.roll.time / dt));
    c.rollDirection = vec3.length(move) > 0.1 ? vec3.normalize(move) : vec3.normalize(vec3.onPlane(c.facing, up));
  }
  // Low, whether it could stand up where it is (stage 4b): its standing body, there, touching nothing.
  const room = MODES[before].low !== true || fits(world, e, body.shape, up);
  // 2b (stage 5c): in the air, a wall beside it, to slide down and jump off: from its chest, towards
  // where it is asked to go (or where it looks); and a ledge to grab, falling past one.
  const radius = frame.radius;
  const hands = handsOf(body.shape);
  const lookingWay = vec3.normalize(vec3.onPlane(c.facing, up));
  const pushingWay = vec3.length(move) > 0.1 ? vec3.normalize(move) : null;
  const side = c.can.wallJump && !c.grounded ? wallAhead(world, e, here, pushingWay ?? lookingWay, radius + 0.25, up) : null;
  const beside = side && !isZero(side.wall) ? side.wall : null;
  // (Just off a wall, not back on it: the lock lasts its time.)
  const backOn = beside !== null && c.offSteps > 0 && vec3.dot(beside, c.offWall) > 0.7;
  const sliding = beside !== null && !backOn && m.vUp <= 0 && pushingWay !== null && vec3.dot(move, beside) > 0.5;
  // (Stage 5p, decision 0031: forgiveness) The last wall it pushed against in the air, and how long ago
  // (counted at the step's end, as its steps in the air are): a jump off it may come as late as one off
  // the ground (`jump.coyote`). None on the ground, nor after.
  let againstWall = false;
  if (c.can.wallJump) {
    if (c.grounded) delete c.nearWall;
    else if (beside !== null && !backOn && pushingWay !== null && vec3.dot(move, beside) > 0.5) {
      c.nearWall = { wall: [...beside], since: 0 };
      againstWall = true;
    }
  }
  if (c.ledge === null && c.can.ledge && !c.grounded && m.vUp <= 0 && c.regrab === 0 && before !== 'climb') {
    const grab = ledgeAhead(world, e, here, pushingWay ?? lookingWay, radius, hands, Math.max(0.25, -m.vUp * dt + 0.05), up);
    if (grab) c.ledge = grab;
  }
  // ON GROUND TOO STEEP TO STAND ON (stage 4.5b; 3b measured it: on 40° it went 14 cm in two seconds,
  // since every step it touched the ground it kept no speed). The face under its middle, steeper than
  // it stands on (a round bottom on an edge is not a slope).
  const steep = c.grounded && under && vec3.dot(under.normal, up) < STANDS_ON ? steepFace(world, e, up) : null;
  // (A floor that grips more than the slope pulls, μ ≥ tan θ, holds it as flat ground does: μ cos θ ≥ sin θ,
  // the sine from a square root, the same bits everywhere.)
  const grip = floor?.friction ?? 0.6;
  const cos = steep ? vec3.dot(steep, up) : 1;
  const held = steep !== null && grip * cos >= Math.sqrt(Math.max(0, 1 - cos * cos));
  const slope = held ? null : steep;
  // (Stage 5c: with the platformer's arc, its own speed and gravity: `arcOf`.)
  const arced = c.movement.arc ? arcOf(c.movement.arc, dt) : null;
  return {
    down,
    input,
    gravity,
    up,
    told,
    toLocked,
    inWorld,
    move,
    wanted,
    jumping,
    crouching: isDown(input, 'crouch'),
    blocking: isDown(input, 'block'),
    frame,
    feet,
    radius,
    hands,
    climbed,
    wallDistance,
    here,
    wasGrounded,
    under,
    floor,
    traction,
    before,
    room,
    lookingWay,
    pushingWay,
    beside,
    backOn,
    sliding,
    againstWall,
    grip,
    cos,
    held,
    slope,
    arced,
    jumpSpeed: arced ? arced.speed : c.movement.jump.speed,
  };
}

/**
 * The wall a jump in the air leaps off (stage 5c): the one beside it, that it pushes against. (Stage 5p,
 * decision 0031: forgiveness, as Celeste's) Or, where it reaches farther (`wall.reach`), the nearest within
 * that of its body, whichever way round it is (the way it is asked to go and the other, a jump off a wall
 * being often asked for pushing away from it; and eight ways round where it looks, 45° apart); or the last
 * it pushed against, if a jump off the ground could still come so late. Never the one it just left, while
 * it cannot steer back to it.
 */
export function wallToLeap(world: World, e: Entity, c: Character, s: Senses): Vec3 | null {
  const { beside, backOn, lookingWay, pushingWay, up } = s;
  if (beside !== null && !backOn) return beside;
  if (!c.can.wallJump) return null;
  const left = (w: Vec3) => c.offSteps > 0 && vec3.dot(w, c.offWall) > 0.7;
  const reach = c.movement.wall.reach;
  if (reach !== undefined) {
    let best: { wall: Vec3; distance: number } | null = null;
    // (Its own √½ for the ways between: the same bits everywhere.)
    const across = vec3.cross(up, lookingWay);
    const ways: Vec3[] = [lookingWay, across, vec3.scale(lookingWay, -1), vec3.scale(across, -1)];
    for (const [a, b] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const)
      ways.push(vec3.add(vec3.scale(lookingWay, a * Math.SQRT1_2), vec3.scale(across, b * Math.SQRT1_2)));
    if (pushingWay) ways.unshift(pushingWay, vec3.scale(pushingWay, -1));
    for (const d of ways) {
      const found = wallAhead(world, e, s.here, d, s.radius + reach, up);
      if (!isZero(found.wall) && !left(found.wall) && (best === null || found.distance < best.distance)) best = found;
    }
    if (best) return best.wall;
  }
  const n = c.nearWall;
  return n && n.since <= c.movement.jump.coyote && !left(n.wall) ? n.wall : null;
}
