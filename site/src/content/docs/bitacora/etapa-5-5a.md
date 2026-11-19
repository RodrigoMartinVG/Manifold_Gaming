---
title: 'Etapa 5.5a: lo que estaba mal hoy'
description: 'La primera etapa de la 5.5, la consolidación antes del bosque. Seis cosas que la auditoría encontró mal, arregladas cada una en su capa: un mundo cargado que perdía el kit de su juego, lámparas que mostraban el estado de la última, una séptima luz y luces que aparecían y desaparecían mientras se jugaba, los juegos dibujados sin anti-aliasing, una pieza que fallaba y dejaba la página en negro, y commits de main que nunca se verificaban.'
sidebar:
  order: 69
---

> Informe de la 5.5a, después de la [5p](../etapa-5p/). Es la primera etapa de la [decisión 0033](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0033-the-shape-before-the-forest.md): la 5.5, una consolidación antes del bosque, como la 2.5 y la 4.5. La 0033 nace de [una auditoría del código, capa por capa](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/audits/the-code-before-the-forest.md), y esta etapa arregla lo que esa auditoría encontró **mal hoy**.

## Lo que pedía

Seis de los nueve hallazgos "mal hoy" de la auditoría. Los otros tres quedan para la etapa donde viven: el personaje que al volver a un punto de control sigue rodando (5.5f, junto con los modos de moverse), la huella en los cuatro navegadores para los replays de todos los juegos (5.5c) y el estado del proyecto dicho en un solo lugar (5.5d).

La regla de la etapa: cada arreglo tiene un test que fallaba antes, y ninguna repetición de referencia cambia su hash.

## El kit, en todos los mundos de un juego

La sesión le daba a un mundo recién nacido dos cosas del cartucho: su filtro de daño y su kit de piezas. Al cargar un snapshot (o al unirse a una partida empezada) le devolvía solo el filtro. Esa copia rechazaba un `add kit …` que el anfitrión sí aceptaba. Y `level.diff`, que hace nacer otro mundo para comparar, lo hacía sin kit: en cualquier nivel con piezas del kit (la fortaleza, la muralla, la ciudadela) fallaba.

Ahora el mundo sabe qué toma de su juego: `world.attach(cartridge)`, en un solo lugar, usado al nacer, al cargar y en `level.diff`. Este último, además, libera su mundo de comparación aunque algo falle en el medio.

## Lo que brilla, de cada copia

Las copias de un modelo comparten sus materiales: un modelo en la GPU, por más personajes que haya. El brillo de una lámpara encendida, o el de un guardia que te ve, se escribía en esos materiales compartidos. Resultado: todas las lámparas mostraban el estado de la última que se procesaba, y un guardia que veía a alguien ponía rojos los visores de todos los personajes.

Ahora lo que brilla es de cada copia: la primera vez que una copia va a cambiar un material, lo toma como propio (una copia de ese material, compartida entre sus piezas como lo estaba el original), y se libera con ella. Los materiales que no brillan siguen compartidos.

## Un solo dueño para las luces

Cada luz real se calcula para cada píxel de cada material iluminado, y agregar o quitar una recompila todos los materiales. Por eso la 4.5f dejó como máximo seis. Pero había dos huecos:

- **Las luces cambiaban mientras se jugaba.** La pieza de las lámparas tenía tantas luces como lámparas. Una bengala tirada, o una que se apagaba, cambiaba ese número y recompilaba todo: un tirón en pleno juego.
- **El destello de los disparos era una séptima luz**, propia, fuera de la cuenta.

Ahora hay un **pool de luces** del escenario:

- **Su tamaño se fija cuando nace un mundo** (al cargar un nivel): las lámparas que tiene al empezar más los lugares que las piezas reservaron (el destello, uno), con un máximo de seis. No cambia mientras se juega.
- **Cada cuadro, cada pieza pide** las luces que querría, y el escenario las reparte justo antes de dibujar, con la cámara de ese mismo cuadro (antes se usaba la del cuadro anterior).
- **El orden:** primero la prioridad (un destello antes que cualquier lámpara), después la más cercana, con **histéresis** para que dos lámparas casi igual de cerca no se pasen la luz en cada paso de la cámara. Si $p_a$ es la lámpara, $r_a$ su alcance y $c$ la cámara,

$$
d(a) = \max\bigl(0,\ \lVert p_a - c\rVert - r_a\bigr) - K \cdot [a \text{ ya encendida}], \qquad K = 2\ \text{m},
$$

y una lámpara encendida conserva su luz hasta que otra quede más de 2 m más cerca.

