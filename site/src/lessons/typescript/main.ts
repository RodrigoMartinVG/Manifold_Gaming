import { length, vec, type Vec } from './vec';

// 1. ANNOTATIONS say what goes in and what comes out (open vec.ts).
console.log('length(vec(3, 4, 0)) =', length(vec(3, 4, 0)));

// A TYPE ERROR, ON PURPOSE. In your editor, the next line is marked before running: "Expected 3
// arguments, but got 2". This page's editor removes the types and runs JavaScript, which lets it
// through: z is undefined, and the length comes out NaN.
// @ts-expect-error -- the example shows what happens when nobody checks the types.
console.log('length(vec(3, 4)) =', length(vec(3, 4)));

// 2. STRUCTURAL TYPES: what counts is the shape. A Point has the same fields as a Vec, so it goes
// where a Vec goes (that is why the tutorial names them by what they mean, not by their shape).
interface Point {
  x: number;
  y: number;
  z: number;
}
const P: Point = { x: 1, y: 2, z: 2 };
console.log('a Point where a Vec goes:', length(P));

// 3. A UNION OF WORDS: a phase of the game is one of these three, and nothing else. The switch
// covers them all; if a fourth were added, `never` would make the compiler point at this switch.
type Phase = 'aiming' | 'won' | 'lost';
function message(phase: Phase): string {
  switch (phase) {
    case 'aiming':
      return 'apuntá';
    case 'won':
      return 'ganaste';
    case 'lost':
      return 'perdiste';
    default: {
      const unhandled: never = phase;
      return unhandled;
    }
  }
}
console.log('the phases:', (['aiming', 'won', 'lost'] as const).map(message).join(', '));

// 4. NULL AS AN ANSWER, and narrowing: after the `if`, the compiler knows it is a number.
/** The depth of a point seen by a camera looking down −z: a number, or null if it is behind. */
function depthOf(p: Vec): number | null {
  return p.z < 0 ? -p.z : null;
}
const depth = depthOf(vec(0, 0, -4));
if (depth === null) console.log('behind the camera');
else console.log('the depth is', depth.toFixed(1));
// ?? gives a value for when there is none (null or undefined); ?. asks only if there is something to ask.
console.log('behind the camera, the depth or 0:', depthOf(vec(0, 0, 5)) ?? 0);

// 5. AN INDEX CAN FALL OUTSIDE A LIST: targets[2] is a Vec or undefined.
const targets: Vec[] = [vec(0, 0, -5), vec(3, 0, -4)];
console.log('the third target:', targets[2]?.z ?? 'there is none');
// The `!` is a promise to the compiler: "there is one". Make it only when you can say why.
const first = targets[0]!; // the list was written right above, with two targets
console.log('the first one is', length(first), 'm away');

// 6. READONLY, and tables with typed keys: a Record has one entry for each phase, and none can be
// forgotten or changed.
const COLOR: Readonly<Record<Phase, string>> = { aiming: 'white', won: 'gold', lost: 'red' };
const hits = new Map<string, number>([['post 1', 2]]);
hits.set('post 2', (hits.get('post 2') ?? 0) + 1);
console.log('when won, the color is', COLOR.won, '; hits:', [...hits].join(' · '));
