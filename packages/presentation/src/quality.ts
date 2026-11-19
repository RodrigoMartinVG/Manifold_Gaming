/**
 * THE QUALITY TIERS (stage 5.5g, the audit's V1; decision 0026's budget). What a frame may cost, and every
 * knob that decides it, in one place: before, the budget lived only in a browser test, and each knob was a
 * constant in another file (the pixel ratio and the anti-aliasing in the stage, the lights in the pool, the
 * textures' filtering in the models, the particles in the fire, the batches' squares in the bodies). The
 * stage owns the active tier (`Stage.quality`) and each piece reads it there; the page says its budget
 * (`data-budget-draws`, `data-budget-triangles`), and the browser tests check what is drawn against that.
 *
 * Today one tier, the floor: decision 0026's numbers, measured on the author's Iris Plus (an integrated GPU,
 * at 1× resolution: 2× is four times the pixels). A tier for a better machine adds a record here; nothing
 * else changes.
 */
export interface Tier {
  readonly name: string;
  /** What a frame may draw, wherever one stands (decision 0026): draw calls, triangles. */
  readonly budget: { readonly draws: number; readonly triangles: number };
  /** The screen's pixels for each of the page's. */
  readonly pixelRatio: number;
  /** The samples a pixel of the scene takes through the finished image's passes: its anti-aliasing. */
  readonly samples: number;
  /** The scene's real lights, at most (the light pool's slots). */
  readonly lights: number;
  /** A texture's anisotropic filtering (the kit's floors seen at a slant). */
  readonly anisotropy: number;
  /** Particles at once: those that add light (fire, sparks), those that cover (smoke, dust). */
  readonly particles: { readonly adds: number; readonly covers: number };
  /** The side of the squares a level's still pieces are batched in (m): what is out of sight goes a square at a time. */
  readonly cell: number;
  /** Whether bodies cast and receive shadows (none on the floor: the stage draws no shadow maps). */
  readonly shadows: boolean;
  /** Sounds playing at once, at most: past it, one fainter than every one playing is not made (a firefight's dozens). */
  readonly voices: number;
  /**
   * Bands of a character's animation by its distance from the camera (m): within `near` (and the page's own,
   * always) all of it, its hands and feet finding what is round them by rays; within `far`, its animations
   * without the rays; beyond, its animations a frame in `every`, with the time of those it skipped.
   */
  readonly animation: { readonly near: number; readonly far: number; readonly every: number };
}

export const TIERS = {
  floor: {
    name: 'floor',
    budget: { draws: 300, triangles: 50_000 },
    pixelRatio: 1,
    samples: 4,
    lights: 6,
    anisotropy: 8,
    particles: { adds: 900, covers: 900 },
    cell: 16,
    shadows: false,
    voices: 32,
    animation: { near: 15, far: 40, every: 3 },
  },
} as const satisfies Record<string, Tier>;

/** The tier every page has today. */
export const FLOOR: Tier = TIERS.floor;
