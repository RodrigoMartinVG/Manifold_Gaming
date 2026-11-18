---
title: 'Etapa 5n: la muralla, niveles que se recorren'
description: 'La muralla deja de ser oleadas en un patio: son cuatro niveles que se recorren, como los de Doom o Quake, para recuperar la muralla tramo por tramo y cerrar el portón antes del alba. Llaves y puertas de su color, secretos, enemigos con roles, un arsenal con munición, la repetidora y el orbe, botiquines y armadura. Y de paso, la mira que se elevaba sola al caminar.'
sidebar:
  order: 66
---

> Informe de la 5n, después de la [5m](../etapa-5m/). Es la etapa de la [decisión 0031](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0031-games-that-play.md) para la muralla, la que el autor describió así: "tiene que ser más como un nivel del Doom o del Quake, con varios niveles, diferentes cuestiones, llaves".

## De oleadas a niveles

Hasta ahora, la muralla eran tres patios donde los atacantes entraban por oleadas hasta la última. Ahora son **cuatro niveles que se recorren**, con el hilo del alba. Mientras recuperabas la llama, entraron por la muralla, y la recuperás tramo por tramo para cerrar el portón antes de que salga el sol:

| Nivel                | Hora | Lo nuevo                                           | Cómo se recorre                                                                                             |
| -------------------- | ---- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| El adarve            | 4:30 | la escopeta, la llave roja                         | un patio de cajones, una torre con la llave, la puerta roja y los que esperan en la sala                    |
| La casa de la puerta | 5:00 | los lanzadores de orbes, la repetidora, dos llaves | una sala de columnas, un cuarto con la repetidora, otro con la llave azul, un patio, la llave roja          |
| Las torres           | 5:30 | los que cargan, la ballesta y granadas             | un patio entre dos torres; la llave amarilla llama a los que cargan                                         |
| El portón            | 6:00 | el bruto, el lanzador                              | una sala con un bruto al fondo, la llave roja y el patio del portón, donde vienen los últimos en dos grupos |

Cada nivel tiene lo que el género pide:

- vueltas que regresan;
- una o dos **llaves**, con **puertas de su color**;
- un **secreto** detrás de un botón escondido;
- peleas que se disparan al entrar en un lugar;
- lo que se junta en el camino.

El final de un nivel es su salida, no la última oleada. El panel cuenta los secretos encontrados y los atacantes que volteaste ("Secretos: 1 de 1", "Atacantes: 8 de 8").

## Llaves y puertas, como datos

Las puertas ya estaban en el formato de nivel desde la 3c: una caja con `door` gira cuando su señal se prende. Una llave tomada prende una señal del nivel (`key_red`). La puerta la lee junto con la zona de adelante (`all key_red at_red`) y, con `latch`, queda abierta. El juego solo prende la señal de la llave: todo lo demás es del nivel.

Un secreto es lo mismo con un botón: `used` (apretar <kbd>E</kbd> en una zona) abre una puerta del color de la pared, un tono más clara. Esa es la pista que se ve.

## El arsenal

Antes, pasar por un soporte cambiaba el arma que llevabas: una sola. Ahora el defensor tiene un **arsenal** (`arms.arsenal`, en el paquete de las armas):

- las armas que tiene y su munición por tipo: dardos, cartuchos, saetas, cohetes y granadas;
- un soporte agrega su arma y algo de munición, y se usa una vez;
- las teclas <kbd>1</kbd> a <kbd>7</kbd> eligen: el palo, la saeta, la escopeta, la repetidora, la ballesta, el lanzador y la granada;
- lo que dispara gasta. Sin munición no dispara, y como en Doom toma lo mejor que tenga con munición: la escopeta, la repetidora, la saeta, la ballesta y, al final, el palo, que no necesita. Nunca el lanzador ni una granada por su cuenta, porque de cerca son el final de uno mismo.

Solo lo usa quien tiene un arsenal. Los personajes del Dojo y de la fortaleza, y los guardias, siguen como antes, y sus repeticiones dan el mismo hash.

Hay **dos armas nuevas**, con sus modelos hechos por el guion de Blender (headless) y su sonido:

