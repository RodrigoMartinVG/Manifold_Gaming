---
title: 'Etapa 5m: los niveles de la fortaleza'
description: 'La fortaleza pasa de tres niveles cortos a cuatro más largos: la muralla, el patio, los cuarteles y la torre del homenaje, cada uno con más de un camino, lugares desde donde mirar, guardias que hay que mover o esperar, y pergaminos fuera del camino seguro. Se dibujan como planos de caracteres. Y para que entren en el presupuesto, las piezas quietas del nivel ahora se dibujan en lotes: de casi 300 llamadas a menos de 100.'
sidebar:
  order: 65
---

> Informe de la 5m, después de la [5l](../etapa-5l/). Es la etapa de la [decisión 0031](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0031-games-that-play.md) para los niveles de la fortaleza.

## Lo que pedía

La 5l hizo que la fortaleza se leyera: la atención de los guardias, la gema, los ruidos, la piedrita. Faltaban niveles hechos para eso. La investigación de la 0031 pide:

- dos o más caminos de verdad y vueltas que se cruzan;
- un lugar seguro desde donde mirar cada zona;
- sombras largas y guardias que ceden terreno;
- un camino que se puede pasar sin fallar, y nunca dos peligros seguidos;
- objetivos con riesgo fuera del camino seguro, y un resumen al final.

Los tres niveles de la 5f se pasaban en un minuto cada uno. La decisión pedía niveles de 2 a 5 minutos.

## Cuatro niveles

| Nivel                 | Qué enseña                  | Cómo se pasa (la prueba)                                                                                                    |
| --------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| La muralla            | la oscuridad, la piedrita   | por la alcantarilla, oscura, a lo largo del muro interior, una piedrita al patio y la puerta mientras su guardia va a mirar |
| El patio              | un golpe por la espalda     | por el lado oeste, oscuro, a lo largo de la fachada, y el guardia de la puerta, volteado desde atrás                        |
| Los cuarteles         | esperar a que pase la ronda | detrás de la ronda, por el pasillo oeste, a un cuarto oscuro mientras pasa, y afuera por el norte                           |
| La torre del homenaje | llevar la llama             | por el lado este de la sala, la llama tomada a espaldas de su guardia, y por la nave oeste hasta la poterna                 |

- **La muralla.** Afuera, el muro tiene dos entradas: la brecha, iluminada por su farol, y lejos al este una alcantarilla oscura, el camino largo. Adentro, un guardia recorre el patio de punta a punta, y hay un farol en el medio, cajones y un depósito con un pergamino adentro. La puerta del muro interior está iluminada de los dos lados, con un guardia apostado mirando al patio. Una piedrita tirada al patio lo lleva a mirar.
- **El patio.** En el medio hay un establo con un pasaje oscuro de lado a lado, y un guardia da vueltas alrededor. Otro camina el lado este junto al farol del pozo, y otro está apostado en la puerta de los cuarteles. En el rincón noroeste hay una plataforma a un metro, con su rampa: desde ahí se ve el patio, y espera un pergamino. Otro está en el establo.
- **Los cuarteles.** Adentro hay una sala en el medio, con su guardia apostado mirando la puerta sur. Alrededor corre un pasillo, y un guardia lo recorre. Pasando el pasillo, a los dos lados, hay cuartos oscuros con una puerta cada uno, donde esperar mientras pasa la ronda. Un pergamino está en el cuarto noroeste y otro en la sala, a espaldas de su guardia.
- **La torre del homenaje.** Una sala con dos filas de columnas y un guardia que da vueltas en el medio. A cada lado hay una nave: la este la recorre un guardia, la oeste nadie. Al fondo, un ábside con la llama, y un guardia en su boca que mira a la sala. Por una puerta lateral se toma la llama a sus espaldas. Pero la llama alumbra, y la vuelta es lo difícil. Hay un pergamino al fondo de cada nave.

Cada nivel se juega entero en una prueba, como lo haría alguien que lo conoce, sin que lo descubran nunca. Esa corrida es su repetición de referencia. Las pruebas tardan 24, 22, 45 y 46 segundos. Los tiempos de oro son 1,3 veces eso: 32, 28, 59 y 60 s. Quien los juega por primera vez, mirando, esperando y probando caminos, tarda varios minutos.

## Pergaminos y el resumen

Cada nivel tiene dos **pergaminos** (zonas `scroll`) fuera del camino seguro: un objetivo de uno, como en Dishonored o Hitman. Al final del nivel, el panel suma dos líneas de la fortaleza a las del caparazón: los pergaminos que robaste de los que había ("Pergaminos: 1 de 2") y los guardias que volteaste ("No volteaste a nadie"). El caparazón aprendió a mostrar esas líneas de cada juego (`notes`, en el resultado de un nivel). Se muestran pero no se guardan: lo que se guarda sigue siendo el mejor tiempo, las estrellas y las caídas.