- **Una luz que sigue encendida se queda en su lugar del pool**, así no salta de una lámpara a otra.

## La imagen terminada

Desde la 5j, los juegos con atmósfera pasan por una cadena de pases: la escena, el brillo, la viñeta y la salida. Había tres problemas:

- **Sin anti-aliasing.** El compositor de three.js crea su imagen intermedia con una sola muestra por píxel. El lienzo pagaba bordes suaves que la cadena tiraba. Ahora la escena se dibuja con **4 muestras por píxel** (o las que acepte la GPU, si son menos).
- **Lo que no puede ser un color.** Un shader que eleva un número negativo a una potencia da NaN, y el brillo, que desparrama lo brillante sobre sus vecinos, lo esparce hasta dejar la pantalla negra: le pasó a la demo del bosque. Ahora un pase entre la escena y el brillo convierte un NaN en negro, un negativo en 0 y un infinito en lo más brillante que cabe en un half float.
- **La viñeta producía colores negativos.** Mezcla cada color $c$ hacia $1-d$ según la distancia al centro, con $u^2$ entre 0 y 1:

$$
c' = (1 - u^2)\,c + u^2\,(1 - d).
$$

Con $c \ge 0$ y $d \le 1$, los dos términos son $\ge 0$. Con $d = 1{,}1$, en una esquina negra da $-0{,}1$, y hoy solo lo salvaba que ACES recorta. Una tabla de color después, o otro mapeo de tonos, habría elevado ese negativo a una potencia. Ahora $d = 1$ (la diferencia a la vista es mínima).

## Una pieza que falla

Las piezas de la vista se llaman una tras otra en cada momento del cuadro. Si una fallaba, cortaba el resto de ese cuadro, el dibujo incluido; si fallaba en cada cuadro, la página quedaba en negro por un error en un solo efecto. Ahora cada llamada es independiente: la que falla se avisa una vez (cada pieza y momento una sola vez, con su error) y las demás siguen.

## Cada commit, verificado

Continuous integration cancelaba el run anterior en cada push a `main`: el commit de la 5k nunca se verificó solo. Ahora en `main` un push espera al anterior, y solo un pull request cancela sus runs viejos. Hay topes de 60 minutos para verificar y 10 para publicar.

## Pruebas

- **El kit:** `level.diff` en un juego con kit dice "nada cambió"; un mundo cargado de un snapshot acepta un `add kit` como el anfitrión. Antes, el primero fallaba con "door is not a piece of this game's kit" y el segundo rechazaba la línea.
- **El brillo:** dos lámparas del mismo modelo, una encendida y otra apagada, cada una con su vidrio; el vidrio sigue siendo uno para sus dos piezas; el hierro, que no brilla, sigue compartido; sin vidrio brilla todo, propio, y al liberar la copia se libera lo suyo y no lo del modelo. Antes, la lámpara encendida salía apagada.
- **El pool:** tamaño fijo con ocho lámparas pedidas (dos hechas mientras se juega); el destello toma un lugar y lo devuelve; lo que sigue encendido se queda en su luz; lo que está detrás de la cámara no recibe luz; la histéresis; las pruebas de la 4.5f sobre qué lámparas se eligen, pasadas al pool.
- **La cadena:** el compositor de three.js tal como viene dibuja con una muestra; la nuestra con 4 (2 si la GPU solo acepta 2); el orden escena, limpieza, brillo, viñeta, salida; la viñeta nunca pasa de 1.
- **Las piezas:** una que falla en cada cuadro se avisa una vez y las demás y el dibujo siguen; `afterStep` en orden inverso.
- **En el navegador**, contra mi propia compilación: los 13 tests de luces, atmósfera, disparos, explosiones, la ciudadela (seis luces para sus catorce lámparas), la fortaleza y la muralla. Pasaron todos. La fortaleza dibuja con 5 luces (sus lámparas y el destello), la muralla y la ciudadela con 6, sin errores.

Los 881 tests sin pantalla pasan. **La versión de la simulación sigue en 49:** nada de esto toca el hash, y las 21 repeticiones de referencia dan el mismo.

## Lo que queda

- El pase de limpieza es un pase más sobre toda la pantalla. Su costo en el Iris Plus se mide en la 5.5g, cuando la cadena se arme desde el nivel de calidad (y con él, cuántas muestras usa cada nivel).
- Lo que sigue es la **5.5b**: las guardas por defecto. Una tabla de capas para el lint, cada archivo nuevo protegido desde que nace y las reglas de la biblioteca compiladas sin el DOM.
