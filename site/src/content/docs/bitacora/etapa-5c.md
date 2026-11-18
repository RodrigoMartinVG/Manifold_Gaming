---
title: 'Etapa 5c: el controlador del juego de plataformas, y el salto en la pared'
description: 'El salto definido por su altura y su tiempo hasta arriba, con su propia gravedad y la cuenta exacta en pasos; más fuerte al soltar y al caer, una velocidad máxima de caída y corrección en las esquinas. Deslizarse por una pared y saltar de ella, también entre dos paredes; agarrarse de un borde, colgar y subirse. Todo medido en el gimnasio, y la torre moviéndose así.'
sidebar:
  order: 54
---

> Informe de la 5c, después de la [5b](../etapa-5b/). La torre de la [decisión 0029](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0029-the-three-games.md) ya se mueve como un juego de plataformas: con su salto, el salto en la pared (su mecánica distintiva) y los bordes que se agarran.

## Qué cambia, y qué no

Todo es del motor y se elige por personaje. Un personaje que no lo pide se mueve exactamente como antes.

Lo comprobé así: jugué las siete repeticiones de referencia con el código nuevo, saqué del estado solo los campos nuevos y comparé el hash con el que estaba grabado. Los siete dieron el mismo hash, bit por bit. La versión de la simulación pasa a 39 igual, porque el estado de cada personaje tiene esos campos, y las repeticiones se grabaron de nuevo.

## El salto, por su altura y su tiempo

Un diseñador de niveles piensa en cuán alto salta y en cuánto tarda, no en una velocidad. Un personaje puede traer ahora su _arco_: la altura de los pies $h$ y el tiempo hasta arriba $t$. De ahí salen su propia gravedad $g$ y la velocidad del salto $v$.

La cuenta se hace en los pasos que el motor de verdad da, no en el continuo. El paso suma primero la gravedad a la velocidad y después mueve con ella. Después de $k$ pasos, la velocidad es $v - k g \Delta t$ y la altura

$$
y(k) = \Delta t \Big( k v - g \Delta t \, \frac{k(k+1)}{2} \Big).
$$

Con $N = t / \Delta t$ pasos (redondeado), pedimos que la velocidad sea 0 en el paso $N$ y que la altura ahí sea $h$:

$$
v = N g \Delta t, \qquad h = g \Delta t^2 \, \frac{N(N-1)}{2}
\quad\Longrightarrow\quad
g = \frac{2h}{N(N-1)\,\Delta t^2}, \qquad v = \frac{2h}{(N-1)\,\Delta t}.
$$

Los pies llegan exactamente a $h$ en los pasos $N-1$ y $N$; el último paso hacia arriba no los mueve. Las fórmulas continuas, $2h/t^2$ y $2h/t$, dan un poco menos, porque el paso pierde medio paso de subida.

El de la torre: 2 m en 0,42 s, o sea $N = 25$, $g = 24$ m/s² y $v = 10$ m/s. Una prueba lo exige: los pies suben 2 m (con 12 cifras en la cuenta, con 3 en la simulación, que guarda posiciones de 32 bits).

Encima de eso:

- **Soltar el salto mientras sube** multiplica la gravedad por 2,5: un toque es un saltito, y un salto sostenido llega a los 2 m. La prueba calcula la altura del toque con las mismas sumas que el paso y la compara.
- **Al caer, la gravedad es 1,5 veces la de subir.** Baja antes de lo que subió: arriba en 25 pasos y abajo en 20, porque $k(k+1) \ge 2h / (1{,}5\, g\, \Delta t^2) = 400$ pide $k = 20$.
- **No cae más rápido que 16 m/s.**
- **Corrección en las esquinas.** Si al subir la cabeza roza un borde, se lo corre de costado de a 5 cm, hasta 25 cm (primero los ejes, después las diagonales). Si eso libera el camino hacia arriba, sigue subiendo; si no, el techo lo frena. En la prueba, un borde que le roza 10 cm de cabeza lo corre y llega a los 2 m; sin la corrección, no pasa de 1 m.

## La pared: deslizarse y saltar

Con `wallJump`, en el aire y empujando contra una pared, el personaje se desliza por ella sin pasar de 2,5 m/s: un modo nuevo, `slide`. Saltando, sale para arriba como un salto y hacia afuera a 6 m/s, y conserva lo que tenía a lo largo de la pared.

Durante un cuarto de segundo no puede volver hacia ella, o estaría otra vez en la pared enseguida. La primera versión solo le impedía girar hacia la pared, pero el control en el aire lo frenaba y perdía un tercio del impulso. Ahora, durante ese cuarto de segundo, lo que lo aleja de la pared se conserva entero y solo maniobra a lo largo de ella.

Entre dos paredes, saltando de una a la otra, sube más alto que cualquier salto: la chimenea de la 0029.

## El borde: agarrarse, colgar, subirse

