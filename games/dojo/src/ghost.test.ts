import { beforeAll, describe, expect, test } from 'vitest';
import {
  ghostAt,
  ghostFromText,
  GhostRecorder,
  ghostToText,
  GHOST_EVERY,
  initPhysics,
  LEAP,
  registryFor,
  replayOf,
  Session,
  yawOf,
  type PlayerInput,
} from '@manifold/core';
import { DojoCartridge } from './cartridge';
import { ROOMS } from './rooms';

beforeAll(initPhysics);

/**
 * GHOSTS AS STRIPS OF POSES (stage 4.5c, decision 0025), recorded from a run on the circuit: the player
 * driven along its first stretch for a minute, as a person would (walking, running, jumping, turning).
 */
/** What the player asks for at step `i`: a path that turns (forward, a curve), jumps now and then, running half the time. */
const inputAt = (i: number): PlayerInput => {
  const a = (i / 60) * 0.6;
  return { move: [Math.sin(a), 0, -Math.cos(a)], run: Math.floor(i / 180) % 2 === 0, jump: i % 97 === 0 };
};

function run(seconds: number) {
  /** Where the player really was, step by step (from step 0). */
  const truth: number[][] = [];
  const registry = registryFor(DojoCartridge);
  registry.run(ROOMS.circuit!.text.replace(/^view\..*$/gm, ''), 'recipe');
  const session = new Session(DojoCartridge, { registry });
  const recorder = new GhostRecorder();
  recorder.record(session.world, 1);
  const hero = () => [...session.world.entities.values()].find((e) => e.character?.player === 1)!;
  for (let i = 0; i < seconds * 60; i++) {
    if (i === 0) truth.push([...hero().transform!.position]);
    session.setInput(1, inputAt(i));
    session.step();
    recorder.record(session.world, 1);
    truth.push([...hero().transform!.position]);
  }
  return { session, recorder, hero, truth };
}

