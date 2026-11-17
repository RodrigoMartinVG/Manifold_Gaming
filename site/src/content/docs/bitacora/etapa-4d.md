---
title: 'Etapa 4d: dónde piensa un bot y por dónde puede ir'
description: 'Dos decisiones antes del código: un bot es un jugador, y su cerebro corre donde se aloja la partida; y la navegación, una grilla de dónde cabe un cuerpo, muestreada del nivel. Un camino por el torreón que aprieta el botón de la puerta y sube el ascensor, y que, si el ascensor no está, va primero a la placa que lo llama.'
sidebar:
  order: 41
---

> Informe de la etapa 4d, la cuarta de la [fase 4](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/ROADMAP.md). Las tres primeras le dieron al personaje un cuerpo, lo que ese cuerpo puede hacer y lo que lo lastima. Esta es lo que un guardia necesita antes de existir: dónde piensa, y por dónde puede ir.

## Qué hicimos

- **La decisión [0023](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0023-where-a-bot-thinks.md): un bot es un jugador.** Sus entradas llegan por la sesión, como las de una persona, y las repeticiones las guardan. Su cerebro es una función del juego que corre una sola vez, donde se aloja la partida: la página cuando se juega solo, el servidor en la fase 6, el arnés de una prueba. Responde un paso tarde, 17 ms. Su memoria son datos que guarda el anfitrión, fuera de la huella. Lo que percibe es de la simulación (la vista con luz de la 3d, el oído de la 3f, la postura de la 4b); lo que decide es de su cerebro. Así, una repetición grabada hoy sigue dando la misma huella aunque mañana cambie el cerebro del guardia.
- **La decisión [0024](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0024-navigation.md): la navegación,** una grilla de dónde cabe un cuerpo parado, muestreada del nivel con las consultas del mundo, con aristas que piden una capacidad o una señal.
- **Un paquete nuevo, `@manifold/bots`:** lo que los bots usan para planear. Corre donde se aloja la partida, fuera de la huella y sin pantalla.
- **La grilla.** Las caras de arriba de lo que nunca se mueve (cajas giradas o no, el piso de un mapa) que son lo bastante planas para pararse. Sobre ellas, una celda cada medio metro donde la cápsula del personaje no choca con nada por encima de lo que sube de un paso. Las aristas unen cada celda con sus ocho vecinas: caminar (hasta 35 cm), caer, saltar (hasta 1,8 m), trepar (pide `climb`) y cruzar un hueco (hasta 2,5 m).
- **Lo que mueve un programa.** Una puerta da una arista que la pide abierta. Un ascensor da celdas en su pie y en su cima, cada una mientras él está ahí, y un viaje entre ellas.
- **A\* y el camino estirado:** de las celdas que pisa, quedan solo las esquinas donde tiene que doblar.
- **"La arista apunta a su botón".** Cuando ningún camino llega, el planificador mira las aristas que no pudo tomar. De la definición de cada señal saca qué la cambia: pararse en la zona de una `zone`, apretar `use` en la de un `used`, encender o apagar un `latch`, dar vuelta un `toggle`. Va ahí primero y sigue, hasta dos en fila. No hay nada escrito para eso en el nivel: las señales ya lo dicen.
- **El formato de nivel 8:** recorridos (`route`, con su nombre y sus puntos, de ida y vuelta o en ronda con `loop`), que se leen, se construyen como entidades, se escriben de vuelta, y la consola agrega y clona. Y para qué sirve algo (`affords cover`, `throw`, `kick`, `weak`), en cualquier línea: datos que leen los cerebros. Una línea sin `affords` queda como estaba, así que ninguna repetición cambió.
- **La consola:** `show.nav` dibuja las celdas, las aristas que no son caminar y los recorridos. `nav.path` planea desde tu personaje hasta un punto o una entidad, con lo que tu personaje puede hacer, y lo dibuja y lo dice paso a paso.

## Por qué A\* encuentra el más rápido

