---
title: 'Etapa 3d: la luz, y alguien que mira'
description: 'La luz es de la simulación: cada lámpara es un dato, y qué tan iluminado está un punto sale de las lámparas que lo ven, con rayos, igual en Node. Una niebla la atenúa, y también la vista. Un observador fijo ve al personaje donde está iluminado, y lo pierde en la oscuridad, detrás de un pilar o en la niebla. Y los primeros presupuestos de lo que se dibuja.'
sidebar:
  order: 27
---

> Informe de la etapa 3d, la cuarta de la fase 3. La mitad de la demostración de la fase: romper una lámpara (3e) cambia lo que ve un observador, porque la luz que mira es la de la simulación.

## Qué hicimos

- **La luz es de la simulación.** El mundo tiene una luz ambiente (cuánto se ve sin ninguna lámpara: 1, como hasta ahora, si el nivel no dice otra cosa), y cada **lámpara** es un dato: dónde está, hasta dónde llega, qué tan fuerte es, y una señal que la prende (3c). Qué tan iluminado está un punto es la luz ambiente más lo de cada lámpara prendida que lo alcanza y lo ve: un rayo desde la lámpara, sin nada en el medio, que cae en línea recta hasta su radio. Sumas, productos, una división y una raíz: igual en todos los navegadores y en Node. Cada personaje sabe qué tan iluminado está (`character.light`), y eso va en el hash.
- **Medios que atenúan, desde el principio.** Una zona con una opacidad por metro, de cualquier clase, quita luz y vista a lo que la cruza. Lo que pasa es 1 / (1 + la suma de lo que cada zona tiene adentro del segmento por su opacidad): una caída racional, no la exponencial de los navegadores, que dependería de cómo cada uno calcula `exp`. La luz y la mirada cruzan lo mismo, así que un observador no ve a través de la niebla más que el jugador.
- **Un observador.** Un ojo fijo, que mira hacia su −Z. Ve a un personaje que está a su alcance y en su campo de visión, sin nada en el medio, y tan iluminado como su umbral, visto desde ahí (su luz, atenuada por lo que haya en el medio). Ver y perder son eventos, y lo que ve puede ser una señal (`seen eye`): la fase 4 va a hacer sonar una alarma con eso. No decide nada; el guardia de la fase 4 se lleva sus ojos. Tiene su fase propia en el paso, la luz, después de las zonas y antes de las señales.
- **El formato de nivel, versión 4.** `ambient`, `lamp`, `watcher` y la señal `seen`. Una zona con opacidad se dibuja translúcida.
- **El dibujo lee los mismos datos.** La luz del día del escenario es la luz ambiente del mundo; cada lámpara ilumina con una luz de three.js de su radio mientras está prendida, y su bola brilla; un observador que ve a alguien se pone rojo. `show.light` dibuja hasta dónde llega cada lámpara, y `show.vision` el campo de visión de cada observador, con una línea a cada personaje en él: verde si lo ve.
- **Una sala, "The watcher".** Un salón oscuro con cuatro charcos de luz (uno con un interruptor), un pilar para esconderse, una niebla baja y el ojo al fondo.
- **Presupuestos.** El costo de los rayos de la luz se suma a los de la simulación, y lo que se dibuja tiene los suyos: las llamadas al GPU y los triángulos de tres salas, contados por una prueba del navegador.
- **Una segunda repetición de referencia para la fase 3** (`phase-3-light`). Como la luz de cada personaje va en el hash, cada navegador que la reproduce hasta el mismo hash ilumina igual que Node.

## Hallazgos

| Hallazgo                                              | Qué pasaba                                                                                                                                                                                                                                                        | Qué hicimos                                                                                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Cada consulta de luz recorría todo el mundo**       | Para cada personaje y cada lámpara, la luz buscaba las lámparas y las nieblas entre todas las entidades: en la sala `stress`, más de 200 por consulta. Con cuatro lámparas, una niebla, un observador y ocho personajes, la luz costaba 0,36 de un paso de Rapier | Las lámparas prendidas y las zonas que atenúan se juntan una vez por paso: 0,29, debajo del presupuesto de 0,5                   |
| **Un pilar demasiado cerca del ojo**                  | La primera sala tenía el pilar a 2,5 m del ojo: tapaba 22° de sus 70°, todo el centro del salón, también el comienzo                                                                                                                                              | El pilar quedó lejos, en un charco del costado, donde tapa 4°                                                                    |
| **El pilar tapaba también a la lámpara**              | Detrás del pilar, visto desde el ojo, el personaje quedaba también a la sombra de la lámpara, que estaba del mismo lado que el ojo: no estaba iluminado, y el escondite no probaba nada                                                                           | La lámpara de ese charco está del otro lado: detrás del pilar el personaje está iluminado, y el ojo no lo ve                     |
| **La niebla le quita luz a la lámpara, también**      | Una lámpara arriba de la niebla ilumina menos a quien está adentro, porque su luz también la cruza. Es lo coherente: la luz y la vista atraviesan lo mismo                                                                                                        | La niebla de la sala es baja (1,2 m): adentro, la lámpara llega con dos tercios de su luz, y el ojo ve un tercio de lo que queda |
| **Una lámpara se prende un paso después de su señal** | Lee su señal como un mecanismo: como estaba al final del paso anterior                                                                                                                                                                                            | Lo dice la decisión 0018, y una prueba lo cuida                                                                                  |
| **Las bolas de las lámparas pesan**                   | Cada lámpara es una esfera de 768 triángulos: en la sala, 3.072 de los 5.024                                                                                                                                                                                      | Queda dentro del presupuesto. Una esfera más simple para lo chico, cuando haga falta                                             |

## Medido

- **Una lámpara:** debajo de ella, a 2 m de una de radio 6, la luz es 0,05 + 1 × (1 − 2/6); a 6 m o más, la luz ambiente. Detrás de una pared, la ambiente.
- **La niebla:** 3 m de opacidad 2 por metro dejan pasar 1/7; 1,5 m, 1/4.
- **El costo de la luz:** cuatro lámparas, una niebla, un observador y ocho personajes en la sala `stress`, 0,29 de un paso de Rapier (0,12 ms).
- **Lo que se dibuja** (Chromium sin GPU): la sala del observador, 28 llamadas y 5.024 triángulos; el circuito, 45 y 1.992; la sala `stress`, 226 y 4.152 (una llamada por cubo: una forma para todos sería una sola).
- **Cuadros por segundo, a mano**, en la máquina del proyecto (una Mac con Intel Iris Plus), en el navegador de la aplicación: la sala del observador, entre 42 y 51. Una sola medición, con el panel en segundo plano: el circuito no llegó a dibujar en esas condiciones, así que la comparación queda pendiente.
- **Las pruebas:** sin pantalla, 331 (17 nuevas: el formato 4 y sus errores; la luz de un punto, su sombra, la niebla, la luz del personaje; el observador que ve y pierde, el pilar, la niebla, el interruptor; la instantánea; la referencia de la luz; el presupuesto de la luz). En el navegador, 131: el observador que ve y pierde en la página, y los presupuestos de lo que se dibuja de tres salas. Chromium, Firefox y WebKit reproducen la referencia de la luz hasta el mismo hash que Node: la luz es la misma en todos.

## Lo que sigue

La 3e: lo que se rompe, la demostración de la fase. Romper una lámpara cambia lo que ve el observador.
