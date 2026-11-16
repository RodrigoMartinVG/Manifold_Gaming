// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { fileURLToPath } from 'node:url';
import { redirects } from './src/redirects.mjs';

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
  // Addresses that moved, so old links still arrive: the old tutorial, archived; stage 1's lessons that
  // took other places; the new tutorial's pilot (src/redirects.mjs, which the tests read too).
  redirects: redirects(BASE, fileURLToPath(new URL('./src/content/docs', import.meta.url))),
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
        // The tutorial (decision 0021): the pages before part 1, then the parts; the old tutorial, archived,
        // closed at the end, with its stages, its glossary and its patterns.
        {
          label: 'Tutorial',
          items: [
            { label: 'Empezar aquí', link: '/tutorial/' },
            { label: 'TypeScript para quien sabe JavaScript', link: '/tutorial/typescript/' },
            { label: 'La notación', link: '/tutorial/notacion/' },
            { label: 'Parte 1: El espacio', items: [{ autogenerate: { directory: 'tutorial/parte-1' } }] },
            {
              label: 'El tutorial anterior (archivado)',
              collapsed: true,
              items: [
                { label: 'Presentación', link: '/tutorial/archivo/' },
                {
                  label: 'Etapa 0: cimientos',
                  collapsed: true,
                  items: [{ autogenerate: { directory: 'tutorial/archivo/etapa-0' } }],
                },
                {
                  label: 'Etapa 1: física y un personaje',
                  collapsed: true,
                  items: [{ autogenerate: { directory: 'tutorial/archivo/etapa-1' } }],
                },
                {
                  label: 'Etapa 2: capacidades',
                  collapsed: true,
                  items: [{ autogenerate: { directory: 'tutorial/archivo/etapa-2' } }],
                },
                {
                  label: 'Etapa 3: un mundo que responde',
                  collapsed: true,
                  items: [{ autogenerate: { directory: 'tutorial/archivo/etapa-3' } }],
                },
                { label: 'Glosario', link: '/tutorial/archivo/glosario/' },
                // The design patterns the lessons use, gathered like the glossary gathers the words (0013).
                { label: 'Patrones', link: '/tutorial/archivo/patrones/' },
              ],
            },
          ],
        },
        { label: 'Bitácora', items: [{ autogenerate: { directory: 'bitacora' } }] },
      ],
      routeMiddleware: './src/route-data.ts',
    }),
  ],
});
