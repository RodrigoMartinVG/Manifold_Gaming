import { newCharacter } from './character';
import type { ComponentSpecs, Entity, GameComponents } from './types';
import type { World } from './world';

/** A game component's name: `<game>.<component>`, lowercase words joined by dots (`dojo.runner`). */
export const COMPONENT_NAME = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

/**
 * A GAME'S COMPONENT on an entity (stage 2.5b), by its name, as the game says it is:
 * `component<Runner>(hero, 'dojo.runner')`. The engine does not look inside: the game wrote it, and
 * the game reads it. (A type with its fields, not an interface: plain data has no methods.)
 */
export function component<T extends object>(e: Entity, name: string): T | undefined {
  return e.game?.[name] as T | undefined;
}

/**
 * SETS A GAME'S COMPONENT on an entity (stage 5.5e, S4), by its name, checked as `createEntity` checks the
 * ones it is born with (`<game>.<component>`): `setComponent(guard, 'wall.wave', { wave })`. Before, a game
 * wrote `e.game = { ...e.game, … }` itself, and nothing checked a name added after the entity was born.
 * Back, the value set.
 */
export function setComponent<T extends object>(e: Entity, name: string, value: T): T {
  if (!COMPONENT_NAME.test(name))
    throw new Error(
      `"${name}" is not a game component's name: it goes with its game, \`<game>.<component>\`, like \`dojo.runner\``,
    );
  (e.game ??= {})[name] = value as unknown as GameComponents[string];
  return value;
}

/** How the world makes one of its components from what is asked for: checked, with what it starts with. */
type Maker<K extends keyof ComponentSpecs> = (spec: ComponentSpecs[K], e: Entity, world: World) => NonNullable<Entity[K]>;

/**
 * HOW THE WORLD MAKES EACH COMPONENT IT MAKES (stage 5.5e, S4), from what is asked for (`ComponentSpecs`,
 * which this must cover: a component there without its maker here does not compile), in the order
 * `createEntity` makes them (a body once the rest is there, a character once its body is). Each one
 * checks what it is given (one that throws does so after its entity took its id, as before) and gives
 * what it starts with: health full, a lamp on if it follows no signal, a mechanism closed where it is.
 */
export const MAKERS: { readonly [K in keyof ComponentSpecs]: Maker<K> } = {
  health(health) {
    if (!(health.most > 0)) throw new Error('Health has some points: its most must be more than 0');
    return { points: health.most, most: health.most, down: -1 };
  },
  mover: (mover) => ({ from: [...mover.from], to: [...mover.to], seconds: mover.seconds }),
  breakable(breakable) {
    if (!(breakable.threshold >= 0)) throw new Error('What breaks it is an energy, 0 or more');
    return { threshold: breakable.threshold, broken: false };
  },
  lamp(lamp, e) {
    if (!e.transform) throw new Error('A lamp needs a transform: where is it?');
    if (!(lamp.radius > 0) || !(lamp.intensity >= 0))
      throw new Error('A lamp reaches somewhere (a radius over 0), with some light (0 or more)');
    return { radius: lamp.radius, intensity: lamp.intensity, signal: lamp.signal, on: lamp.signal === null };
  },
  watcher(watcher, e) {
    if (!e.transform) throw new Error('A watcher needs a transform: where is its eye, and where does it look?');
    if (!(watcher.range > 0) || !(watcher.cone >= -1 && watcher.cone <= 1))
      throw new Error('A watcher sees somewhere: a range over 0, a cone between -1 and 1');
    return { range: watcher.range, cone: watcher.cone, threshold: watcher.threshold, sees: [] };
  },
  mechanism(mechanism, e, world) {
    if (!e.transform) throw new Error('A mechanism needs a transform: where is it, closed?');
    if (!(mechanism.seconds > 0)) throw new Error('A mechanism takes some time: its seconds must be more than 0');
    if (!mechanism.door === !mechanism.lift) throw new Error('A mechanism is a door or a lift');
    return {
      signal: mechanism.signal,
      seconds: mechanism.seconds,
      closed: { position: [...e.transform.position], rotation: [...e.transform.rotation] },
      ...(mechanism.door
        ? { door: { hinge: [...mechanism.door.hinge], axis: [...mechanism.door.axis], degrees: mechanism.door.degrees } }
        : {}),
      ...(mechanism.lift ? { lift: { by: [...mechanism.lift.by] } } : {}),
      toward: 0,
      since: world.tick,
      from: 0,
    };
  },
  sensor(sensor, e) {
    if (!e.transform) throw new Error('A zone needs a transform: where is it?');
    const params = Object.fromEntries(Object.entries(sensor.params ?? {}).map(([k, v]) => [k, [...v]]));
    return { kind: sensor.kind, half: [...sensor.half], inside: [], params };
  },
  body(body, e, world) {
    if (!e.transform) throw new Error('A body needs a transform: where is it?');
    // What it is made of gives it its friction, its bounce and (stage 3g) what it weighs for its size
    // (the world checked it knows it, before the entity took its id).
    const material = body.material === undefined ? undefined : world.materials[body.material];
    const spec = material
      ? {
          ...body,
          friction: body.friction ?? material.friction,
          restitution: body.restitution ?? material.bounce,
          density: body.density ?? material.density,
        }
      : body;
    return world.physics.addBody(spec, e.transform);
  },
  character(character, e) {
    if (e.body?.type !== 'character') throw new Error("A character needs a body of type 'character'.");
    return newCharacter(character);
  },
};

/**
 * WHAT THE CONSOLE'S `set` MAY CHANGE OF A COMPONENT (stage 5.5e, S4): all of its fields, but what this
 * says, and why. What the physics keeps goes through the world (`set` places and pushes); what a level's
 * line made it, its line keeps.
 */
export const SETTABLE: Readonly<
  Partial<Record<keyof Entity, { only?: readonly string[]; not?: readonly string[]; why: string }>>
> = {
  body: {
    only: ['linearVelocity', 'angularVelocity'],
    why: "a body's shape, kind and material are the physics': delete it and add it again",
  },
  transform: { not: ['rotation'], why: "a turn is its line's (`rotate y 45`): delete it and add it again" },
  mechanism: { only: [], why: "mechanism is the level line's: delete it and add it again" },
  mover: { only: [], why: "mover is the level line's: delete it and add it again" },
  source: { only: [], why: "source is the level line's: delete it and add it again" },
};

/** Why `set` may not change a component's field (its first key), or null if it may. */
export function unsettable(component: string, field: string | undefined): string | null {
  const rule = Object.hasOwn(SETTABLE, component) ? SETTABLE[component as keyof Entity] : undefined;
  if (!rule) return null;
  if (rule.only && !(field !== undefined && rule.only.includes(field))) return rule.why;
  if (rule.not && field !== undefined && rule.not.includes(field)) return rule.why;
  return null;
}
