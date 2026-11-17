---
title: 'Etapa 4g: las piezas del shooter, y el cierre de la fase 4'
description: 'Una cámara en primera persona, con el arma dibujada aparte para que no se meta en las paredes ni se estire; los disparos salen de los ojos, donde está la cámara. Una arena en el Dojo con tres guardias que disparan. Y el cierre de la fase: las dos mitades de su demostración, jugadas de punta a punta por pruebas.'
sidebar:
  order: 44
---

> Informe de la etapa 4g, la última de la [fase 4](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/ROADMAP.md): la segunda mitad de su demostración, y el cierre de la fase.

## Qué hicimos

- **Una cámara en primera persona** (`view.camera first`). Es la cámara de apuntar puesta en los ojos: se mueve como la de apuntar, detrás de la cabeza, y después se pone en los ojos, mirando hacia el mismo lado. Así girarla es lo mismo. El cuerpo no se dibuja, porque la cámara quedaría adentro de la cabeza.
- **El arma, dibujada aparte.** Lo que el personaje tiene en las manos se dibuja en una segunda pasada, sobre el mundo y con la profundidad borrada, con una proyección propia (50°, el plano cercano a 1 cm). No se mete en las paredes, porque se dibuja encima de ellas, y no se estira cuando el campo de visión del mundo es ancho. El trazo de un dardo sale de donde esa pasada dibuja la punta.
- **Los disparos salen de los ojos**, donde está la cámara: lo que está en el centro de la pantalla es lo que se golpea. Una prueba apunta desde los ojos a la cabeza de un muñeco, y le pega en la cabeza.
- **Guardias que disparan** (zonas `gunner`, con un dardo o una saeta). Cuando un guardia así te ve, se queda quieto, apunta desde sus ojos al medio de tu cuerpo y dispara una vez por segundo, después de un momento para verte. Si le pegan, sabe de dónde vino. Un guardia caído se levanta a los diez segundos (un muñeco, a los tres).
- **Una sala nueva, "The arena":** un cuadrado con muros, cosas detrás de las que cubrirse (`affords cover`), un dardo y una saeta en sus soportes y tres guardias con dardos. El objetivo se cumple cuando los tres están caídos a la vez (una señal `cleared`). Versión de la simulación, 36.

## La proyección del arma

Una cámara en perspectiva lleva un punto de la vista $(x, y, z)$, con $z < 0$ hacia adelante, a la pantalla por

$$x_s = \frac{f}{a}\,\frac{x}{-z}, \qquad y_s = f\,\frac{y}{-z}, \qquad f = \cot\frac{\theta}{2},$$

donde $\theta$ es el campo de visión vertical y $a$ la proporción de la pantalla. El arma está a 30 o 40 cm de los ojos. Con el campo de visión del mundo, si se ensancha, $f$ baja y el arma se ve más chica y deformada en los bordes. Además, con la profundidad del mundo, una pared a 20 cm la tapa: se metería en la pared. Dibujada en su propia pasada, con su propio $\theta$ y la profundidad borrada, ninguna de las dos cosas pasa. El precio: el arma no tiene sombra sobre el mundo, ni el mundo sobre ella. Para que el trazo salga de su punta, la punta se proyecta con la cámara del arma, y ese punto de la pantalla se vuelve a llevar al mundo con la del mundo, a la misma distancia de los ojos.

## Hallazgos

| Hallazgo                                           | Qué pasaba                                                                                                                                                                          | Qué hicimos                                                                                                                     |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Los disparos desde el pecho**                    | Un dardo salía del pecho, 22 cm debajo de los ojos: en primera persona, lo que está en el centro de la pantalla no era lo que se golpeaba                                           | Salen de los ojos. Las pruebas de la 4c, que apuntaban derecho desde el pecho, ahora apuntan al medio del cuerpo desde los ojos |
| **El hombro tapa media cabeza**                    | Apuntando al centro de la cabeza, un grado de dispersión bajaba el dardo 7 cm, y pegaba en el cuerpo: la parte del cuerpo es ancha (24 cm de radio) y llega al costado de la cabeza | Así son las partes; la prueba apunta 4 cm más arriba, donde la dispersión sigue cayendo en la cabeza                            |
| **Los guardias no se enteraban**                   | En la arena, tirados de costado, los guardias no se daban vuelta: solo veían lo que tenían adelante                                                                                 | Un guardia golpeado sabe de dónde vino                                                                                          |
| **"El vigía te ve" por los ojos de un guardia**    | El aviso del Dojo para el vigía de un nivel saltaba también con los ojos de los guardias                                                                                            | Solo para los vigías del nivel                                                                                                  |
| **Una corrida sobre una compilación que cambiaba** | Las pruebas del navegador de la 4f fallaron en ocho casos: mientras corrían, volví a compilar el sitio en la misma carpeta para una captura                                         | Corridas de nuevo sobre una compilación quieta: pasan. Una compilación por corrida                                              |

## Medido

- **La arena:** limpia en 5,7 s: 12 dardos acertados (cuatro por guardia), uno de ellos te pegó.
- **La primera persona:** el disparo desde los ojos le pega a la cabeza a la que apunta.
- **Las pruebas:** sin pantalla, 616 (6 nuevas en la etapa); en el navegador, la arena en primera persona, su objetivo y sus guardias.

## El cierre de la fase 4

La fase 4, combate y bots, en siete etapas:

- la 4a le dio a todos un cuerpo;
- la 4b, lo que ese cuerpo puede hacer;
- la 4c, lo que lo lastima, y contra qué se juzga un golpe;
- la 4d, dónde piensa un bot y por dónde va;
- la 4e, los guardias;
- la 4f, las piezas de la aventura;
- la 4g, las del shooter.

Su demostración tenía dos mitades, y las dos las juega una prueba de punta a punta:

- **un guardia en el torreón** que te oye, abre la puerta, llama el ascensor, sube detrás de vos y te pelea (4e);
- **una arena en primera persona con bots** (4g).

**Las fichas del tutorial** que la fase 4 ahora tiene dónde apuntar escribieron su línea de Manifold: 7.2 (A\*), 7.4 (la grilla en lugar de la malla), 7.7 y 7.12 (el guardia), 7.10 (oír a través de las paredes), 7.13 (dónde corre un cerebro), 9.8 (la historia de las poses), 3.15 (la saeta contra el vidrio), 5.12 y 5.14 (el cuerpo inerte y la cinemática inversa) y 1.2 (la proyección del arma).

**La tabla del plan** sumó siete filas, con lo que construyó la fase y quién lo va a usar:

- la salud y su filtro;
- los disparos y la explosión;
- la navegación;
- los bots como jugadores;
- bloquear y fijarse en alguien;
- los objetivos y las escenas;
- la primera persona.

**Lo que queda pendiente, anotado en sus etapas:**

- un personaje quieto retrocede con cada pelota que lo toca (4c);
- las pelotas que salen de un nivel caen para siempre (4c);
- la cámara al fijarse en alguien no encuadra a los dos (4f).

## Lo que sigue

La fase 4.5: la revisión antes de los juegos. El kit compartido, las decisiones que la fase 5 necesita antes de empezar y las deudas anotadas.
