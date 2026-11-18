import type { Entity, World } from '@manifold/core';
import { weapon, WEAPONS, type WeaponKind } from './weapons';

/** A weapon's model's name, as the presentation knows it (`arms.dart`): a node of `weapons.glb` (art/weapons.py). */
export const weaponModel = (kind: WeaponKind) => `arms.${kind}`;

/**
 * HOW EACH WEAPON LOOKS IN THE HANDS (stage 4c's boxes, the Dojo's; stage 5g gave each its model): the
 * box it fits (m: across, up, along; its muzzle at the far end), its color while its model loads, where
 * the hands hold it from its back end (the right hand, then the left), how far it points above the aim
 * at rest (a stick held up), and its model. Plain data, the presentation's `Tool` without a strike: a game
 * gives it in its `tools` (the Dojo's, a shooter's).
 */
export interface WeaponLook {
  size: [number, number, number];
  color: number;
  grips: readonly number[];
  lift: number;
  model: string;
}

export const WEAPON_LOOKS: Readonly<Record<WeaponKind, WeaponLook>> = Object.freeze({
  dart: { size: [0.05, 0.13, 0.3], color: 0x8fa8c0, grips: [0.08, 0.2], lift: 0, model: weaponModel('dart') },
  bolt: { size: [0.42, 0.1, 0.56], color: 0x9a6e48, grips: [0.18, 0.36], lift: 0, model: weaponModel('bolt') },
  stick: { size: [0.04, 0.04, WEAPONS.stick.reach], color: 0xc8a060, grips: [0.06, 0.24], lift: 50, model: weaponModel('stick') },
  grenade: { size: [0.14, 0.14, 0.14], color: 0x4a6a3a, grips: [0.07], lift: 0, model: weaponModel('grenade') },
  shotgun: { size: [0.07, 0.13, 0.76], color: 0x5a4a3a, grips: [0.18, 0.5], lift: 0, model: weaponModel('shotgun') },
  launcher: { size: [0.17, 0.19, 0.96], color: 0x56603a, grips: [0.28, 0.58], lift: 0, model: weaponModel('launcher') },
  // (Stage 5n) The repeater, and the attackers' orb caster.
  repeater: { size: [0.06, 0.15, 0.42], color: 0x7a8ea8, grips: [0.1, 0.28], lift: 0, model: weaponModel('repeater') },
  orb: { size: [0.42, 0.1, 0.56], color: 0x5a8a9a, grips: [0.18, 0.36], lift: 0, model: weaponModel('orb') },
});

/**
 * WHAT A CHARACTER HAS IN ITS HANDS (stage 4c, the Dojo's `dojoTool`; the games' since 5g): its weapon's
 * look, with a strike's sweep under way (its turn from straight ahead, degrees, + to its right, as the
 * world sweeps it) and, blocking, held across. The presentation's `Tool`, as plain data: a game gives it
 * as its `tools`.
 */
export function armsTool(_world: World, e: Entity): (WeaponLook & { sweep: number | null; block?: boolean }) | null {
  const w = weapon(e);
  if (!w || w.kind === 'none') return null;
  const { steps, arc } = WEAPONS.stick;
  const sweep = w.kind === 'stick' && w.strike > 0 ? arc / 2 - (arc * (steps - w.strike - 1)) / steps : null;
  return { ...WEAPON_LOOKS[w.kind], sweep, ...(e.character?.mode === 'block' ? { block: true } : {}) };
}
