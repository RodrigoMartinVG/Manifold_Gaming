---
title: 'Etapa 4.5a: jugar la fase 4'
description: 'La primera etapa de la 4.5: jugar las salas de la fase 4 y arreglar lo que aparece. Apuntar ya no va a saltos de un grado, agacharse baja la vista, hay una mira y un campo de visión a gusto; los números de los guardias son de cada sala; y la navegación se arma de a poco, sin trabar el arranque.'
sidebar:
  order: 45
---

> Informe de la etapa 4.5a, la primera de la [4.5](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/ROADMAP.md): la revisión antes de los juegos. Empieza jugando, porque una hora del autor en la arena y el torreón encontró tres fallas que más de 800 pruebas no habían visto (el informe de la 4g). Esta etapa siguió con lo que él encontró después, con lo que ya estaba anotado y con mi propia pasada por las salas.

## Qué hicimos

- **Apuntar, fino.** Hacia dónde mira un personaje (`face`) viajaba en grados enteros, y solo cambiaba cuando la cámara había girado un grado; hacia dónde apunta arriba o abajo (`pitch`), en pasos de 0,9°. La cámara giraba suave, pero el personaje, y sus dardos, a saltos: un grado son 35 cm a 20 m. Ahora cada entrada dice qué tan fino viaja (`resolution`): hacia dónde mira, a la décima de grado; hacia dónde apunta, a la milésima de cuarto de vuelta (0,09°). Hacia dónde va (`move`) sigue en grados enteros, así que cada repetición grabada se lee igual y da la misma huella. En una repetición, una dirección fina se escribe con su decimal: `face @12.3`.
- **Los ojos, donde está la cabeza.** Agachado, la primera persona seguía a la altura de parado. Los ojos están ahora a la altura de la cabeza en la forma de moverse de ese momento (`eyeHeightOf`, la pieza de los golpes que se llama `head`): 0,62 m sobre el centro parado, 0,12 m agachado. La cámara llega ahí en unos 80 ms, así que agacharse no es un salto. Solo cambia la altura: agachado, la cabeza se inclina 40 cm hacia adelante, y una cámara ahí se metería en la pared que el cuerpo toca.
- **Una mira** (`view.crosshair`, prendida de entrada): un punto y cuatro marcas cortas en el medio de la pantalla, al apuntar desde atrás o en primera persona, mientras estás de pie.
- **El campo de visión, a gusto** (`view.fov`): 60° de arriba abajo, unos 92° de lado a lado en una pantalla 16:9, lo usual en primera persona. Los dos, en el menú de ajustes.
- **Los guardias, de cada sala.** Cuánto tardan en verte, cada cuánto disparan, cómo te sigue su puntería, desde qué distancia disparan y su vida son ahora variables de mundo (`dojo.guards.see`, `every`, `aim`, `range`, `health`), como `dojo.air`. Entran en un paso y las repeticiones las guardan. Una sala se hace más difícil o más fácil desde su receta. Un guardia nuevo pelea como los que ya están, y uno al que nunca se le dijo nada no lleva nada: la huella de cada mundo quedó como estaba.
- **La navegación, sin trabar.** Armar la grilla de una sala con guardias paraba el arranque entre 0,1 y 1,2 s. Ahora se arma de a poco, 200 consultas a la física por paso. Se cuentan consultas y no milisegundos, así que tarda los mismos pasos en cualquier máquina, y las pruebas dan lo mismo en todas. Mientras tanto, un guardia va derecho hacia donde quiere ir. Y un camino entre dos celdas se pregunta una sola vez: de ida o de vuelta, el cuerpo barre el mismo espacio, así que son la mitad de las consultas, con exactamente la misma grilla.

## La puntería que sigue

Un guardia apunta a un punto $a$ que en cada paso avanza una fracción $k$ del camino hasta vos (la 4g; ahora, `dojo.guards.aim`). Si caminás de costado a velocidad $v$, en cada paso de $\Delta t$ te alejás $v\,\Delta t$, y la distancia $L$ entre vos y adonde apunta cambia así:

