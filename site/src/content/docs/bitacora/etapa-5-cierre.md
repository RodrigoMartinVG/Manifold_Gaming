---
title: 'Cierre de la fase 5: los tres juegos'
description: 'La fase 5 terminada: la torre, la fortaleza y la muralla, tres juegos sobre el mismo motor, una sola noche, jugables hasta el final y cada uno con sus repeticiones de referencia. Las fichas de lecciones que ahora tienen dónde apuntar, con sus líneas de Manifold, y la tabla del plan revisada para la fase 6.'
sidebar:
  order: 60
---

> Informe del cierre de la fase 5. El plan pedía tres cosas: las lecciones de cada juego, las de la fase y la tabla del plan revisada para la fase 6.

## Qué hicimos

- **Las fichas de lecciones, con sus líneas de Manifold.** El tutorial nuevo ([decisión 0021](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0021-a-new-tutorial.md)) se escribe parte por parte, siguiendo su currículo, no fase por fase. Lo que cierra una fase es lo mismo que en la 4: las fichas que ahora tienen algo de Manifold que señalar reciben su línea. Diecisiete lecciones la recibieron:
  - **2.10**, el azar con semilla: los dados del disparo de la escopeta;
  - **2.15**, tu fantasma: el fantasma por enlace y su curva;
  - **4.3**, impulsos: la explosión y el salto con explosión;
  - **5.3**, un salto que se siente bien: `arcOf`, que es exactamente la solución en pasos de la ficha;
  - **5.4**, modos de moverse: deslizarse y colgarse, y el control en el aire con tope;
  - **5.7**, capacidades como datos: el salto en la pared y los bordes;
  - **5.16**, el juego de plataformas: la torre;
  - **6.8**, la luz como lógica: la luz como herramienta y la cuenta de la fortaleza;
  - **6.10**, el sonido de los eventos: el de cada arma y el grito;
  - **6.12**, la interfaz: el cascarón y la marca de acierto;
  - **6.13**, guardar como datos: el progreso versionado;
  - **6.16**, la sala de sigilo: la fortaleza;
  - **7.8**, los modos del guardia: el guardia alerta y el puesto;
  - **7.11**, memoria y búsqueda: lo que recuerda un guardia alerta, y la búsqueda que no termina;
  - **7.14**, el guardia te persigue: el ritmo que sube;
  - **8.16**, efectos: cómo se siente un arma;
  - **8.17**, la sala de noche: el cielo según la hora.

  Además, la 7.12 apuntaba a un archivo que se mudó en la 5e. Ya apunta al nuevo.

- **La tabla del plan, revisada para la fase 6.** Cinco filas nuevas, una por cada cosa que dejó la fase 5: el cielo según la hora; el cascarón de los juegos; el control del juego de plataformas; lo que pelea, ahora del motor; y un arma usada como evento, con el control en el aire. La lista de lo que pedía cada juego quedó marcada con lo hecho y lo que sigue abierto.

## La fase 5, entera

Una sola noche, tres rincones del mismo mundo ([decisión 0029](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0029-the-three-games.md)):

| Etapa              | Qué dejó                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| [5a](../etapa-5a/) | El gimnasio de medidas y el cielo                                                                                                     |
| [5b](../etapa-5b/) | El cascarón de los juegos: título, campaña, progreso guardado, créditos                                                               |
| [5c](../etapa-5c/) | El control del juego de plataformas: un salto por su altura y su tiempo, el salto en la pared, los bordes                             |
| [5d](../etapa-5d/) | **La torre**, al atardecer: cuatro pisos, estrellas y tiempos de oro, fantasmas por enlace                                            |
| [5e](../etapa-5e/) | Lo que pelea, ahora del motor; la luz como herramienta; guardias alertas                                                              |
| [5f](../etapa-5f/) | **La fortaleza**, de noche: tres niveles de sigilo para recuperar la llama                                                            |
| [5g](../etapa-5g/) | Las armas del shooter: un papel para cada una, la escopeta, el lanzador, el salto con explosión; cómo se siente cada una, sus modelos |
| [5h](../etapa-5h/) | **La muralla**, antes del amanecer: oleadas de bots con un ritmo que sube                                                             |

