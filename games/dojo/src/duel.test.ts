import { beforeAll, describe, expect, test } from 'vitest';
import type { Vec3 } from '@manifold/common';
import { BotHost, initPhysics, registryFor, Session, type Entity, type Event, type PlayerInput } from '@manifold/core';
import { DojoCartridge } from './cartridge';
import { BLOCKED, weapon, WEAPONS } from './rules';
import { ROOMS } from './rooms';

beforeAll(initPhysics);

/**
 * THE DUEL (stage 4f): the adventure's pieces in a Dojo room. A scene as you come in; objectives that
 * chain from the level's data; a guard fought hand to hand under the lock-on, blocking and striking.
 */
function duel() {
  const registry = registryFor(DojoCartridge);
  expect(registry.run(ROOMS.duel!.text, 'recipe').filter((m) => m.level === 'error')).toEqual([]);
  const session = new Session(DojoCartridge, { registry });
  const bots = new BotHost();
  const events: Event[] = [];
  const step = (input: PlayerInput = {}) => {
    bots.think(session);
    session.setInput(1, input);
    session.step();
    events.push(...session.world.stepEvents);
  };
  const all = () => [...session.world.entities.values()];
  const hero = (): Entity => all().find((e) => e.character?.player === 1)!;
  const guard = (): Entity => all().find((e) => e.brain)!;
  return { session, events, step, hero, guard };
}

const toward = (from: Vec3, to: Vec3): Vec3 => {
  const d = Math.hypot(to[0] - from[0], to[2] - from[2]);
  return d < 0.05 ? [0, 0, 0] : [(to[0] - from[0]) / d, 0, (to[2] - from[2]) / d];
};

describe('the duel (stage 4f)', () => {
  test('a scene as you come in; take the stick, bring the guard down under the lock-on, blocking its blows; then out through the gate', () => {
    const { session, events, step, hero, guard } = duel();
    const world = () => session.world;
    step();
    step();
    const said = () =>
      events.flatMap((e) => (e.type === 'objective' ? [`${e.name} ${e.state}`] : e.type === 'scene' ? [`scene ${e.name}`] : []));
    // The scene played at once (you stand where you come in); the first objective is the one to do.
    expect(said()).toEqual(['scene hello']);
    expect(world().named('arm')!.objective!.state).toBe('active');
    // To the stick's rack.
    for (let i = 0; i < 300 && weapon(hero())!.kind !== 'stick'; i++)
      step({ move: toward(hero().transform!.position, [-3, 0, 5]) });
    expect(weapon(hero())!.kind).toBe('stick');
    step();
    expect(said()).toEqual(['scene hello', 'arm done', 'fight active']);
    // Lock on to the guard (it is in front, coming): T, once.
    step({ face: toward(hero().transform!.position, guard().transform!.position) });
    step({ lock: true });
    step({});
    expect(hero().character!.lock).toBe(guard().id);
    // The fight: towards it; within reach, block while it swings, strike when it does not.
    let blocked = 0;
    for (let i = 0; i < 2400 && (guard().health!.down ?? -1) < 0; i++) {
      const h = hero();
      const g = guard();
      if ((h.health!.down ?? -1) >= 0) {
        step({});
        continue;
      }
      if (h.character!.lock === null) {
        step({ face: toward(h.transform!.position, g.transform!.position) });
        step({ lock: true });
        continue;
      }
      const d = Math.hypot(
        g.transform!.position[0] - h.transform!.position[0],
        g.transform!.position[2] - h.transform!.position[2],
      );
      const swinging = (weapon(g)?.strike ?? 0) > 0;
      if (swinging) step({ block: true });
      else if (d > 1.3) step({ ahead: 1 });
      else step({ 'arms.attack': i % 2 === 0 });
      if (h.character!.mode === 'block') blocked++;
    }
    expect(guard().health!.down).toBeGreaterThanOrEqual(0);
    // Blows taken blocking took a quarter; the hero blocked some.
    const hits = events.flatMap((e) => (e.type === 'hurt' && e.kind === 'stick' ? [e] : []));
    expect(blocked).toBeGreaterThan(0);
    expect(hits.some((h) => h.amount === Math.round(WEAPONS.stick.damage * BLOCKED))).toBe(true);
    step();
    expect(said()).toEqual(['scene hello', 'arm done', 'fight active', 'fight done', 'leave active']);
    // Out through the gate.
    for (let i = 0; i < 600 && world().named('leave')!.objective!.state !== 'done'; i++) {
      const p = hero().transform!.position;
      step({ lock: false, move: toward(p, p[2] > -8 ? [0, 0, -8] : [0, 0, -11]) });
      if (hero().character!.lock !== null) step({ lock: true });
    }
    expect(said().at(-1)).toBe('leave done');
    session.world.dispose();
  });
});
