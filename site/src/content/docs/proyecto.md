---
title: El proyecto
description: Qué es Manifold Gaming, de dónde viene y cómo está pensado.
---

**Manifold Gaming** es un laboratorio de mundos físicos en 3D para la web. No es un juego suelto ni una biblioteca aislada: es un motor propio escrito en TypeScript (con [Three.js](https://threejs.org) para dibujar y [Rapier](https://rapier.rs) para la física, en su versión determinista), un **Dojo** con una consola en vivo donde ponerlo a prueba, los **juegos** que se construyen encima, un **tutorial** con código que se edita y se ejecuta en la misma página, y una **bitácora** donde queda qué se hizo en cada etapa, qué falló y cuánto midió cada solución.

El nombre junta dos ideas que rara vez van de la mano.

**Manifold** viene de la geometría diferencial. Una _manifold_ (en castellano, _variedad_) es un espacio que, mirado de cerca, parece el espacio plano de todos los días, aunque en grande sea curvo, esté retorcido o tenga una sola cara: un planeta chico, un toro, una cinta de Möbius. En la mayoría de los motores 3D esos mundos son trucos difíciles de encajar, porque el código da por sentado que "abajo" es siempre el mismo eje y que el espacio nunca se pega consigo mismo. Este motor parte de la idea contraria: tratar la variedad como el caso normal. El "abajo" de cada personaje sale de un campo de gravedad que puede cambiar de un lugar a otro, y un nivel plano de los de siempre es solo el caso más sencillo.

**Gaming** dice para qué existe esa matemática: para hacer y jugar juegos completos. Manifold no reinventa cómo se dibuja un triángulo ni cómo rebotan dos esferas (eso ya lo hacen muy bien Three.js y Rapier). Lo que construye encima es lo que convierte esa geometría y esa física en **reglas de juego reproducibles**: un personaje que compone capacidades en vivo (trepar, planear, un doble salto), niveles que son texto, una red donde cada paso del mundo tiene una huella que se puede verificar y, en las fases que vienen, mecanismos que responden e inteligencia artificial que usa el escenario.

Por eso el sitio tiene cuatro puertas que se alimentan entre sí: en [Jugar](../jugar/) están el Dojo y, más adelante, los juegos; en el [Tutorial](../tutorial/), las piezas del motor explicadas desde cero con ejemplos vivos; en la [Bitácora](../bitacora/), la historia técnica paso a paso; y acá, en el Proyecto, las ideas y el plan que mantienen todo unido.

## De dónde viene

Manifold Gaming es la **segunda versión** de esta búsqueda. La primera fue un shooter que creció paso a paso: primero tuvo física y armas; después, una hormiga capaz de trepar por las paredes, autos, una pista sobre una cinta de Möbius, partidas en red, mecanismos, luz simulada, inteligencia artificial que usaba el mundo, repeticiones y, al final, tres juegos sobre el mismo motor.

Aquella versión demostró que las ideas eran posibles en un navegador, pero también mostró el precio de sumar sistemas sobre una base que no los había previsto: el controlador del personaje se trababa en los cuerpos que se mueven, un contador de identificadores y un azar compartidos hacían que dos simulaciones se robaran números, y varias veces hubo que frenar para rehacer cimientos que habían quedado chicos.

De ella no se copia una línea de código: se traen las **lecciones**, muchas medidas en milisegundos y kilobytes, convertidas ahora en reglas desde el primer día. Qué se conserva, qué se descarta y con qué números está escrito en la [decisión 0000](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0000-why-a-v2.md).

## Cómo está pensado

Cuatro capas con fronteras estrictas. Las dependencias apuntan siempre hacia el núcleo, y nada de la simulación sabe que existe una pantalla:

| Capa                                       | Qué hace                                                                                                   | Qué no sabe                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Núcleo** (`packages/core`)               | Simula el mundo en pasos fijos: sus entidades, su física, su azar con semilla y su huella (_hash_)         | Que existe una pantalla, una red, o a qué se está jugando       |
| **Red** (`packages/net`)                   | Lleva el compás de la partida, decide en qué paso entra cada acción y comprueba que las copias no diverjan | Cómo se dibuja el mundo, o por qué canal viajan los mensajes    |
| **Juegos** (`games/`)                      | Dicen qué hay en el mundo, qué acciones entienden y qué significa lo que pasa                              | Sus reglas, cómo funciona la física por dentro o cómo se dibuja |
| **Presentación** (`packages/presentation`) | Dibuja lo que el núcleo simula, y convierte el teclado, el mando y el ratón en lo que el jugador pide      | Cómo cambiar el mundo por su cuenta                             |

Debajo de todo hay dos paquetes chicos, también sin pantalla: la matemática y el azar con semilla (`packages/common`), y el registro y el intérprete de la consola (`packages/commands`).

Y siete reglas que no se negocian:

- **Todo el estado vive en el mundo, como datos.** Se puede inspeccionar en vivo, guardar en una instantánea (_snapshot_) y restaurar intacto: en el recorrido del Dojo, con doce cubos, guardarlo entero tarda 0,7 ms.
- **La simulación no toca la pantalla.** No lo vigila una costumbre: lo vigilan el compilador y el _linter_, que además deja fuera de la simulación todo cálculo que cambia de un navegador a otro, como la trigonometría de JavaScript.
- **Determinismo medido, entre plataformas.** Cada paso tiene una huella. Una partida jugada con el teclado en Chromium, Firefox o WebKit, repetida en Node, termina con la misma huella.
- **Todo pasa por la red, incluso jugando solo.** La página levanta su propio servidor, y cada segundo comprueba que las copias del mundo coinciden.
- **El motor no conoce a los juegos.** Recibe un _cartucho_ (_cartridge_) que dice qué hay en el mundo y qué significa lo que pasa, y le avisa lo que pasa en cada paso.
- **El Dojo y su consola, desde el primer día.** Lo que el motor expone se puede consultar, cambiar en un paso concreto y compartir como una receta o una repetición dentro de un enlace.
- **Medir antes de afirmar.** Un número de rendimiento sin el escenario en que se midió no vale.

## En qué etapa está

Los tres primeros juegos comparten un mismo personaje, que gana capacidades y un mundo que le responde a medida que avanzan las fases. Los mundos extraños llegan al final, sobre esa base firme.

| Fase                                   | Qué trae                                                                                                                             | Cómo se demuestra                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 0. Cimientos                           | El repositorio y sus herramientas, este sitio, el tutorial ejecutable, la consola y un núcleo mínimo                                 | Un cubo que gira en el Dojo, calculado por la simulación                                                 |
| 1. Física y un personaje               | Física determinista, un personaje con su cámara, repeticiones y fantasmas, instantáneas y el esqueleto de la red                     | Un personaje corre y salta en un nivel, y su repetición da la misma huella                               |
| 2. Capacidades                         | Niveles como datos y zonas; trepar, planear y el doble salto, compuestos; plataformas que se mueven; modelos y animaciones           | Prender y apagar capacidades en vivo, en un nivel de verdad                                              |
| 3. Un mundo que responde               | Mecanismos, señales, cosas que se rompen, luz y sonido; la interfaz del juego, guardar, mazmorras por semilla                        | Romper una lámpara cambia lo que ve un vigía (el guardia, con su cerebro, en la fase 4)                  |
| 4. Combate y bots                      | Armas y salud; bots que ven, oyen y usan el mundo, y navegación; la historia; la aventura crece y empieza el shooter                 | Un guardia que te oye, llama al ascensor para seguirte y pelea; y la primera arena del shooter, con bots |
| 5. Juegos                              | Tres juegos clásicos completos sobre la misma base, con historia, niveles, gráficos y sonido                                         | Un plataformas, una aventura y un shooter, en este sitio                                                 |
| **El bosque** ← _aquí_                 | Un segundo mundo para exigirle al motor: terreno con relieve, dibujar a escala, criaturas, la luz como sistema, agua, cuerdas, vuelo | Tres juegos en un valle (las copas, el manantial, la noche), y después el del hada                       |
| 6. Red y niveles                       | Partidas en línea con predicción y compensación de la latencia; un editor de niveles                                                 | El shooter, en red                                                                                       |
| 7. Mundos extraños                     | Gravedades que cambian de lugar en lugar, caminar por paredes y techos, espacios pegados consigo mismos                              | Dos juegos de la segunda tanda                                                                           |
| 8. Potencia para un jugador (opcional) | El mismo motor y el mismo juego, sin la segunda copia que verifica, con una física más rápida y escombros que cuentan                | Una estructura que cae en miles de cuerpos de verdad, a 60 cuadros por segundo                           |

Entre fase y fase hay pausas para consolidar: una antes de los modelos de la fase 2, para dejar listas las piezas en las que se van a apoyar las fases 3 y 4; otra antes de los juegos; y la 5.5, antes del bosque, que le da a cada pieza del código su lugar ([decisión 0033](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0033-the-shape-before-the-forest.md)). El bosque tiene nombre y no número: «fase 6» sigue siendo la red.

La fase 8 es opcional, y sale de una cuenta: jugando solo, hoy corren en la página dos copias completas del mundo, la que cuenta y la que se dibuja, y eso es lo que comprueba en vivo que todo es determinista. Un juego de un jugador que quiera miles de cuerpos puede renunciar a esa comprobación, sabiéndolo, y quedarse con todo lo demás.

El código está en [GitHub](https://github.com/RodrigoMartinVG/Manifold_Gaming). Lo que cada fase construye y deja lista para la siguiente está en el [_roadmap_](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/ROADMAP.md); el porqué de cada pieza, en [las decisiones](https://github.com/RodrigoMartinVG/Manifold_Gaming/tree/main/docs/decisions); y los hallazgos y las mediciones de cada paso, en la [Bitácora](../bitacora/).

## Los idiomas

El sitio está en español: el tutorial, la Bitácora y todo lo que explica o informa (más adelante, también en inglés). **Lo que es código o protocolo está en inglés**: los paquetes y sus comentarios, los nombres de archivos y carpetas, el formato de los niveles, las pruebas, las decisiones, los mensajes de cada cambio y la consola del Dojo con sus recetas.

Los nombres de la consola no se traducen, porque funcionan como las palabras de un lenguaje de programación (`if` no se traduce por `si`): así, una receta o un enlace armado por cualquiera corre igual para todos. Lo cuenta la [decisión 0011](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0011-languages.md), y un [glosario](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/7707772/site/src/content/docs/tutorial/archivo/glosario.mdx) junta las palabras de los dos idiomas.
