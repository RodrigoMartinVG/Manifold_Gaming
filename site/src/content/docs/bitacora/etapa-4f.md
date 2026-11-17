---
title: 'Etapa 4f: las piezas de la aventura'
description: 'Moverse para pelear: una explosión que arroja, bloquear, y fijarse en alguien para rodearlo sin alejarse. Las piezas de la historia: objetivos que se encadenan y escenas cortas, como líneas del nivel. Y un duelo en el Dojo que las junta.'
sidebar:
  order: 43
---

> Informe de la etapa 4f, la sexta de la [fase 4](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/ROADMAP.md). La aventura de la fase 5 va a usar estas piezas primero; acá se construyen en el Dojo, en una sala.

## Qué hicimos

- **Una explosión** (`World.explode`). Lo que mueve la física recibe un impulso. Un personaje recibe un cambio de velocidad, como si pesara 80 kg. Las dos cosas son menos con la distancia, y nada detrás de lo que no se mueve. Se oye, y se dice (`blast`). Un personaje arrojado conserva lo que le dio la explosión hasta que aterriza (`thrown`), y en el aire solo se maneja con lo que pide.
- **Bloquear**, un modo con su capacidad y sus números (`block`: la B, o el botón derecho): va a 2 m/s. Cuánto saca un golpe bloqueado lo decide cada juego; en el Dojo, un cuarto si viene de frente.
- **Fijarse en alguien** (`lock`: la T). Toma al más cercano de adelante a menos de 15 m, y lo suelta si se va, cae o se aleja. El personaje lo mira siempre, y sus pasos de costado lo rodean a la misma distancia.
- **Las piezas de la historia**, como líneas del nivel que avanzan con sus señales:
  - objetivos (`objective <nombre> when <señal> say <clave> [then <nombre>]`): el que no tiene ninguno antes es el que hay que hacer; cuando su señal se enciende, está hecho, y pasa al siguiente;
  - escenas cortas (`scene <nombre> when <señal> quién:clave …`), una sola vez.

  Corren en una fase propia (`story`), como eventos y datos del mundo. La página muestra arriba el objetivo, y abajo de él las líneas de una escena, cada una el tiempo que lleva leerla (un clic sigue).

- **El Dojo:** granadas, en un quinto soporte; su palo ahora golpea en todo su largo; un guardia bloquea mientras le pegan; una señal `down` cuenta los guardias caídos, para un nivel que la pide.
- **Una sala nueva, "A duel":** un maestro dice por qué estás ahí, y los objetivos se encadenan (tomar el palo, derribar al guardia, salir por la puerta), con el guardia peleado mano a mano, fijado en él.

## Rodear sin alejarse

Fijado en alguien a una distancia $r$, un paso de costado de largo $d$ en línea recta lo deja a $\sqrt{r^2 + d^2}$. Se aleja $\tfrac{d^2}{2r}$ en cada paso, y eso se suma: a 4,5 m/s y 3 m, una vuelta entera lo aleja metro y medio. Para seguir en el círculo, el paso va por la **cuerda** del arco que recorre. Un arco de ángulo $\theta$ tiene una cuerda de largo $d = 2r \sin\frac{\theta}{2}$, que forma un ángulo $\frac{\theta}{2}$ con la tangente. Así que el paso se tuerce hacia adentro un ángulo $\varphi$ con

$$\sin\varphi = \frac{d}{2r}, \qquad \cos\varphi = \sqrt{1 - \sin^2\varphi},$$

y el coseno sale de una raíz cuadrada: los mismos bits en todos los navegadores. Lo que se pide hacia el otro o lejos de él queda como estaba. Medido: una vuelta entera a 3 m, sin salirse más de 5 cm.

## Hallazgos

| Hallazgo                              | Qué pasaba                                                                                                                                                                                                      | Qué hicimos                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Rodeando, se alejaba igual**        | Con la cuerda y todo, se salía 44 cm en una vuelta. Su "de costado" se medía desde hacia donde miraba en el paso anterior, que al girar está apenas corrido: una pizca hacia afuera en cada paso, que se sumaba | Fijado en alguien, adelante y al costado se miden desde donde está el otro ahora |
| **La explosión casi no arrojaba**     | Un empujón de 4 m/s lo llevaba 26 cm: en el aire, el control frena hacia quedarse quieto cuando no se pide nada                                                                                                 | Arrojado, conserva lo que le dio hasta que aterriza                              |
| **Nadie se pegaba**                   | En el duelo, a 0,7 m uno del otro, ninguno le pegaba al otro en 40 segundos: el golpe del palo probaba solo el arco de la punta, a 1,2 m, y el que estaba más cerca no estaba ahí                               | El palo golpea en todo su largo: cada paso prueba la línea del pecho a la punta  |
| **Quién hablaba aparecía crudo**      | La escena decía `master` en lugar de "El maestro": quién habla tiene que ser una clave de las palabras del juego, como lo que dice                                                                              | `dojo.who.master`                                                                |
| **Formato sin revisar en dos etapas** | Dos archivos de la 4d y la 4e se subieron sin pasar el formateador; la integración continua lo habría marcado                                                                                                   | Formateados, y el chequeo de formato antes de cada commit                        |

## Medido

- **La explosión:** un personaje a 1,5 m, arrojado más de un metro antes de aterrizar; uno detrás de una pared, quieto; una caja de 50 kg, a 6 m/s.
- **Fijado:** una vuelta entera a 3 m, a menos de 5 cm; sin fijar, los mismos pasos lo alejan más de 3 m.
- **Bloqueando:** 2 m en un segundo, contra 4,5 caminando. En el duelo, los golpes bloqueados sacaron 8 de 30.
- **Las pruebas:** sin pantalla, 610 (11 nuevas en la etapa); en el navegador, el duelo: la escena, el objetivo en castellano y el siguiente.

## Las lecciones que ahora tienen dónde apuntar

- **4.3 impulsos:** la explosión, un impulso para lo que mueve la física y un cambio de velocidad para un personaje.
- **5.5 la cámara que sigue:** fijarse en alguien, y el arco que no se aleja.
- **6.12 la interfaz:** el objetivo y la escena, en las palabras del jugador.
- **6.13 guardar como datos:** objetivos y escenas como datos del nivel y del mundo.

**Lo que no hicimos como decía el plan:** qué hace la cámara al fijarse en alguien (encuadrar a los dos) queda para el trabajo de cámara de la 4.5.

## Lo que sigue

La etapa 4g: las piezas del shooter, la segunda mitad de la demostración. Una arena en el Dojo, en primera persona, con bots.
