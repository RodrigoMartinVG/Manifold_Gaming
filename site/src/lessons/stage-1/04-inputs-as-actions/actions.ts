/**
 * WHAT A PLAYER CAN ASK FOR: actions, with a name and a kind. The world reads these, never keys: a
 * key, a gamepad, a bot, a replay or the network are only different ways of asking for them.
 */
export const ACTIONS = [
  {
    name: 'move',
    kind: 'direction',
    description: 'where on the floor: whole degrees from forward (−Z) to the right',
  },
  { name: 'jump', kind: 'button', description: 'held or not' },
] as const;

/** What one player asks for at one step. `move` is null when standing still. */
export interface Input {
  move: number | null;
  jump: boolean;
}
export const NOTHING: Input = { move: null, jump: false };

/** Which PHYSICAL key asks for what (`KeyboardEvent.code`: the same place on any keyboard layout). */
export interface Binding {
  forward: string;
  back: string;
  left: string;
  right: string;
  jump: string;
}
export const BINDINGS: Record<number, Binding> = {
  1: { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space' },
  2: {
    forward: 'ArrowUp',
    back: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    jump: 'Enter',
  },
};

/** The eight directions keys can ask for, in whole degrees, by [right, forward]. */
const DEGREES: Record<string, number> = {
  '0,1': 0,
  '1,1': 45,
  '1,0': 90,
  '1,-1': 135,
  '0,-1': 180,
  '-1,-1': 225,
  '-1,0': 270,
  '-1,1': 315,
};
/** And each one as a step on the floor (x, z) of length 1, without trigonometry: the same bits everywhere. */
const S = Math.SQRT1_2;
export const DIRECTION: Record<number, [x: number, z: number]> = {
  0: [0, -1],
  45: [S, -S],
  90: [1, 0],
  135: [S, S],
  180: [0, 1],
  225: [-S, S],
  270: [-1, 0],
  315: [-S, -S],
};

/**
 * THE KEYBOARD: the keys held, and the ones pressed since the last reading. A key pressed and
 * released between two readings still counts once (if `keepTaps`): on a slow screen, a quick tap
 * happens entirely between two frames.
 */
export function keyboard(keepTaps: () => boolean) {
  const held = new Set<string>();
  const pressed = new Set<string>();
  addEventListener('keydown', (e) => {
    held.add(e.code);
    pressed.add(e.code);
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); // not to scroll the page
  });
  addEventListener('keyup', (e) => held.delete(e.code));
  return {
    /** What player `player` asks for now, by its bindings. */
    read(player: number): Input {
      const keys = binding(player);
      const down = (code: string) => held.has(code) || (keepTaps() && pressed.has(code));
      const right = (down(keys.right) ? 1 : 0) - (down(keys.left) ? 1 : 0);
      const forward = (down(keys.forward) ? 1 : 0) - (down(keys.back) ? 1 : 0);
      return { move: DEGREES[`${right},${forward}`] ?? null, jump: down(keys.jump) };
    },
    /** Once every player was read: the taps were used. */
    used() {
      pressed.clear();
    },
  };
}
const binding = (player: number): Binding => BINDINGS[player] ?? BINDINGS[1]!;

/** Whether two inputs ask for the same thing (only changes are kept). */
export const same = (a: Input, b: Input) => a.move === b.move && a.jump === b.jump;

/** As text, the way a replay or the network would carry it. */
export const describe = (i: Input) =>
  [i.move === null ? 'still' : `move ${i.move}°`, ...(i.jump ? ['jump'] : [])].join(', ');