$$L' = (L + v\,\Delta t)(1 - k).$$

Es una contracción (de factor $1 - k < 1$), así que tiende a su punto fijo, $L = L'$:

$$L^{\ast} = \frac{v\,\Delta t\,(1-k)}{k}.$$

Con $v = 4{,}5$ m/s, $\Delta t = 1/60$ s y $k = 0{,}15$, son 42 cm, más o menos el ancho del cuerpo: al que camina casi siempre lo erra, y al que está quieto ($v = 0$, $L^{\ast} = 0$) le acierta. Con $k = 1$ no hay demora: le acierta a todo.

## Hallazgos

| Hallazgo                                        | Qué pasaba                                                                                                                                                               | Qué hicimos                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| **Apuntar a saltos**                            | Hacia dónde mira, en grados enteros y con un grado de margen; hacia dónde apunta, en pasos de 0,9°. La decisión era de la 2.5c: entradas chicas para repeticiones chicas | Décimas de grado para mirar, milésimas para apuntar; caminar sigue en grados enteros |
| **Agacharse no bajaba la vista**                | Los ojos, fijos a 0,62 m del centro                                                                                                                                      | A la altura de la cabeza en cada forma de moverse                                    |
| **En el torreón, un guardia mandado al aire**   | Oyó el ascensor en el paso 5, con la navegación todavía armándose, y guardó el sonido sin bajarlo al piso: el medio del ascensor, en el aire. Ya nunca lo corregía       | El sonido se baja al piso cuando va hacia él, no cuando lo oye                       |
| **El primer armado, en frío**                   | Aun repartido, el código todavía sin compilar hacía lentas las primeras consultas: 132 ms en un paso con 400                                                             | 200 por paso: el paso más lento, 32 ms (el primero)                                  |
| **Los parámetros de una zona son obligatorios** | Sumar números a las zonas de los guardias obligaba a reescribir todos los niveles                                                                                        | Variables de mundo, como `dojo.air`                                                  |

## Medido

- **El arranque de la arena:** el paso más lento, 874 ms antes; 32 ms ahora. Sus consultas, de 19.084 a 10.894, con los mismos 16.440 caminos. La grilla tarda unos 55 pasos en estar.
- **La arena más difícil desde su receta** (`see 0.5`, `every 1`, `aim 1`), quieto al descubierto: caés a los 2,3 s; como viene, a los 3,3.
- **Girar de a décimas:** un personaje al que se le pide 0,07° más en cada paso gira de a décimas, sin saltos de un grado.
- **Las pruebas:** sin pantalla, 623; en el navegador, la mira, los ojos agachado, el mouse donde nada acerca la cámara.

## La velocidad y el salto

El autor preguntó si son los correctos. Hoy, el personaje camina a 4,5 m/s y corre a 7,5; salta a 6,5 m/s hacia arriba con la gravedad de la Tierra, así que sube $v^2/2g = 2{,}15$ m (una vez y un tercio su altura de 1,6 m) y está 1,33 s en el aire. Una persona camina a 1,4 m/s, trota a 3 y salta medio metro; los juegos exageran a propósito, para que las salas no parezcan enormes y el salto se sienta.

Para un juego de plataformas, 2 m está bien, con una gravedad más fuerte al soltar el botón y al caer (está en la fase 5). Para el juego de disparos y la aventura es mucho: lo usual es un metro, más o menos, y para lo alto, trepar o agarrarse de un borde. Son números de cada juego, no del motor: la fase 5 los fija para cada uno, con el banco de pruebas de sus niveles.

## Lo que sigue

La etapa 4.5b: las deudas que cambian la simulación, juntas, con una sola versión nueva. Las paredes y las pendientes; los disparos desde los ojos donde está la cabeza (agachado, más abajo); el coseno; las del tutorial y las de la fase 4.
