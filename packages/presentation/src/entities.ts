import type { Entity, EntityId, World } from '@manifold/core';

/** The components the view asks for by name (what its pieces looked for, each walking the whole world). */
export const INDEXED = [
  'character',
  'lamp',
  'watcher',
  'sensor',
  'appearance',
  'brain',
  'objective',
  'projectile',
] as const satisfies readonly (keyof Entity)[];
export type Indexed = (typeof INDEXED)[number];

/**
 * THE ENTITIES BY WHAT THEY HAVE (stage 5.5g, the audit's V7). Before, eight pieces walked every entity of
 * the world on every frame, and the page found its player by copying all of them, twice a frame and once
 * an event. One index, kept from the world's events (an entity made, an entity gone) and made again when
 * the page's world is another (a restart, a load, a snapshot, a replay, a join: whichever way it came):
 * the entities that have a component, in the order they were made (their ids'), and this page's player,
 * kept until it goes.
 *
 * What it hands out is checked as it is read: an entity that lost the component since (a broken crate
 * loses its body) is left out, and forgotten.
 */
export interface EntityIndex {
  /** The entities that have `component` now, in id order. */
  with<C extends Indexed>(component: C): readonly (Entity & Required<Pick<Entity, C>>)[];
  /** This page's player's character (the one it drives), if the world has one. */
  hero(): Entity | undefined;
  /** An entity made, or gone (the world's events). */
  made(id: EntityId): void;
  gone(id: EntityId): void;
}

/** An index of the world the page draws now (`world`), for the player `who` says (it may change: driving a bot, joining a match). */
export function createEntityIndex(world: () => World, who: () => number): EntityIndex {
  const by = new Map<Indexed, Map<EntityId, Entity>>(INDEXED.map((c) => [c, new Map()]));
  let hero: Entity | undefined;
  let heroOf = -1;
  let indexed: World | null = null;
  const add = (e: Entity) => {
    for (const c of INDEXED) if (e[c] !== undefined) by.get(c)!.set(e.id, e);
  };
  /** The world it indexes, the page's: made again if it is another. */
  const sync = () => {
    const now = world();
    if (now === indexed) return now;
    indexed = now;
    for (const list of by.values()) list.clear();
    hero = undefined;
    heroOf = -1;
    for (const e of now.entities.values()) add(e);
    return now;
  };
  return {
    with<C extends Indexed>(component: C) {
      sync();
      const list = by.get(component)!;
      const out: Entity[] = [];
      for (const [id, e] of list) {
        if (e[component] === undefined) list.delete(id);
        else out.push(e);
      }
      return out as (Entity & Required<Pick<Entity, C>>)[];
    },
    hero() {
      sync();
      const player = who();
      if (hero?.character?.player === player && heroOf === player && by.get('character')!.has(hero.id)) return hero;
      hero = undefined;
      heroOf = player;
      for (const e of by.get('character')!.values())
        if (e.character?.player === player) {
          hero = e;
          break;
        }
      // (Not there, it may be one made since the last events were read, a step ago: looked for in the world.)
      if (!hero)
        for (const e of indexed!.entities.values())
          if (e.character?.player === player) {
            add(e);
            hero = e;
            break;
          }
      return hero;
    },
    made(id) {
      const e = sync().entities.get(id);
      if (e) add(e);
    },
    gone(id) {
      sync();
      for (const list of by.values()) list.delete(id);
      if (hero?.id === id) hero = undefined;
    },
  };
}
