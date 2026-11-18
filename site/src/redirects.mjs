// @ts-check

/**
 * ADDRESSES THAT MOVED, so old links still arrive: Astro's `redirects`, read by astro.config.mjs. (Astro does not
 * add `base` to a redirect's destination: without it, the page would send readers to /tutorial/…, outside the site,
 * as a browser test once found.)
 *
 * The tutorial is the book (docs/tutorial-v3.md; decision 0030). The earlier tutorials left the site on 2026-11-18:
 * every address they ever answered at, the archive's pages, the second version's, the addresses the first one had
 * before it was archived, stage 1's renames and the pilot's, now lands on the book's first page. Their text is in the
 * repository as it was then, at commit 7707772.
 *
 * @param {string} base the site's base, without the final slash: '/Manifold_Gaming'
 * @returns {Record<string, string>}
 */
export function redirects(base) {
  const book = `${base}/tutorial/`;
  /** @type {Set<string>} */
  const old = new Set();
  for (const page of EARLIER) {
    if (page) old.add(`/tutorial/${page}`);
    // The first tutorial answered at /tutorial/… before it was archived at /tutorial/archivo/… (decision 0021).
    if (page.startsWith('archivo/') && page !== 'archivo/') old.add(`/tutorial/${page.slice('archivo/'.length)}`);
  }
  // Stage 1's lessons, before the deeper pass gave them other places (decision 0013).
  for (const page of ['01-un-personaje', '02-repeticiones', '03-instantaneas', '04-servidor-y-cliente'])
    old.add(`/tutorial/etapa-1/${page}/`);
  // The second version's pilot lived at /tutorial-nuevo/; Moverse waited at the end of part 1.
  for (const page of PILOT) old.add(`/tutorial-nuevo/${page}`);
  old.add('/tutorial/parte-1/05-moverse/');
  return Object.fromEntries([...old].map((address) => [address, book]));
}

/** The earlier tutorials' pages, relative to /tutorial/, as they were when they left the site ('' was its index). */
const EARLIER = [
  'archivo/',
  'archivo/etapa-0/00-del-3d-a-la-pantalla/',
  'archivo/etapa-0/01-primer-cubo/',
  'archivo/etapa-0/02-cuaterniones/',
  'archivo/etapa-0/03-paso-fijo/',
  'archivo/etapa-0/04-azar-con-semilla/',
  'archivo/etapa-0/05-simulacion-y-dibujo/',
  'archivo/etapa-0/06-numeros-que-no-son-exactos/',
  'archivo/etapa-0/07-matrices-y-espacios/',
  'archivo/etapa-1/00-motor-de-fisica/',
  'archivo/etapa-1/01-como-se-encuentra-un-choque/',
  'archivo/etapa-1/02-un-personaje/',
  'archivo/etapa-1/03-la-camara-que-sigue/',
  'archivo/etapa-1/04-entradas-como-acciones/',
  'archivo/etapa-1/05-repeticiones/',
  'archivo/etapa-1/06-instantaneas/',
  'archivo/etapa-1/07-servidor-y-cliente/',
  'archivo/etapa-2/00-un-nivel-como-texto/',
  'archivo/etapa-2/01-zonas-que-notan-quien-entra/',
  'archivo/etapa-2/02-un-modo-por-paso/',
  'archivo/etapa-2/03-capacidades-como-datos/',
  'archivo/etapa-2/04-plataformas-que-llevan/',
  'archivo/etapa-2/05-rayos-y-barridos/',
  'archivo/etapa-2/06-un-personaje-animado/',
  'archivo/etapa-3/00-entidades-y-senales/',
  'archivo/etapa-3/01-la-luz-como-logica/',
  'archivo/etapa-3/02-lo-que-se-rompe/',
  'archivo/etapa-3/03-el-sonido-sale-de-los-eventos/',
  'archivo/etapa-3/04-guardar-como-datos/',
  'archivo/etapa-3/05-friccion-y-rebote/',
  'archivo/etapa-3/06-la-masa/',
  'archivo/etapa-3/07-la-camara-contra-las-paredes/',
  'archivo/etapa-3/08-la-interfaz-del-juego/',
  'archivo/etapa-3/09-un-nivel-que-se-prueba-solo/',
  'archivo/etapa-3/10-un-calabozo-con-una-semilla/',
  'archivo/glosario/',
  'archivo/patrones/',
  'notacion/',
  'parte-1/',
  'parte-1/01-coordenadas/',
  'parte-1/02-la-proyeccion/',
  'parte-1/03-una-ventana-al-mundo/',
  'parte-1/04-vectores/',
  'parte-1/05-el-producto-escalar/',
  'parte-1/06-el-producto-vectorial/',
  'parte-1/07-mirar/',
  'parte-1/18-moverse/',
  'typescript/',
];

/** The pilot's pages, relative to /tutorial-nuevo/. */
const PILOT = [
  '',
  'parte-1/',
  'parte-1/01-coordenadas/',
  'parte-1/01-una-ventana-al-mundo/',
  'parte-1/02-la-proyeccion/',
  'parte-1/02-moverse/',
  'parte-1/03-una-ventana-al-mundo/',
  'parte-1/04-vectores/',
  'parte-1/05-moverse/',
  'notacion/',
  'typescript/',
];
