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
  AMMO_GIVEN,
  AMMO_MOST,
  AMMO_OF,
  ARSENAL,
  arsenal,
  AUTOMATIC,
  fallbackOf,
  giveAmmo,
  MAGAZINES,
  RELOAD,
  RELOAD_HEARD,
  RELOAD_IN,
  reloadShare,
  roundsOf,
  RAISED,
  raised,
  SLOT_INPUTS,
  SLOTS,
  READY,
  READY_HEARD,
  THROWN,
  WEAPON,
  WEAPON_KINDS,
  weapon,
  WEAPONS,
  type AmmoKind,
  type Arsenal,
  type Raised,
  type Thrown,
  type Weapon,
  type WeaponKind,
} from './weapons';
export { armsTool, RELOAD_LOOK, reloadLift, WEAPON_LOOKS, weaponModel, type WeaponLook } from './looks';
export { GUARD, GUARD_BRAIN, guard, guardsOf, GUNNER, GUNNER_KEY, gunnerOf, type Fair, type Gunner } from './guard';
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
  NOTICE,
  noticeOf,
  noticing,
  PEBBLE_INPUT,
  secondsToNotice,
  stealth,
  stealthDamage,
  WARY,
  wary,
  type Aware,
  type Notice,
  type NoticeState,
  type Pouch,
  type Wary,
} from './stealth';

/**
 * THE VERSION OF ITS RULES (stage 5.5c, decision 0033): what fights: the weapons, their strikes, shots and blasts, the arsenal, the guards and the stealth. It goes up when what they decide changes
 * what a replay gives; every game whose rules use it names it in its `versions`, so its replays say so.
 *
 *   1  stage 5.5c: as at the engine's version 49
 */
export const ARMS_VERSION = { arms: 1 } as const;
