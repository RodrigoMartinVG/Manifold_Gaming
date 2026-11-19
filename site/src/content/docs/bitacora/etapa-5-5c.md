---
title: 'Etapa 5.5c: las pruebas que escalan'
description: 'Cada juego tiene ahora la versión de sus reglas, y el cambio de un juego ya no reescribe las repeticiones de los otros. Las repeticiones de todos los juegos se juegan en los cuatro navegadores, no solo las del Dojo. Cada nivel se graba en su propio archivo, así que los niveles corren a la vez. Y hay un primer arnés para lo que la red va a necesitar: re-simular al personaje propio con los demás donde estaban.'
sidebar:
  order: 71
---

> Informe de la 5.5c, después de la [5.5b](../etapa-5-5b/). Es la tercera etapa de la [decisión 0033](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0033-the-shape-before-the-forest.md): las pruebas que sostienen todo lo demás, hechas para que alcancen cuando lleguen los cuatro juegos del bosque.

## Lo que pedía

Las repeticiones de referencia son la prueba más fuerte del proyecto: si la última línea da el mismo hash, el cambio no tocó nada. Pero tenían cuatro límites:

- **Una sola versión para todo.** La de la simulación iba por la 49, y cada cambio de un juego la subía y reescribía las 21 repeticiones de los cuatro juegos, aunque las de los otros dieran el mismo hash. También dejaba de funcionar cualquier enlace a una repetición que un jugador hubiera compartido, de cualquier juego.
- **La huella en los navegadores era solo la del Dojo.** Las 14 repeticiones de la torre, la fortaleza y la muralla se jugaban solo en Node: sus reglas nunca se comparaban en Firefox ni en WebKit.
- **Una lista a mano y cuatro copias.** El script que regraba las referencias nombraba cinco archivos a mano, y cada juego copiaba el mismo texto de encabezado y los mismos chequeos.
- **Un archivo de 109 segundos.** Vitest corre los archivos a la vez, pero las pruebas de un archivo una tras otra. Los cuatro niveles de la muralla en un solo archivo eran el piso de toda la suite.

## Versiones por partes

La versión de la simulación pasa a ser la **del motor**: lo que deciden el núcleo, su física y su aritmética. Sigue en 49. Cada juego declara ahora en su cartucho las versiones de sus reglas, por nombre: la suya y las de los paquetes de la biblioteca que usa.

- La torre: `tower 1`, `character 1`, `kit 1`.
- La fortaleza y la muralla, además, `arms 1`.
- El Dojo: `dojo`, `arms`, `character` y `kit`.
- La aventura: `adventure` y `character`.

Una repetición las escribe después de la versión del motor, en una línea `rules`:

```
# Manifold replay 49
rules arms 1 character 1 kit 1 wall 1
```

Y la rechaza solo el juego cuyas versiones difieren, diciendo cuál: «grabada por otras reglas: wall 1 (este juego juega wall 2)». Entonces un cambio en la muralla sube `wall` y regraba solo las repeticiones de la muralla. Un cambio en `arms` las regraba en los tres juegos que la usan, y ninguna más. Una repetición sin línea `rules` (anterior a esta etapa) se juzga, como antes, solo por la versión del motor, así que los enlaces que ya circulan siguen andando.

La red también lo verifica: el servidor manda las versiones en su bienvenida, y una página con otras reglas no se une a la partida, porque las copias se separarían.

Un test lee las reglas de cada juego y las de la biblioteca que usan, también a través de otros paquetes (`arms` usa `character`), y exige que sus versiones las nombren a todas. Lo probé sacándole `kit` a la torre: el test lo señaló.

## Un kit para las referencias

`@manifold/shell/references` reúne lo que cada juego copiaba:

- `referenceText`: el texto de una repetición, con sus versiones, qué es y quién la graba;
- `describeReferences`: una repetición para cada nivel, de este motor y de estas reglas, y cada una jugada de vuelta hasta el hash de su última línea.

**La convención:** las pruebas que graban las referencias de un juego viven en su carpeta `src/references/`, **un nivel por archivo**, y las que las juegan de vuelta en su `replays.test.ts`. `npm run references` regraba todo lo que hay en esas carpetas, sin lista a mano. Un test exige que cada archivo `.replay` tenga una prueba que lo grabe, y que cada juego con repeticiones las juegue de vuelta.

Las 21 se regrabaron una vez: cambió su encabezado (la línea `rules` y el comentario), y **las 21 últimas líneas, con su hash, quedaron idénticas**.

## La huella de todos los juegos, en cada navegador

