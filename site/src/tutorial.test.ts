import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * THE SITE'S LINKS, checked without a browser (decision 0013; the tutorial is the book since decision 0030, and its
 * pages' numbers and figures are checked by the browser tests, e2e/lessons.e2e.ts):
 *
 * - every link between the site's pages arrives at a page (and at a heading, when it names one), and every image at
 *   a file;
 * - every link to the engine's code points to a file that exists: on `main`, in this checkout; on a commit or a
 *   stage's tag, at that commit (when the clone has it). The Bitácora's links to the earlier tutorials point to them
 *   as they were, at the commit where they left the site.
 */
const SITE = join(import.meta.dirname, '..');
const REPO = join(SITE, '..');
const DOCS = join(SITE, 'src', 'content', 'docs');

/** The file each page is written in, by its id: its images are relative to it, not to the page's address. */
const SOURCES = new Map<string, string>();
/** Every page of the site's docs, by id (`tutorial/dibujar/01-la-pantalla`), with its text. */
function pages(folder = DOCS, out = new Map<string, string>()): Map<string, string> {
  for (const e of readdirSync(folder, { withFileTypes: true })) {
    const file = join(folder, e.name);
    if (e.isDirectory()) pages(file, out);
    else if (/\.mdx?$/.test(e.name)) {
      const id = posix.normalize(file.slice(DOCS.length + 1).replaceAll('\\', '/')).replace(/(\/?index)?\.mdx?$/, '');
      out.set(id, readFileSync(file, 'utf8'));
      SOURCES.set(id, file);
    }
  }
  return out;
}
const PAGES = pages();
/** A heading's anchor, as Starlight makes it (github-slugger): lower case, no punctuation, spaces as dashes. */
const slug = (heading: string) =>
  heading
    .replace(/[`_*]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');
const anchorsOf = (text: string) => new Set([...text.matchAll(/^#{2,4} (.+)$/gm)].map((m) => slug(m[1]!)));

/**
 * The site's own pages (`src/pages/`, not the docs): each `index.astro` at its folder's address, each
 * page made from a parameter (`[room].astro`) as the pattern of its addresses (a Dojo room). A game's
 * page (stage 3k, the adventure; 5b, the tower) is known as soon as it is there.
 */
function sitePages(folder = join(SITE, 'src', 'pages'), at = ''): (string | RegExp)[] {
  const out: (string | RegExp)[] = [];
  for (const e of readdirSync(folder, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...sitePages(join(folder, e.name), at ? `${at}/${e.name}` : e.name));
    else if (e.name === 'index.astro') out.push(at);
    else if (/^\[[a-z]+\]\.astro$/.test(e.name)) out.push(new RegExp(`^${at}/[a-z0-9-]+$`));
  }
  return out;
}
const SITE_PAGES = sitePages();

describe('the links between pages arrive', () => {
  /** A page of the site at that address: a doc, or one of the site's own (a game's, a Dojo room). */
  const exists = (target: string) =>
    target === '' || PAGES.has(target) || SITE_PAGES.some((p) => (typeof p === 'string' ? p === target : p.test(target)));
  // Every page of the site, not only the tutorial's: the Bitácora and the play pages link into it.
  for (const [id, text] of PAGES) {
    // A page is served at its id with a slash at the end: links are relative to that "folder".
    const base = id.endsWith('index') ? id.slice(0, -'index'.length) : `${id}/`;
    // An image (`![…](…)`) is a file, relative to the page's source, which the build takes in; the rest, pages.
    const IMAGE = /!\[[^\]]*\]\(([^)\s]+)\)/g;
    const images = [...text.matchAll(IMAGE)].map((m) => m[1]!).filter((src) => !/^https?:/.test(src));
    const links = [...text.replace(IMAGE, '').matchAll(/\]\(((?:\.\.\/|[a-z0-9-]+\/)[^)\s]*)\)/g)].map((m) => m[1]!);
    if (links.length === 0 && images.length === 0) continue;
    it(id, () => {
      for (const src of images)
        expect(existsSync(join(dirname(SOURCES.get(id)!), src)), `the image ${src} (from ${id})`).toBe(true);
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
  // The tutorial's links on any ref; the other pages' (the Bitácora's, mostly) on commits and tags, which never move.
  for (const [id, text] of PAGES)
    for (const m of text.matchAll(GITHUB))
      if (id.startsWith('tutorial') || m[1] !== 'main') found.set(m[1]!, (found.get(m[1]!) ?? new Set()).add(m[2]!));
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