## Niveles dibujados como planos

Cuatro niveles de este tamaño son cientos de piezas: el primero tiene 248. Ahora se dibujan como **planos**: un archivo de nivel con una grilla adentro, un carácter por metro.

- `#` es una pared de 6 m, `+` una de 3, `c` un cajón, `o` una columna, `.` piso y un espacio, nada.
- Cada tramo de pared se arma con las piezas del kit de 4, 2 y 1 m, girado si va a lo largo de una columna. Las esquinas quedan en los dos tramos, así que no quedan huecos.
- El piso son baldosas de 4 m donde haya algo.
- Lo demás del archivo (los faroles, las rondas, las zonas, los guardias) pasa tal cual.

La herramienta es `levelFromPlan`, en el paquete del kit. Una prueba se asegura de que cada nivel sea lo que hace su plano, línea por línea. Si un plano cambia, el nivel se rehace con `--update`, como las repeticiones de referencia. Si alguien edita un nivel a mano, se separa de su plano, y la prueba lo dice.

## Las piezas quietas, en lotes

Cada pieza del kit era una copia de su modelo y se dibujaba sola: una llamada de dibujo, o más. Desde adentro de un patio grande, el piso y las paredes solos se habrían comido el presupuesto de 300 llamadas por cuadro (decisión 0026).

Ahora lo que la física nunca mueve y un modelo dibuja (las paredes, el piso y los cajones del kit; no lo que se rompe, da luz o es una zona) se dibuja **en instancias**: una llamada por cada malla de su modelo, por cada cuadrado de 16 m del nivel, tengan las piezas que tengan. Las copias siguen ahí, ocultas, para lo que las lee (un clic encima, la cuenta de las pruebas). Se rearman solo cuando una pieza aparece, se va o se mueve.

¿Por qué en cuadrados? Un solo lote para toda la ciudadela dibujaba todos sus triángulos desde cualquier lado: 46.000 de los 50.000 del presupuesto, porque un lote fuera de la vista no se deja de dibujar si alguna de sus piezas está a la vista. En cuadrados de 16 m, lo que no se ve se deja afuera un cuadrado por vez.

| Dónde                     | Llamadas antes | Llamadas ahora | Triángulos ahora |
| ------------------------- | -------------- | -------------- | ---------------- |
| La ciudadela (5 lugares)  | hasta 300      | 39 a 81        | 19.000 a 37.000  |
| La torre, primer piso     | 162            | 39             | —                |
| La fortaleza (la de 5f)   | 204            | 68             | —                |
| La muralla                | 152            | 29             | —                |
| Los cuatro niveles nuevos | —              | 36 a 112       | 15.000 a 34.000  |

La prueba de la ciudadela ahora también pide no más de 150 llamadas en cada uno de sus cinco lugares.

## Pruebas

- **Los planos**:
  - lo que no es la grilla pasa tal cual, en su lugar;
  - una baldosa donde un cuadrado de 4 por 4 tiene algo;
  - las paredes en sus tramos, de dos piezas de alto, en piezas de 4, 2 y 1, giradas a lo largo de una columna, y la baja de una;
  - un cajón donde dice;
  - el mismo plano da el mismo nivel, y un plano sin grilla, o con una grilla que no termina, se rechaza.
- **Los cuatro niveles**: cada uno es lo que hace su plano, y cada uno se juega entero sin que te descubran (en el patio, volteando a uno, que el resumen cuenta). Su corrida es su repetición de referencia.
- **La fortaleza**: lo de antes, en sus lugares nuevos (atrapado y de vuelta en el punto de control de la brecha; la salida de la torre solo con la llama; la atención frente al guardia del ábside, con la llama en la mano).
- **En el navegador**:
  - el primer nivel terminado, con su tiempo de oro y su resumen ("Pergaminos: ninguno de 2", "No volteaste a nadie");
  - el final de la fortaleza, con la llama vista por el guardia del ábside;
  - la ciudadela dentro de 150 llamadas.

La versión de la simulación pasa a **46** (el intruso cuenta pergaminos y guardias volteados). Cambian las repeticiones de la fortaleza; las del Dojo, la torre y la muralla dan el mismo hash.

## Lo que queda

La 5n: la muralla como niveles que se recorren, recuperando el muro tramo por tramo para cerrar la puerta antes del alba. Llaves y puertas, secretos, enemigos con roles, más armas y municiones.
