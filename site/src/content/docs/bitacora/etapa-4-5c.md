---
title: 'Etapa 4.5c: las repeticiones, los fantasmas y las mediciones base'
description: 'Una decisión, la 0025: las repeticiones siguen siendo entradas, exactas y de su versión; los fantasmas pasan a ser tiras de poses, que se dibujan en cualquier versión sin simular un segundo mundo. Y las mediciones base, antes de los juegos.'
sidebar:
  order: 47
---

> Informe de la etapa 4.5c, la tercera de la [4.5](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/ROADMAP.md). Con la simulación de los juegos ya fija (4.5b), se decide qué hacer con las repeticiones y los fantasmas cuando el motor cambia, y se mide de dónde parte la fase 5.

## Qué hicimos

- **La decisión [0025](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0025-replays-ghosts-and-baselines.md).** Una repetición sigue siendo las entradas de una partida, exacta y comprobada contra su huella, y por eso solo se reproduce con la versión que la grabó. El sitio guarda solo su motor más nuevo, y las repeticiones de referencia se graban de nuevo cuando la simulación cambia a propósito. Un fantasma, en cambio, pasa a ser una tira de poses.
- **Los fantasmas, tiras de poses.** Hasta acá un fantasma era un segundo mundo, nacido como la repetición y alimentado con sus entradas: costaba tanto como el mundo de verdad, y cada versión nueva rompía todos los enlaces de fantasmas compartidos. Ahora la página graba, mientras jugás, dónde estabas, hacia dónde mirabas y cómo te movías, cada 6 pasos (diez veces por segundo). Las posiciones van al centímetro, hacia dónde mira a la décima de grado y la forma de moverse por su nombre. El fantasma se dibuja entre sus poses, con sus animaciones, sin simular nada: se ve igual en cualquier versión del motor y varios a la vez cuestan poco. No prueba nada: para eso está la repetición.
- **Como texto** (`# Manifold ghost 1`, un formato propio): su juego, la sala donde se grabó, su primera pose, y por cada pose siguiente cuánto cambió lo que cambió (la diferencia segunda). Caminando derecho o cayendo es la misma línea una y otra vez, y el deflate de un enlace la achica.
- **Los enlaces viejos de fantasmas**, que llevaban una repetición, se siguen corriendo: la página la juega una vez, sin pantalla, para sacar la tira de su jugador.
- **Las mediciones base**, en la decisión: el recorrido, la arena con tres guardias y la sala de estrés.
- **Las preguntas abiertas, al día:** dónde piensa un bot ya estaba resuelta por la 0023, y las repeticiones y los fantasmas entre versiones, por esta.

## La diferencia segunda

Si las posiciones de las poses son $x_0, x_1, x_2, \ldots$ (en centímetros enteros), lo que cambia de una a otra es $\Delta x_k = x_k - x_{k-1}$, y cuánto cambia eso es

$$\Delta^2 x_k = \Delta x_k - \Delta x_{k-1} = x_k - 2x_{k-1} + x_{k-2}.$$

Caminando a velocidad constante, $\Delta x_k$ es constante y $\Delta^2 x_k = 0$. Cayendo con gravedad constante, $x$ es una parábola en el tiempo, $\Delta x_k$ crece lo mismo en cada pose y $\Delta^2 x_k$ es constante: $g\,(6\,\Delta t)^2 \approx 9{,}81 \cdot 0{,}1^2 \approx 10$ cm. Las líneas se repiten, y el deflate de un enlace hace muy poco de ellas: con $\Delta x$ solo, un minuto pesaba 4,2 KB; con $\Delta^2 x$, 2,7 (cada 4 pasos) y 2,3 (cada 6). El redondeo al centímetro deja un ruido de $\pm 1$ en $\Delta^2$ cuando la trayectoria curva, y eso es casi todo lo que queda.

Leer la tira es sumar dos veces: $\Delta x_k = \Delta x_{k-1} + \Delta^2 x_k$, y $x_k = x_{k-1} + \Delta x_k$. Todo en números enteros, así que vuelve exacta.

## Hallazgos

| Hallazgo                             | Qué pasaba                                                                                                                                                                                                      | Qué hicimos                                                                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **El cero con signo, otra vez**      | Redondear $-0{,}001$ m al centímetro da $-0$, que se escribe "0" y se lee como $+0$: otros bits, y la tira no volvía igual                                                                                      | `\|\| 0` al cuantizar, como las entradas desde la 1c2                                                                                              |
| **El presupuesto de 2 KB**           | La propuesta decía cada 3 o 4 pasos, menos de 2 KB por minuto. Medido: cada 4, 2,7 KB; cada 8 recién entra, pero corta las esquinas de un esquive hasta 30 cm                                                   | Cada 6 (2,3 KB, 22 cm): los 2 KB eran una estimación                                                                                               |
| **Apuntar agranda las repeticiones** | Desde la 4.5a, hacia dónde mira viaja a la décima de grado: con el mouse moviéndose siempre, una entrada nueva por paso. 18 a 23 KB por 32 s apuntando, contra 4,8 KB por 30 s en los grados enteros de la 2.5c | Anotado en la decisión. Escribirlo como lo que cambió ahorraría de 20 a 40% (medido): para cuando los enlaces de partidas largas importen (fase 6) |
| **Una instantánea, mal medida**      | La primera medición pasó a JSON los bytes de la física: 5 MB para la sala de estrés                                                                                                                             | Como la cuenta el servidor: 547 KB                                                                                                                 |

## Medido

| Escena                  | Cuerpos, bots | Paso (promedio, p99, máximo) | Huella | Instantánea | Repetición, 32 s | Fantasma, 32 s |
| ----------------------- | ------------- | ---------------------------- | ------ | ----------- | ---------------- | -------------- |
| El recorrido, caminando | 20, 0         | 0,15; 0,56; 1,8 ms           | 0,7 ms | 43 KB       | 6,0 KB           | 1,5 KB         |
| El recorrido, apuntando | 20, 0         | 0,20; 0,59; 1,4 ms           | 0,5 ms | 44 KB       | 17,9 KB          | 0,7 KB         |
| La arena, tres guardias | 14, 3         | 0,32; 0,89; 1,2 ms           | 0,8 ms | 47 KB       | 23,4 KB          | 0,7 KB         |
| La sala de estrés       | 207, 0        | 0,35; 0,96; 1,6 ms           | 2,4 ms | 547 KB      | 6,0 KB           | 1,5 KB         |

En Node, en la máquina del autor. Los presupuestos que cuidan estos números en la integración continua siguen medidos contra el paso de Rapier, que no depende de la máquina.

**Las pruebas:** una tira como texto y de vuelta, dibujada entre sus poses, un minuto en menos de 2,5 KB; en el navegador, un enlace de fantasma con su tira, y uno viejo con una repetición.

## Lo que sigue

La etapa 4.5d: la cámara, antes de los niveles.
