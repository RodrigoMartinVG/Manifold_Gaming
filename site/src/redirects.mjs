// @ts-check
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ADDRESSES THAT MOVED, so old links still arrive: Astro's `redirects`, read by astro.config.mjs and by
 * the tests. (Astro does not add `base` to a redirect's destination: without it, the page would send
 * readers to /tutorial/…, outside the site, as the browser test found.)
 *
 * - The old tutorial is archived at /tutorial/archivo/ (decision 0021): every page of it answers at its
 *   old address too, read from the archive's folder, so none is forgotten.
 * - Stage 1's lessons took other places in the deeper pass (decision 0013).
 * - The new tutorial's pilot lived at /tutorial-nuevo/ before it took /tutorial/.
 *
 * @param {string} base the site's base, without the final slash: '/Manifold_Gaming'
 * @param {string} docs the docs folder: src/content/docs
 * @returns {Record<string, string>}
 */
export function redirects(base, docs) {
  /** @type {Record<string, string>} */
  const out = {};
  const to = (/** @type {string} */ address) => `${base}/${address}`;

  // The archive: /tutorial/etapa-0/01-primer-cubo/ → /tutorial/archivo/etapa-0/01-primer-cubo/ (its
  // introduction stays out: /tutorial/ is the new tutorial's).
  for (const page of addresses(join(docs, 'tutorial', 'archivo')))
    if (page) out[`/tutorial/${page}`] = to(`tutorial/archivo/${page}`);
  for (const [from, now] of [
    ['01-un-personaje', '02-un-personaje'],
    ['02-repeticiones', '05-repeticiones'],
    ['03-instantaneas', '06-instantaneas'],
    ['04-servidor-y-cliente', '07-servidor-y-cliente'],
  ])
    out[`/tutorial/etapa-1/${from}/`] = to(`tutorial/archivo/etapa-1/${now}/`);

  // The pilot: every page it had, at the same place under /tutorial/ (two of its first pages became others).
  for (const page of [
    '',
    'parte-1/',
    'parte-1/01-coordenadas/',
    'parte-1/02-la-proyeccion/',
    'parte-1/03-una-ventana-al-mundo/',
    'parte-1/04-vectores/',
    'parte-1/05-moverse/',
    'notacion/',
    'typescript/',
  ])
    out[`/tutorial-nuevo/${page}`] = to(`tutorial/${page}`);
  out['/tutorial-nuevo/parte-1/01-una-ventana-al-mundo/'] = to('tutorial/parte-1/03-una-ventana-al-mundo/');
  out['/tutorial-nuevo/parte-1/02-moverse/'] = to('tutorial/parte-1/05-moverse/');
  return out;
}

/** The addresses of the pages under a folder, relative to it, with their final slash ('' for its index). */
function addresses(/** @type {string} */ folder, prefix = '') {
  /** @type {string[]} */
  const out = [];
  for (const e of readdirSync(folder, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...addresses(join(folder, e.name), `${prefix}${e.name}/`));
    else if (/\.mdx?$/.test(e.name))
      out.push(e.name.startsWith('index.') ? prefix : `${prefix}${e.name.replace(/\.mdx?$/, '')}/`);
  }
  return out;
}