- **la repetidora**: dardos de a diez por segundo, 12 cada uno, dentro de 2,5°. Es la saeta a chorros, y vacía el carcaj rápido;
- **el orbe**, de un atacante: una bola que brilla a 11 m/s. La investigación pide que el proyectil de un enemigo vaya entre 0,6 y 1,2 veces lo que corrés (7,5 m/s), para verlo venir y esquivarlo.

**Lo que se junta:**

- la salud, hasta el máximo;
- la armadura, hasta 100, que se lleva la mitad de cada golpe mientras dura;
- la munición, hasta lo que se puede llevar.

## Enemigos con roles

Hay uno nuevo por nivel, como pide la investigación, y se lo ve de lejos antes de pelearlo:

| Rol                | Arma     | Salud | Qué hace                                                            |
| ------------------ | -------- | ----- | ------------------------------------------------------------------- |
| El centinela       | saeta    | 40    | los muchos: dos saetas lo voltean                                   |
| El que lanza orbes | orbe     | 60    | aguanta un lugar y te obliga a moverte; levanta el arma 0,7 s antes |
| El que carga       | palo     | 80    | corre a 9 m/s (vos a 7,5), ruidoso: te das vuelta y lo enfrentás    |
| El bruto           | escopeta | 300   | camina a 3,2 m/s y casi no se inmuta: para eso está el lanzador     |

Todos son justos, con los números de la 5i, al ritmo del nivel.

## Pruebas

- **Los cuatro niveles**: cada uno es lo que hace su plano, y una prueba lo juega entero: pelea con quien aparece (apuntando desde los ojos al más cercano), toma las armas, las llaves y el secreto, pasa las puertas y llega a la salida, con todos los atacantes volteados y sin caer nunca. Su corrida es su repetición de referencia. Las corridas tardan 41, 47, 46 y 52 segundos, y los tiempos de oro son 53, 61, 60 y 67 s.
- **Una llave abre su puerta**: sin la llave, frente a la puerta no pasa nada. Con ella, la señal se prende, la puerta se abre y queda abierta.
- **Lo que se junta**:
  - la salud, sin pasar el máximo;
  - la armadura, que se lleva la mitad de un golpe de 20;
  - el soporte de la escopeta, que da el arma en la mano y 8 cartuchos, y desaparece.
- **El arsenal**:
  - una tecla toma su arma, y si la ranura está vacía no pasa nada;
  - disparar gasta;
  - sin dardos, toma el palo.
- **Un grupo llamado una vez**: al entrar en su zona vienen sus atacantes, de su rol (salud, arma y velocidad), y no vienen de nuevo.
- **En el navegador**:
  - el primer nivel terminado, con su tiempo de oro, su resumen y el arma en el HUD;
  - los atacantes justos, que levantan el arma antes del primer golpe.

La versión de la simulación pasa a **47**. Cambian las repeticiones de la muralla, y las del Dojo, la torre y la fortaleza dan el mismo hash.

## De paso: la mira que se elevaba sola

El autor vio que, en primera persona, caminando hacia adelante con <kbd>W</kbd>, la mira se elevaba sola sin mover el mouse. Era el balanceo de la 5k.

Al empezar cada cuadro, la cámara deshace solo lo que ella movió para ir a los ojos, y desde ahí calcula hacia dónde mira. El balanceo bajaba un poco los ojos en cada paso, después de eso, y nadie lo deshacía. Así, cuadro tras cuadro, la cámara quedaba un poco por debajo de donde quería estar, y miraba hacia su objetivo un poco más arriba.

Ahora el balanceo devuelve lo que movió al empezar el cuadro siguiente: todo el cuadro, su dibujo y lo que lo lee, tiene los ojos movidos, y la cámara nunca los toma como suyos. La prueba del balanceo en el navegador ahora también pide que, caminando sin tocar el mouse, hacia dónde mira arriba y abajo no cambie más de 0,01. Sin el arreglo, cambiaba 0,09 en un segundo y medio.

## Lo que queda

La 5o: la torre. Contacto y profundidad (una sombra, polvo, el sonido al deslizarse), saltos en la pared más permisivos, seis pisos y un final.
