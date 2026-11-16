---
title: 'Lo que el tutorial encontró en el motor'
description: 'Escribir las lecciones del tutorial obligó a medir el motor de cerca, y apareció lo que nadie había mirado: cuerpos que las consultas no ven, una normal que no es un número, saltos en las costuras del piso, cajas que se duermen en una pendiente, palabras sin plurales, pies que patinan. Cada cosa, medida primero y arreglada en su capa, con una prueba que falla sin el arreglo.'
sidebar:
  order: 37
---

> Informe de la pasada por el motor antes de la fase 4. El [informe anterior](../etapa-3-tutorial/) dejó, en su tabla de hallazgos, ocho cosas que el motor hacía mal o decía mal. Acá están todas: medidas con Rapier solo cuando el problema era de Rapier, y arregladas en la capa donde nacen.

## Qué hicimos

- **Las consultas ven lo que se acaba de poner.** Un cuerpo creado o puesto en otro lugar entre dos pasos (`place`), o antes del primero, ya aparece en los rayos y los barridos, donde está. Rapier actualiza lo que ven sus consultas recién en su paso siguiente, y no tiene cómo hacerlo antes. Hasta ese paso, `physics.ts` le pregunta a cada uno de esos cuerpos por separado. El controlador del personaje se frena contra ellos. La instantánea guarda cuáles son, porque Rapier guarda en la suya su árbol viejo.
- **Un rayo que empieza adentro tiene normal cero.** Es siempre un número, y quiere decir "acá no hay superficie". La sombra bajo un personaje no se dibuja cuando su rayo empieza adentro de algo.
- **El piso de un mapa sigue debajo de las paredes.** Donde el piso y las paredes forman un rectángulo, queda una sola losa. El laberinto del Dojo pasó de 17 losas a una.
- **Una regla para dormir.** Cuando Rapier duerme un cuerpo, el motor mira la superficie que lo sostiene: una caja o una cápsula puede resbalar si esa superficie es más empinada de lo que aguanta su rozamiento, y una pelota, en cualquier pendiente. Y resbala si venía bajando por ella como la pendiente la hace bajar. Entonces el sueño se rechaza y el cuerpo sigue como venía. Uno que se apoya en otros, en una pila o trabado en un rincón, no se mueve: algo más lo sostiene, y duerme. Se pregunta solo en ese momento, así que no cuesta nada mientras todo descansa.
- **El comentario del empujón, corregido.** El rozamiento de la caja contra el piso es de 242 N, no de 220, porque Rapier promedia los dos coeficientes. Ahora hay una prueba que lo distingue. Sobre el empujón propio de Rapier: movía el bloque con la masa de una persona, pero no con la que le da a la cápsula del motor.
- **El calabozo, fijo.** Las huellas de los seis calabozos que se comprueban están escritas en la prueba: un cambio sin querer al generador ahora falla. Y donde solo entran una o dos salas, la llave va a la primera sala, nunca donde empieza el personaje (antes no había llave).
- **Las palabras de los juegos:**
  - **plurales en frases enteras.** Una frase que dice cuántos se escribe entera para cada forma del número, y el idioma elige cuál (`Intl.PluralRules`). Puede tener además una forma para un número propio (`=0`: "la última, ya son 3"). "1 tomadas, quedan 1" pasó a ser "1 tomada, queda 1";
  - **los subtítulos ya no pegan pedazos.** Hay una frase entera para cada sonido y cada material ("Un golpe contra madera"), y su flecha sale de la mirada de la cámara acostada sobre el piso;
  - **la fecha de una partida guardada,** en el idioma del jugador: "Partida guardada el 16 de noviembre de 2026".