Cada juego se juega hasta el final sin la consola. Cada uno tiene repeticiones de referencia que lo juegan hasta el final, y sus pruebas manejan al personaje como lo haría una persona:

- **la torre:** saltos, chimeneas, esperar lo que se mueve;
- **la fortaleza:** esperar a que el guardia mire para otro lado, apagar un farol, el palo por la espalda;
- **la muralla:** apuntar desde los ojos al más cercano que se ve.

## Hallazgos de la fase

Algunos de los que más enseñaron, de las tres últimas etapas:

| Hallazgo                                  | Qué pasaba                                                                                                              | Qué se hizo                                                                                       |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Un guardia sin ronda se iba a otra**    | El guardia que mira la llama tomaba la ronda más cercana, la del pasillo, y dejaba su lugar                             | Un guardia alerta sin ruta tiene un puesto, y una zona `post` lo pide                             |
| **Un guardia volteado seguía viendo**     | Sus ojos son del mundo y la cuenta de "te vieron" los contaba                                                           | El juego cuenta solo los ojos de un guardia de pie                                                |
| **El golpe no llegaba**                   | El primer guion pegaba desde 1,7 m, y el palo alcanza un centro a unos 1,65 m                                           | Ahora se acerca a 1,4 m. El número quedó en el informe de la 5f                                   |
| **El control en el aire sin tope**        | Arrojado por una explosión y empujando hacia adelante, un personaje sumaba aceleración sin fin                          | `airStrafe`: sube hacia lo pedido, nunca lo pasa (versión 42)                                     |
| **Los modelos cambiaban en cada corrida** | El exportador sacaba los triángulos de una esfera UV en otro orden cada vez                                             | Una icoesfera; el guion hace el mismo archivo siempre                                             |
| **El arma recién tomada no disparaba**    | La prueba del lanzador apretaba antes de que pasara la recarga de la escopeta, que sigue contando aunque cambie el arma | La prueba espera; la regla quedó así a propósito                                                  |
| **Una oleada que no terminaba**           | Dos atacantes que buscaban al defensor empujaban para siempre contra los caídos, cuyo cuerpo sigue en el mundo          | En la muralla, los caídos se retiran a los 2 s; que el guardia note que no avanza queda pendiente |
| **El índice de la bitácora, uno menos**   | El sitio se construyó antes de escribir un informe, y la prueba lee los informes del código                             | Se construye de nuevo después de escribir                                                         |

## Medido

- **Los juegos, jugados por sus pruebas:** la torre en 62,8 s (cuatro pisos), la fortaleza en 53,5 s sin que nadie la viera, y la muralla en 88,9 s, perdiendo 505 de salud en total, con dos caídas en el amanecer. Para quien los juega la primera vez, mucho más.
- **La simulación** va por la versión 42. De las catorce repeticiones de referencia del Dojo, la torre y la fortaleza, doce dan el mismo hash desde la 41. Las tres de la muralla nacieron en la 42.
- **Las pruebas:** sin pantalla, 787. En el navegador, 210, con las de los tres juegos y la sala de armas.

## Lo que sigue

La fase 6, la red y los niveles, empieza dividiéndose en etapas (6.0). La muralla es la que va en red:

- **Lo que ya está listo:** sus perdigones salen de los dados del disparo y sus rayos ya miran hacia atrás lo que vio quien tiró ([decisión 0022](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0022-hits-and-the-history-of-poses.md)). `fired` es de la vista, así que los disparos de otra pestaña se dibujan con los mismos eventos.
- **Lo que va antes de bots que jueguen en red:** las deudas de los guardias que encontró esta fase. Un guardia que no avanza no lo nota; un guardia no se cubre; un disparo no es un sonido que el mundo oiga.
