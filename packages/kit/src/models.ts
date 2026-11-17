// The kit (stage 4.5e), made by art/kit.py: one file, served by its address; each piece a node of it.
import kit from '../assets/kit.glb?url';
import { KIT, KIT_LEAVES, kitModel } from './index';

/**
 * THE KIT'S MODELS, for the presentation: each piece's and each leaf's model by its name (`kit.wall_2`,
 * `kit.door_1`), as its file's address and the node's name (`…/kit.glb#wall_2`): the file is loaded
 * once, and each one is its node.
 */
export const KIT_MODELS: Readonly<Record<string, string>> = Object.fromEntries(
  [...Object.keys(KIT), ...Object.keys(KIT_LEAVES)].map((name) => [kitModel(name), `${kit}#${name}`]),
);
