---
title: 'Etapa 5b: la cáscara de los juegos, y la torre empieza'
description: 'Lo que los tres juegos comparten, hecho una vez: el título, el camino por sus niveles con lo que cada uno costó guardado, las líneas del hilo, los créditos sacados de dónde viene cada archivo y la música hecha en el navegador. Y la torre, el primer juego que la usa, con sus reglas propias y dos pisos de prueba.'
sidebar:
  order: 53
---

> Informe de la 5b, después de la [5a](../etapa-5a/). Con ella, un juego de la fase 5 es sus reglas, sus niveles y sus palabras; el resto lo pone la cáscara.

## La cáscara

Es un paquete nuevo, `@manifold/shell`. Un juego le da:

- sus reglas (el cartucho);
- sus niveles en orden, y cuándo uno está terminado;
- sus palabras, en castellano y en inglés;
- las pocas líneas del hilo, al principio y al final;
- las listas de dónde viene cada archivo que dibuja;
- su música.

La cáscara pone el resto:

- **El título,** sobre el nivel que tocaría jugar, quieto detrás. Ofrece jugar desde el principio o seguir donde estabas, y los créditos.
- **Las líneas del hilo** al empezar: cada una un cuadro con quién la dice. Una tecla o un clic sigue.
- **Cada nivel,** y al terminarlo, un cuadro con lo que costó: el tiempo, tu mejor tiempo si este fue peor, las estrellas y las caídas. Después, el siguiente.
- **Después del último,** las líneas finales y los créditos.

Todo funciona con el teclado solo, con lo que ya hacían los cuadros de diálogo de la 3i. Un juego terminado no monta la consola (la [decisión 0010](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0010-the-console-and-recipes.md) deja que cada juego decida). Un enlace todavía puede traer una receta, para las pruebas y para quien lo hace.

## Lo que se guarda

El progreso de un jugador por un juego, en su navegador: hasta dónde llegó y lo mejor de cada nivel terminado. Cada número es su propio mejor: los menos pasos, las más estrellas, las menos caídas, aunque vengan de partidas distintas.

No es la partida guardada de la 3k, que guarda el mundo. Un nivel es corto y empieza de nuevo desde su principio, así que lo que importa es el camino.

Como pide la [decisión 0020](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0020-saved-games.md), dice su versión:

- Uno de una versión anterior se trae hacia adelante paso a paso. Todavía no hay ninguno: esta es la primera.
- Lo que no es progreso, o lo que trae adentro y no se entiende, se deja afuera en vez de creerlo.
- Uno de una versión más nueva que el código (una página que volvió a un motor viejo) empieza de nuevo, en vez de leer lo que no conoce.

## Los créditos

Salen de las listas que ya estaban al lado de cada archivo (`assets.json`, [decisión 0015](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0015-art-and-sound.md)). Cada archivo que el juego dibuja ocupa una línea: lo hace un guion de este proyecto, o viene de afuera con su autor, su fuente y su licencia. Las pruebas de cada lista ya exigen que ningún archivo falte, así que los créditos también quedan completos.

Se suman:

- lo que el motor usa de afuera, con su licencia: la física, Rapier (Apache-2.0), y el dibujo, three.js (MIT);
- que los sonidos y la música se hacen en tu navegador, sin archivos de audio.

## La música

La [decisión 0027](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0027-music.md) pidió que la música pasara por el mismo mezclador que los sonidos. Ese mezclador no existía como tal: la pieza de los sonidos tenía su contexto de audio para ella sola.

Ahora la página tiene un mezclador con un canal por clase de cosa que se oye, cada uno con su volumen. Arranca con la primera tecla o el primer clic, la regla del navegador para los dos. `view.music` empieza en la mitad del de los sonidos y aparece en los ajustes donde un juego tiene música.

Un tema es un dato: un tempo, una escala, unos estados de ánimo, y en cada uno unas voces con sus notas, una por tiempo como mucho. Qué suena es una función pura de cuál estado y cuáles tiempos (`notesBetween`), así que una prueba lo escucha sin parlante.

La altura de un grado de la escala, en temperamento igual: $f = 440 \cdot 2^{(n - 69)/12}$ Hz, donde $n$ es la raíz más los semitonos del grado, y un grado que pasa la escala es el de la octava siguiente.

