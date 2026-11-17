---
title: 'Etapa 4b: lo que puede hacer un cuerpo'
description: 'El personaje apunta hacia arriba y hacia abajo aparte de hacia dónde mira, se agacha y pasa por donde parado no cabe, rueda, y tira más lejos cuanto más carga el tiro. Lo que un guardia va a leer de él: se lo ve menos y se lo oye menos agachado. Y la primera mezcla de poses propia: la inercia, donde el fundido cruzado daba un tirón.'
sidebar:
  order: 39
---

> Informe de la etapa 4b, la segunda de la [fase 4](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/ROADMAP.md). La 4a le dio un cuerpo al personaje; esta le da lo que ese cuerpo puede hacer, y lo que los guardias de la 4e van a leer de él.

## Qué hicimos

- **Apuntar con inclinación.** Una entrada más, `pitch`: hacia arriba o hacia abajo, en fracciones de un cuarto de vuelta (centésimos: 0,9°). El personaje la guarda en grados, en la huella, y `aimOf` da hacia dónde apunta, con el seno y el coseno de la simulación (los mismos bits en todos los navegadores). La cámara `aim` la manda junto con hacia dónde mira. La pelota del Dojo sale hacia donde apunta. El cuerpo lo muestra, solo en la vista: el pecho se inclina un 30 % y la cabeza el resto, así el visor mira justo hacia donde apunta.
- **Agacharse**, un modo y una capacidad (`crouch`: la C, o apretar el stick derecho). Va más lento, y el controlador mueve el cuerpo agachado (la pose de colisión, que son datos desde la 2e: 1,1 m para el maniquí), así pasa por un hueco bajo. Se para solo donde su cuerpo parado cabe: debajo del hueco sigue agachado hasta salir. La luz y la vista llegan a su centro, más bajo, y un vigía necesita el doble de luz para verlo; sus pasos se oyen a la mitad de distancia (el ruido por postura que tomó la decisión 0000). Sus animaciones, hechas sin pantalla como las demás, salen de los caminos de los pies, como las de caminar.
- **Rodar**, otro modo y otra capacidad (`roll`: la V, o el gatillo izquierdo). Se esquiva 3 m en 0,6 s, hacia donde se le pide ir, mirando hacia ahí mientras rueda; bajo, así que rueda por debajo de un hueco, y si termina debajo, sigue agachado. Su estado son datos: los pasos que le quedan y hacia dónde va. La vista toca su animación (una voltereta en el piso) según cuánto de la rodada pasó, leído de la simulación.
- **La fuerza de un tiro.** Apretada, la F del Dojo carga el tiro; al soltarla, la pelota sale: un toque, a 9 m/s, como siempre; un segundo apretada, a 16. El núcleo tiene `released` junto a `pressed`. El HUD muestra la carga mientras se llena.
- **Una sala nueva del Dojo, `moves`:** un pasaje de 1,15 m de alto, un vigía y su lámpara, y un blanco a 15 m: un tablero con una placa adelante y una lámpara que se prende para siempre cuando una pelota llega.
- **La inercia, para los gestos.** Lo que hay que mezclar al pasar de una animación a otra se midió primero (abajo). Donde el fundido cruzado daba un tirón (el aterrizaje), la pose nueva se dibuja de una vez, y lo que la separa de la que se veía se apaga solo.
- **Una repetición de referencia de la fase 4**, que crece con ella: tiros apuntados, el pasaje parado y agachado, el vigía, dos rodadas, el tiro cargado. Da la misma huella en Node, Chromium, Firefox y WebKit.

## La inercia, con números

