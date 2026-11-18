---
title: 'Etapa 5j: la atmósfera de los tres juegos'
description: 'Una noche que se siente oscura y se sigue leyendo: un relleno frío que no baja de un piso, la luz de la luna, niebla del color del horizonte, tono de cine y un brillo en lo que da luz. Debajo, los sonidos de fondo según la hora: viento que sube con la altura, grillos, pájaros y una lechuza. Es lo que comparten la torre, la fortaleza y la muralla.'
sidebar:
  order: 62
---

> Informe de la 5j, la segunda etapa de la [decisión 0031](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0031-games-that-play.md), después de la [5i](../etapa-5i/).

## Lo que pedía

El autor pidió "más atmósfera" para los tres juegos. La investigación de la decisión 0031 lo resume en dos reglas:

- **Que se sienta oscuro, sin ser oscuro.** Una noche negra no se juega. Lo que la hace noche es el color frío, el contraste, la niebla que se come lo lejano y las luces que brillan.
- **El sonido de un lugar tiene capas:** un fondo constante, detalles que van y vienen y, muy de vez en cuando, algo raro.

Las dos viven en la presentación. La simulación no cambia, ni su versión ni las repeticiones.

## Una noche que se lee

Cada juego ya tenía su hora: la torre al atardecer, la fortaleza de noche, la muralla antes del alba. El cielo ya sabía dónde están el sol y la luna. Lo nuevo sale de un solo número, **cuánto es de noche**, a partir de la altura del sol: $s_y$, el seno de su ángulo sobre el horizonte.

$$
n = \min\left(1,\ \max\left(0,\ -4\,s_y\right)\right).
$$

Con el sol arriba, $n = 0$. Llega a $1$ cuando $s_y = -\tfrac14$, con el sol unos 14,5° bajo el horizonte. Con ese $n$:

| Qué                                                     | De día     | De noche ($n = 1$) |
| ------------------------------------------------------- | ---------- | ------------------ |
| El relleno del cielo, como mínimo                       | el que hay | 0,5, frío          |
| La luz de la luna (para que se vean las siluetas)       | apagada    | 0,45               |
| La niebla, del color del horizonte: empieza y se cierra | 60 y 180 m | 18 y 85 m          |
| La exposición                                           | 1          | 1,15               |

Cada número va de su valor de día al de noche en línea recta: la niebla empieza a $60 + (18 - 60)\,n$ metros. El relleno no baja nunca de su piso y se vuelve frío, porque el ojo lee la oscuridad azul como noche aunque se vea bien.

La luz de la luna está siempre en la escena y de día vale cero. Así la cantidad de luces no cambia nunca y nada se compila de nuevo; es lo mismo que hace el destello del arma de la 5i. La niebla es una sola y cambia en el lugar, porque en el Dojo la luz del día puede cambiar en cada cuadro.

**El tono de cine** (ACES) comprime los brillos en vez de cortarlos, como una película: un farol pasa a blanco de a poco, sin una mancha plana.

## El brillo

Sobre la imagen terminada pasan dos cosas más:

- **Un brillo** alrededor de lo que da luz: faroles, la llama, los destellos, el disco del sol. Toma solo lo que pasa de cierto brillo (el 82 %) y lo esparce.
- **Una viñeta suave** que oscurece los bordes y lleva la mirada al centro.

El brillo se apaga en los ajustes, "Brillo en lo que da luz", para el gusto de cada uno o para una máquina lenta.

**Un detalle de las cuentas.** Three.js cuenta lo que dibuja cada vez que dibuja. Con pasadas después de la escena, la última cuenta era la de la última pasada: un solo triángulo que cubre la pantalla. Las pruebas de presupuesto (cuántos dibujos y triángulos por cuadro) habrían pasado siempre. Ahora la pasada de la escena guarda su propia cuenta y el escenario la expone (`drawn`), así los presupuestos siguen midiendo la escena.

## Los sonidos de fondo

Debajo de todo hay un viento: ruido marrón, suave arriba como el viento de verdad, por un filtro grave. Su volumen pasea despacio y **sube con la altura**: a 20 m de altura es el doble. En la cima de la torre sopla más.

Sobre el viento llegan, cada uno de un lado y nunca dos veces igual, los sonidos según la hora del cielo:

| Qué                                   | Cuándo                                         |
| ------------------------------------- | ---------------------------------------------- |
| Grillos (tres pulsos agudos)          | de las 20 a las 4:30; entran en hora y media   |
| Pájaros (dos notas que suben y bajan) | al atardecer (17 a 19) y al alba (5:30 a 7:30) |
| Una lechuza (dos ululatos)            | muy de noche (22 a 3:30), cada 9 a 17 s        |

Cada capa vale entre 0 y 1 y sube o baja a los costados de su franja. Cuanto más hay de una, más seguido suena. Así la torre tiene pájaros, la fortaleza grillos y lechuza, y la muralla vuelve a los pájaros cuando se acerca el sol. Todo va por el canal de los sonidos, así que su volumen manda, y a un tercio de él: el fondo acompaña, lo que pasa lo cuentan los sonidos.

La cuenta de las capas es una función pura (`ambienceAt`): una prueba la oye sin parlante.

**Lo que ya estaba.** Los pasos según el suelo existen desde la 3f, de cada personaje y en el espacio (piedra que golpea, madera que suena hueca, metal que resuena). Las capas de música van con la etapa de cada juego, porque dependen de lo que pasa en él: en la fortaleza, según la alerta de los guardias (5l); en la muralla, el combate (5n); en la torre, una capa por piso (5o).

## Pruebas

- Las capas de sonido por hora (atardecer, noche, alba, mediodía, medianoche, las entradas suaves) y cuánto es de noche según la altura del sol.
- En el navegador:
  - la fortaleza tiene la atmósfera prendida, el brillo, la niebla de noche (18 a 85 m) y las capas de la noche;
  - en la torre llegan pájaros;
  - los presupuestos de la GPU (las salas del Dojo, la ciudadela, el kit) se siguen cumpliendo, ahora medidos sobre la escena.

## Lo que queda

Después de la 5j, el autor pidió tres cosas más: explosiones y sonidos mucho mejores, el balanceo al caminar en primera persona y un salto mejor calibrado. Son la 5k, que va primero. Las etapas que seguían corren una letra: la 5l es que la fortaleza se lea (una gema de luz, anillos de ruido, una alerta que se llena con signos y voces, la última posición vista, una piedrita para distraer y música por niveles de alerta).
