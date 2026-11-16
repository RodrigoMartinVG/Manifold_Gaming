import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { BASE, sectionOf } from './sections';

type Entry = App.Locals['starlightRoute']['sidebar'][number];

/**
 * EACH SECTION, ITS OWN INDEX. Starlight builds one sidebar for the whole site, and its
 * previous/next links follow it in order: from the glossary, "next" went to the Bitácora. Here,
 * before each page is drawn, the sidebar keeps only the page's section, and previous/next never
 * leave it. A section with a single page (Jugar, Proyecto) shows no sidebar at all.
 */
export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  const section = sectionOf(route.id);
  if (!section) return; // the home page: no sidebar
  // The old tutorial, archived (decision 0021): each of its pages says so on top, and where the new one is.
  if (route.id.startsWith('tutorial/archivo')) route.entry.data.banner = { content: ARCHIVE_NOTICE };
  const inSection = (href: string) => href.startsWith(`${BASE}${section}/`);

  // (The section's group keeps its heading: it names the section, and its links stay small.)
  const sidebar = keep(route.sidebar, inSection);
  route.sidebar = sidebar;
  route.hasSidebar &&= countLinks(sidebar) > 1;

  const { prev, next } = route.pagination;
  route.pagination = {
    prev: prev && inSection(prev.href) ? prev : undefined,
    next: next && inSection(next.href) ? next : undefined,
  };
});

/** What every archived page says on top. (The site's text, in Spanish.) */
const ARCHIVE_NOTICE =
  `Esta lección es del <strong>tutorial anterior</strong>, que quedó archivado: sus ejemplos siguen funcionando, ` +
  `pero ya no se actualiza. El tutorial nuevo empieza en <a href="${BASE}tutorial/">Empezar aquí</a>.`;

/** The entries (and the groups, with what is left of them) whose links pass the filter. */
function keep(entries: Entry[], pass: (href: string) => boolean): Entry[] {
  return entries.flatMap((e): Entry[] => {
    if (e.type === 'link') return pass(e.href) ? [e] : [];
    const inner = keep(e.entries, pass);
    return inner.length ? [{ ...e, entries: inner }] : [];
  });
}

function countLinks(entries: Entry[]): number {
  return entries.reduce((n, e) => n + (e.type === 'link' ? 1 : countLinks(e.entries)), 0);
}