Al tocar, las notas se ponen en el reloj de audio un poco por adelante (0,4 s). Así un cuadro tarde no las corta. Cuál estado suena se lee en cada cuadro, y uno nuevo empieza en el tiempo siguiente.

## La torre empieza

El primer juego sobre la cáscara es [la torre](../../jugar/torre/), el de plataformas de la [0029](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0029-the-three-games.md). Tiene su paquete y su página, y su tarjeta en Jugar. Por ahora son dos pisos de prueba: la entrada a las 18:45 y el primer piso a las 19:15, con la noche cayendo entre uno y otro. La 5d hace los pisos de verdad.

Lo que salió al hacerla:

- **Sus reglas son suyas.** La primera versión usaba las del Dojo. El lint lo frenó, con razón: un juego importa el motor, nunca otro juego ([decisión 0003](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0003-boundaries.md)). Ahora tiene las suyas, cortas: la meta, los puntos de control, las estrellas y las caídas. La 5c les suma el controlador del juego de plataformas. Un efecto de paso: el aviso de meta del Dojo se repetía con el cuadro de la cáscara, y ya no está.
- **Los pisos, por la medida del gimnasio.** El primer dibujo tenía plataformas de 2 m después de un hueco de 3 m. El gimnasio dice que un salto que cae a la misma altura lleva el centro 5,9 m caminando, así que se pasaba de largo. Ahora del otro lado hay 6 m para caer, y las subidas son escaleras.
- **Su música, rala de verdad.** La primera versión empezaba una nota en un tercio de los tiempos: no era la música escasa que pide la 0027. Una prueba lo exige ahora: en un minuto, menos de un quinto. Quedó un bordón grave que cambia cada 16 tiempos y tres notas encima cada 32. Cuando el piso está terminado, nada.

## El cielo, más barato

La prueba de la torre en el navegador tardaba más de un minuto, y la razón estaba en la 5a. En las pruebas de navegador, WebGL corre en la CPU (SwiftShader), y ahí el recorrido bajaba de 17 a 9 cuadros por segundo con cielo.

Cambié dos cosas:

- **Se dibuja último y en el plano lejano,** así la prueba de profundidad deja afuera los píxeles que ya cubre algo.
- **Lo que cambia despacio se calcula en las esquinas de la cúpula** (64 × 48) y se mezcla entre ellas: el degradé, el suelo bajo el horizonte, el resplandor ancho del sol. Cada píxel hace solo lo que es nítido, y solo donde puede estar: cerca del sol, cerca de la luna, las estrellas de noche. Las potencias pasaron a ser productos.

Medido con la máquina cargada por otra sesión, mejoró poco. Lo que cuesta en la CPU es llenar cada píxel descubierto, y eso lo tiene que hacer cualquier cielo. En una placa de video es barato: la ciudadela con su cielo dibuja un cuadro en unos 6 ms en el Iris Plus del autor. Me quedo con el sombreador más barato, que es mejor de todos modos, y con esto: en las pruebas de navegador, los niveles con cielo andan más lento que los demás.

## Pruebas

- **El progreso:** un nivel terminado abre el siguiente y guarda su mejor; lo guardado se lee igual; lo que no se entiende, o es de una versión más nueva, empieza de nuevo.
- **Los créditos:** una línea por archivo, de las listas de lo que el juego dibuja; un archivo en dos listas, una vez.
- **La música:** la altura de un grado; lo que suena entre dos tiempos, vuelta tras vuelta; un estado sin voces es silencio.
- **La torre:** sus dos pisos jugados hasta la meta sin pantalla; sus palabras en los dos idiomas; su música rala.
- **En el navegador:** la torre de punta a punta. Créditos desde el título, jugar, las dos líneas, el primer piso con las teclas, lo guardado; la página de nuevo, seguir desde ahí, el segundo piso, las líneas finales, los créditos y el título otra vez, todo terminado.

## Lo que queda para después

- **Las palabras del hilo son un borrador:** la 5d las escribe con la torre.
- **Los ajustes están solo en el menú de pausa** (Esc), no en el título.
- **Elegir piso:** cuando haya más de dos, el título puede ofrecer los terminados.

Sigue la 5c: el controlador del juego de plataformas y su salto en la pared.