- **Los pies del maniquí, quietos en el piso.** El caminar y el correr se hicieron de nuevo, por script como siempre (`art/mannequin.py`):
  - cada pie está apoyado un cuarto del ciclo y va hacia atrás bajo la cadera en línea recta, a velocidad fija; cada pierna con sus dos huesos se resuelve para que llegue ahí;
  - la cadera sube y baja (solo eso, nunca a lo largo del piso): una pierna recta desde donde está armada apenas llega al piso, y un pie adelante o atrás la pide más baja. La prueba del arte ahora lo permite, y nada más;
  - la vista toma el paso de cada ciclo de lo que mide en el modelo (`STRIDES`), y en las diagonales pesa cada ciclo por su paso, no solo por el ángulo, para que el paso mezclado apunte adonde camina el personaje;
  - en la mezcla, la vista pone cada pie donde los pies de los ciclos están, mezclados, y no donde los deja la mezcla de los giros de los huesos. Un pie apoyado se queda donde bajó hasta que se levanta (`feet.ts`). Es solo de la vista: el mundo no se entera.
- **La versión de la simulación sube a 23.** Las cinco partidas de referencia, grabadas de nuevo, terminan con las mismas huellas: solo cambió su número de versión.

## Hallazgos

| Hallazgo                                             | Qué pasaba                                                                                                                                                                                                                                                                                 | Qué hicimos                                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ni antes del primer paso**                         | Además de lo que se pone entre pasos, antes del primer paso de un mundo las consultas de Rapier no ven ningún cuerpo. Un personaje no encontraba el piso en su primer paso                                                                                                                 | Entra en la misma regla: hasta el paso, cada cuerpo se pregunta por separado                                                                      |
| **La instantánea y lo que no se ve**                 | Rapier guarda en su instantánea el árbol viejo de sus consultas. Una copia restaurada sin la lista de lo no visto habría respondido distinto que la original                                                                                                                               | La lista va en los bytes de la física, antes de los de Rapier. Una prueba compara la huella paso a paso                                           |
| **La primera normal que probamos rompió una prueba** | Para el rayo que empieza adentro probamos primero la dirección del rayo al revés, como si hubiera una superficie de frente. Un rayo hacia abajo desde adentro de una pared "encontraba" un piso, y el personaje que dejaba de trepar a mitad de pared volvía a recibir el salto de la cima | La normal es cero: no hay superficie. La prueba de trepar lo cuida                                                                                |
| **La primera regla dejaba despiertas las pilas**     | Miraba solo la pendiente de la superficie que más sostiene. Un cubo apoyado en otros, inclinado, "no podía" descansar: en la sala de estrés, unos 20 cubos quedaban despiertos para siempre, y el paso costaba más                                                                         | La regla pide también que el cuerpo venga bajando: con eso, la sala queda igual que sin regla (0 a 2 despiertos)                                  |
| **Las pelotas también se dormían**                   | Una pelota en una pendiente de medio grado se dormía a los 8 mm. Debía rodar 3 m en diez segundos                                                                                                                                                                                          | La regla vale para ellas: ruedan en cualquier pendiente de más de 1 en 1000                                                                       |
| **Lo que ofrece Rapier contra las costuras**         | Un compuesto con `FIX_INTERNAL_EDGES` arregla la pelota, pero una caja que resbala igual se tropieza. Engrosar el contacto (`contactSkin`) y redondear los bordes no sirven                                                                                                                | En un mapa rectangular, una sola losa. Un piso irregular (las salas y pasillos de un calabozo) necesita un cuerpo compuesto: queda para la fase 4 |
| **El ciclo de caminar no caminaba**                  | El pie más bajo iba unos 5 cm atrás y adelante bajo la cadera, sin avanzar: el muslo iba un cuarto de ciclo desfasado de la rodilla. Los 0,42 m eran del pie levantado. Ningún paso de la vista podía frenar el patinaje                                                                   | El arte, de nuevo (arriba): sin eso, ningún número alcanzaba                                                                                      |
| **Las diagonales, mezcladas por los huesos**         | Con los ciclos nuevos, cada dirección pura ya no patinaba, pero las diagonales sí, cerca de 1 m/s. El mezclador mezcla los giros de los huesos, y dos piernas inclinadas, mezcladas, dan una pierna demasiado larga: el pie se hundía 3 cm y bajaba antes de tiempo                        | Los pies se mezclan donde están, y cada pierna se resuelve hasta ellos                                                                            |
| **El rozamiento de Rapier cede**                     | Empujada con menos fuerza que su rozamiento, la caja no acelera, pero se arrastra a velocidad fija: 7 mm/s con 200 N, 32 con 240 N                                                                                                                                                         | Anotado; es el resolvedor de Rapier. La prueba de los 242 N mira si acelera, no si se mueve                                                       |

