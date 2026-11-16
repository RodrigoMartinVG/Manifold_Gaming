// The mannequin (stage 2e), made by art/mannequin.py: served as a file, by its address.
import mannequin from '../assets/mannequin.glb?url';
import { MANNEQUIN } from './index';

/**
 * THE CHARACTER'S MODELS, for the presentation (stage 4a): what a game hands `mount` in its `models`, by
 * the name its characters' appearances give. (A model is the presentation's: the rules only name it.)
 */
export const CHARACTER_MODELS: Readonly<Record<string, string>> = { [MANNEQUIN]: mannequin };
