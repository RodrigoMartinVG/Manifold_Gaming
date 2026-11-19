---
title: 'Etapa 5.5h: los juegos sobre una biblioteca'
description: 'La carrera de un nivel, los archivos por nombre y un conductor sin pantalla pasan a la biblioteca; las corrientes, al núcleo; la cámara la da el juego y no cada nivel; los nombres con dos sentidos, renombrados. Un juego de prueba es sus reglas, su nivel, sus palabras y su música, sin copiar un archivo. Las repeticiones de los cuatro juegos dan el mismo hash.'
sidebar:
  order: 76
---

> Informe de la 5.5h, después de la [5.5g](../etapa-5-5g/). Es la octava etapa de la [decisión 0033](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0033-the-shape-before-the-forest.md): que un juego nuevo (el bosque trae cuatro) sea sus reglas y sus niveles, y no nueve archivos copiados de otro.

## Lo que pedía

La auditoría encontró en los juegos once problemas (G1 a G11). Los que más pesan para un juego nuevo:

- **La carrera de un nivel, copiada en cada cartucho** (G1): el componente de la carrera, el `switch` de las zonas (caer al punto de control, tomarlo, la meta) cuatro veces, los jugadores que se unen al lado del primero tres veces, el aviso a un jugador cinco veces, y `* 60` escrito por `1 / STEP` en cinco lugares.
- **Un juego copiaba unos nueve archivos antes de escribir una regla** (G2): el glob de sus niveles, el de sus repeticiones, el arnés para jugarlo sin pantalla (`go`, `walkTo`, `step`)…
- **El Dojo tenía mecanismos que los juegos necesitan** (G5): las zonas que llevan lo que está en ellas (sus corrientes: el agua y el viento del bosque).
- **Canales que se mezclan** (G9): la cámara dicha en la receta de cada nivel (`view.camera steady` seis veces en la torre).
- **Nombres con dos sentidos** (G8): `FORTRESS` era el ajuste de la fortaleza y también el juego; `WALL`, lo mismo.

## Lo que hay ahora

### La carrera de un nivel, en la biblioteca (G1)

`@manifold/shell/run`, reglas sin pantalla (vigiladas como cualquier regla):

- `STEPS_PER_SECOND`, en lugar de `* 60`;
- `notice`, el aviso a un jugador con su clave y sus números;
- `followPlayers`: cada jugador de la partida sin personaje del juego recibe uno, 1,2 m a la derecha del primero por cada jugador; el que se fue lo pierde, salvo el que se queda (un muñeco de práctica, un bot), y sin el primero, ninguno si el juego lo pide;
- `byName`: los archivos de un glob por su nombre, para los niveles y las repeticiones (el glob se queda en el archivo del juego: Vite lo resuelve donde está escrito).

Cada juego mantiene la clave de su componente, sus palabras y **el orden en que hace las cosas**, del que dependen sus hashes. La torre, la fortaleza, la muralla y el Dojo ya lo usan. Tiene su versión (`shell 1`), y cada juego la nombra: la línea `rules` de las 21 repeticiones cambió, y ningún hash.

El linter tuvo que aprender una cosa: el shell es casi todo vista, y la regla que lo prohibía en las reglas de un juego tapaba también sus subrutas. Ahora prohíbe la página del shell por su nombre exacto, y deja pasar `@manifold/shell/run`. Lo comprobé en los dos sentidos.

### Un conductor sin pantalla (G2)

`@manifold/shell/drive`: una sesión nacida de la receta de un nivel, el personaje del jugador 1 conducido como lo haría una persona (`step`, `go`, `walkTo`, agachado si hace falta, `jump`), con los bots pensando antes de cada paso si el juego los tiene. Lo que es de un solo juego (las chimeneas de la torre, apagar una lámpara en la fortaleza, disparar en la muralla) sigue en el suyo. Los tres arneses de juego lo usan, con las mismas distancias y los mismos pasos: sus repeticiones son las mismas.

### Las corrientes, en el núcleo (G5)

