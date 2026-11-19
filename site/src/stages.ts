/**
 * THE ENGINE'S STAGES (decision 0000), for the home page's strip: THE ONE PLACE that says where the project is
 * (stage 5.5d, decision 0033). The project's page and the roadmap's table say it too, and a test
 * (`status.test.ts`) checks that they say the same as this. The names are the site's text, in Spanish; a stage
 * that is named and not numbered (the forest, decision 0032) has no number.
 */
export const STAGES = [
  { number: '0', name: 'Cimientos' },
  { number: '1', name: 'Física y un personaje' },
  { number: '2', name: 'Capacidades' },
  { number: '3', name: 'Un mundo que responde' },
  { number: '4', name: 'Combate y bots' },
  { number: '5', name: 'Juegos' },
  { number: null, name: 'El bosque' },
  { number: '6', name: 'Red y niveles' },
  { number: '7', name: 'Mundos extraños' },
  // Optional (ROADMAP.md): a local profile, for single-player games that want more physics.
  { number: '8', name: 'Potencia para un jugador' },
] as const;

/**
 * The stage the engine is in now (its index in `STAGES`): the forest, which stage 5.5 (decision 0033, the
 * code given its shape before it, closed on 2026-11-19) prepared.
 */
export const CURRENT_STAGE = 6;
