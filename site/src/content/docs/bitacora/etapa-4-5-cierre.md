---
title: 'Cierre de la etapa 4.5: los ruidos, las pruebas que fallaban con carga y lo que queda para los juegos'
description: 'El cierre de la revisión antes de los juegos: los ruidos que el autor oía (cuerpos en reposo que sonaban en cada paso), un fantasma que terminaba antes de tiempo, tres pruebas que fallaban con la máquina cargada, Firefox y WebKit dibujando en integración continua, la auditoría de lo que supone que "arriba" es +Y, las deudas que quedaban y las dos decisiones antes de la fase 5.'
sidebar:
  order: 51
---

> Informe del cierre de la [4.5](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/ROADMAP.md), después de la [4.5f](../etapa-4-5f/). Con él, la 4.5 está completa y lo que sigue es la fase 5: los juegos.

## Los ruidos que no paraban

El autor lo contó jugando: a veces aparecían ruidos que no paraban, como de objetos que quedaban rebotando para siempre, y sobre todo al llevar una caja agarrada cerca de una pared, que quedaba rebotando y girando.

Medido sin pantalla, era peor que eso. En la sala de máquinas, sin tocar nada, la caja y el bloque de piedra sonaban 120 veces por segundo, para siempre.

Un golpe se oía cuando el cambio de velocidad de un cuerpo en un paso, sin contar el de la gravedad, llevaba energía suficiente: $\tfrac12 m\,|\Delta v - g\,\Delta t|^2 \ge 0{,}02$ J. Un cuerpo en reposo no cae: el piso le devuelve en cada paso lo que la gravedad le sacó, y ese $|\Delta v - g\,\Delta t| = g\,\Delta t \approx 0{,}16$ m/s se leía como un choque.

- La caja, de 45 kg, sumaba 0,6 J por paso.
- El bloque, de una tonelada, 16 J.
- Los cubos de la sala de estrés pesan menos de 1,5 kg, quedaban debajo del umbral y por eso nadie lo había oído antes.

Además, en el Dojo un golpe hiere lo que tiene salud. Una caja apoyada contra un guardia lo habría lastimado en cada paso.

Lo arreglamos en tres capas:

- **Un golpe se oye solo cuando un contacto empieza:** Rapier avisa qué pares de cuerpos empezaron a tocarse en cada paso (sus eventos de colisión, que salen de su fase estrecha y entran en sus instantáneas). Y se mide sin la parte que solo sostiene el cuerpo contra la gravedad. Apoyado, apretado contra algo o deslizando, no vuelve a sonar.
- **Un empujón es parte de la velocidad del cuerpo:** `World.push` cambiaba la velocidad en Rapier sin anotarla en los datos del cuerpo, y la lectura de después tomaba cada empujón del agarre por un choque.
- **Lo que se agarra se sostiene antes de lo que está en el camino:** contra una pared, el agarre apuntaba adentro de la pared. El empuje, que tiene un tope, se gastaba contra ella y no quedaba para sostener la caja: temblaba, giraba y se hundía. Ahora el punto donde se la sostiene se acerca hasta donde una bola de su tamaño llega sin tocar nada, y la velocidad del personaje hacia lo que la frena no se suma.

Ahora la caja agarrada y llevada contra la pared suena una vez, al golpear: 45 kg a 5,7 m/s, un golpe fuerte, como debe ser. Después queda sostenida, quieta y callada. Cambia la simulación, así que la versión pasa a 38. Las repeticiones de referencia de las fases 0 a 4 se grabaron de nuevo y dan los mismos hashes; la de la ciudadela es una partida nueva.

## Un fantasma que terminaba antes

La prueba del fantasma falló una vez con la máquina cargada: el fantasma quedó en $z = 4{,}67$ y tenía que pasar 4,5.

La tira guarda una pose cada 6 pasos y no agregaba la última, la de donde terminaste. El fantasma se detenía hasta 5 pasos antes que vos (45 cm caminando). Sin carga no se notaba, porque el jugador caminaba de más antes de soltar la tecla.

Ahora la tira termina donde terminaste. La pose $k$ está en el paso $\min(6k,\ \text{fin})$, de modo que una tira vieja, sin esa última pose, se lee igual que antes.

## Las pruebas que fallaban con la máquina cargada

Las tres pasaban solas. La causa de fondo apareció al medir: con seis procesos dibujando a la vez, dos páginas cada uno, todo por software en la CPU, una página avanzaba unos 3 pasos por segundo en vez de 60. Cada una tenía además su propia forma de fallar:

- **Los ejemplos de `help`:** esperaba que algo nuevo apareciera dibujado, y la página escribía lo dibujado cada 10 cuadros. Con cuadros de más de un segundo, eran más de 15 s. Ahora lo escribe en cada cuadro.
- **Dos pestañas, una partida:** esperaba 20 s el primer cuadro de cada página, y con la máquina así tardó más. Con 60 s de margen pasó de esa espera, pero falló más adelante: sus dos páginas tienen que andar a velocidad para jugar una partida.
- **El pie del personaje animado:** mide el deslizamiento cuadro por cuadro, y en un cuadro de una máquina cargada cabe medio paso. Probé dejar afuera los cuadros largos: con la máquina así, todos lo eran, y la medida quedó en cero. Lo revertí.

Las dos últimas miden algo que depende de que la máquina dibuje a velocidad. Ahora están marcadas `@quiet` y corren en un proyecto propio, después de todas las demás, con la máquina tranquila. El margen de 60 s de la carga inicial quedó: no es un arreglo del juego en red, solo el tiempo que la suite le da a una página para levantarse, como el escaparate de la portada espera 40.