A\* recorre las celdas por $f(n) = g(n) + h(n)$: $g$ es lo que ya costó llegar, y $h$ es una estimación de lo que falta. Si $h$ nunca sobreestima (es _admisible_), el primer camino que llega a la meta es el más barato. Acá el costo de una arista es el tiempo que tarda el cuerpo en cruzarla, y la estimación es la distancia por el suelo a la velocidad de caminar $v$:

$$h(n) = \frac{\sqrt{(x_n - x_m)^2 + (z_n - z_m)^2}}{v}.$$

Es admisible porque cada arista tarda por lo menos su largo por el suelo a esa velocidad: caminar tarda exactamente eso, y caer, saltar y cruzar le suman tiempo. La altura queda afuera a propósito. Una caída de altura $y$ tarda $\sqrt{2y/g}$, y recorrer esa altura caminando, $y/v$; la caída es más rápida cuando

$$\sqrt{2y/g} < y/v \iff y > \frac{2v^2}{g} = \frac{2 \cdot 4{,}5^2}{9{,}81} \approx 4{,}1 \text{ m}.$$

Contando la distancia en tres dimensiones, un camino con una caída de más de 4 m habría sobreestimado, y A\* podía devolver uno que no era el más rápido. La primera versión lo hacía; se arregló antes de cerrar la etapa.

## Hallazgos

| Hallazgo                                 | Qué pasaba                                                                                                                                                                                      | Qué hicimos                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Trepaba en vez de tomar el ascensor**  | El primer camino del torreón subía la pared de 4,3 m trepando: el planificador daba por hechas todas las capacidades, y el personaje de los juegos no trepa (en el Dojo, hasta `dojo.climb on`) | Un plan toma solo las capacidades que se le dicen: las del personaje (`can`) |
| **Saltaba para bajar del ascensor**      | Caminar entre dos celdas del mismo ascensor pedía la señal del ascensor, y el plan todavía la creía apagada: para salir, saltaba por encima de la celda de al lado                              | Sobre el ascensor, nada se pide: si uno está arriba de él, está ahí          |
| **`affords` cambiaba todas las huellas** | Cada entidad guarda la línea que la hizo, y una lista vacía de `affords` en cada línea cambiaba la huella de todos los niveles                                                                  | `affords` está solo si la línea lo dice                                      |
| **La heurística sobreestimaba**          | Con la distancia en tres dimensiones, una caída de más de 4 m tarda menos que la heurística                                                                                                     | La distancia por el suelo (arriba)                                           |

## Medido

- **El torreón:** 1.080 celdas y 8.260 aristas, armadas en 57 ms; un camino de punta a punta, en 2,4 ms.
- **Las otras salas del Dojo** (el recorrido, el circuito, `moves`, las máquinas, el laberinto, las capacidades): de 1.300 a 1.550 celdas, en 59 a 94 ms. Se arma una vez por nivel, donde corren los cerebros.
- **El camino del torreón:** con la puerta cerrada y el ascensor abajo, camina al botón, aprieta `use`, cruza la puerta, sube al ascensor, viaja y camina hasta la placa; 8,2 s. Con el ascensor arriba, va primero a la placa que lo llama. Un cuerpo que trepa sube la pared.
- **Las pruebas:** sin pantalla, 579 (12 nuevas en la etapa); en el navegador, `show.nav` y `nav.path` en el torreón.

## Las lecciones que ahora tienen dónde apuntar

- **7.2 Dijkstra y 7.3 A\*:** la búsqueda, su heurística admisible y por qué la altura queda afuera.
- **7.4 mallas de navegación:** la grilla elegida en su lugar, y por qué.
- **6.3 niveles como texto:** el formato 8, recorridos y para qué sirve cada cosa.
- **6.6 señales y mecanismos:** leer la definición de una señal para saber qué la cambia.

**Lo que no hicimos como decía el plan:** seguir un camino (7.5) quedó para la 4e, con los guardias que lo siguen.

## Lo que sigue

La etapa 4e: los guardias. Patrullan, ven, oyen, persiguen, usan el ascensor y pelean, con lo que dieron la 4a a la 4d. Y la consola para mirarlos: lo que oyó cada uno, `possess` para manejar uno con las teclas, `step back`.
