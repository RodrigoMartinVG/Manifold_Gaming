---
title: 'Etapa 3k: guardar la partida, y empieza la aventura'
description: 'Una partida guardada es el progreso del jugador como datos con su versión, nunca una foto del mundo: sobrevive a las actualizaciones del motor, y una vieja se trae hacia adelante versión por versión. Y empieza la aventura de acción: calabozos hechos de una semilla, gemas, una llave que abre la salida, un inventario, y la partida que se guarda y se carga.'
sidebar:
  order: 34
---

> Informe de la etapa 3k, la última de la fase 3. Lo que todo juego de la fase 5 necesita para no perder lo jugado, y el primer paso del segundo juego.

## Qué hicimos

- **La decisión primero ([0020](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0020-saved-games.md)):** una partida guardada es **el progreso del jugador**, como datos que define el juego, con su propia versión; nunca una instantánea del mundo. Una instantánea es de la versión del motor que la hizo (como una repetición): cada etapa de la fase 3 cambió esa versión, de la 14 a la 22, y cada cambio habría borrado todas las partidas.
- **El sobre, igual para todos los juegos:** `{ save: 1, game: 'adventure', version: 2, engine: 22, made: '2026-11-15', progress: {…} }`. En JSON: se guarda en el navegador, y se puede copiar y leer. `engine` solo dice qué versión lo escribió: nada rechaza una partida por eso.
- **Cargar es construir de nuevo:** los valores de arranque que pide el progreso (la semilla, la profundidad), un mundo nuevo nacido de ellos, y el progreso como un cambio del mundo en su primer paso (`progress 1 {…}`). Una partida guardada es, en el fondo, una receta.
- **Las viejas se traen hacia adelante, de a una versión:** el juego dice, para cada versión que tuvo, cómo llevarla a la siguiente. Una partida de otro juego, de una versión más nueva que el juego, o de otro sobre, se rechaza con el porqué.
- **En el menú de pausa**, para un juego que guarda y jugando solo: "Guardar la partida" y "Cargar la partida".
- **Empieza la aventura de acción** (`games/adventure`, decisión 0012), con su página en el sitio (`/jugar/aventura/`):
  - **Calabozos hechos de una semilla:** salas donde caben, separadas, cada una unida a la anterior por un pasillo que dobla una vez; más profundo, más salas. Se dibujan como un mapa de la 3j: paredes solo donde tocan el piso. La primera sala es el comienzo; la del medio tiene la llave; la última, la salida; las demás, una gema.
  - **Un inventario**, un componente del juego (2.5) en el personaje: lo que lleva, y de qué celdas ya tomó algo.
  - **La salida**, cerrada sin la llave; con ella, más abajo: otro calabozo de la misma semilla, a la profundidad siguiente.
  - **Su progreso**, versión 2: la semilla, la profundidad, dónde está, hacia dónde mira, lo que lleva y lo que tomó. La versión 1 (sin lo que tomó) se guarda como archivo, para probar que se trae hacia adelante.
  - **Su HUD:** la profundidad, las gemas, y si tiene la llave.
- **Las páginas de los juegos comparten su marco:** pantalla completa, la pista de la primera vez y el botón para salir, el Dojo y la aventura.
- **"La misma huella" hace calabozos:** el navegador del lector hace seis, de tres semillas, y muestra la huella del texto de cada uno.

## Hallazgos

| Hallazgo                                    | Qué pasaba                                                                                                                                                   | Qué hicimos                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **El progreso nunca entraba, sin pantalla** | Una receta jugada sin pantalla paraba cuando no quedaba nada esperando; el último cambio (el `progress`) seguía en la fila de la sesión, sin entrar al mundo | Sigue dando pasos hasta que entraron los cambios que mandaron sus últimas líneas                            |
| **Las gemas no se veían**                   | Una zona no tiene apariencia propia                                                                                                                          | El juego se la da, como el Dojo a sus estrellas: una gema azul, una llave que gira, la salida, una luz roja |
| **El personaje, sin nombre**                | La consola encuentra por número o por nombre, y el número del personaje cambia con el calabozo                                                               | Se llama `hero`                                                                                             |
| **El mismo maniquí en los tres juegos**     | El maniquí está en el paquete del Dojo, y un juego no depende de otro                                                                                        | Por ahora, una cápsula: el kit que comparten los tres juegos llega en la etapa 4.5                          |

## Medido

- **Los calabozos:** con 180 (60 semillas, tres profundidades), desde el comienzo se llega a la llave, a la salida y a cada gema. La misma semilla da el mismo calabozo; otra semilla, u otra profundidad, otro. En Chromium, Firefox y WebKit, los seis de "La misma huella" dan la huella que da Node.
- **Guardar y cargar:** una gema tomada, la partida guardada; la página abierta de nuevo (nada tomado), la partida cargada: la gema en el inventario, el personaje a menos de 10 cm de donde estaba, y la gema ya no está en el calabozo.
- **Una partida de la versión 1**, escrita por el motor 21, se trae a la versión 2 y se carga en el 22.
- **Las pruebas:** sin pantalla, 397 (9 nuevas: los calabozos, el inventario y la salida, guardar y cargar, la migración, lo que se rechaza, el progreso como datos). En el navegador, 149 (4 nuevas: guardar y cargar en la aventura, y el mismo calabozo en Chromium, Firefox y WebKit).

## Lo que sigue

El cierre de la fase 3: un nivel que muestre la demostración de punta a punta (una puerta, un ascensor, una lámpara, un vigía), jugado por una prueba como el circuito; las lecciones de la fase; y la tabla del plan revisada para las fases 4 y 5.
