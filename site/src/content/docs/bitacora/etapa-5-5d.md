---
title: 'Etapa 5.5d: el entorno, rápido y claro'
description: 'La verificación de tipos corre en paralelo y en forma incremental; continuous integration se divide en trabajos que corren a la vez, y los navegadores vienen en la imagen de Playwright; las pruebas de navegador quedan en archivos por tema y toman su puerto y su build del entorno; el arte se puede regenerar y comparar byte a byte; el rendimiento se mide por escenario; un solo lugar dice dónde está el proyecto, y un CLAUDE.md dice por dónde empezar.'
sidebar:
  order: 72
---

> Informe de la 5.5d, después de la [5.5c](../etapa-5-5c/). Es la cuarta etapa de la [decisión 0033](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0033-the-shape-before-the-forest.md): el entorno de trabajo, para que cada cambio se verifique rápido y nadie se tropiece con la otra sesión.

## Lo que pedía

La auditoría midió un entorno lento y frágil:

- la verificación de tipos tardaba 77 s, un paquete después del otro;
- continuous integration tardaba entre 15 y 46 minutos en un solo trabajo, y 30 de esos minutos eran instalar navegadores;
- las pruebas de navegador eran un archivo de 2.282 líneas que corría en un solo proceso;
- un servidor que ya estuviera en el puerto 4321 se reusaba en silencio;
- el arte no fijaba la versión de Blender, y nada comprobaba sus bytes;
- el rendimiento cubría una sola escena;
- cinco lugares decían cinco cosas distintas sobre dónde está el proyecto;
- no había un «por dónde empezar».

## Los tipos, en paralelo e incrementales

`npm run check` corre ahora `scripts/check.mjs`: el chequeo de cada workspace, más el de las pruebas de navegador, el de rendimiento y el del repositorio, todos a la vez, tantos como núcleos tiene la máquina. Cada `tsc` es incremental: guarda lo que encontró y, después de un cambio, solo vuelve a mirar lo que ese cambio toca.

|                      | Antes | Ahora     | Meta de la 0033 |
| -------------------- | ----- | --------- | --------------- |
| Desde cero           | 77 s  | 52 s      | 30 s            |
| Después de un cambio | 77 s  | 25 a 29 s | 10 s            |

**Las metas no se cumplen.** Dos cosas lo explican:

- **El chequeo del sitio** (`astro check` más el del tutorial) tarda 17 s por sí solo, y es el piso.
- **Cada paquete vuelve a verificar el núcleo entero,** porque importa su código fuente.

Lo que resuelve lo segundo son las _project references_ de TypeScript (`tsc -b`): cada paquete se verifica una vez, y lo que no cambió no se vuelve a mirar. Lo intenté, y choca con los JSON de assets que los paquetes se comparten (`character/assets`, `kit/assets`, `arms/assets`): bajo proyectos compuestos hay que exportarlos de otra forma. Queda anotado, con estas medidas.

## Continuous integration, en trabajos que corren a la vez

Antes era un solo trabajo, todo en serie. Ahora:

- **los chequeos estáticos:** tipos, lint y formato;
- **las pruebas sin pantalla:** las 904 de `test:all` y después, solo, el rendimiento, cuyos números quedan como artefacto;
- **las pruebas de navegador, una por navegador,** en la imagen de Playwright (`mcr.microsoft.com/playwright:v1.65.0-noble`), que ya trae los navegadores y sus bibliotecas: la instalación eran 30 minutos del run más lento;
- **el sitio para Pages**, que se publica cuando todo lo anterior pasa.

Un cambio solo en documentos (`docs/`, `ROADMAP.md`, `README.md`, `CLAUDE.md`) no corre nada, porque el sitio no los lee. Un test exige que la versión de la imagen sea la del Playwright instalado; si Dependabot sube una y no la otra, el test lo dice.

**No está verificado acá.** Un flujo de GitHub Actions solo se puede probar con un push. El primer push va a decir si el contenedor, Xvfb y Node 26 andan juntos como dice la guía de Playwright.

## Las pruebas de navegador

- **Por tema.** El archivo de 2.282 líneas se dividió en doce, por las secciones que ya tenía: el sitio, la consola, el personaje, la cámara, la interfaz, las repeticiones, el kit, el Dojo, la torre, la fortaleza, la muralla y los juegos juntos. Usé el parser de TypeScript para no cortar ninguna sentencia. Son las mismas 151 pruebas que antes (lo comprobé contra la lista anterior), ahora en 18 archivos que corren a la vez. Los ayudantes compartidos (y las tres copias de `typeInConsole`) quedan en `e2e/helpers.ts`.
- **Su puerto y su build, del entorno.** `E2E_PORT`, `E2E_DIST` (un sitio ya construido, que se sirve sin volver a construirlo) y `E2E_OUTPUT`. Un servidor que ya esté en el puerto se usa solo con `E2E_REUSE=1`: antes se usaba cualquiera, en silencio, y podía ser el servidor de desarrollo del autor o la build de la otra sesión. Ya no hacen falta archivos de configuración temporales.

## Las dos sesiones, en una carpeta

- `scratch/` para el trabajo descartable: fuera de git, del lint y de las pruebas.
- `sitio/` (las cachés de un sitio viejo), borrado.
- Los tres worktrees viejos de `.claude/worktrees`, de sesiones anteriores, todavía están: se borran solo con la palabra del autor.

