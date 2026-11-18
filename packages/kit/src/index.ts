import type { Vec3 } from '@manifold/common';
import type { KitPieces, Turn } from '@manifold/core';
import made from '../assets/kit.json' with { type: 'json' };

/**
 * THE KIT OF LEVEL PIECES (stage 4.5e, decision 0026): what `art/kit.py` made, read from what it wrote
 * beside the model (`kit.json`): each piece's boxes, in its own frame (a box may be turned within it),
 * its size, and the model it is drawn with (`kit.<piece>`). A game gives it as its `kit`; its levels say
 * `kit wall_door 4 0 -6 rotate y 90`. Runs without a screen: the model is the presentation's (`./models`).
 */
interface Made {
  pieces: Record<
    string,
    { boxes: { center: number[]; half: number[]; turn?: { axis: string; degrees: number } }[]; size: number[]; triangles: number }
  >;
  leaves: Record<string, { size: number[]; triangles: number }>;
}

/** A piece's model's name, as the presentation knows it (`kit.wall_2`). */
export const kitModel = (piece: string) => `kit.${piece}`;

const vec = (v: number[]): Vec3 => [v[0]!, v[1]!, v[2]!];

export const KIT: KitPieces = Object.fromEntries(
  Object.entries((made as Made).pieces).map(([name, p]) => [
    name,
    {
      boxes: p.boxes.map((b) => ({
        center: vec(b.center),
        half: vec(b.half),
        ...(b.turn ? { turn: { axis: b.turn.axis as Turn['axis'], degrees: b.turn.degrees } } : {}),
      })),
      size: vec(p.size),
      model: kitModel(name),
    },
  ]),
);

/**
 * THE LEAVES the kit draws over a level's doors (stage 4.5f): models with no boxes of their own, since a
 * door is a box the simulation turns (decision 0026). Each its size, the box a level gives the door it
 * draws (`box … 0.5 1.1 0.03 door … model kit.door_1`): `door_1` fills `wall_door` (two fill
 * `wall_door_wide`), `gate_leaf` half of `wall_gate`. Hinged on its left edge (−x).
 */
export const KIT_LEAVES: Readonly<Record<string, { size: Vec3; model: string }>> = Object.fromEntries(
  Object.entries((made as Made).leaves).map(([name, l]) => [name, { size: vec(l.size), model: kitModel(name) }]),
);

/** Each piece's and leaf's triangles, as the script counted them (the kit's budget: decision 0026). */
export const KIT_TRIANGLES: Readonly<Record<string, number>> = Object.fromEntries(
  [...Object.entries((made as Made).pieces), ...Object.entries((made as Made).leaves)].map(([name, p]) => [name, p.triangles]),
);
export { levelFromPlan } from './plan';
