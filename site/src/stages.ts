/**
 * THE ENGINE'S STAGES (decision 0000), for the home page's strip. The full plan, with what each one
 * brings and how it is shown, is on the project's page. The names are the site's text, in Spanish.
 */
export const STAGES = [
  'Cimientos',
  'Física y un personaje',
  'Capacidades',
  'Un mundo que responde',
  'Combate y bots',
  'Juegos',
  'Red y niveles',
  'Mundos extraños',
  // Optional (ROADMAP.md): a local profile, for single-player games that want more physics.
  'Potencia para un jugador',
] as const;

/** The stage the engine is in now. */
export const CURRENT_STAGE = 2;
