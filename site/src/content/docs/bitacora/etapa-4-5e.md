---
title: 'Etapa 4.5e: el kit de piezas de nivel'
description: 'Las piezas con las que los tres juegos van a construir sus niveles: 23, hechas por un script de Blender sin pantalla, cada una una malla y las cajas con las que choca, salidas de las mismas líneas. Un nivel pone una con una línea (`kit wall_door -2 0 -12`), y una sala nueva del Dojo las muestra todas.'
sidebar:
  order: 49
---

> Informe de la etapa 4.5e, la quinta de la [4.5](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/ROADMAP.md). Antes del nivel que lleva el motor al límite (4.5f), las piezas con las que se construye.

## Qué hicimos

- **Una decisión primero, la [0026](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0026-a-levels-look.md): cómo se engancha el aspecto de un nivel a sus datos.** Una pieza del kit es una malla del modelo del kit y las cajas con las que choca, en su propio marco: una caja puede ir girada dentro de la pieza, como la de una rampa. Las dos cosas salen del mismo script, así que lo que se dibuja y lo que choca no pueden separarse. El plan la ponía en la 4.5f; el kit la necesitaba antes.
- **El kit, por script** (`art/kit.py`, `npm run art:kit`): 23 piezas.
  - pisos de 1, 2 y 4 m;
  - muros de 1, 2 y 4 m, de 3 m de alto, y con un hueco de puerta, uno ancho, un portón y una ventana;
  - una esquina, un pilar y una columna;
  - escaleras de un metro y de un piso, una rampa;
  - una baranda, un puente, una viga, una losa elevada, un techo, una cornisa y un bloque.

  Cada caja se dibuja como ella misma, con las aristas biseladas, más lo que la hace leerse como lo que es: el zócalo y el remate de un muro, el filo oscuro de un escalón, las ocho caras de una columna, los parantes de una baranda. Cuatro materiales y ninguna textura todavía: 3.516 triángulos el kit entero, 440 la pieza más grande. Dos corridas dan los mismos bytes.

- **Un paquete nuevo, `@manifold/kit`:** el catálogo (las cajas de cada pieza, leídas de lo que el script escribió al lado del modelo) corre sin pantalla, y el modelo es de la presentación. La presentación carga un archivo una sola vez y toma cada pieza de su nodo (`kit.glb#wall_2`).
- **El formato de nivel 9:** `kit wall_door -2 0 -12 rotate y 90 name puerta_oeste`. Construye un cuerpo que nunca se mueve, sus cajas como un solo compuesto, dibujado con el modelo de la pieza. La consola lo agrega (`add kit block_1 0 0 10`) y el nivel se vuelve a escribir igual. El juego le da al lector su kit, como le da sus zonas.
- **Una sala nueva del Dojo, "The kit":** las 23 piezas, las escaleras de un piso hasta una plataforma a 3 m, la rampa y el puente.

## La escalera y la grilla

La navegación (0024) muestrea una celda cada 0,5 m, y un escalón del kit sube 0,2 m en 0,4 m de profundidad. Entre dos celdas vecinas cae a veces un escalón y a veces dos: 0,2 m o 0,4 m de diferencia. El personaje sube un paso de hasta 0,35 m (`STEP_UP`), así que la navegación marcaba esos 0,4 m como un salto, aunque el personaje sube la escalera caminando, de a un escalón.

Ahora, cuando la diferencia entre dos celdas está entre uno y dos pasos, la navegación pregunta por el piso a mitad de camino. Si cada mitad entra en un paso, es caminar. Con escalones de alto $h \le$ `STEP_UP` y profundidad $d$, entre dos puntos a distancia $c = 0{,}5$ m hay a lo sumo $\lceil c/d \rceil = 2$ escalones, es decir $2h \le 2\,$`STEP_UP`: la prueba a mitad de camino alcanza para cualquier escalera que el personaje suba caminando.

## Hallazgos

| Hallazgo                                      | Qué pasaba                                                                                                       | Qué hicimos                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **La escalera, a saltos**                     | La navegación veía saltos de 0,4 m en una escalera que se sube caminando                                         | El piso a mitad de camino: si cada mitad es un paso, se camina                 |
| **La puerta ancha, angosta**                  | El hueco de `wall_door_wide` medía 0,8 m, menos que el de la puerta común (1 m); ninguna prueba medía los huecos | 2 m, y una prueba que mide cada hueco: las dos puertas, el portón y la ventana |
| **La escalera de un piso, sobre presupuesto** | Quince escalones biselados eran 840 triángulos, sobre los 600 de la decisión                                     | Los escalones sin biselar, con su filo: 360                                    |
| **Un JSON para Node**                         | Las pruebas del navegador cargan el Dojo en Node, que pide declarar el tipo de un JSON importado                 | `with { type: 'json' }`, que Vite también entiende                             |
| **Un juego no importa a otro**                | El linter tomó el kit por otro juego                                                                             | El kit, entre los paquetes del motor que un juego puede usar                   |
| **Partes giradas dentro de un compuesto**     | Un compuesto se corta para que sus partes se toquen cara a cara; una parte girada no se puede cortar así         | Un compuesto con partes giradas queda como es                                  |

## Medido

- **El kit:** 23 piezas, 3.516 triángulos, 4 materiales, 245 KB.
- **La sala del kit:** 29 piezas, 5.340 triángulos dibujados en 60 llamadas.
- **Caminado:** hasta la plataforma a 3 m por la escalera, por la rampa hasta la de un metro, y a lo largo del puente.
- **Las pruebas:** sin pantalla, 653 (16 nuevas); en el navegador, la sala con cada pieza dibujada con su modelo.

## Lo que sigue

La etapa 4.5f: un nivel que lleva el motor al límite, construido con este kit, y después su aspecto hecho con Blender.