## El arte, comprobable

- Cada script de Blender exige la versión 4.5 antes de hacer nada.
- `npm run art:check` regenera todos los assets en una carpeta temporal y los compara byte a byte con los del repositorio: **los seis dan exactamente los mismos bytes** (el maniquí, la puerta, la lámpara, el kit con su `kit.json` y las armas), en 25 s.
- Cada asset tiene su hash en su `assets.json` (`npm run art:hashes` los escribe), y un test comprueba que los archivos del repositorio son esos bytes.

## El rendimiento, por escenario

`perf/` tiene ahora un archivo por escenario, con los ayudantes compartidos en `measure.ts`:

- la sala de estrés del Dojo, la de antes;
- la luz, la de antes;
- **un nivel de juego, nuevo:** el primero de la muralla, con sus atacantes pensando.

Cada corrida escribe sus números en `perf/results/<escenario>.json`, y continuous integration los guarda: la tendencia se lee entre corridas, no en los comentarios.

El escenario nuevo encontró algo:

- **El paso del motor cuesta 10,4 a 10,6 veces el de Rapier.** En la sala de estrés es 1,7 a 1,9, porque la física sí tiene trabajo. En un nivel de juego Rapier tiene poco que hacer (un nivel quieto, pocos cuerpos que se mueven) y lo que pesa es lo de alrededor.
- **El primer paso del nivel cuesta unas 100 veces el de Rapier** (15 a 16 ms): es el «primer paso lento» que dejó abierto la fase 5.

Quedan presupuestos con un tercio de margen sobre lo medido, para que nada empeore sin que se note. La 5.5e debería bajar las dos cosas: los sistemas del mundo con índices, y cada cuerpo visible desde el primer paso.

## Un solo estado, y por dónde empezar

- `site/src/stages.ts` es el único lugar que dice dónde está el proyecto. Ahora tiene el bosque, con nombre y sin número, como etapa actual: la 5.5 es su preparación.
- La página de inicio lo lee.
- La tabla del proyecto y la del roadmap tienen que coincidir con él: lo comprueba `status.test.ts`. Lo probé cambiando la etapa actual, y el test marcó las dos tablas.
- El README ya no dice el estado (decía «terminó la fase 3»): es un índice de dónde está cada cosa.
- `CLAUDE.md`, nuevo: por dónde empezar. Los comandos, las reglas que valen en todos lados (determinismo, versiones, mecanismo y política, idiomas, arte por scripts), cómo correr las pruebas de navegador en un puerto propio y cómo trabajan las dos sesiones en una carpeta.

## Más orden

- `character` declaraba la presentación como dependencia de desarrollo, aunque su `models.ts` la usa en tiempo de ejecución, y sus tests usaban three sin declararlo. Las dos cosas quedaron declaradas como corresponde. De paso se corrigió en el lockfile una entrada vieja: le faltaba la muralla en las dependencias del sitio.
- Dependabot ya no propone subir Rapier, porque esa versión es la simulación (otra versión, otro motor).
- Un test exige que el Rapier del núcleo y el del sitio sean la misma versión exacta.
- `.gitattributes` marca como generado lo que escribe un test o un script (las repeticiones, `kit.json`, los niveles dibujados desde planos), así un diff de reglas no queda tapado por las repeticiones que regrabó.

## Pruebas

- Pasan los 904 tests sin pantalla (`test:all`, 91 s; `npm test`, 42 s), las 11 pruebas de rendimiento (15 s), la verificación de tipos, el lint y el formato.
- Los tests nuevos del repositorio: las versiones que tienen que moverse juntas (Rapier y Playwright), el hash de cada asset, y el estado en sus tres lugares.
- **En el navegador**, con la configuración nueva (puerto 4420 y mi propia build, sin archivo temporal): las 151 pruebas de Chromium pasan en 14 minutos, y el determinismo y la física, en Firefox y WebKit.
- **La primera corrida completa encontró dos pruebas sensibles al tiempo.** Al dividir el archivo, ahora corren tres páginas de juego a la vez, dibujando en la CPU. La señal «!» de la fortaleza y los atacantes justos de la muralla necesitan que sus bots piensen a velocidad, y fallaron; solas, pasan. El proyecto ya tenía un mecanismo para eso, la etiqueta `@quiet`: esas pruebas corren al final, cuando la máquina está tranquila. Les puse la etiqueta, y el proyecto ahora las corre de a una (Playwright permite limitar los workers por proyecto); antes, aun al final, corrían en paralelo entre ellas. (Los otros tres fallos de esa corrida eran del sitio: escribí este informe mientras corría, y la build tenía un informe menos que el disco.)

## Lo que queda

- **Las metas de tiempo de la 0033 no se cumplen todavía:**
  - los tipos: 52 s y 25 s, contra 30 s y 10 s;
  - `npm test`: 42 s contra 20 s;
  - `test:all`: 91 s contra 45 s.

  Las project references esperan a que los assets se exporten de otra forma. La parte lenta de los tests son pruebas pesadas que no son recorridos (las reglas de la muralla, el curso del tutorial).

- **Continuous integration** se verifica con el primer push.
- **Los tres worktrees viejos** esperan la palabra del autor.
- Lo que sigue es la **5.5e**: la forma de la simulación, sin cambiar un bit.
