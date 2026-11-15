import { expect, test } from 'vitest';
import { dojoDeclarations } from './declarations';

// Stage 2.5a: what the Dojo's console declares is data, read without mounting anything (no page, no
// WebGL): the site's console reference is generated from it when the site is built.
test("everything the Dojo's console declares can be read without a screen: the engine's and the Dojo's", () => {
  const { variables, commands } = dojoDeclarations();
  const names = [...variables, ...commands].map((d) => d.name);
  // From every part: the core, the Dojo, the presentation's pieces, the console and help.
  for (const name of ['seed', 'dojo.cubes', 'show.stats', 'view.camera', 'controls.scheme', 'snapshot', 'export', 'help'])
    expect(names, name).toContain(name);
  // How each one is written, as the console says it; and its default, as it is written.
  expect(commands.find((c) => c.name === 'replay')!.usage).toBe('replay [export|play|stop]');
  expect(commands.find((c) => c.name === 'dojo.goto')!.scope).toBe('world');
  expect(variables.find((v) => v.name === 'physics.gravity')!.written).toBe('0 -9.81 0');
});
