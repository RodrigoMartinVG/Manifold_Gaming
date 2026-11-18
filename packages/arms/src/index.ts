/**
 * WHAT FIGHTS (stage 5e): the games' weapons, guards and their brain, out of the Dojo's rules (decision
 * 0003: a game imports the engine, never another game; the adventure and the shooter fight too).
 */
export {
  ARMS_INPUTS,
  arms,
  armsDamage,
  ATTACK,
  BLOCKED,
  EYE,
  fuses,
  impactDamage,
  THROWN,
  WEAPON,
  WEAPON_KINDS,
  weapon,
  WEAPONS,
  type Thrown,
  type Weapon,
  type WeaponKind,
} from './weapons';
export { GUARD, GUARD_BRAIN, guard, guardsOf, GUNNER, GUNNER_KEY, gunnerOf, type Gunner } from './guard';
export { ARMS_BRAINS, type GuardMemory } from './brain';
export {
  FLARE_INPUT,
  POUCH,
  pouch,
  SHOUT_INPUT,
  SMOKE_INPUT,
  STEALTH,
  STEALTH_INPUTS,
  STEALTH_ZONES,
  stealth,
  stealthDamage,
  WARY,
  wary,
  type Pouch,
  type Wary,
} from './stealth';
