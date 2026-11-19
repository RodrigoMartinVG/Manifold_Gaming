---
title: 'Etapa 5.5f: las deudas que cambian la simulación, en una sola versión'
description: 'El estado del personaje queda agrupado por forma de moverse; un personaje puesto en otro lugar deja de hacer lo que hacía (un punto de control termina una rodada); el hash y las instantáneas dejan afuera lo indefinido y lo que vale su valor por defecto. Todo en la versión 50 del motor, con las 21 repeticiones grabadas de nuevo una vez.'
sidebar:
  order: 74
---

> Informe de la 5.5f, después de la [5.5e](../etapa-5-5e/). Es la sexta etapa de la [decisión 0033](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0033-the-shape-before-the-forest.md): lo que la 5.5e no podía hacer sin cambiar un bit, junto, en **una sola versión del motor**, para grabar las repeticiones de nuevo una vez y no cuatro.

## Lo que pedía

- **El estado de cada forma de moverse, junto** (la segunda pasada de S1). El personaje tenía catorce campos sueltos de modos distintos: `rolling` y `rollDirection` de la rodada, `ledge` y `regrab` de la cornisa, `offWall`, `offSteps` y `nearWall` del salto desde una pared, `wall` de trepar, y seis del salto. Dos de ellos (`nearWall` y `hung`) se borraban con `delete` cuando no se usaban.
- **Un personaje puesto en otro lugar sigue haciendo lo que hacía** (W6). `place()` reseteaba cinco campos de su movimiento y no el resto: uno mandado a un punto de control en medio de una rodada seguía rodando desde ahí, y dentro del tiempo de gracia de una pared podía saltar de esa pared desde el punto de control.
- **"Ausente quiere decir lo de antes" se acumula, y el hash debajo es frágil** (P2). El hash recorre cada clave y hashea un `undefined`: `{hung: undefined}` y `{}` daban hashes distintos, y una ida y vuelta por JSON (lo que va a hacer la red de la fase 6) borra el primero. Y una lámpara apagada a mano y vuelta a prender (`out: false`) hasheaba distinto de una que nunca se apagó (sin `out`).

## El estado, por forma de moverse

Ahora el personaje tiene un objeto por cada cosa que hace:

| Antes                                                                   | Ahora                                               |
| ----------------------------------------------------------------------- | --------------------------------------------------- |
| `jumpPending`, `jumpHeld`, `airJumps`, `stepsInAir`, `leaping`, `hung?` | `jump: { pending, held, air, inAir, rising, hung }` |
| `wall`                                                                  | `climb: { wall }`                                   |
| `rolling`, `rollDirection`                                              | `roll: { steps, way }`                              |
| `ledge`, `regrab`                                                       | `hang: { ledge, regrab }`                           |
| `offWall`, `offSteps`, `nearWall?`                                      | `wallJump: { off, lock, near }`                     |

Nada se borra: lo que antes desaparecía vale su "ninguno" (`hung: 0`, `near: null`). La regla de la caída (`pulled`) cuenta ahora `hung` como un número, con 0 para "no cuelga".

## Puesto en otro lugar, deja de hacer lo que hacía

`stopMotion(c)`, en el módulo de los modos: sin velocidad, en el aire, sin tiempo de gracia, sin salto guardado, sin subir ni colgar de la cima de un salto, sin pared de la que saltar, sin lo que lo empujaba ni lo que lo llevaba, y con sus saltos en el aire de vuelta. Y cada forma de moverse dice lo suyo (`reset`): la rodada termina, la cornisa se suelta, la pared que trepaba ya no está. `world.place` lo usa, así que vale para todos los juegos: los cinco llevan a sus personajes a los puntos de control con `place`.

## Lo que no cuenta en el hash

`defaults.ts` dice, por componente, qué vale un campo cuando nada dice otra cosa (hoy, `lamp.out: false`). El hash deja afuera un campo igual a su valor por defecto, y todo `undefined` en cualquier lugar; una instantánea los deja afuera también, así que lo que viaja es más chico. Un campo que una etapa futura agregue con su valor por defecto no va a cambiar el hash de ningún mundo que no lo use: esa es la razón de fondo, para que las versiones sean de cambios y no de agregados.

## La versión 50

`SIMULATION_VERSION` pasa de 49 a 50, y las 21 repeticiones se grabaron de nuevo una vez. **Por qué cambió cada hash:** el hash lee las claves del personaje, y sus nombres cambiaron (`jump` en lugar de `airJumps` y sus vecinos). Cómo se mueve cada mundo es el de la 49, salvo lo que hace un personaje puesto en otro lugar. Lo comprobé: jugué las 21 repeticiones de la versión 49 con el motor de la 49 y con el de la 50, y **las 21 terminan exactamente igual**: cada entidad de cada una en la misma posición, con el mismo modo, la misma velocidad y la misma salud. En ninguna, entonces, cambió otra cosa que el nombre de las claves (y lo que el hash deja afuera).

## Pruebas

- **Nuevas**, y las dos fallan con la versión 49: un personaje mandado a otro lugar en medio de una rodada, con un salto guardado y una pared cerca, deja de rodar, no guarda el salto ni la pared, y queda parado donde lo pusieron (antes rodaba el resto de su rodada desde ahí); una lámpara apagada y vuelta a prender da el hash de la que nunca se apagó, un campo `undefined` es uno que no está, y una instantánea no guarda ninguno de los dos.
- **Cambiadas, y por qué.** Dos pruebas del Dojo se apoyaban en lo que `stopMotion` arregla. Una ponía al personaje en la plataforma más alta y saltaba en su segundo paso, antes de pisar: el salto salía como salto desde el piso porque heredaba el tiempo de gracia de donde estaba parado antes; ahora nace ahí, así que salta una vez que pisa. La otra, la del fantasma, cambiaba de golpe la dirección en sus últimos cuatro pasos; con el recorrido nuevo (el personaje cae al vacío seis veces en esos 20 s y vuelve a su punto de control) ese giro caía cuando iba rápido, y la línea recta de la tira entre dos poses no lo puede seguir: ahora sigue su curva, que es lo que la prueba mide. Las pruebas que arman personajes a mano usan los grupos nuevos.
- Pasan las 927 pruebas sin pantalla (`test:all`), la verificación de tipos, el lint y el formato.
- **En el navegador**, contra mi propia compilación en el puerto 4420: las 21 repeticiones nuevas dan la misma huella en Firefox y WebKit, como en Node, y pasan sus pruebas de física (22 de 22); en Chromium pasan las 151 pruebas de navegador.

## Lo que queda

- **La postura como propiedad de la forma de moverse** (lo que la decisión pone en esta etapa, de S6) ya la hizo la 5.5e, sin cambiar un bit: cada modo dice si va bajo, cuánto se lo ve y cuánto se oyen sus pasos.
- Lo que sigue es la **5.5g**, la forma de la vista.
