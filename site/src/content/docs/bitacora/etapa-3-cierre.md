---
title: 'Cierre de la fase 3: la fortaleza y sus lecciones'
description: 'La demostración de la fase en una sola sala, jugada de punta a punta por una prueba: un botón abre una puerta, un ascensor sube a un salón oscuro, una lámpara ilumina la placa ante la última puerta y un vigía ve a quien la pisa; rota la lámpara, la puerta se abre. Y las cinco lecciones de la fase en el tutorial.'
sidebar:
  order: 35
---

> Informe del cierre de la fase 3. El plan pedía un nivel que mostrara la demostración de punta a punta (una puerta, un ascensor, una lámpara, un vigía), jugado por una prueba como el circuito; las lecciones de la fase; y la tabla del plan revisada para las fases 4 y 5.

## Qué hicimos

- **La fortaleza** (la sala [`keep`](../../jugar/dojo/keep/) del Dojo): todo lo que construyó la fase, en una sola sala. Un botón abre una puerta (3c). Detrás, un ascensor sube a un salón oscuro (3c, 3d). Ahí, una lámpara en un poste ilumina la placa que está ante la última puerta, y un ojo al fondo ve a quien la pisa (3d). La puerta se abre solo para alguien sobre la placa a quien el ojo no ve: una pelota contra la lámpara la rompe (3e), su luz se apaga, el ojo te pierde, y la puerta se abre y queda abierta. Detrás, la meta.
- **Las señales que lo arman**, escritas en el nivel: `ready` es `all on_plate unseen`, y `opened` un cerrojo (`latch`) que se prende con ella y nunca se apaga (lo apaga `never`, una entrada que nadie toca). Sin el cerrojo, la puerta se cerraba al bajarse de la placa para cruzarla.
- **Una prueba que la juega entera**, sin teletransportes, con un conductor como el del circuito: va hasta el botón y aprieta `use`, cruza la puerta, sube en el ascensor, camina hasta la placa en la luz (el ojo la ve: la puerta no abre), vuelve, mira la lámpara y tira una pelota, vuelve a la placa en la oscuridad (la puerta abre), cruza y llega a la meta. Otra se queda en la placa con la lámpara entera, y la puerta no se mueve.
- **Las lecciones de la fase**, la etapa 3 del tutorial: [entidades con nombre y señales](../../tutorial/etapa-3/00-entidades-y-senales/), [la luz como lógica](../../tutorial/etapa-3/01-la-luz-como-logica/), [lo que se rompe, en capas](../../tutorial/etapa-3/02-lo-que-se-rompe/), [el sonido sale de los eventos](../../tutorial/etapa-3/03-el-sonido-sale-de-los-eventos/) y [guardar como datos](../../tutorial/etapa-3/04-guardar-como-datos/). Cada una con su ejemplo en vivo, sus capas (más a fondo, en los motores, para practicar) y una prueba en el navegador que lee lo que su ejemplo muestra. Sus palabras van al glosario, y su patrón nuevo, el **doble búfer**, a la página de patrones.
- **La tabla del plan, revisada** para las fases 4 y 5: lo que dejó la fase 3 y quién lo necesita.

## Hallazgos

| Hallazgo                                   | Qué pasaba                                                                                                                                                                             | Qué hicimos                                                                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **La puerta se cerraba al cruzarla**       | Con `opened` igual a `ready`, la puerta seguía a la placa: al bajarse de ella para cruzar, se cerraba                                                                                  | Un cerrojo, que se apaga con una entrada que nadie toca: abierta una vez, queda abierta                                       |
| **La energía de un golpe, en el ejemplo**  | El ejemplo de la lección anotaba la energía en cada paso que la pelota seguía tocando el jarrón, y quedaba la del último, ya frenada: 23,5 J donde llegaban 38,5                       | Un golpe es el paso en que empieza a tocar. El motor ya lo hacía así: rompe por el primer paso con la velocidad con que llegó |
| **Dos filas con el mismo comienzo**        | La prueba de la lección de la luz buscaba la fila `lamp 2` del panel, y encontraba primero `lamp 2 on`                                                                                 | Busca la fila por su nombre entero                                                                                            |
| **Dos puntos en una descripción**          | El sitio no se construía: la descripción de una lección tenía ": " en el medio, y el YAML la leía como otra clave                                                                      | Entre comillas, como las de la Bitácora                                                                                       |
| **El último sonido, pisado por los pasos** | La prueba de la lección del sonido esperaba ver "hit on metal" en el último sonido del panel; los pasos lo pisan unas décimas después, y con la máquina cargada no lo alcanzaba a leer | El ejemplo cuenta los golpes aparte (_hits_), y la prueba lee esa cuenta                                                      |
| **La fortaleza, a la primera**             | La prueba que la juega pasó a la primera: el conductor del circuito, las señales de la 3c, la luz de la 3d y la lámpara de la 3e, juntos, sin un ajuste                                | Nada que arreglar: es lo que la demostración tenía que mostrar                                                                |

## Medido

- **La fortaleza:** la prueba la juega de punta a punta en 880 pasos (14,7 s del mundo). Con la lámpara entera, parado en la placa: el ojo lo ve (`seen_me` = 1), la puerta cerrada. Rota: no lo ve, y la puerta se abre en el paso siguiente.
- **Las lecciones:** de la causa a la puerta, 1 paso; calculadas al revés, 3. La luz del personaje es el ambiente más la parte de cada lámpara. A 4 m/s el jarrón aguanta (unos 38 J); a 7, se rompe en 3 pedazos y 24 fragmentos. Los pasos se oyen a 7 m en la madera, 6 en la piedra y 10 en el metal. El progreso se carga con otra versión del motor; la foto, no.
- **Las pruebas:** sin pantalla, 416 (19 nuevas: la fortaleza jugada, y sin la lámpara rota; y las revisiones de las cinco lecciones: sus capas, sus patrones y sus enlaces). En el navegador, 160 (11 nuevas: las cinco lecciones leídas, cada uno de sus ejemplos sin errores, y la dirección de la fortaleza).

## La fase 3, entera

Un mundo que responde: lo que el programa mueve, sólido (3a); un formato de nivel con nombres, materiales y zonas con datos (3b); señales y mecanismos (3c); la luz de la simulación y un vigía (3d); lo que se rompe, en capas (3e); el sonido (3f); la masa y agarrar (3g); la cámara contra las paredes (3h); la interfaz y los ajustes del jugador (3i); hacer niveles desde la consola (3j); y las partidas guardadas, con el comienzo de la aventura (3k). Tres decisiones: las señales (0018), las palabras de los juegos (0019) y las partidas guardadas (0020).

## Lo que sigue

La fase 4: combate y bots. Primero, partirla en etapas (4.0), como la 3.0 partió esta. El guardia que la demostración de la fase 3 pedía, con su cerebro: ve con la luz de la 3d, oye con los sonidos de la 3f, y usa el mundo de la 3c.