describe('a ghost, as a strip of poses (stage 4.5c)', () => {
  test('recorded every six steps; as text and back, the same poses (to the centimeter, to a tenth of a degree)', () => {
    const { session, recorder, hero } = run(20);
    const strip = recorder.ghost('dojo', replayOf(session).birth, session.world.tick);
    expect(strip.every).toBe(GHOST_EVERY);
    expect(strip.poses).toHaveLength(20 * 10 + 1);
    const back = ghostFromText(ghostToText(strip));
    expect(back).toEqual(strip);
    // The last pose is where the player is (to the centimeter), looking where it looks (to a tenth).
    const last = back.poses.at(-1)!;
    const at = hero().transform!.position;
    for (let k = 0; k < 3; k++) expect(Math.abs(last.position[k]! - at[k]!)).toBeLessThanOrEqual(0.005 + 1e-9);
    expect(Math.abs(last.yaw - yawOf(hero().character!))).toBeLessThanOrEqual(0.05 + 1e-9);
    expect(back.birth).toContain('dojo.level circuit');
    session.world.dispose();
  });

  test('it ends where the player ended, also between two of its steps (stage 4.5’s close)', () => {
    const { session, recorder, hero } = run(20);
    // Four steps more, still on its curve: the strip's last step was 1200, it ends at 1204. (Not a turn of a
    // sudden: the strip's straight line between two poses cannot follow one, and that is not what this measures.)
    let halfway: number[] = [];
    for (let i = 0; i < 4; i++) {
      session.setInput(1, inputAt(1200 + i));
      session.step();
      recorder.record(session.world, 1);
      if (i === 1) halfway = [...hero().transform!.position];
    }
    const strip = ghostFromText(ghostToText(recorder.ghost('dojo', replayOf(session).birth, session.world.tick)));
    expect(strip.end).toBe(1204);
    expect(strip.poses).toHaveLength(20 * 10 + 2);
    const at = hero().transform!.position;
    const end = ghostAt(strip, 1204)!;
    for (let k = 0; k < 3; k++) expect(Math.abs(end.position[k]! - at[k]!)).toBeLessThanOrEqual(0.005 + 1e-9);
    // Halfway through those four steps, on the curve: as near where it was as the strip's centimeters let.
    const half = ghostAt(strip, 1202)!.position;
    for (let k = 0; k < 3; k++) expect(Math.abs(half[k]! - halfway[k]!)).toBeLessThanOrEqual(0.01);
    session.world.dispose();
  });

  test('drawn along a curve through its poses (stage 5d): over a minute of running about, nearer where the player was than the straight lines between them', () => {
    const { session, recorder, truth } = run(60);
    const strip = ghostFromText(ghostToText(recorder.ghost('dojo', replayOf(session).birth, session.world.tick)));
    /** The straight line between the two poses around a step, as before. */
    const straight = (t: number) => {
      const i = Math.floor(t / strip.every);
      const a = strip.poses[i]!.position;
      const b = strip.poses[Math.min(strip.poses.length - 1, i + 1)]!.position;
      const u = (t - i * strip.every) / strip.every;
      return a.map((v, k) => v + (b[k]! - v) * u);
    };
    let curve = 0;
    let line = 0;
    let n = 0;
    for (let t = 1; t < truth.length - strip.every; t++) {
      if (t % strip.every === 0) continue;
      // (Only motion: a fall puts it back at its checkpoint, a leap the strip draws, but cannot place in its span.)
      const i = Math.floor(t / strip.every);
      const span = strip.poses[i]!.position.map((v, k) => v - strip.poses[i + 1]!.position[k]!);
      if (Math.hypot(span[0]!, span[1]!, span[2]!) > LEAP) continue;
      const at = ghostAt(strip, t)!.position;
      const was = truth[t]!;
      curve += Math.hypot(at[0]! - was[0]!, at[1]! - was[1]!, at[2]! - was[2]!);
      const l = straight(t);
      line += Math.hypot(l[0]! - was[0]!, l[1]! - was[1]!, l[2]! - was[2]!);
      n++;
    }
    expect(curve / n).toBeLessThan(0.75 * (line / n));
    session.world.dispose();
  });

  test('drawn between its poses: moving at one velocity, along the line between them; looking by the shorter way round', () => {
    const strip = ghostFromText(
      // (Each line, how much what changed changed: 40 cm along and 10° round, then the same again.)
      ['# Manifold ghost 1', 'game dojo', 'every 4', 'pose 0 100 0 3550 walk', '40 0 0 100', '0 0 0 -100 air', 'end 8'].join(
        '\n',
      ),
    );
    // Halfway between the first two: 20 cm along, and from 355° past 0° to 5°: at 0°.
    const half = ghostAt(strip, 2)!;
    expect(half.position[0]).toBeCloseTo(0.2, 9);
    expect(half.yaw).toBeCloseTo(0, 9);
    expect(half.mode).toBe('walk');
    expect(ghostAt(strip, 8)!.mode).toBe('air');
    // Past its end, its last pose.
    expect(ghostAt(strip, 100)!.position[0]).toBeCloseTo(0.8, 9);
  });

  test('a minute of running about, in a link, is under 2.5 KB (deflated): about the open question’s 2 (decision 0025)', async () => {
    const { session, recorder } = run(60);
    const text = ghostToText(recorder.ghost('dojo', replayOf(session).birth, session.world.tick));
    // (Deflated as a link does it: the browser's own stream, which Node has too.)
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const deflated = (await new Response(stream).arrayBuffer()).byteLength;
    // (As a link writes it, base64: four letters for each three bytes.)
    console.log(
      `a minute's ghost: ${text.length} characters, ${deflated} bytes deflated, about ${Math.ceil((deflated * 4) / 3)} in a link`,
    );
    expect(deflated).toBeLessThan(2560);
    session.world.dispose();
  });

  test('a strip from a newer format is refused with why; a broken line says which', () => {
    expect(() => ghostFromText('# Manifold ghost 9\n')).toThrow(/newer/);
    expect(() => ghostFromText('# Manifold ghost 1\nevery 4\npose 0 0 0 0 walk\n1 2 x 3\n')).toThrow(/line 4/);
  });
});
