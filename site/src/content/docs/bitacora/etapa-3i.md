---
title: 'Etapa 3i: la interfaz del juego, y los ajustes del jugador'
description: 'Un menú de pausa, los ajustes que quedan guardados (volumen, sensibilidad, invertir el eje, subtítulos de los sonidos, menos movimiento de cámara), un HUD con el tiempo, las caídas y las estrellas, y un cuadro al llegar a la meta. Todo en el idioma del jugador: el mundo dice qué pasó con claves y números, y la página lo dice en palabras.'
sidebar:
  order: 32
---

> Informe de la etapa 3i, la novena de la fase 3. Lo que cualquier juego necesita alrededor del mundo, y la decisión que pedía: en qué idioma hablan los juegos.

## Qué hicimos

- **La decisión primero ([0019](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0019-the-games-words.md)):** el mundo no lleva frases. Dice lo que pasó con una clave y sus números (`dojo.star`, 1, 2), y la página lo dice en el idioma del jugador, de tablas de palabras: una por idioma, español e inglés, completas las dos (una prueba lo pide). El idioma es el de la página (`<html lang>`): el sitio está en español, así que los juegos también. La consola sigue en inglés, y escribe los avisos en inglés.
- **Los avisos del Dojo son claves.** "Punto de control", "Te caíste: de vuelta al punto de control", "Una estrella: 1 tomadas, quedan 2": en la pantalla, en español; en la consola, en inglés. Las pruebas comparan claves, que no cambian si se reescribe una frase.
- **El menú de pausa:** <kbd>Esc</kbd> o <kbd>P</kbd> (<kbd>Start</kbd> en un mando). Jugando solo, el mundo se detiene; en una partida con otros, no (el mundo es de todos), y el menú lo dice. Seguir, Ajustes, Empezar de nuevo.
- **Todo con el teclado solo:** las flechas van de un control al siguiente (izquierda y derecha mueven un deslizador), <kbd>Enter</kbd> o <kbd>Espacio</kbd> aprietan, <kbd>Esc</kbd> vuelve. Y con un mando: la cruz, A y B.
- **Los ajustes del jugador:** el volumen, la sensibilidad del mouse y la del stick, invertir el eje vertical, subtítulos de los sonidos, y menos movimiento de la cámara para quien se marea (un arrastre no la sigue girando, y vuelve atrás del personaje a la mitad de velocidad). Cada uno es una variable de la vista (`view.mouse`, `view.calm`…): la consola también los cambia.
- **Quedan guardados**, como las teclas de la consola: en este navegador, para cada juego. Se aplican antes que cualquier receta (una sala o un enlace que pide otra cosa, gana). Lo que cambia una persona, en el menú o en la consola, se guarda; lo que cambia una receta, no; y un ajuste que vuelve a su valor de fábrica se olvida.
- **El HUD:** lo que el juego dice que se ve, leído del mundo en cada cuadro. En el Dojo, en un nivel con meta: el tiempo, las caídas y las estrellas (tomadas, de todas las que había), de lo que el corredor del personaje ya guardaba.
- **Un cuadro de diálogo**, que el juego abre cuando quiere: al llegar a la meta, el tiempo, las caídas, las estrellas, y dos botones, "Otra vez" (empieza de nuevo) y "Quedarme".
- **Subtítulos de los sonidos:** cada sonido que la cámara oiría, escrito abajo, con una flecha hacia donde vino ("Pasos en piedra ↑"). Se ven con sonido o sin él. El mismo sonido otra vez suma sobre su línea ("×3") en vez de llenar la pantalla.

## Hallazgos

| Hallazgo                                      | Qué pasaba                                                                                                                        | Qué hicimos                                                                                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Una receta no es el gusto del jugador**     | Guardando cada cambio de un ajuste, una sala que bajara el volumen lo dejaría bajo para siempre                                   | El registro avisa de dónde vino cada cambio (una persona o una receta), y solo se guarda lo de una persona                               |
| **Un cuadro que se abre mientras se escribe** | Un `dojo.goto` a la meta desde la consola abría el cuadro, que se llevaba el foco: lo que se seguía escribiendo iba a sus botones | La consola queda por encima de los cuadros. Uno que se abre mientras se escribe no toma el foco, y lo recibe cuando la consola se cierra |
| **Un piso sin material, en los subtítulos**   | Suena como piedra (3f), pero los subtítulos decían solo "Pasos"                                                                   | Sin material, piedra, como suena                                                                                                         |
| **Los subtítulos tapaban la inspección**      | Los dos estaban abajo a la derecha                                                                                                | Los subtítulos, abajo en el medio, como en el cine                                                                                       |
| **"0.6" en una interfaz en español**          | Los deslizadores mostraban el valor como lo escribe la consola                                                                    | En el idioma del jugador: "0,60"                                                                                                         |
| **Apuntando, Esc es del navegador**           | Con el mouse tomado (`aim`), el navegador usa Esc para soltarlo, y puede no pasárselo a la página                                 | <kbd>P</kbd> abre el menú siempre; si el primer Esc solo soltó el mouse, un segundo Esc lo abre                                          |

## Medido

- **La pausa:** con el menú abierto, la página dibuja 20 cuadros más y el mundo no da un paso. Al seguir, los pasos siguen.
- **Los ajustes:** el volumen a 0,4 con las flechas e invertir el eje con la barra espaciadora, sin tocar el mouse; después de recargar la página, ahí siguen. De vuelta a su valor de fábrica, se olvidan.
- **El HUD del recorrido:** "Tiempo 0:04,0 | Caídas 0 | Estrellas 0 de 3"; una caída al vacío, "Caídas 1"; en la meta, el cuadro, y "Otra vez" empieza de nuevo con 0 caídas.
- **Los subtítulos:** caminando por el comienzo de la sala de superficies, "Pasos en piedra ↑".
- **Las pruebas:** sin pantalla, 362 (7 nuevas: el aviso de los cambios de la vista, las tablas completas en los dos idiomas, las frases con sus números y decimales, el tiempo, el idioma de la página, las palabras del Dojo y su HUD). En el navegador, 142 (4 nuevas: la pausa, los menús con el teclado y los ajustes que quedan, el HUD con la meta, y los subtítulos).

## Lo que sigue

La 3j: hacer niveles, y la consola que crece. Construir una sala desde la consola y exportarla como texto, niveles dibujados como grillas de texto para los calabozos, y recetas con `wait` y `assert`.