`carryAlong(world, kind)`: la zona de la clase que el juego diga lleva lo que está en ella; a un personaje, parado en ella (o también en el aire, si es viento); lo que mueve la física, por el arrastre de su material. El Dojo la llama donde llamaba la suya, así que su hash no cambia.

### La cámara la da el juego (G9)

Un `Game` tiene `view`: las líneas de la vista que valen para todos sus niveles. La torre da `view.camera steady` y la muralla `view.camera first`, una vez cada una, y sus recetas de nivel ya no las repiten.

### Los nombres (G8)

El ajuste de la fortaleza es `FORTRESS_TUNING` y el de la muralla `WALL_TUNING`; `FORTRESS` y `WALL` son los juegos.

### Un juego de prueba (la condición de terminado)

Una prueba del shell define un juego entero dentro de sí: sus reglas (una caminata hasta una meta, pasando por un punto de control, con un vacío al costado), su nivel como texto, sus palabras en los dos idiomas y su música, sin un archivo propio ni nada copiado de otro juego. Lo juega el conductor hasta la meta, dice sus avisos en sus palabras, su música cambia de humor al terminar, y su repetición, escrita con el kit de las referencias, vuelve a dar su hash. Otro jugador que se une camina al lado del primero, y el que cae vuelve a donde empezó.

## Pruebas

- **Nuevas**: el juego de prueba, en dos: jugado sin pantalla hasta su meta, por su punto de control, dicho en sus palabras en los dos idiomas, con su música que cambia al terminar y su referencia que vuelve a dar su hash; y otro jugador que se une a 1,2 m del primero, y el que cae, que vuelve a donde empezó. `carryAlong` en el núcleo: quien está parado en una corriente va con ella y quien está al lado no, y una pelota rueda con ella; en el aire no la lleva, salvo que sea viento. Y el linter deja pasar `@manifold/shell/run` en las reglas de un juego (con la configuración de antes, esa prueba falla), y sigue prohibiendo `@manifold/shell`.
- **Lo que encontró una prueba nueva**: `carryAlong` tomaba `grounded` de unas opciones que podían no decirlo, así que `{}` la volvía viento. Ahora, si no lo dicen, es `true`.
- **Cambiadas**: las pruebas de la fortaleza y de la muralla importan su ajuste por el nombre nuevo.
- Las 21 repeticiones, grabadas de nuevo: su línea `rules` nombra `shell 1`, y ningún hash cambió.
- Pasan las 940 pruebas sin pantalla (`test:all`), la verificación de tipos, el lint y el formato, las 152 pruebas de navegador en Chromium y las 22 de Firefox y WebKit, con las 21 repeticiones dando la misma huella.

## Lo que queda

Esta etapa es más grande que lo que entró en ella. Lo que no hice, y por qué:

- **Los puntajes de cada juego** (G3): el resultado del shell sigue siendo el de la torre (pasos, estrellas, caídas), que la fortaleza y la muralla reinterpretan. Cambiarlo cambia el progreso guardado en el navegador de cada jugador: necesita su versión y su migración (decisión 0020), y es un cambio de diseño, no de forma.
- **Las armas desde tablas con opciones** (G4): `WEAPONS` y sus vecinas siguen siendo tablas globales, los guardias no tienen opciones, y la orbe y la lanza de fuego viven todavía en la biblioteca y no en la muralla. Moverlas sin cambiar un bit toca el mecanismo de las armas entero.
- **Los contratos de las armas probados en `arms`** (G6): siguen probándose a través de la muralla.
- **El generador de la aventura en la biblioteca** (G7), **recortar las superficies públicas** (G10) y **un registro de juegos para las páginas, las tarjetas y las referencias del sitio** (G11).
- **Las opciones del montaje agrupadas** (de la 5.5g).

Los dejo anotados para el bosque, que es quien los va a necesitar: G3 cuando sus juegos cuenten otras cosas, G4 cuando lleguen sus criaturas, G11 cuando se sumen sus páginas. Lo que sigue es el [cierre de la 5.5](../etapa-5-5-cierre/).
