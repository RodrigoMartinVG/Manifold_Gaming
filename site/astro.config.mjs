// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

/**
 * The Manifold Gaming site (decision 0002): Astro, with Starlight for the tutorial. It is published
 * on GitHub Pages, at https://rodrigomartinvg.github.io/Manifold_Gaming/ : that is why every address
 * starts with `base`. The site's TEXT is in Spanish (decision 0011); its code, in English.
 */
const BASE = '/Manifold_Gaming';

export default defineConfig({
  site: 'https://rodrigomartinvg.github.io',
  base: BASE,
  trailingSlash: 'always',
  // The tutorial's mathematics, typeset (decision 0021): $…$ inline and $$…$$ apart, drawn by KaTeX
  // when the site is built (no script in the reader's browser).
  markdown: { remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex] },
  // Models (stage 2e: the Dojo's mannequin): served as files, by their address.
  vite: { assetsInclude: ['**/*.glb'] },
  // Addresses that moved, so old links still arrive. Stage 1's lessons took their places in the
  // deeper pass (decision 0013): collisions, the camera and inputs went in between, where they teach.
  // (Astro does not add `base` to a redirect's destination: without it, the page would send readers
  // to /tutorial/…, outside the site, as the browser test found.)
  redirects: Object.fromEntries(
    [
      ['01-un-personaje', '02-un-personaje'],
      ['02-repeticiones', '05-repeticiones'],
      ['03-instantaneas', '06-instantaneas'],
      ['04-servidor-y-cliente', '07-servidor-y-cliente'],
    ].map(([from, to]) => [`/tutorial/etapa-1/${from}/`, `${BASE}/tutorial/etapa-1/${to}/`]),
  ),
  integrations: [
    starlight({
      title: 'Manifold Gaming',
      description: 'Un laboratorio de mundos físicos en 3D para la web.',
      defaultLocale: 'root',
      locales: { root: { label: 'Español', lang: 'es' } },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/RodrigoMartinVG/Manifold_Gaming' }],
      // The "workshop" look (bronze, patina and compass constructions): src/styles/workshop.css.
      logo: { src: './src/assets/drawings/logo.svg', alt: '' },
      favicon: '/favicon.svg',
      customCss: ['@fontsource-variable/cinzel', 'katex/dist/katex.min.css', './src/styles/workshop.css'],
      components: {
        // The home page has its own hero, with the live 3D showcase.
        Hero: './src/components/Hero.astro',
        // Next to the title, the site's sections (and, on a phone, a bar at the bottom).
        SiteTitle: './src/components/SiteTitle.astro',
        // Next to the theme selector, the buttons that hide the side panels.
        ThemeSelect: './src/components/ThemeSelect.astro',
        // Each side panel, with its "Ocultar" button on top.
        Sidebar: './src/components/Sidebar.astro',
        PageSidebar: './src/components/PageSidebar.astro',
      },
      // The panels hidden on another page: applied before drawing, so nothing flickers.
      head: [
        {
          tag: 'script',
          content:
            "try{for(const[k,a]of[['mg-no-sidebar','data-no-sidebar'],['mg-no-toc','data-no-toc']])if(localStorage.getItem(k)==='1')document.documentElement.setAttribute(a,'')}catch{}",
        },
      ],
      // The whole site's sidebar; each page shows only its section's part (src/route-data.ts).
      sidebar: [
        // Jugar: the games first (each one with its page), then what every game shares: the
        // character's controls, the console, which is the engine's, not one game's, and the same hash
        // (the reference replays played in this browser).
        {
          label: 'Jugar',
          items: [
            { label: 'Los juegos', link: '/jugar/' },
            { label: 'Juegos', items: [{ label: 'El Dojo', link: '/jugar/dojo/' }] },
            {
              label: 'Para todos los juegos',
              items: [
                { label: 'Cómo se juega', link: '/jugar/como-se-juega/' },
                { label: 'La consola', link: '/jugar/consola/' },
                { label: 'La misma huella', link: '/jugar/la-misma-huella/' },
              ],
            },
          ],
        },
        {
          label: 'Tutorial',
          items: [
            { label: 'Empezar aquí', link: '/tutorial/' },
            { label: 'Etapa 0: cimientos', items: [{ autogenerate: { directory: 'tutorial/etapa-0' } }] },
            { label: 'Etapa 1: física y un personaje', items: [{ autogenerate: { directory: 'tutorial/etapa-1' } }] },
            { label: 'Etapa 2: capacidades', items: [{ autogenerate: { directory: 'tutorial/etapa-2' } }] },
            { label: 'Etapa 3: un mundo que responde', items: [{ autogenerate: { directory: 'tutorial/etapa-3' } }] },
            { label: 'Glosario', link: '/tutorial/glosario/' },
            // The design patterns the lessons use, gathered like the glossary gathers the words (0013).
            { label: 'Patrones', link: '/tutorial/patrones/' },
          ],
        },
        { label: 'Bitácora', items: [{ autogenerate: { directory: 'bitacora' } }] },
        // The new tutorial's pilot (decision 0021): out of the sections until it is accepted.
        {
          label: 'Tutorial nuevo (piloto)',
          items: [
            { label: 'Empezar aquí', link: '/tutorial-nuevo/' },
            { label: 'La notación', link: '/tutorial-nuevo/notacion/' },
            { label: 'Parte 1: algo que se mueve', items: [{ autogenerate: { directory: 'tutorial-nuevo/parte-1' } }] },
          ],
        },
      ],
      routeMiddleware: './src/route-data.ts',
    }),
  ],
});