## Medido

- **Las pruebas sin pantalla:** 495 (eran 435), y cada arreglo con una que falla sin él.
- **En el navegador**, contra una copia construida del sitio: la física y el determinismo en Chromium, Firefox y WebKit, y las pruebas del sitio que tocan esto (el HUD, los subtítulos, la partida guardada de la aventura, el maniquí, el fantasma, las instantáneas).
- **El presupuesto de la luz** (0,6 del paso de Rapier) a veces falla con la máquina cargada. Medido contra el código de antes en las mismas condiciones, los dos dieron entre 0,18 y 0,81: es la máquina, no este cambio.
- **Las consultas, con Rapier solo:**
  - un cuerpo fijo movido entre pasos no aparece ni donde estaba ni donde quedó;
  - uno creado entre pasos tampoco;
  - antes del primer paso no aparece ninguno;
  - después de un paso, sí; lo que se mueve en un paso, siempre (0 fallas en 60 pasos a 30 m/s).
- **La normal desde adentro:** `NaN` en una pelota desde su centro, cero en una caja o una cápsula, de costado en una pelota fuera de su centro.
- **Las costuras:**
  - una pelota a 6 m/s sobre losas de 1 m salta hasta 29 cm;
  - en el laberinto, con 17 losas, hasta 42 cm antes de llegar a una pared; con una losa, nada;
  - los calabozos que se comprueban quedan con 6 a 22 losas;
  - una caja que resbala a 6 m/s salta 18 cm, con el compuesto o sin él.
- **El sueño:**
  - una caja a 27°, medio grado pasada su ángulo de rozamiento (26,57°), se dormía a los 30 pasos después de bajar 1,6 cm; despierta, baja 4,3 m en diez segundos (la cuenta del rozamiento da 4,2);
  - no dormir nunca no es la salida: en una pila asentada de 200 cuerpos, cada paso de Rapier pasa de 0,45–0,55 ms a 2,0–2,3 ms;
  - en la sala de estrés, despiertos a los 5, 10, 15 y 20 s: 1, 0, 2 y 0 sin regla y con la regla; 21, 20, 22 y 20 con su primera versión.
- **El empujón de Rapier, con Rapier solo:** con la masa de una persona (70 kg), en dos segundos mueve la caja 4,5 m y el bloque 3,8. Con la de la cápsula del motor (0,4 kg), la caja 0,5 m y el bloque nada.
- **La caja contra el piso:** 44,8 kg · 9,81 · 0,55 = 241,7 N. Con 230 N no acelera; con 255 N gana 0,3 m/s por segundo.
- **Los pies del maniquí** (la prueba lo mueve con el archivo del modelo, como lo mueve la vista):
  - con los ciclos viejos, caminando derecho, el pie patinaba 2,5 m/s;
  - con los nuevos, en cualquier dirección y a los dos ritmos, entre 0,1 y 1,3 cm/s en promedio. Lo más, 13,5 cm/s, en el cuadro en que el pie se levanta;
  - la vista nunca tuvo que sostener un pie a más de 6 mm de donde lo ponían los ciclos;
  - el paso de cada ciclo: caminando, 2,64 m adelante, 2,24 atrás y 1,36 de costado; corriendo, 3,04, 2,40 y 1,60;
  - a 4,5 m/s son 1,7 ciclos por segundo hacia adelante y 3,3 de costado: un paso de costado no puede abrirse mucho sin cruzar los pies.

## Lo que sigue

- **El piso de un calabozo como un solo cuerpo** (un compuesto de cajas, y lo que eso toca: dibujarlo, escribirlo de vuelta, la consola), antes de que la fase 4 llene los calabozos de cosas que se tiran y ruedan.
- **Las lecciones:** el rayo que empieza adentro, el sueño y su regla, las costuras y el rozamiento que cede son material para la parte de física del tutorial nuevo, con estos números.
- Después, la **fase 4**, empezando por partirla en etapas (4.0).
