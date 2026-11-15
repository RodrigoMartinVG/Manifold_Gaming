---
title: 'Etapa 2.5c: un formato y tres decisiones'
description: 'Las direcciones en grados enteros, que cambian solo pasado un grado: los enlaces de una repetición miden la mitad. Y tres decisiones escritas antes de que hagan falta: de dónde salen el arte y el sonido, el modelo de red de la fase 6 y el alcance de la fase 5. Con ella termina la 2.5.'
sidebar:
  order: 20
---

> Informe de la etapa 2.5c, la última de la 2.5. Antes de la 2e (modelos y animaciones), lo que quedaba: un formato de repetición más corto y tres decisiones que las fases que vienen necesitan escritas.

## Qué hicimos

- **Las direcciones, en grados enteros.** Adónde ir (`move`) y adónde mirar (`face`) son de un tipo nuevo de entrada, una dirección sobre el suelo: uno de 360 grados, de adelante (−Z) hacia la derecha (+X), y cuánto (de 0 a 1). Por dentro siguen siendo el vector que el personaje lee, armado con nuestro seno y coseno: los mismos bits en todos lados. El grado se calcula sin el `atan2` del navegador, comparando contra nuestro seno.
- **Cambian solo pasado un grado.** Una dirección nueva entra cuando la pedida se aleja un grado o más de la anterior. Una cámara que gira despacio, o una mano que tiembla en el borde entre dos grados, no piden una dirección nueva en cada paso.
- **En la repetición, `@37`** en vez de tres números: `input 41 1 move @37`, o `@37:0.5` con la mitad.
- **Tres decisiones escritas:** de dónde salen el arte y el sonido ([0015](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0015-art-and-sound.md)), el modelo de red de la fase 6 ([0016](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0016-the-networking-model.md)) y el alcance de la fase 5 ([0017](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0017-phase-5-scope.md)).

## Hallazgos

| Hallazgo                                                  | Qué pasaba                                                                                                                                                                                                                          | Qué hicimos                                                                                                                                                                |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lo que pesa en un enlace**                              | El plan decía que lo que llenaba un enlace era cómo se escribe hacia dónde mirar: un vector en centésimas. Medido, escribirlo como un solo ángulo ahorraba apenas un 8%: el deflate ya comprime bien los tres números               | Lo que pesaba era cuántas veces cambia: con la cámara girando, en casi cada paso. El umbral de un grado es el que corta el enlace a la mitad; el ángulo entero suma encima |
| **El umbral necesita memoria**                            | Redondear al grado más cercano no alcanza: una dirección que tiembla justo en el borde entre dos grados salta de uno al otro en cada paso                                                                                           | La dirección cambia recién cuando la pedida se aleja un grado de la anterior (histéresis). Una prueba hace temblar la mano entre 10,45° y 10,9°, y la dirección no cambia  |
| **Un grado de diferencia, en el borde de la comparación** | El cliente de red también normaliza antes de mandar. Si el servidor comparaba otra vez, un cambio de exactamente un grado podía quedar del lado de "es la misma" por un error de redondeo, y el cliente no lo iba a volver a mandar | Una dirección que ya es una de las 360 (la que manda el cliente, la que trae una repetición) entra tal cual. El umbral es solo para lo que llega crudo                     |

## Medido

- **Los enlaces de una repetición**, 30 s en el recorrido caminando con la cámara girando: de 5.803 caracteres a 2.712, y de 795 cambios de entrada a 418. Apuntando con el mouse: de 10.219 caracteres a 4.787. Los dos, un 53% menos.
- **Las repeticiones de referencia:** solo la de la fase 1 cambió de huella, porque sus direcciones no iban a lo largo de los ejes. Las de las fases 0 y 2 dan la misma: sus direcciones (adelante, a la derecha) ya eran exactas en grados enteros. La simulación pasó a la versión 11.
- **Las pruebas:** sin pantalla, 176 (4 nuevas: las direcciones, sus grados contra la trigonometría del navegador en 500 ángulos, el umbral con la mano que tiembla, y cuánto); en el navegador, 98.

## Lo que sigue

Termina la 2.5. Lo que sigue es la 2e: los modelos y las animaciones, con personajes de paquetes libres (CC0) ajustados por un guion y Blender corriendo desde la línea de comandos, como dice la decisión 0015. Y la pasada que le da más hondura al tutorial ([decisión 0013](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0013-a-deeper-tutorial.md)), antes de que nazcan las lecciones de la fase 2.
