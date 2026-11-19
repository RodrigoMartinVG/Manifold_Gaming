// The weapons (stage 5g), made by art/weapons.py: one file, served by its address; each weapon a node of it.
import weapons from '../assets/weapons.glb?url';
import type { Feel } from '@manifold/presentation/feel';
import { weaponModel } from './looks';
import { WEAPON_KINDS, type WeaponKind } from './weapons';

/**
 * THE WEAPONS' MODELS, for the presentation: each one's by its name (`arms.dart`), as its file's address
 * and the node's name (`…/weapons.glb#dart`): the file is loaded once, and each one is its node.
 */
export const ARMS_MODELS: Readonly<Record<string, string>> = Object.fromEntries(
  WEAPON_KINDS.map((kind) => [weaponModel(kind), `${weapons}#${kind}`]),
);

/**
 * HOW EACH WEAPON FEELS (stage 5.5g: until then the presentation knew them by name; the view's `Feel`, given
 * through the mount as the looks are): its flash at its end (m across), how much it kicks the view of whoever
 * uses it (degrees), how far it is heard (m) and which of the view's sounds it makes; the flame lance breathes
 * flames, which are its strikes. A rocket leaves a trail with a hiss, and what it strikes it blows up. What is
 * swung or thrown is heard near, as a whoosh. The numbers are those the presentation had (stages 5g to 5o).
 */
export const ARMS_FEEL: Feel = Object.freeze({
  weapons: Object.freeze({
    dart: { flash: 0.14, kick: 1.2, heard: 30, sound: 'crack' },
    bolt: { flash: 0.1, kick: 2, heard: 20, sound: 'twang' },
    shotgun: { flash: 0.34, kick: 6, heard: 45, sound: 'boom' },
    launcher: { flash: 0.28, kick: 4.5, heard: 40, sound: 'thump' },
    // (Stage 5n) Quick and light; the orb's, an attacker's, has no flash (it glows itself).
    repeater: { flash: 0.12, kick: 0.7, heard: 30, sound: 'tick' },
    orb: { flash: 0, kick: 0, heard: 25, sound: 'hum' },
    // (Stage 5o) The longshot, a heavy flash and a hard kick; the flame lance, its flames instead.
    longshot: { flash: 0.2, kick: 3.5, heard: 50, sound: 'ring' },
    flamer: { flash: 0, kick: 0.2, heard: 12, sound: 'roar', flames: true },
    stick: { flash: 0, kick: 0, heard: 8, sound: 'whoosh' },
    grenade: { flash: 0, kick: 0.6, heard: 8, sound: 'whoosh' },
    smoke: { flash: 0, kick: 0.6, heard: 8, sound: 'whoosh' },
    flare: { flash: 0, kick: 0.6, heard: 8, sound: 'whoosh' },
    // (The fortress's pouch: what it throws to hide or to light, heard as what is thrown.)
  } satisfies Record<WeaponKind | 'smoke' | 'flare', Feel['weapons'][string]>),
  projectiles: Object.freeze({ rocket: { trail: true, hiss: true, blasts: true } as const }),
});
