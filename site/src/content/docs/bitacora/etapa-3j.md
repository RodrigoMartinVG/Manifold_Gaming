---
title: 'Etapa 3j: hacer niveles, y la consola que crece'
description: 'La consola construye: agrega lo que dice una línea de un nivel, copia, mueve, cambia valores y saca, y escribe el mundo de vuelta como nivel. Las recetas esperan pasos y revisan cosas, así que una receta es una prueba. Y el formato de nivel 7 dibuja mapas con caracteres, para los calabozos.'
sidebar:
  order: 33
---

> Informe de la etapa 3j, la décima de la fase 3. Una herramienta para hacer niveles sin esperar al editor de la fase 6, y lo que la 3k va a usar para los calabozos.

## Qué hicimos

- **Un mundo, escrito como nivel.** Cada cosa que construye un nivel guarda su línea como dato (`source`), y el mundo guarda el título, el comienzo y la luz ambiente del nivel (`origin`); los dos van en el hash y en las instantáneas. `level.export` escribe el mundo como nivel: lo que hizo su nivel, y lo que se agregó, copió, movió o sacó desde entonces. Guardado como archivo `.level`, se carga igual. `level.diff` dice qué cambió desde que nació, línea por línea.
- **La consola construye.** `add` agrega lo que dice una línea de nivel (`add box 0 1 -3  1 1 1  material wood  name caja`), leída en el contexto del mundo: sus nombres y sus señales se revisan contra lo que ya hay. `clone` copia lo que hizo una línea, corrido. `delete` saca una entidad. `set` cambia un valor de una entidad por su camino (`set caja transform.position 0 2 0`, `set lampara lamp.intensity 2`): lo que guarda la física pasa por el mundo (una posición, por `place`; una velocidad, con un empujón), y la línea de nivel de la entidad lo sigue. Son cambios del mundo como cualquier otro: entran en un paso, quedan en la historia de la sesión, y una repetición los juega igual en Node.
- **Valores relativos:** `+2` suma, `*0.5` multiplica, en las variables (`physics.gravity *0.5`) y en `set` (`+0 +1 +0`).
- **`inspect` que escribe:** abajo de lo que muestra, los `set`, `clone` y `delete` de esa entidad, para hacer clic, corregir y correr.
- **Recetas que esperan y revisan.** `wait 60`: lo que sigue corre 60 pasos después. `assert caja.transform.position.y < 1`: dice sí, o no y cuánto es (una variable, una señal, o un valor de una entidad, con `=`, `<`, `~`…). Una receta con `assert` es una prueba: cada sala del Dojo que tenga uno se juega sin pantalla, y sus revisiones tienen que dar sí. En un enlace, es una lección que se revisa sola.
- **El formato de nivel, versión 7: mapas dibujados con caracteres.** Un bloque `map` con una celda por carácter: `#` una pared, `.` piso, un espacio nada, y letras que su línea hace zonas. El motor lo convierte en tan pocas cajas como rectángulos lo cubren. Es lo que la 3k va a escribir a partir de una semilla.
- **Tres salas:** el patio (`yard`, un piso donde construir), el taller (`workshop`, construido sobre el patio desde la consola, que se revisa solo), y el laberinto (`maze`, dibujado como texto).
- **Un script de Blender para geometría libre** quedó sin hacer: ningún nivel la pidió todavía.

## Hallazgos

| Hallazgo                                           | Qué pasaba                                                                                                                                                                                                    | Qué hicimos                                                                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **En la página, `add "box …"`**                    | Un cambio del mundo viaja como texto. El resto de la línea iba entre comillas, y el servidor de la página, que lo lee de nuevo, recibía `"box`. En Node no se veía: ahí la sesión aplica el cambio sin leerlo | El resto de una línea va como está, sin comillas. Una prueba lo pide de la historia de la sesión                                                                       |
| **`wait` contaba pasos de la copia**               | En la página, lo que la receta manda va al servidor y vuelve uno o más pasos después. `wait 1` terminaba antes, y la línea siguiente no encontraba lo que se había agregado                                   | Un `wait` empieza a contar cuando entraron al mundo los cambios que se mandaron antes que él: la sesión avisa al registro cada vez que aplica uno. En Node da lo mismo |
| **Un color era un comentario**                     | En la consola, `#` hasta el final de la línea era un comentario: `add box … color #8a6a42` perdía su color                                                                                                    | `#` es comentario al empezar una línea o seguido de un espacio; un color, no                                                                                           |
| **Lo que se agrega está en el paso siguiente**     | `clone banco` justo después de `add … name banco` no lo encontraba: como todo cambio del mundo, entra en el paso siguiente                                                                                    | Una receta pone `wait 1` antes de usar lo que agregó, y la ayuda de `add` lo dice                                                                                      |
| **Un nombre repetido, con una línea que nadie ve** | `add` lee la línea al final del mundo escrito como nivel, y el error decía "the first, on line 7" de ese texto                                                                                                | "is already in the world"                                                                                                                                              |
| **El laberinto empezaba contra su pared**          | Detrás del personaje estaba el borde: la cámara (3h) se acercaba hasta su cabeza                                                                                                                              | El comienzo, más adentro de un pasillo                                                                                                                                 |

## Medido

- **Ida y vuelta:** los 8 niveles del Dojo, construidos y escritos de vuelta desde su mundo, dan el mismo nivel. El laberinto vuelve como sus cajas, que construyen otra vez el mismo mundo.
- **El laberinto:** 121 celdas, 37 entidades (16 paredes, 17 pisos, 4 zonas), en vez de 121.
- **El taller:** la página exporta exactamente el mismo texto que Node jugando la misma receta, y cargado como nivel por un Dojo que lo tiene, da el mismo nivel. `level.diff` muestra lo agregado y la copia.
- **Las repeticiones de referencia** cambiaron de huella (la línea de cada pieza va en el hash). La simulación pasó a la versión 22.
- **Las pruebas:** sin pantalla, 388 (26 nuevas: la construcción, exportar y leer de vuelta, los mapas y sus errores, `wait` y `assert`, los valores relativos, la ida y vuelta de cada nivel del Dojo, y las salas que se revisan solas). En el navegador, 145 (3 nuevas: el taller, y las direcciones de las dos salas nuevas).

## Lo que sigue

La 3k: guardar la partida, y empieza la aventura de acción. Antes, una decisión: el formato de la partida guardada y cómo se trae una vieja.
