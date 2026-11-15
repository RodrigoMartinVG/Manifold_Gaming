import { declareHelp, formatValue, type CommandInfo, type Scope, type VariableInfo } from '@manifold/commands';
import { registryFor } from '@manifold/core';
import { PRESENTATION_COMMANDS, PRESENTATION_VARIABLES } from '@manifold/presentation/catalog';
import { DojoCartridge } from './cartridge';

/** A variable as the reference shows it: what it is, and its default value as it is written. */
export interface DeclaredVariable extends VariableInfo {
  /** Its default value, as it is written in the console (`0 -9.81 0`, `off`). */
  written: string;
}

/** A command as the reference shows it: what it is, how it is written, and whether it is a world action. */
export interface DeclaredCommand extends CommandInfo {
  /** How it is written (`step [n]`, `replay [export|play|stop]`): what the console says. */
  usage: string;
  /** World actions enter the simulation at a step (like world values); the rest happen right away. */
  scope: Extract<Scope, 'world'> | null;
}

/**
 * EVERYTHING THE DOJO'S CONSOLE DECLARES, as data (stage 2.5a): the engine's (the core's, the
 * presentation's pieces', the console's and help's) and the Dojo's own, in the order they are
 * declared, without mounting anything. What the site's console reference is generated from.
 */
export function dojoDeclarations(): { variables: DeclaredVariable[]; commands: DeclaredCommand[] } {
  const registry = registryFor(DojoCartridge);
  declareHelp(registry);
  for (const v of PRESENTATION_VARIABLES) registry.declareVariable(v);
  for (const c of PRESENTATION_COMMANDS) registry.declareCommand(c);
  return {
    variables: registry.variables().map(({ decl }) => {
      const { onChange: _, onWorld: __, ...info } = decl;
      return { ...info, written: formatValue(info.default) };
    }),
    commands: registry.commands().map((c) => {
      const { run: _, onWorld, check: __, ...info } = c;
      return { ...info, usage: registry.usage(c), scope: onWorld ? 'world' : null };
    }),
  };
}
