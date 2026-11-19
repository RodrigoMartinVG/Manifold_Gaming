/**
 * HOW A WEAPON FEELS, AS DATA (stage 5.5g, the audit's V10). Before, the view knew the arms library's weapons
 * by name: each one's flash and kick (fire.ts), how far each is heard (audio.ts), a switch of sound recipes by
 * weapon (synth.ts), and the flame lance and the rocket as special cases; while how each looks already came
 * from the library as data. Now the library gives how each feels beside how it looks (`arms`'s
 * `ARMS_FEEL`), through the mount (`MountOptions.feel`), and the view keeps generic recipes: a sound by
 * the name of how it sounds, not of what makes it.
 */

/** The view's sounds of a weapon used (synth.ts's `fired`), by how they sound. */
export type FiredSound = 'crack' | 'twang' | 'boom' | 'thump' | 'tick' | 'ring' | 'roar' | 'hum' | 'whoosh';

export interface WeaponFeel {
  /** Its flash at its end (m across; 0, none). */
  readonly flash: number;
  /** How much it kicks the view up when the page's character uses it (degrees). */
  readonly kick: number;
  /** How far it is heard (m). */
  readonly heard: number;
  readonly sound: FiredSound;
  /** It breathes flames from its end, which are its strikes (no tracer, no sparks where it strikes). */
  readonly flames?: true;
}

export interface ProjectileFeel {
  /** A trail behind it, and a hiss that follows it. */
  readonly trail?: true;
  readonly hiss?: true;
  /** What it strikes it blows up: no sparks nor a struck sound of its own (the blast is its). */
  readonly blasts?: true;
}

export interface Feel {
  readonly weapons: Readonly<Record<string, WeaponFeel>>;
  readonly projectiles: Readonly<Record<string, ProjectileFeel>>;
}

/** A page given none: every weapon swung or thrown, every projectile plain. */
export const NO_FEEL: Feel = Object.freeze({ weapons: {}, projectiles: {} });

/** A weapon the feel does not name: nothing seen, near, a whoosh (what is swung or thrown). */
export const SWUNG: WeaponFeel = Object.freeze({ flash: 0, kick: 0, heard: 8, sound: 'whoosh' });

export const weaponFeel = (feel: Feel, kind: string): WeaponFeel => feel.weapons[kind] ?? SWUNG;
export const projectileFeel = (feel: Feel, kind: string): ProjectileFeel => feel.projectiles[kind] ?? {};

/** The largest flash a feel has: what a flash's light is measured against (the loudest, at its brightest). */
export const largestFlash = (feel: Feel): number => Object.values(feel.weapons).reduce((most, w) => Math.max(most, w.flash), 0);
