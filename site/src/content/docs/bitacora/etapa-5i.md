---
title: 'Etapa 5i: bots justos, y la cámara de la torre'
description: 'Después de jugar los tres juegos, el autor pidió más juego. Primero, la cámara de la torre, que giraba con cada paso al costado y cambiaba hacia dónde es adelante; después, los atacantes de la muralla, que eran casi perfectos: ahora levantan el arma antes de tirar, se los ve y se los oye, no más de dos a la vez, el primer tiro pasa de largo y se sacuden cuando les pegás. La sensación de las armas, completada.'
sidebar:
  order: 61
---

> Informe de la 5i, después del [cierre de la fase 5](../etapa-5-cierre/). Es la primera etapa de la [decisión 0031](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0031-games-that-play.md), que salió de jugar los tres juegos y de investigar cómo se hacen los de cada clase.

## Lo que dijo el autor

Después de jugar la torre, la fortaleza y la muralla, el autor escribió que la sensación general era buena, pero que les faltaba _flow_ de juego, jugabilidad, inmersión. Y dio tres cosas concretas: la cámara de la torre complica las acrobacias, la fortaleza es la que menos juego tiene, y en la muralla los bots son demasiado perfectos, en un salón donde solo aparecen, con armas que pueden ser mucho mejores.

La [decisión 0031](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0031-games-that-play.md) lo pone al lado de tres investigaciones: cómo se hacen los juegos de sigilo, los shooters de niveles y la sensación de juego y la atmósfera. Las fuentes son charlas de quienes los hicieron, sus postmortems y el código publicado de Doom, Quake y Half-Life 2. De ahí salen seis etapas, de la 5i a la 5n, y el autor eligió hacerlas todas en el orden recomendado.

## La cámara de la torre

En el modo `follow`, la cámara se queda donde puede y solo mantiene la distancia. Un paso al costado la hace girar alrededor del personaje, y como el teclado se lee mirando desde la cámara, "adelante" giraba con ella: correr hacia una pared y saltar de ella, que piden mantener una dirección, se volvían una pelea.

El modo nuevo, `view.camera steady`, acompaña al personaje sin girar nunca por su cuenta. Su dirección es la que ya tenía (desde donde miraba), no la que va de la cabeza nueva a la cámara: se mueve con el personaje y mantiene la distancia, y solo la gira el mouse o el stick derecho. Los cuatro pisos de la torre lo usan; los demás juegos siguen con `follow`.

Una prueba en el Dojo compara los dos: corriendo un segundo al costado y saltando, `follow` gira más de 0,1 radianes y `steady` menos de 0,01. Otra, en el primer piso de la torre, corre al costado, salta y mira que adelante siga donde estaba.

De paso, una sola regla para algo que cada juego hacía a su manera: una receta de nivel, en una sesión sin página (una prueba, un servidor), no lleva las líneas de la vista (`view.…`), que ahí no existen. Es `withoutView`, en el núcleo, y la usan los tres juegos.

## Bots justos

Los atacantes de la 5h apuntaban siguiendo al defensor: cada paso, su mira recorría entre el 15 % y el 30 % del camino que le faltaba. A 60 pasos por segundo eso lo alcanza en una décima de segundo, y el dardo pega al instante. Al final de la noche, casi todos los tiros daban. Y si les pegabas, reaccionaban **más** rápido.

Ahora cada uno es un tirador justo, con los números de los clásicos:

| Qué                                                         | Cuánto                                      | De dónde                             |
| ----------------------------------------------------------- | ------------------------------------------- | ------------------------------------ |
| Tarda en verte antes de levantar el arma                    | 0,6 s, hasta 0,3                            | Half-Life 2: 0,3 s sin aviso         |
| Levanta el arma, y se lo ve y se lo oye, antes de cada tiro | 0,5 s, hasta 0,3                            | Doom: 0,29 a 0,46 s                  |
| Apunta a donde estabas                                      | 0,2 s antes                                 | El soldado de Quake                  |
| El error de su tiro                                         | 3,5°, hasta 1,5°; triple al verte           | Half-Life 2: triple, cierra en 0,6 s |
| Cuántos con el arma levantada a la vez                      | 2                                           | Doom 2016, Half-Life 2               |
| El primer tiro después de verte                             | pasa a 0,8 m                                | Half-Life 2, los tiros que se ven    |
| Cuando le pegás                                             | baja el arma, apunta amplio de nuevo, 0,4 s | El susto de Doom                     |

**El arma levantada** es del mundo: un componente nuevo, `arms.raised`, que está solo mientras el arma está arriba (lo que nunca levantó una no cambia), y un sonido, `ready`, que se oye a 14 m. Lo pide una entrada nueva, `arms.ready`, mientras se sostiene. Un jugador dispara al instante y nunca la usa.

**El error** sale de los dados del propio tiro (decisión 0022), con otro número que el de la dispersión del arma, así que dos corridas dan lo mismo. Si el tirador acaba de ver al defensor, el error es el triple, y se cierra en 36 pasos:

$$
e = s\left(1 + 2\max\left(0,\ 1 - \frac{t - t_0}{36}\right)\right),
$$

con $s$ el error de base y $t_0$ el paso en que lo vio.

**Dos a la vez:** de los que ven al defensor y podrían levantar el arma, pasan primero los de número más bajo. Cada cerebro cuenta el mismo mundo (quién ve a quién, quién tiene el arma arriba o lista), así que dos nunca toman la última vez en el mismo paso.

Todo esto solo vale para un tirador que lo trae (`fair`, en su `arms.gunner`). Los del Dojo pelean como en la 4g. La versión de la simulación pasa a **43**, y las repeticiones de referencia se grabaron de nuevo: las catorce del Dojo, la torre y la fortaleza dan el mismo hash, y cambian las tres de la muralla.

## La sensación, completada

La 5g ya tenía el destello, el retroceso, las chispas, la explosión vista, la marca al acertar y un sonido por arma. Lo que faltaba, según la investigación:

- **El destello alumbra.** Una luz que siempre está en la escena y solo se prende un instante. Como la cantidad de luces no cambia, nada se compila de nuevo.
- **El arma levantada brilla.** Un destello frío en la punta del arma, con su sonido (un clic metálico y un silbido que sube) y su subtítulo: "Alguien levanta su arma: te apunta".
- **Tus aciertos se oyen.** Un tic corto cuando pegás y un golpe más grave cuando volteás a alguien, como la marca en la mira.
- **Un golpe sacude la vista.** Cuando te pegan, o explota algo cerca, la vista tiembla según un "trauma" que se va en menos de un segundo; el temblor es su cuadrado, y suave. Se apaga en los ajustes: "Sacudir la vista con los golpes".

## Pruebas

- Los tres niveles de la muralla se ganan peleando. Antes la prueba pedía, además, que costaran salud: con atacantes justos, quien apunta perfecto y dispara sin pausa voltea a cada uno antes de su primer tiro, que pasa de largo. Lo que cuesta se ve en otra prueba: quien solo mira recibe golpes, pero después de una advertencia, y nunca hay más de dos armas levantadas.
- El ritmo de la muralla, con los números justos en cada punto de la noche.
- En el navegador: el Dojo compara `follow` y `steady`, la torre mantiene adelante, y en la muralla un atacante levanta el arma (se ve el destello) antes del primer golpe, que sacude la vista.

## Lo que queda

La 5j: la atmósfera de los tres juegos (una noche que se ve, el brillo, los sonidos de fondo, los pasos según el suelo, la música por capas).