Y la causa de fondo, en su lugar: la suite corre localmente con tres procesos a la vez, no con cuatro (la mitad de los ocho núcleos, lo que Playwright toma solo). Con cuatro, cada corrida se quedaba sin tiempo en otro par de pruebas: el escaparate de la portada, la cámara contra las paredes. Con tres, en ninguna. En la integración continua queda lo de Playwright.

## Firefox y WebKit, dibujando en integración continua

Desde la 2.5a, sus pruebas de física que dibujan corrían solo en la máquina del autor, hasta verificar su WebGL en Linux.

Verificarlo acá habría pedido bajar la imagen de Linux de Playwright (gigas). En cambio, la integración continua lo verifica sola: un paso propio corre esas pruebas en Firefox y WebKit sin bloquear todavía. Cuando haya pasado allá, pierde el `continue-on-error`.

No está verificado hasta el próximo push.

## Lo que supone que "arriba" es +Y

La fase 7 trae gravedad que cambia de lugar en lugar y caminar por las paredes. [La auditoría](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/audits/up-is-y.md) lista, por sistema, lo que todavía supone que arriba es +Y.

El controlador del personaje, los golpes y las capas de la animación ya preguntan a la gravedad. Lo estructural es:

- la navegación (su grilla se toma a lo largo de un solo "abajo");
- los guardias;
- los formatos de entradas, repeticiones y fantasmas (una dirección en el suelo es un ángulo en el plano $xz$; en una pared se pierde el "hacia arriba de la pared");
- los mapas dibujados con caracteres.

Dos cosas eran baratas y estaban mal ya hoy, así que las arreglamos. La navegación calculaba saltos y caídas con la gravedad de la Tierra: en la luna del Dojo, un bloque de 3 m se salta, no se trepa. Y no se volvía a construir cuando cambiaba la gravedad, ni cuando un cuerpo fijo se movía con `set`.

## Las deudas que no cambian la simulación

- **El aviso a Rapier:** su controlador de personaje casi no avanza sobre un cuerpo cinemático (medido en la 2d y en la 2.5b). Reproducido ahora con Rapier solo: sobre un piso fijo camina 8,7 m en 2 s; sobre el mismo piso, cinemático y quieto, 0,23 m, y descansa 1,5 mm más abajo (no respeta su holgura). El borrador está escrito y espera el visto bueno del autor para presentarlo.
- **Una esfera más simple para lo chico:** la bola de una lámpara, o una que se tira, pasó de 720 triángulos a 168.
- **Los tiempos de cuadro de la 3d, comparados:** con la medida de la 4.5f (la Iris Plus del autor, a 1280 × 720 y sin limitar los cuadros), el recorrido tarda 2,9 ms, el torreón 3,2 y la ciudadela de 4,2 a 7,2. La página dice ahora cuánto le cuesta dibujar (`show.stats`).

## Las dos decisiones antes de la fase 5

Las tomamos por instrucción del autor de seguir las recomendaciones, y cada una se puede revisar con su palabra:

- **[La música](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0027-music.md):** hecha en el navegador como los sonidos, escasa, con su volumen propio. La de cada juego, con el juego. Una grabación CC0 solo cuando no se pueda generar, y por decisión del autor.
- **[Los controles táctiles](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0028-touch-controls.md):** teclado, mouse y gamepad hasta la fase 6. Un teléfono sin gamepad lo lee sobre el juego ("Este juego se juega con teclado y mouse, o con un gamepad"), y puede mirar igual arrastrando.

## Hallazgos

| Hallazgo                          | Qué pasaba                                                                                   | Qué hicimos                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Cuerpos en reposo que sonaban** | El piso que sostiene un cuerpo se leía como un golpe: 120 por segundo en la sala de máquinas | Un golpe, solo cuando un contacto empieza, y sin la parte que sostiene                                 |
| **Empujones que sonaban**         | Un empujón no quedaba en la velocidad del cuerpo, y la lectura lo tomaba por un choque       | Queda en ella                                                                                          |
| **La caja contra la pared**       | El agarre la empujaba adentro de la pared: temblaba, giraba y se hundía                      | Se la sostiene antes de lo que está en el camino                                                       |
| **El fantasma, corto**            | La tira no guardaba la última pose: terminaba hasta 5 pasos antes                            | Termina donde terminaste; las viejas se leen igual                                                     |
| **Tres pruebas con carga**        | Con todo dibujando en la CPU a la vez, una página iba a 3 pasos por segundo                  | Lo dibujado, escrito en cada cuadro; lo que tiene que andar a velocidad, al final y a solas (`@quiet`) |
| **La navegación, en la luna**     | Saltaba y caía con la gravedad de la Tierra, y no se reconstruía al cambiar la gravedad      | Con la del mundo, y se reconstruye                                                                     |

## Lo que queda para los juegos

Está en el ROADMAP, con su tabla revisada para las fases 5 a 7:

- el presupuesto de cada nivel (0026);
- la música (0027);
- las texturas del kit repiten cada metro (si una pared lo muestra, variantes por pieza);
- un guardia que no tiene camino hacia un ruido camina derecho hacia él;
- el palo contra un guardia que bloquea es un intercambio parejo (lo equilibra el combate de la aventura);
- el primer paso de un nivel grande tarda 0,14 a 0,3 s;
- lo que se une a una partida empezada pesa 475 KB de física (fase 6);
- la lista de lo que supone que arriba es +Y (fase 7).
