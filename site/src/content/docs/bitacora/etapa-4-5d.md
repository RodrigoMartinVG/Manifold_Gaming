---
title: 'Etapa 4.5d: la cámara, antes de los niveles'
description: 'Cuatro arreglos de la cámara antes de construir niveles: la correa que retrocede sin girar cuando el personaje viene de frente, la persecución que vuelve detrás de hacia donde va, una cámara que sube por encima de los muros donde no hay techo, y fijarse en alguien con los dos a la vista.'
sidebar:
  order: 48
---

> Informe de la etapa 4.5d, la cuarta de la [4.5](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/ROADMAP.md). Los niveles de la fase 5 se van a construir mirando por esta cámara, así que va primero.

## Qué hicimos

- **`follow`, de frente sin girar.** La correa sigue al personaje como un remolque: mantiene su distancia y gira de a poco cuando él va hacia un costado. Caminando casi derecho hacia la lente, cualquier paso apenas de lado la hacía girar, y con ella hacia dónde va la S. Ahora, dentro de 15° de ir derecho hacia ella, la correa es una barra rígida que retrocede sin girar.
- **`chase`, detrás de hacia donde va.** Volvía detrás de hacia dónde mira el personaje, así que girar en el lugar la arrastraba alrededor. Ahora vuelve detrás de su velocidad, tanto más rápido cuanto más rápido va (hasta el paso de correr): girando en el lugar se queda, y caminando hacia atrás también.
- **Por encima de los muros.** En los pasillos estrechos (la 3k lo encontró en el laberinto) la cámara se metía hasta la espalda del personaje. Ahora, en `follow` y `chase`, si un muro la acerca y arriba de la cabeza no hay techo (nada a 8 m), sube hasta el ángulo más bajo desde el que ve la cabeza, de a 10° y hasta 80°: rápido al subir, despacio al bajar. Un muro de 3 m a un metro detrás pide 63°: la cámara mira casi desde arriba, como hacen los juegos en lugares estrechos.
- **Fijarse en alguien, los dos a la vista.** La 4f hizo que el personaje mire al otro, pero no la cámara. Ahora, fijado, la cámara va detrás del personaje, del lado opuesto al otro, y mira un poco hacia él (un 35% del camino entre las dos cabezas).
- **Para las pruebas**, la página escribe también hacia dónde mira la cámara (`data-look`).

## El remolque

La correa es un remolque de un solo eje: si el personaje pasa de $\mathbf{P}$ a $\mathbf{P}'$ y la cámara estaba en $\mathbf{C}$ (en el plano del piso),

$$\mathbf{C}' = \mathbf{P}' + L\,\frac{\mathbf{C} - \mathbf{P}'}{\lVert \mathbf{C} - \mathbf{P}' \rVert},$$

y la dirección de la cámara gira lo que el paso tiene de lado: un paso $\mathbf{d}$ que forma un ángulo $\alpha$ con la dirección hacia la cámara la hace girar unos $\lVert \mathbf{d} \rVert \sin\alpha / L$. Yendo de frente, $\alpha$ es chico pero no cero, y la S (que va hacia la cámara) gira con ella: lo que gira la cámara cambia hacia dónde va el próximo paso. Dentro del cono de 15°, el giro se corta: $\mathbf{C}' = \mathbf{P}' + L\,\hat{\mathbf{u}}$, con $\hat{\mathbf{u}}$ la dirección de antes.

## Hallazgos

| Hallazgo                                  | Qué pasaba                                                                                                                                             | Qué hicimos                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| **No subía lo suficiente**                | La primera búsqueda iba de a 10° hasta 70° y se salteaba el último intento: un muro de 3 m a un metro pedía 63° desde los 22° de partida, y no llegaba | Hasta 80°, con el último intento justo en el tope                                     |
| **Una prueba que miraba en un paso fijo** | La persecución se acomoda con el reloj; con la máquina cargada, 120 pasos del mundo no le alcanzaban                                                   | La prueba espera a que esté detrás                                                    |
| **La primera persona no debe subir**      | La cámara de primera persona es la de apuntar puesta en los ojos: si subiera sobre un muro, miraría hacia abajo                                        | Subir sobre los muros y el encuadre de fijarse en alguien, solo en `follow` y `chase` |

## Medido

- **De frente:** con el stick hacia la cámara y un poco de costado (11°), la cámara gira menos de 2° en un segundo; 31° de costado, gira más de 3°.
- **Persiguiendo:** girando en el lugar, menos de 5°; caminando, detrás de hacia donde va en menos de 25°.
- **Un muro de 3 m a un metro detrás:** la cámara a 7 m de altura mirando abajo, antes metida a 0,85 m de la espalda.
- **Fijado en el guardia del duelo:** los dos a menos de 30° del centro de la vista.
- **Las pruebas:** sin pantalla, 637; en el navegador, las cuatro, y las de apuntar y la primera persona como antes.

## Lo que sigue

La etapa 4.5e: el kit de piezas de nivel, hecho por un script de Blender.