Con `ledge`, cayendo junto a un borde que tiene adelante, el personaje se agarra: un modo nuevo, `hang`. Busca una cara de pared un poco debajo de sus manos (que están 30 cm debajo de la punta de su cabeza), y encima de esa cara, una superficie donde podría pararse. Las manos quedan sobre la superficie, 10 cm pasando el borde; el cuerpo, a una separación de la cara; la velocidad, en cero. Las manos se dibujan sobre el borde, a un ancho de hombros.

- **Saltando, o empujando hacia la pared después de un quinto de segundo colgado,** se sube. Llegó empujando hacia la pared, así que no se sube en el mismo paso en que se agarra.
- **Empujando hacia afuera, o agachándose,** se suelta, y por un quinto de segundo no se agarra de nuevo.
- **Saltando hacia afuera,** sale como de una pared.

Subirse es un movimiento propio: primero hacia arriba hasta que los pies pasan el borde, después hacia adelante, 0,15 s cada parte, a través de los choques. La primera versión era un salto con gravedad, y perdía el avance contra la pared, porque una regla de la 4.5 quita la velocidad que va contra una pared. Las manos quedan en el borde hasta que está arriba.

## Medido en el gimnasio

El gimnasio de la 5a tiene dos estaciones nuevas:

- bordes de 2,5 a 3,75 m, para agarrar después de un salto;
- chimeneas de dos paredes de 8 m de alto, separadas de 2 a 5 m.

Tres interruptores del Dojo (`dojo.arc`, `dojo.walljump` y `dojo.ledge`) le dan al personaje los números del de la torre. `metricsOf` dice lo mismo desde los números, y una prueba pone las dos cosas una al lado de la otra:

| Medida                             | `metricsOf`                              | El gimnasio                                                                 |
| ---------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| **El salto**                       | 2 m arriba en el paso 24, abajo en el 45 | Igual, con 3 cifras en la simulación                                        |
| **Lo que lleva caminando**         | 3,375 m                                  | 3,375 m                                                                     |
| **El borde más alto que agarra**   | Las manos llegan a 3,32 m                | Agarra hasta 3,25; el de 3,5 no                                             |
| **La chimenea más ancha que sube** | 4,46 m                                   | Sube hasta arriba la de 4 m; la de 4,5 hasta 6,7 m de los 8, la de 5 apenas |

La chimenea se calcula paso por paso, como mueve el controlador: 6 m/s en el paso del salto y en los 14 que dura el bloqueo; después, el control en el aire lo lleva hacia la velocidad de caminar, a 14 m/s². Eso cuenta durante los 45 pasos que tarda en volver a su altura, más el cuerpo de pared a pared.

Al medir apareció un error del controlador. Teletransportado mientras colgaba, el personaje seguía agarrado al borde de antes, y el paso siguiente lo tiraba de vuelta allá. Ahora ponerlo en otro lugar suelta el borde y termina lo que hacía en la pared.

Las pruebas del gimnasio sostienen el salto, como lo haría una persona: soltarlo enseguida es un saltito.

## La torre, moviéndose así

El personaje de la torre trae los números del juego de plataformas, que están en `@manifold/character` como `PLATFORMER`, compartidos con el gimnasio.

Sus dos pisos de prueba se rehicieron para un salto más corto (3,4 m caminando): el hueco del primero es de 2 m y el del segundo de 3. Y ya muestran lo nuevo, aunque los pisos de verdad son de la 5d:

- **En el primero,** una chimenea de dos paredes del kit, de 6 m de alto y 2,4 de separación, con una estrella a 5 m.
- **En el segundo,** una estrella sobre un bloque de 3 m, que se sube agarrándose del borde.

Una prueba toma las dos estrellas con esos movimientos.

## Pruebas

- **El controlador:** el arco exacto; el saltito; la caída más fuerte; la velocidad máxima; la corrección en las esquinas, con y sin; la pared, con y sin la capacidad; la chimenea; el borde (agarrarse, quedarse, subirse, soltarse, y sin la capacidad).
- **Las métricas:** las del arco, y la chimenea.
- **El gimnasio:** sus estaciones nuevas al lado de las métricas.
- **La torre:** sus pisos hasta la meta con el salto sostenido, y sus dos estrellas.
- **Las repeticiones:** las siete de antes dan su hash viejo sin los campos nuevos; grabadas de nuevo, en la versión 39.

## Lo que queda para después

- **La navegación de los bots no conoce los bordes ni las paredes:** un bot no sabe todavía que puede agarrarse o saltar de una pared. Llega cuando un juego tenga un bot que lo necesite.
- **Las animaciones:** deslizarse usa la de caer y colgar la de trepar quieta. Animaciones propias, con el resto del aspecto de la torre (5d).
- **Los números son una primera elección,** a afinar jugando los pisos de verdad.

Sigue la 5d: la torre, con tres a cinco pisos construidos por la medida del gimnasio, el salto en la pared enseñado en cuatro tiempos, su aspecto, su música, sus estrellas y tiempos, y los fantasmas por enlace.
