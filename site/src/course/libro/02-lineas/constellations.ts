import type { Point } from './line';

/** A constellation: its stars, at pixel centres, in the order lines join them; `closed` joins the last to the first. */
export interface Constellation {
  name: string;
  stars: Point[];
  closed: boolean;
}

/** THE NIGHT'S CONSTELLATIONS, as data: away from the moon and the tower, brighter than the other stars. */
export const CONSTELLATIONS: Constellation[] = [
  {
    name: 'the Bow',
    stars: [
      { x: 6.5, y: 10.5 },
      { x: 14.5, y: 5.5 },
      { x: 21.5, y: 13.5 },
    ],
    closed: false,
  },
  {
    name: 'the Ladder',
    stars: [
      { x: 62.5, y: 12.5 },
      { x: 70.5, y: 20.5 },
      { x: 66.5, y: 31.5 },
      { x: 78.5, y: 38.5 },
      { x: 90.5, y: 33.5 },
    ],
    closed: false,
  },
  {
    name: 'the Kite',
    stars: [
      { x: 140.5, y: 44.5 },
      { x: 151.5, y: 55.5 },
      { x: 141.5, y: 70.5 },
      { x: 131.5, y: 56.5 },
    ],
    closed: true,
  },
];
