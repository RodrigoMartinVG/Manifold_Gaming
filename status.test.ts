import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { CURRENT_STAGE, STAGES } from './site/src/stages';

const root = import.meta.dirname;

/** The rows of the first table under a heading of a markdown file: each row's cells, trimmed. */
function table(file: string, heading: string): string[][] {
  const lines = readFileSync(join(root, file), 'utf8').split('\n');
  const start = lines.indexOf(`## ${heading}`);
  const from = lines.findIndex((l, i) => i > start && l.startsWith('|'));
  const to = lines.findIndex((l, i) => i > from && !l.startsWith('|'));
  return lines
    .slice(from + 2, to) // past its header and the line under it
    .map((l) =>
      l
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim()),
    );
}

describe('where the project is, said once (stage 5.5d, decision 0033): site/src/stages.ts, and the rest agrees', () => {
  test('the roadmap’s table: the same stages in the same order; done before the current one, under way the current one, to do after it', () => {
    const rows = table('ROADMAP.md', 'The plan in one table');
    expect(rows).toHaveLength(STAGES.length);
    rows.forEach((cells, i) => {
      const stage = STAGES[i]!;
      expect(cells[0], `row ${i}`).toMatch(stage.number === null ? /^The forest/ : new RegExp(`^${stage.number}\\. `));
      expect(cells.at(-1), `${cells[0]}: its status`).toBe(i < CURRENT_STAGE ? '✅' : i === CURRENT_STAGE ? '🔨' : '⬜');
    });
  });

  test('the project’s page: its table’s stages are the strip’s, by name and number, and “← aquí” is on the current one', () => {
    const rows = table('site/src/content/docs/proyecto.md', 'En qué etapa está');
    expect(rows).toHaveLength(STAGES.length);
    rows.forEach((cells, i) => {
      const stage = STAGES[i]!;
      const name = cells[0]!
        .replace(/\*\*/g, '')
        .replace(/\s*←\s*_aquí_/, '')
        .replace(/\s*\(opcional\)$/, '');
      expect(name, `row ${i}`).toBe(stage.number === null ? stage.name : `${stage.number}. ${stage.name}`);
      expect(cells[0]!.includes('← _aquí_'), `${name}: “aquí”`).toBe(i === CURRENT_STAGE);
    });
  });
});
