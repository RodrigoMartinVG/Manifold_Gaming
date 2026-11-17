---
title: 'Etapa 4.5f: la ciudadela, un nivel que lleva el motor al límite'
description: 'El nivel que la 4.5 pedía antes de los juegos: tres pisos y doce salas hechas con 293 piezas del kit, con puertas de tres tamaños, una balsa, un ascensor, una lámpara que se rompe, un ojo y dos guardias. Su aspecto, con texturas que hace el mismo script del kit. Y lo que encontró en el motor: las luces, la navegación que atravesaba pisos, las consultas que recorrían todo el mundo y un guardia que preguntaba sin parar.'
sidebar:
  order: 50
---

> Informe de la etapa 4.5f, la última de la [4.5](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/ROADMAP.md) antes de sus dos decisiones y su cierre. El autor la pidió para saber dónde se detiene el motor antes de los juegos, no adentro de ellos.

## Qué hicimos

- **La ciudadela** (la sala "The citadel" del Dojo), toda con piezas del kit, en tres pisos.
  - Un patio, y en su rincón una caseta con su puerta de un metro: la abre un botón. Adentro hay un dardo, un palo y una caja.
  - Un portón de dos hojas que se abre mientras algo pisa una placa a 10 m. Corriendo desde la placa, se cierra antes de que llegues; la caja dejada encima lo sostiene.
  - Una sala de dos pisos de alto, con columnas y un guardia. Una escalera sube a una galería, y un botón abre su puerta doble.
  - Una balsa cruza un pozo a un piso de altura. Del otro lado hay un punto de control.
  - En la biblioteca, una lámpara alumbra la placa que vigila un ojo. Rompés la lámpara con una bola y la puerta se abre.
  - Un ascensor sube a los techos. Por dos puentes cruzás el pozo; en el techo de la sala hay otro guardia, y una rampa lleva a una plataforma desde la que un puente llega a lo alto de la torre: la meta.
- **Lo que el kit sumó:**
  - las hojas de puerta: una de un metro, dos para la puerta ancha y dos para el portón. Son solo modelos, porque una puerta es una caja que la simulación gira (decisión 0026);
  - una plataforma de un metro de alto.

  Una prueba comprueba que cada hoja llena su hueco.

- **Su aspecto:**
  - Cada uno de los cinco materiales del kit es una imagen de un metro de lado que se repite: piedra en hiladas, losas, una piedra más oscura, madera y metal.
  - Cada cara de cada pieza está mapeada un metro a esa imagen. Como las piezas se apoyan en una grilla de un metro, las piedras siguen de una pieza a la siguiente.
  - Las lámparas son faroles colgados de cadenas o sobre postes.
- **Medido.** Los límites del motor con este nivel, en Node y en el navegador. Su fila es la más pesada de las líneas base de la 4.5c (decisión 0025).

## Las texturas: periódicas por construcción

El plan era hornear las texturas desde los materiales de Blender. No sirvió.

- El ruido y los ladrillos de los nodos de Blender no son periódicos sobre una baldosa: el tinte de cada ladrillo depende de su índice, y el ladrillo que cruza el borde de la imagen cambia de color a la mitad.
- Cycles agrega su propio ruido de muestreo.

Las hace el mismo `art/kit.py`, con numpy:

- **El ruido:** sale de una red de valores al azar de $n \times n$ que se cierra sobre sí misma (los índices se toman módulo $n$), interpolada con $3f^2 - 2f^3$. Así es periódico de período 1 en cada eje.
- **Las piedras:** cada hilada se corta en lugares al azar tomados módulo 1, de modo que la piedra que cruza el borde es la última y la primera a la vez.

Con semilla fija, dos corridas dan los mismos bytes. Las cinco imágenes juntas pesan 41 KB y el archivo del kit, 368 KB. Dibujarlas no costó nada medible.

## Las luces: lo que cuesta un cuadro

Cada luz puntual que tiene three.js se calcula en cada píxel de cada material iluminado, esté donde esté la lámpara. Además, cada luz nueva recompila todos los materiales.

En la Iris Plus del autor, a 1280 × 720 y sin limitar los cuadros:

| Escena                                 | Cuadro      |
| -------------------------------------- | ----------- |
| El recorrido                           | 2,9 ms      |
| La ciudadela, con sus catorce lámparas | 9 a 10,5 ms |
| La misma ciudadela, con solo cuatro    | 5,5 ms      |

Eso da unos 0,4 ms por luz con la pantalla llena. Las llamadas de dibujo, en cambio, no pesan: con cuatro lámparas, la sala (250 llamadas) cuesta lo mismo que la biblioteca (101).

Ahora el dibujo tiene tantas luces como lámparas tenga el mundo, y seis como máximo. En cada cuadro se las da a las lámparas cuyo alcance ve la cámara, primero las más cercanas: se ordenan por $\max(0,\ |p - c| - r)$, la distancia de la cámara $c$ a la esfera de alcance de radio $r$ alrededor de la lámpara $p$. Todas las lámparas siguen brillando, y la luz de la simulación, con la que ve el ojo, sigue siendo la de todas.

Los cuadros de la ciudadela bajaron a 4,2–7,2 ms.

Dos cosas que no hicimos, con su porqué:

- **Instancias:** las llamadas de dibujo no son el cuello de botella; esperan a un nivel que se acerque al millar.
- **Luz horneada:** acá la luz es de la simulación, y una lámpara se apaga o se rompe; horneada, la luz se quedaría.

## La navegación que atravesaba pisos

