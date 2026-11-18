// The weapons (stage 5g), made by art/weapons.py: one file, served by its address; each weapon a node of it.
import weapons from '../assets/weapons.glb?url';
import { weaponModel } from './looks';
import { WEAPON_KINDS } from './weapons';

/**
 * THE WEAPONS' MODELS, for the presentation: each one's by its name (`arms.dart`), as its file's address
 * and the node's name (`…/weapons.glb#dart`): the file is loaded once, and each one is its node.
 */
export const ARMS_MODELS: Readonly<Record<string, string>> = Object.fromEntries(
  WEAPON_KINDS.map((kind) => [weaponModel(kind), `${weapons}#${kind}`]),
);
