import { describe, expect, test } from 'vitest';
import characters from '@manifold/character/assets';
import kit from '@manifold/kit/assets';
import { creditsFrom, type AssetList } from './credits';

describe('the credits (stage 5b, decision 0015)', () => {
  test('one line a file, from the lists of what a game draws: made by a script of ours, or from outside with its author, source and license', () => {
    const outside: AssetList = {
      'rock.png': { what: 'a rock', author: 'Someone', source: 'https://example.org/rock', license: 'CC0-1.0' },
    };
    expect(creditsFrom([kit, characters, outside])).toEqual([
      { file: 'kit.glb', made: 'script', by: 'art/kit.py' },
      { file: 'mannequin.glb', made: 'script', by: 'art/mannequin.py' },
      { file: 'rock.png', made: 'outside', author: 'Someone', source: 'https://example.org/rock', license: 'CC0-1.0' },
    ]);
  });

  test('a file in two lists, once', () => {
    expect(creditsFrom([kit, kit]).map((c) => c.file)).toEqual(['kit.glb']);
  });
});
