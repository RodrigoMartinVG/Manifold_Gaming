import { beforeAll, describe, expect, test } from 'vitest';
import { initPhysics, NO_INPUT, registryFor, Session, type Entity, type PlayerInput } from '@manifold/core';
import { DojoCartridge } from './cartridge';
import { ROOMS } from './rooms';

beforeAll(initPhysics);

/** The room "watch", and what a test needs to drive it. */
function watch() {
  const registry = registryFor(DojoCartridge);
  expect(registry.run(ROOMS.watch!.text, 'recipe').filter((m) => m.level === 'error')).toEqual([]);
  const session = new Session(DojoCartridge, { registry });
  const notices: string[] = [];
  const me = (): Entity => [...session.world.entities.values()].find((e) => e.character?.player === 1)!;
  const step = (input: PlayerInput = NO_INPUT, n = 1) => {
    for (let i = 0; i < n; i++) {
      session.setInput(1, input);
      session.step();
      for (const ev of session.world.stepEvents) if (ev.type === 'notice') notices.push(ev.text);
    }
  };
  /** Put somewhere, standing, and a few steps more: what the eye sees there. */
  const at = (x: number, z: number) => {
    expect(session.registry.run(`dojo.goto ${x} 1 ${z}`, 'console').filter((m) => m.level === 'error')).toEqual([]);
    step(NO_INPUT, 40);
    return { light: me().character!.light, seen: session.world.signal('spotted') === 1 };
  };
  return { session, notices, step, at, me };
}

describe('the watcher (stage 3d): seen in the light, lost in the dark', () => {
  test('in the dark at the start, unseen; in a pool of light, seen; and back in the dark, lost: each time, a notice', () => {
    const w = watch();
    w.step(NO_INPUT, 30);
    expect(w.me().character!.light).toBeCloseTo(0.08, 6);
    expect(w.session.world.signal('spotted')).toBe(0);
    expect(w.at(-4, 3)).toMatchObject({ seen: true });
    expect(w.at(0, 9)).toEqual({ light: expect.closeTo(0.08, 6), seen: false });
    expect(w.notices).toEqual(['the watcher sees you', 'the watcher lost you']);
  });

  test('right behind the pillar, lit, it does not see you; a step aside, it does', () => {
    const w = watch();
    const hidden = w.at(-3, -5.5);
    expect(hidden.light, 'lit').toBeGreaterThan(0.35);
    expect(hidden.seen).toBe(false);
    expect(w.at(-1.5, -5.5).seen).toBe(true);
  });

  test('beside the fog bank, lit, seen; in it, it sees a third of your light, and loses you', () => {
    const w = watch();
    expect(w.at(5.6, 5).seen).toBe(true);
    const inFog = w.at(3.5, 5);
    expect(inFog.light, 'still lit, a little less: the fog takes from the lamp too').toBeGreaterThan(0.35);
    expect(inFog.seen).toBe(false);
  });

  test('the switch: E at the post lights the pool on the right, and there it sees you', () => {
    const w = watch();
    expect(w.at(3, -3)).toMatchObject({ seen: false });
    w.at(-5.4, 6.2);
    w.step({ ...NO_INPUT, use: true });
    w.step(NO_INPUT, 3);
    expect(w.session.world.named('lamp_switch')!.lamp!.on).toBe(true);
    expect(w.at(3, -3)).toMatchObject({ seen: true });
  });
});
