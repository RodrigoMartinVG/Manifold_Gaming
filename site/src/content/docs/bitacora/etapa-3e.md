---
title: 'Etapa 3e: lo que se rompe'
description: 'La demostración de la fase: una pelota tirada a una lámpara la rompe, su luz se apaga y el observador que veía al personaje lo pierde. Lo que se rompe va en capas: en el motor, si está roto, un umbral por la energía del golpe y unas pocas piezas grandes, todo en el hash; la rotura es un evento con una semilla; y los fragmentos son del dibujo, con su propio mundo de física, que nadie hashea.'
sidebar:
  order: 28
---

> Informe de la etapa 3e, la quinta de la fase 3, y su demostración: **romper una lámpara cambia lo que ve un observador.**

## Qué hicimos

- **Lo que se rompe, en capas.** En el motor, y en el hash: si está roto, y la energía de un golpe que lo rompe (un umbral, en joules: la mitad de la masa por la velocidad al cuadrado de lo que mueve la física, como venía). Se mira en una fase propia, justo después de la física, antes de que se lean las velocidades que dejó el golpe. Roto, su cuerpo se va (ya no choca), y salen de donde estaba unas pocas piezas grandes que mueve la física: una cada 20 cm de su lado más largo, entre 2 y 6. Una caja desaparece salvo por ellas; una lámpara queda, apagada.
- **La rotura es un evento**, con una semilla que sale del azar del mundo: dónde, qué la rompió y con cuánta energía.
- **Los fragmentos son del dibujo.** Con esa semilla, la presentación hace un puñado de pedacitos que vuelan, caen y rebotan en un mundo de física propio, con las cajas fijas del nivel para chocar. Ningún rayo del juego los ve, nadie los hashea, y se van en dos segundos y medio. Como salen de la semilla, son los mismos en cada copia de la partida.
- **Una lámpara entera y rota en un mismo modelo**, hecho por un guion (`art/lamp.py`, Blender sin pantalla): un foco bajo una tapa de metal, en una jaula. Tiene dos nodos, `whole` (el foco) y `broken` (unos vidrios que quedan en el portalámparas), y la presentación muestra uno u otro según esté. Brilla solo su vidrio, mientras está prendida.
- **El formato de nivel, versión 5.** `breaks` en una caja o una lámpara, y `model` en una lámpara. Una lámpara que se rompe tiene un cuerpo chico, para que algo la golpee.
- **La demostración**, en la sala del observador: una lámpara sobre un poste, a la altura del pecho. A su luz, el ojo te ve; una pelota tirada a ella (F) la rompe, su luz se apaga y el ojo te pierde. La repetición de referencia de la luz la tiene de punta a punta.

## Hallazgos

| Hallazgo                                             | Qué pasaba                                                                                                                                                                                         | Qué hicimos                                                                                                                                                                                                                             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **La energía, con la velocidad de antes**            | Después del paso de la física, la pelota ya rebotó: su velocidad es la de después del golpe                                                                                                        | La rotura se mira antes de leer las velocidades de vuelta: la pelota todavía tiene la que traía. Una prueba deja caer la misma pelota desde 0,5 m (0,16 J: no rompe) y desde 2 m (0,66 J: rompe), y la energía medida es la de la caída |
| **Una lámpara a 3 m no se alcanza**                  | La pelota sale del pecho, a 9 m/s hacia adelante y 2,5 hacia arriba: sube 32 cm. Ninguna lámpara colgada se rompe así                                                                              | La lámpara que se rompe está sobre un poste, a 1,5 m. Para las de arriba hay que saltar y tirar en lo alto del salto                                                                                                                    |
| **El modelo de la lámpara no salía igual dos veces** | Dos corridas del guion daban bytes distintos. El maniquí y la puerta no: lo que cambiaba era el orden de los índices de la esfera del foco, que el exportador de Blender escribe distinto cada vez | Un icosaedro subdividido en vez de la esfera de meridianos: tres corridas, los mismos bytes                                                                                                                                             |
| **Que brille solo el vidrio**                        | La luz de una lámpara prendía todo su dibujo; con el modelo, también la tapa y la jaula                                                                                                            | Si el modelo tiene un material `glass`, brilla solo ese; si no, todo, como las bolas de antes                                                                                                                                           |

## Medido

- **El umbral:** una pelota de 20 cm de radio (0,0335 kg) sobre una caja que rompen 0,3 J: desde 0,5 m, 0,16 J, no rompe; desde 2 m, 0,66 J, rompe. Tres piezas de un tercio de su lado, que caen y quedan en el piso.
- **Lo mismo dos veces:** el mismo mundo se rompe igual: la misma semilla, las mismas piezas, el mismo hash, también desde una instantánea de antes del golpe.
- **Fuera del hash:** en el navegador, con los fragmentos todavía volando, la repetición de la página se reproduce en Node hasta el mismo hash.
- **Las repeticiones de referencia** cambiaron de huella. La simulación pasó a la versión 19.
- **Las pruebas:** sin pantalla, 338 (7 nuevas: lo que se rompe y lo que no, sus piezas, que se rompa igual, la lámpara que se apaga, el formato 5, el modelo de la lámpara, la demostración en la sala). En el navegador, 134: la demostración, con los fragmentos volando y el hash de Node.

## Lo que sigue

La 3f: el sonido. Lo que hacen oír los eventos de la simulación: pasos según el material del piso, golpes según su energía, una lámpara que se rompe. Cada sonido tiene también un radio en la simulación, para que lo oiga el guardia de la fase 4.
