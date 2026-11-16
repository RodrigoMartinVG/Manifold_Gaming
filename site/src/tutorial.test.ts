import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * THE TUTORIAL'S SHAPE AND ITS LINKS (decision 0013), checked without a browser. The browser tests
 * run every example; these read the lessons' text:
 *
 * - every lesson has the short main path and the layers around it: at least two "Más a fondo", "En
 *   los motores" (with where Manifold chose otherwise), "En Manifold", "Para practicar" (two or three
 *   exercises, each with a hint) and "Para saber más". So phase 2's lessons are born in this shape;
 * - every "Patrón" callout points to its pattern on the Patrones page, and the page names the lesson;
 * - every link between the site's pages arrives at a page (and at a heading, when it names one);
 * - every link to the engine's code points to a file that exists: on `main`, in this checkout; on a
 *   stage's tag, at that tag (when the clone has it).
 */
const SITE = join(import.meta.dirname, '..');
const REPO = join(SITE, '..');
const DOCS = join(SITE, 'src', 'content', 'docs');

/** Every page of the site's docs, by id (`tutorial/etapa-0/01-primer-cubo`), with its text. */
function pages(folder = DOCS, out = new Map<string, string>()): Map<string, string> {
  for (const e of readdirSync(folder, { withFileTypes: true })) {
    const file = join(folder, e.name);
    if (e.isDirectory()) pages(file, out);
    else if (/\.mdx?$/.test(e.name))
      out.set(
        posix.normalize(file.slice(DOCS.length + 1).replaceAll('\\', '/')).replace(/(\/?index)?\.mdx?$/, ''),
        readFileSync(file, 'utf8'),
      );
  }
  return out;
}
const PAGES = pages();
const lessons = [...PAGES].filter(([id]) => /^tutorial\/etapa-\d+\//.test(id));

/** A heading's anchor, as Starlight makes it (github-slugger): lower case, no punctuation, spaces as dashes. */
const slug = (heading: string) =>
  heading
    .replace(/[`_*]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');
const anchorsOf = (text: string) => new Set([...text.matchAll(/^#{2,4} (.+)$/gm)].map((m) => slug(m[1]!)));

/** The text of a section: from its heading to the next one of the same level. */
function section(text: string, heading: string): string | null {
  const start = text.indexOf(`\n## ${heading}\n`);
  if (start < 0) return null;
  const next = text.indexOf('\n## ', start + 1);
  return text.slice(start, next < 0 ? undefined : next);
}

describe('every lesson has its main path and the four layers around it (0013)', () => {
  it('there are lessons to check', () => expect(lessons.length).toBeGreaterThan(10));
  for (const [id, text] of lessons)
    it(id, () => {
      // (The main path is each lesson's own: the first one tells ideas, not code, and has no "El código".)
      for (const heading of ['Lo importante', 'En Manifold']) expect(section(text, heading), `"${heading}"`).not.toBeNull();
      expect(text, 'its live example').toMatch(/<LiveCode lesson="[^"]+"/);
      const deeper = section(text, 'Más a fondo') ?? '';
      expect((deeper.match(/<details>/g) ?? []).length, 'at least two "Más a fondo"').toBeGreaterThanOrEqual(2);
      // The traps, which every lesson of stages 0 to 2 had and stage 3's were born without (the index
      // promises them in every lesson): a callout, with at least two.
      const traps = /:::caution\[Sutilezas\]\n([\s\S]*?)\n\s*:::/.exec(text)?.[1] ?? '';
      expect((traps.match(/^- \*\*/gm) ?? []).length, 'at least two "Sutilezas"').toBeGreaterThanOrEqual(2);
      const engines = section(text, 'En los motores') ?? '';
      expect(engines, '"En los motores", with where Manifold chose otherwise').toContain('**Dónde Manifold eligió otra cosa.**');
      const practice = section(text, 'Para practicar') ?? '';
      const exercises = (practice.match(/^\*\*\d\. /gm) ?? []).length;
      expect(exercises, 'two or three exercises').toBeGreaterThanOrEqual(2);
      expect(exercises).toBeLessThanOrEqual(3);
      expect((practice.match(/<summary>Una pista<\/summary>/g) ?? []).length, 'a hint for each exercise').toBe(exercises);
      expect(section(text, 'Para saber más') ?? '', '"Para saber más", with something to read').toMatch(/^- /m);
    });
});

describe('the patterns', () => {
  const patterns = PAGES.get('tutorial/patrones')!;
  const anchors = anchorsOf(patterns);
  for (const [id, text] of lessons)
    for (const callout of text.matchAll(/:::tip\[Patrón: ([^\]]+)\]([\s\S]*?)\n:::/g))
      it(`${id}: "${callout[1]}" is on the Patrones page, which names the lesson`, () => {
        const link = /\]\(\.\.\/\.\.\/patrones\/#([^)]+)\)/.exec(callout[2]!);
        expect(link, 'the callout links to its pattern').not.toBeNull();
        expect(anchors.has(decodeURIComponent(link![1]!)), `#${link![1]} on the Patrones page`).toBe(true);
        expect(patterns).toContain(`](../${id.slice('tutorial/'.length)}/)`);
      });
});

describe('the links between pages arrive', () => {
  /** A page of the site at that address: a doc, a Dojo room (a page of its own), or a game's page (stage 3k). */
  const exists = (target: string) =>
    target === '' || PAGES.has(target) || /^jugar\/dojo\/[a-z0-9-]+$/.test(target) || target === 'jugar/aventura';
  for (const [id, text] of [...PAGES].filter(([p]) => p.startsWith('tutorial'))) {
    // A page is served at its id with a slash at the end: links are relative to that "folder".
    const base = id.endsWith('index') ? id.slice(0, -'index'.length) : `${id}/`;
    const links = [...text.matchAll(/\]\(((?:\.\.\/|[a-z0-9-]+\/)[^)\s]*)\)/g)].map((m) => m[1]!);
    if (links.length === 0) continue;
    it(id, () => {
      for (const link of links) {
        const [path, anchor] = link.split(/[#]/);
        const target = posix
          .normalize(posix.join(base, path!.split(/[?]/)[0]!))
          .replace(/\/$/, '')
          .replace(/^\.$/, '');
        expect(exists(target), `${link} (from ${id}) → ${target}`).toBe(true);
        if (anchor && PAGES.has(target) && !anchor.includes('='))
          expect(anchorsOf(PAGES.get(target)!).has(decodeURIComponent(anchor)), `#${anchor} in ${target}`).toBe(true);
      }
    });
  }
});

describe("the links to the engine's code point to files that exist", () => {
  const GITHUB = /https:\/\/github\.com\/RodrigoMartinVG\/Manifold_Gaming\/(?:blob|tree)\/([^/]+)\/([^)\s#]+)/g;
  const found = new Map<string, Set<string>>();
  for (const [, text] of [...PAGES].filter(([p]) => p.startsWith('tutorial')))
    for (const m of text.matchAll(GITHUB)) found.set(m[1]!, (found.get(m[1]!) ?? new Set()).add(m[2]!));
  const hasRef = (ref: string) => {
    try {
      execFileSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd: REPO, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };
  for (const [ref, paths] of found)
    it.skipIf(ref !== 'main' && !hasRef(ref))(`on ${ref}`, () => {
      for (const path of paths) {
        if (ref === 'main') expect(existsSync(join(REPO, path)), path).toBe(true);
        else
          expect(() =>
            execFileSync('git', ['cat-file', '-e', `${ref}:${path.replace(/\/$/, '')}`], { cwd: REPO, stdio: 'ignore' }),
          ).not.toThrow();
      }
    });
});