Medida con la repetición de la ciudadela, la simulación pasaba de 0,15–0,35 ms por paso a 3,6 ms en promedio. El percentil 99 llegaba a 75 ms y el peor paso a 200.

Casi todo era lo que piensan los guardias: de 331 búsquedas de camino, 309 fallaban, y cada una tardaba hasta 73 ms. El guardia del techo intentaba ir a "mirar" un ruido del patio. La navegación decía que había camino, y lo había, pero falso: una caída desde el techo de la sala hasta el piso de la sala, justo debajo, atravesando el techo.

Una caída, un salto o una trepada van hasta la columna vecina y suben o bajan por la más baja de las dos. La navegación comprobaba el primer tramo (una cápsula barrida a la altura de la celda alta) y nunca el segundo. Con pisos apilados queda a la vista.

Ahora pregunta también eso: una cápsula un poco más delgada que el cuerpo sube por la columna de la celda baja, desde su altura hasta la de la alta, y no tiene que tocar nada. La respuesta se guarda por par de celdas, como las otras. En la ciudadela, la mitad de las aristas eran de esas: de 65.100 quedaron 32.428.

Después aparecieron dos cosas más:

- **Las consultas espaciales recorrían todo el mundo dos veces:** una para dejar afuera a los personajes, otra para saber de quién era el cuerpo tocado. Con 357 entidades y 200 consultas por paso mientras se construye la navegación, eso dominaba. Ahora el mundo tiene un índice de cuerpo a entidad, actualizado donde los cuerpos aparecen y desaparecen. Las respuestas son las mismas.
- **Un guardia sin camino preguntaba en cada paso:** el de la sala, por un ruido detrás del portón cerrado. Ahora recuerda dónde no encontró camino y no vuelve a preguntar por el mismo lugar durante un segundo y medio.

La navegación aprendió algo más: si quien busca no tiene, con lo que puede hacer, ninguna arista que una su celda con la meta, no hay camino, esté abierto lo que esté abierto. Las partes son las componentes conexas del grafo, tomando cada arista en ambos sentidos y sin mirar puertas ni ascensores: una cota segura. La pregunta se contesta al instante, sin recorrer cada celda alcanzable.

Con todo esto, el paso quedó en 1,2 ms en promedio, 4,7 en el percentil 99 y 23 como máximo.

## Hallazgos

| Hallazgo                                | Qué pasaba                                                                                                        | Qué hicimos                                                                           |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Las lámparas, el costo**              | Cada luz puntual se calcula en cada píxel; catorce llevaban el cuadro de 5,5 a 10 ms                              | Seis luces como máximo, para las lámparas que ve la cámara                            |
| **Caídas a través de pisos**            | La navegación comprobaba el tramo horizontal, no el vertical: la mitad de las aristas de la ciudadela eran falsas | La columna baja, libre entre las dos alturas                                          |
| **Consultas que recorrían todo**        | Dejar afuera a los personajes y encontrar la entidad tocada recorrían todas las entidades en cada consulta        | Un índice de cuerpo a entidad en el mundo                                             |
| **Un guardia que preguntaba sin parar** | Sin camino a un ruido, volvía a buscarlo en cada paso                                                             | Recuerda dónde no hay camino, un segundo y medio                                      |
| **El duelo, parejo**                    | Con el palo, el guardia bloquea cada golpe tuyo y vos los suyos: gana el que golpea primero, por un pelo          | La caseta ofrece también un dardo, que el guardia no bloquea; con eso juega la prueba |
| **El ojo, ciego al plato**              | El ojo quedaba casi encima de la placa, 58° debajo de su eje, con un campo de ±35°                                | Más bajo, y la placa más lejos: 22°                                                   |
| **Mi medida, no el motor**              | Medí la instantánea en 5,6 MB: `JSON.stringify` de un `Uint8Array` escribe cada byte como una clave               | La instantánea real: 475 KB de física y 259 KB de entidades, en 2 ms                  |

## Medido

|                                                | La ciudadela                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Piezas, cuerpos, guardias                      | 293 piezas del kit, 325 cuerpos, 357 entidades, 2 guardias                                              |
| El paso (media, percentil 99, máximo)          | 1,2, 4,7 y 23 ms (antes: 3,6, 75 y 200)                                                                 |
| La navegación                                  | 4.370 celdas, 32.428 aristas; 0,57 s de una vez, o 277 pasos sin ninguno de más de 20 ms                |
| El hash                                        | 5,7 ms                                                                                                  |
| Una instantánea, o lo que recibe quien se une  | 475 KB de física y 259 KB de texto (22 KB comprimidos), en 1,9 ms                                       |
| El primer paso, una vez                        | 0,14 a 0,3 s: antes del primer paso de la física, ningún cuerpo está todavía en las consultas de Rapier |
| El dibujo (Iris Plus, 1280 × 720, sin limitar) | 4,2 a 7,2 ms por cuadro; 97 a 277 llamadas; 7.800 a 19.600 triángulos                                   |
| La partida de la prueba                        | 61 s de juego; su repetición, 17,8 KB (4,6 KB en un enlace)                                             |
| Determinismo                                   | El mismo hash en Chromium, Firefox y WebKit: la repetición de la ciudadela es de referencia             |

## Lo que sigue

Las dos decisiones antes de la fase 5 (la música y los controles táctiles) y el cierre de la 4.5. Entre lo que el cierre revisa ahora está lo que el autor notó jugando: ruidos que no paran, de una caja agarrada que, contra una pared, queda rebotando.
