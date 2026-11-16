import { getCollection, type CollectionEntry } from 'astro:content';
import { BASE } from './sections';

/**
 * LISTS OF PAGES, read from the content itself: the home page and the Bitácora's index use them, so
 * a new lesson or a new report shows up there without touching anything else.
 */

type Page = CollectionEntry<'docs'>;
const order = (p: Page) => p.data.sidebar.order ?? 0;

export const pageUrl = (p: Page) => `${BASE}${p.id}/`;

/** The Bitácora's reports, newest first (by their order in the sidebar). */
export async function reports(): Promise<Page[]> {
  const all = await getCollection('docs', (p) => p.id.startsWith('bitacora/') && p.id !== 'bitacora/index');
  return all.sort((a, b) => order(b) - order(a));
}

/** The tutorial's lessons, in order: the parts' numbered lessons (not their introductions, nor the archive). */
export async function lessons(): Promise<Page[]> {
  const all = await getCollection('docs', (p) => /^tutorial\/parte-\d+\/\d+/.test(p.id));
  const key = (p: Page) => p.id.replace(/\d+/g, (n) => n.padStart(3, '0')); // parte-10 after parte-9
  return all.sort((a, b) => key(a).localeCompare(key(b)));
}