El chequeo que era del Dojo pasa al núcleo y queda para cualquier juego: `checkReplays`, al que se le dan los juegos con sus repeticiones. «La misma huella» juega ahora las 21 en tu navegador: las siete del Dojo, los seis pisos de la torre, los cuatro niveles de la fortaleza y los cuatro de la muralla, sin dibujar nada. La prueba de navegador lee todas las carpetas de repeticiones y compara cada fila por su nombre (`tower/floor-3`).

## Tres proyectos de pruebas

Las pruebas sin pantalla se separan en tres proyectos:

- **units**: el motor, la biblioteca y las reglas de los juegos;
- **playthroughs**: cada nivel de cada juego jugado hasta el final, y sus repeticiones jugadas de vuelta (las lentas, cada nivel en su archivo, así corren a la vez);
- **site**: las del tutorial.

`npm test` corre unidades y sitio; `npm run test:all`, los tres, y es lo que corren continuous integration y `verify`.

**Las pruebas del motor ya no dependen del código del tutorial.** La configuración importaba el código del curso para resolver sus pasos, así que un error en el tutorial impedía arrancar cualquier prueba del motor. Ahora ese código se carga solo cuando un paso del curso lo pide, y solo en el proyecto del sitio. Node 26 corre ese TypeScript directamente.

## Re-simular al personaje propio

La [decisión 0016](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0016-the-networking-model.md) promete que, en red, cada copia predice solo a su personaje. Cuando llega la palabra del servidor para el paso $t-k$, lo devuelve a ese paso y lo re-simula hasta ahora, con los demás donde estaban. Eso vale solo si lo que lleva o frena al personaje propio es función del paso o está en el estado, y nada lo comprobaba.

El arnés (`resimulateOwn`):

1. Juega una repetición una vez y guarda cada entidad al final de cada paso.
2. Desde el comienzo de cada ventana de 30 pasos, vuelve al mundo de ese momento.
3. Les quita los inputs a los demás jugadores, así su propia simulación se va a otra parte.
4. Antes de cada paso, pone a todas las demás entidades donde las tenía la grabación.
5. Exige que el personaje propio, solo con sus inputs, termine cada paso exactamente igual que en la grabación. Si no, dice el primer paso donde se separa y en qué.

Los primeros casos, sobre repeticiones del Dojo:

- **Fase 1**, con un segundo jugador que entra, se mueve y se va: 15 ventanas, todas iguales.
- **Fase 2**, sobre las plataformas que llevan al personaje: 31 ventanas, todas iguales. El transbordador es función del paso; el giro del carrusel lo calcula Rapier.

Un control negativo prueba que el arnés no pasa por no mirar. En un juego donde el personaje propio se mueve según lo que _pide_ el otro (no según dónde está), el arnés dice en qué paso se separa. El bosque va a sumar casos: la liana, el agua y la montura. Si se puede re-simular a un personaje sin avanzar el mundo entero es la medida de la F2.

## Pruebas

- **Las versiones:** la línea `rules`, escrita y leída; el rechazo cuando sube la versión del juego o de la biblioteca, o falta una; una repetición sin versiones, aceptada; un nombre o una versión mal escritos, rechazados con su línea. En la red, una página con otras reglas no se une, y con las mismas sí.
- **El kit y las carpetas:** cada repetición con su grabador; cada juego, con sus versiones completas (y la torre sin `kit`, rechazada).
- **El chequeo de todos los juegos**, en Node: un replay correcto da la misma huella, uno alterado da otra, y avisa cómo va.
- **El arnés:** los dos casos del Dojo y el control negativo.
- Pasan los 898 tests sin pantalla (`test:all`, 98 s). Los recorridos y sus repeticiones, en 60 s. `npm run references`, en 50 s.
- **En el navegador**, contra mi propia compilación: las 21 repeticiones dan la misma huella en Chromium, Firefox y WebKit, como en Node, y las mazmorras de la aventura también (6 de 6). Las 9 pruebas de física, que leen las repeticiones del Dojo con su encabezado nuevo, también pasan.
- **La versión del motor sigue en 49**, y las 21 repeticiones dan el mismo hash.

## Lo que queda

- `npm test` tarda 46 s, no los 20 s de la meta. Ya no lo frena un solo archivo, sino dos pruebas pesadas que no son recorridos: las reglas de la muralla (27 s) y el curso del tutorial (21 s). Es tema de la **5.5d**, junto con el resto del entorno: la verificación de tipos, continuous integration y las pruebas de navegador.
- Las pruebas de navegador de cada juego todavía repiten lo que es del shell. Eso se ordena en la 5.5h, cuando los juegos compartan su biblioteca.
