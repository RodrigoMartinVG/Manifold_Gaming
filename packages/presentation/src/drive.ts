import type { CommandInfo, VariableInfo } from '@manifold/commands';
import { faceFor, upAt } from '@manifold/core';
import type { Rig } from './camera';
import type { PageMatch } from './match';
import type { GamePage, Piece } from './page';
import { CHARACTER_KEYS, type ControlScheme, type GameButton, type PlayerControls } from './player';

/** What driving the character lets people change, as data (the site's console reference reads it). */
export const DRIVE_VARIABLES = {
  scheme: {
    name: 'controls.scheme',
    description:
      "How the keys (and a gamepad's left stick) drive the character: `camera` goes by where the camera looks (W forward, A and D to its sides; the character looks where it walks); `tank` goes by where the character looks: W and S forward and back, A and D turn it on its own axis, Q and E (or A and D with Alt held) go to its sides. With `view.camera aim` the mouse turns it, and the keys go by the camera.",
    scope: 'view',
    type: { kind: 'option', options: ['camera', 'tank'] },
    default: 'camera',
  },
} as const satisfies Record<string, VariableInfo>;
export const DRIVE_COMMANDS = {
  inputs: {
    name: 'inputs',
    description:
      'What a player can ask for in this game, and what presses it (the core declares what the character reads; each game, its own buttons).',
  },
} as const satisfies Record<string, CommandInfo>;

/**
 * DRIVING THE CHARACTER (stage 1b): on every frame, before the steps, what this page's player asks
 * for (keys and gamepad, read by player.ts, by where the camera looks), sent to the match: it enters
 * the world at the next step. Not while a replay plays. It declares `controls.scheme` and `inputs`.
 */
export function mountDrive(
  page: GamePage,
  match: PageMatch,
  rig: Rig,
  o: { controls: PlayerControls; buttons?: readonly GameButton[]; replaying(): boolean },
): Piece {
  let scheme: ControlScheme = 'camera';
  page.registry.declareVariable({
    ...DRIVE_VARIABLES.scheme,
    onChange: (v) => (scheme = v as ControlScheme),
  });
  page.registry.declareCommand({
    ...DRIVE_COMMANDS.inputs,
    run: (_, out) => {
      out.write('what a player can ask for:');
      for (const a of page.session.actions) {
        const keys =
          CHARACTER_KEYS[a.name] ??
          o.buttons
            ?.find((b) => b.action === a.name)
            ?.keys.map((k) => k.replace(/^Key/, ''))
            .join(' or ');
        out.write(`  \`${a.name}\` (${a.kind}): ${a.description}${keys ? ` — ${keys}` : ''}`);
      }
    },
  });

  return {
    beforeSteps({ world, hero }) {
      if (!hero?.transform || o.replaying()) return;
      const look = rig.look();
      // (Aiming, the mouse turns it: the keys go by the camera, whatever the scheme.)
      const aiming = rig.mode === 'aim';
      const asked = o.controls.read(look, upAt(world, hero.transform.position), aiming ? 'camera' : scheme);
      // Aiming, the character looks where the camera looks (the core keeps only its horizontal part).
      // `face` is read inside the turn the platforms gave the character (stage 2d): asked inside the
      // one the camera already turned by, the same as long as the mouse is still (`faceFor`, the core).
      const turn = rig.turn() ?? hero.character?.carriedTurn ?? [0, 0, 0, 1];
      match.sendInput(aiming ? { ...asked, face: faceFor({ carriedTurn: turn }, look) } : asked);
    },
  };
}