Una mezcla cruzada (_cross-fade_) junta las dos animaciones durante un rato. Larga, la nueva llega tarde: las rodillas de un aterrizaje, que tienen que ceder enseguida, cederían una décima después. Corta, el cuerpo da un tirón. La inercia, en cambio, dibuja la pose nueva enseguida. Para cada hueso, lo que la separa de la pose que se veía es un giro alrededor de un eje, y su ángulo $x(t)$ se apaga solo: sale de $x_0$ con la velocidad que tenía ($v_0$, de las dos últimas poses dibujadas) y llega a 0 en un tiempo $t_1$, sin velocidad ni aceleración. Son seis condiciones ($x$, $x'$ y $x''$ en los dos extremos), y el polinomio de menor grado que las cumple es uno de grado cinco:

$$x(t) = x_0 + v_0 t + \tfrac{a_0}{2} t^2 + C t^3 + B t^4 + A t^5, \qquad a_0 = \frac{-8 v_0 t_1 - 20 x_0}{t_1^2},$$

con $a_0$ elegido para que no se pase de 0, como lo hace la inercia de David Bollo. Si ya se estaba achicando rápido, $t_1$ es más corto; nunca más de 0,2 s.

## Hallazgos

| Hallazgo                                     | Qué pasaba                                                                                                                                                                                                                                                     | Qué hicimos                                                                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **CI en rojo por una prueba sin tipos**      | La prueba de las manos de la 4a daba una caja como literal de solo lectura; vitest no revisa tipos, y el chequeo de tipos que corrí fue antes de escribirla                                                                                                    | Arreglada y subida aparte                                                                                                                       |
| **Una mano en la pared no llegaba al borde** | Al llegar arriba, una mano que todavía se agarraba de la pared la soltaba tarde, y para entonces el borde quedaba fuera de su alcance. Que las dos manos llegaran al borde dependía del ritmo de los cuadros: la prueba de la torre falló con otra compilación | Una mano en la pared pasa al borde en cuanto lo alcanza, en 0,15 s y no de golpe                                                                |
| **El colisionador nuevo, en el lugar viejo** | Rapier mueve un colisionador con su cuerpo recién en su paso siguiente: el cuerpo agachado quedaba un paso colgando 30 cm, y el personaje alternaba entre agachado y en el aire                                                                                | Se lo pone en su lugar del mundo enseguida, y una prueba mira que siga agachado en cada paso                                                    |
| **El agachado entraba en el piso**           | El primer agachado, con la espalda a 45° y la cadera 0,4 m abajo, metía una rodilla 2 cm en el piso, y la cabeza sobresalía del cuerpo agachado                                                                                                                | La espalda a 55°, la cadera 0,3 m abajo, y la pose de colisión del personaje de 1,1 m, con su cabeza adentro; una prueba lo mira en cada cuadro |
| **El modelo, lleno de lo que no cambia**     | El exportador escribe la posición y el tamaño de cada hueso en cada animación: 528 canales que nunca cambian, y el archivo pasó su presupuesto (307 KB)                                                                                                        | El script del arte lo compacta después de exportar: 228 KB, con los giros intactos                                                              |
| **Un salto pedido rodando**                  | Un salto pedido a mitad de la rodada esperaba al final, por más temprano que se hubiera pedido                                                                                                                                                                 | Se guarda sus 6 pasos de siempre, también rodando                                                                                               |
| **Pararse a apuntar dobla por la cintura**   | Repartida la inclinación con el pecho al 40 %, apuntar bien arriba arqueaba al maniquí hacia atrás como bajo una vara: su torso es una pieza que gira en la cintura                                                                                            | El pecho toma el 30 % y la cabeza el resto, como en una persona (la nuca se extiende hasta unos 60°)                                            |

## Medido

- **El agachado:** desde el primer paso agachado, en cada paso; una viga a 1,05 m frena al personaje parado y no al agachado; debajo de ella sigue agachado hasta salir; una instantánea tomada debajo de la viga sigue igual que el mundo del que salió. Sus pasos se oyen a la mitad. Un vigía lo ve parado a más de 4,5 m de su lámpara, y agachado, a menos de 2.
- **El maniquí agachado:** adentro de su cuerpo agachado en cada cuadro de sus cinco animaciones; las rodillas, por lo menos 8 cm sobre el piso; el pie apoyado no se desliza a 2 m/s, en siete direcciones.
- **La rodada:** sus 36 pasos, hacia donde se pidió, mirando hacia ahí, y después como se le decía; no desde el aire, no dos veces, no sin la capacidad.
- **El tiro cargado:** sobre la puntería, un toque a 9 m/s, medio segundo a 12,4, un segundo a 16 (y siempre 2,5 m/s arriba de ella). Un toque cae antes del blanco; un segundo, apuntando un poco arriba, llega.
- **Las transiciones** (la velocidad de giro de cada hueso, comparada con la más rápida de sus propias animaciones): caminar a agacharse y de vuelta, 0,86; quieto a correr, 0,81; una rodada, la de la rodada misma; la voltereta en el aire, 1,03. El aterrizaje desde la caída, con el fundido de 0,05 s: 1495°/s, el doble de su propia más rápida (815). Con la inercia, 674. El comienzo de la voltereta, en cambio, sube a 1,25 veces su mitad: lo que se apaga se suma a su giro.
- **Las pruebas:** sin pantalla, 537 (26 nuevas en la etapa); en el navegador, la misma huella en tres navegadores, y agacharse por el pasaje, rodar, la carga en el HUD.

## Las lecciones que ahora tienen dónde apuntar

- **2.7, entradas:** `pitch` como eje en centésimos, y un borde nuevo, `released`, para lo que se carga.
- **5.4, modos de moverse:** agacharse y rodar como modos, con su prioridad: rodando, se rueda; bajo y sin lugar, agachado.
- **5.7, capacidades como datos:** `crouch` y `roll`, que un juego da o quita.
- **6.8, la luz como lógica, y la vista:** la luz y la vista que llegan al centro del cuerpo agachado, y la postura en el umbral.
- **6.10, el sonido sale de los eventos:** el ruido de los pasos por postura.
- **1.16, apuntar:** la puntería con inclinación, con el seno y el coseno de la simulación.
- **5.13, clips y mezclas:** el fundido cruzado medido, y la inercia donde no alcanzaba.

**Lo que no hicimos como decía el plan:** el plan mostraba al vigía del torreón viendo tarde a un personaje agachado. Lo mostramos en la sala `moves`, que se puede medir sola; en el torreón también se puede agachar, y su vigía lee igual la postura.

## Lo que sigue

La etapa 4c: la salud, el daño y las armas. Primero una decisión, la de los golpes y la historia de las poses: qué es una pose, cuántos pasos guarda el anillo, hasta cuándo mira hacia atrás el servidor.
