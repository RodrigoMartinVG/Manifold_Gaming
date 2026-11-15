import { DIRECTION, NOTHING, type Input } from './actions';

export const STEP = 1 / 60;
const SPEED = 4; // m/s
const JUMP = 5; // m/s up
const G = 9.81;

/** A player in the world: where it is, how fast it goes up, and what it asks for now and asked for at the step before. */
export interface Player {
  position: [x: number, y: number, z: number];
  vy: number;
  input: Input;
  before: Input;
  jumps: number;
}

/**
 * A SMALL WORLD FOR TWO PLAYERS. It knows nothing of keys: in every step it gets each player's
 * input (or keeps the one it had), and reads its actions.
 */
export function createWorld() {
  const players = new Map<number, Player>([
    [1, { position: [-1.5, 0, 0], vy: 0, input: NOTHING, before: NOTHING, jumps: 0 }],
    [2, { position: [1.5, 0, 0], vy: 0, input: NOTHING, before: NOTHING, jumps: 0 }],
  ]);
  let steps = 0;
  return {
    players,
    get steps() {
      return steps;
    },
    /** One step, with the inputs that changed at it (by player). */
    step(changes: ReadonlyMap<number, Input>) {
      steps++;
      for (const [id, p] of players) {
        p.before = p.input;
        p.input = changes.get(id) ?? p.input;
        // PRESSED: held now and not at the step before. Here, in the world, from its own two inputs:
        // so a replay, or another copy of the world, decides exactly the same.
        const pressed = p.input.jump && !p.before.jump;
        if (pressed && p.position[1] === 0) {
          p.vy = JUMP;
          p.jumps++;
        }
        if (p.input.move !== null) {
          const [dx, dz] = DIRECTION[p.input.move] ?? [0, 0];
          p.position[0] = Math.max(-6, Math.min(6, p.position[0] + dx * SPEED * STEP));
          p.position[2] = Math.max(-4, Math.min(4, p.position[2] + dz * SPEED * STEP));
        }
        p.vy -= G * STEP;
        p.position[1] = Math.max(0, p.position[1] + p.vy * STEP);
        if (p.position[1] === 0) p.vy = 0;
      }
    },
  };
}
