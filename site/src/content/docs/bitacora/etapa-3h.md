---
title: 'Etapa 3h: la cámara contra las paredes'
description: 'La cámara barre una esfera desde la cabeza del personaje hasta donde quiere estar, y si encuentra una pared o un techo se muestra antes, de golpe; cuando el camino se despeja, vuelve despacio. Una zona del nivel puede sugerir hacia dónde mirar. Y una sala nueva, el pasillo, donde manteniendo W se recorre todo.'
sidebar:
  order: 31
---

> Informe de la etapa 3h, la octava de la fase 3. Lo que todo nivel con paredes necesitaba, y lo que un nivel puede decirle a la cámara.

## Qué hicimos

- **La cámara no termina adentro de una pared.** En cada cuadro barre una esfera de 25 cm desde la cabeza del personaje hasta donde quiere estar (`castShape`, la consulta que el mundo tiene desde la etapa 2.5b). Si encuentra algo, se muestra antes, **de golpe**: un cuadro detrás de una pared ya taparía al personaje. Cuando el camino se despeja, vuelve **despacio** (`1 − e^(−3 · dt)`), para que una columna que pasa no la haga saltar.
- **El acercamiento es solo de lo que se muestra.** La correa (etapa 1c2), un arrastre y la rueda trabajan desde donde la cámara quiere estar, no desde donde la puso la pared: al principio de cada cuadro, y antes de cada arrastre, se le devuelve lo que la pared la corrió. Así la correa no aprende la distancia de cada pared, y al salir del túnel la cámara vuelve a la suya.
- **Lo que no la detiene:** lo que mueve la física (una pelota que pasa la haría saltar) y los personajes (otro jugador que camina detrás tuyo). Las consultas del mundo aprendieron a dejar afuera a los personajes (`characters: false`).
- **Una zona puede sugerir hacia dónde mirar:** su `view`, una dirección del mundo. Mientras el personaje está adentro, la cámara gira hacia ahí, más suave que `chase` cuando vuelve atrás del personaje, salvo que la acabes de girar a mano. Vale para cualquier zona que la tenga; el Dojo tiene una de ese tipo, `camera`.
- **Una sala nueva, `corridor`:** un túnel con techo, una vuelta a la derecha hacia una trinchera abierta al cielo, otra vuelta hacia un segundo túnel, y una sala al final. Paredes de 4,5 m, el paso de 1,6 m. En cada vuelta, una zona dice hacia dónde sigue el pasillo: la cámara gira, y W, que va hacia donde mira la cámara, gira con ella. Manteniendo W se llega al final.

## Hallazgos

| Hallazgo                                | Qué pasaba                                                                                                                                                                                             | Qué hicimos                                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **La correa aprendía la pared**         | La correa mantiene la distancia que tiene la cámara. Si la cámara se quedaba donde la puso la pared, después del túnel seguía cerca                                                                    | Lo que la pared la corre se le devuelve al principio de cada cuadro, y antes de cada arrastre o de la rueda                                                         |
| **Sin el arreglo, no quedaba adentro**  | Con paredes de 3 m, la prueba no encontraba la cámara adentro de una caja: estaba 12 cm por encima del techo del túnel, mirando su lado de arriba. El personaje no se veía, pero "adentro" no lo decía | La prueba pide además que no haya nada entre la cámara y la cabeza. Y las paredes del pasillo son de 4,5 m: sin el barrido, en las vueltas, la cámara queda adentro |
| **Una tecla enviada al documento**      | Desde una prueba, una tecla enviada al documento (no a un elemento) hacía fallar al que escucha las teclas: el documento no tiene `closest`. Una tecla de verdad siempre llega a un elemento           | Mira si es un elemento antes de preguntar si es un campo de texto                                                                                                   |
| **La 3g subió con un error del linter** | La masa calculada (`massOf`) usaba `**`, que es `Math.pow` y puede dar otros bits en otro navegador. La regla del linter lo dice desde la etapa 1f, y la integración continua de la 3g se detuvo ahí   | Productos. Las repeticiones de referencia no cambiaron de huella. Y antes de cada subida, la verificación entera después del último cambio                          |

## Medido

- **En el túnel:** la cámara a 2,75 m (el techo, a 3, menos los 25 cm de la esfera) y a 3,3 m detrás del personaje, en vez de 3,6 m de alto y 5,5 detrás. En la trinchera, abierta, vuelve hacia su altura.
- **Manteniendo W**, el personaje recorre los 30 m del pasillo con sus dos vueltas y llega a la sala.
- **La prueba sin el barrido falla:** la cámara llega a estar adentro de una pared (a 0 cm). Con el barrido, nunca está a menos de 20 cm de una caja (los 25 de la esfera, redondeados al centímetro como los escribe la página), y en ningún cuadro hay algo entre ella y la cabeza.
- **Las pruebas:** sin pantalla, 355 (2 nuevas: el pasillo no parpadea, y escrito como texto se lee igual). En el navegador, 138 (2 nuevas: el pasillo de punta a punta, y su dirección en el sitio).

## Lo que sigue

La 3i: la interfaz del juego y los ajustes del jugador. Antes, la pregunta abierta del idioma de los juegos, porque la interfaz tiene palabras.
