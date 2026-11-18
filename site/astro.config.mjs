// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
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
  // Addresses that moved, so old links still arrive: every page of the earlier tutorials lands on the book's
  // first page (src/redirects.mjs).
  redirects: redirects(BASE),
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
        // The tutorial is the book (docs/tutorial-v3.md; decision 0030): its first page, then its parts, each one
        // a folder of chapters numbered through the whole book.
        {
          label: 'Tutorial',
          items: [
            { label: 'Construir un mundo', link: '/tutorial/' },
            { label: 'Parte I. Dibujar', items: [{ autogenerate: { directory: 'tutorial/dibujar' } }] },
          ],
        },
        { label: 'Bitácora', items: [{ autogenerate: { directory: 'bitacora' } }] },
      ],
      routeMiddleware: './src/route-data.ts',
    }),
  ],
});
