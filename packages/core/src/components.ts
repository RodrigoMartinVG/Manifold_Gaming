import type { Entity } from './types';

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
