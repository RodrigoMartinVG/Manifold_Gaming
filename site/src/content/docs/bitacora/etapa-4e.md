---
title: 'Etapa 4e: los guardias'
description: 'Un guardia en el torreón: oye el ascensor, aprieta el botón de la puerta, llama el ascensor desde su placa, sube detrás de vos y pelea con su palo. Su cerebro corre una sola vez, donde se aloja la partida, y lo que pide entra como lo que pide cualquier jugador. La consola para mirarlo: qué hace, manejarlo con las teclas, volver unos segundos.'
sidebar:
  order: 42
---

> Informe de la etapa 4e, la quinta de la [fase 4](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/ROADMAP.md): la primera mitad de su demostración. La 4d decidió dónde piensa un bot y le dio por dónde ir; esta lo pone a pensar.

## Qué hicimos

- **Los bots, alojados** (decisión 0023). Un personaje puede llevar un cerebro (`brain`: cuál de los cerebros de su juego, y su recorrido). Eso es dato del mundo, así que cualquier anfitrión sabe para quién pensar. El cartucho da sus cerebros (`Cartridge.brains`). El `BotHost` del núcleo piensa por cada uno antes de un paso, y lo que cada uno pide entra a la sesión como la entrada de cualquier jugador: las repeticiones lo guardan, y todas las copias lo reciben. Lo aloja el servidor (no mientras se reproduce una repetición, que ya trae sus entradas), y el arnés de una prueba también. Su memoria son datos que guarda el anfitrión, fuera de la huella.
- **El guardia.** Es un jugador propio (100, 101…), con vida, un palo, ojos y un cerebro. Los ojos son un vigía sobre su cuerpo, que mira hacia donde mira él: ve con la luz, y a un jugador agachado le cuesta más. El cerebro:
  - patrulla su recorrido, de ida y vuelta;
  - oye lo que suena dentro del radio de cada sonido (un paso, el ascensor, una puerta, un golpe), se queda escuchando un momento, vuelto hacia el sonido, y después camina a mirar y mira alrededor;
  - corre detrás de quien ve, y le pega cuando lo tiene al alcance del palo.

  Su camino es el de la navegación: aprieta el botón de la puerta, espera en la placa que llama el ascensor, viaja, y no pisa un ascensor que todavía no llegó.

- **El Dojo:** guardias donde un nivel tiene una zona `guard`, o con `dojo.guard x y z [recorrido]`. Sus jugadores ahora tienen vida: caídos, vuelven a su punto de control a los tres segundos. Versión de la simulación, 34.
- **La consola.** `bots` dice el modo de cada uno, adónde va, qué oyó y qué vio y cuándo, y su camino. `possess <bot>` hace que tus teclas lo manejen: su cerebro espera y la cámara va con él. `back [segundos]` vuelve la partida: el servidor guarda una instantánea cada medio segundo, durante diez segundos, con lo que recuerdan los bots. `show.vision` ya mostraba lo que ve cualquier vigía, así que muestra lo que ven los guardias sin cambiar nada.
- **Una sala nueva, "A guard in the keep":** la demostración, abajo.

## La demostración, paso a paso

Empezás sobre el ascensor, pasada la puerta cerrada, y el ascensor te sube. Tarda tres segundos, y zumba al arrancar, con un radio de 12 m. El guardia está en el patio, detrás de la puerta, a unos 8 m:

1. lo oye, y se queda escuchando tres cuartos de segundo, vuelto hacia el ruido;
2. camina a mirar. La puerta está cerrada, y la navegación de la 4d dice que el camino pasa por su botón: va, aprieta `use` y pasa;
3. llega al pie del ascensor y mira alrededor. Arriba, tus pasos sobre la piedra se oyen a 6 m: los oye;
4. el camino hacia arriba pide el ascensor abajo, y el ascensor está arriba. La señal del ascensor es un `latch`: lo enciende alguien parado sobre él, y lo apaga la placa de al lado. El guardia se para en la placa, el ascensor baja, se sube y viaja;
5. arriba te ve a la luz de la lámpara, corre, y te pega con el palo hasta que caés.

Una prueba lo juega de punta a punta, y mira que cada parte pase en su orden: oyó, abrió la puerta, llamó el ascensor, subió, te pegó, caíste.

## Hallazgos

| Hallazgo                                       | Qué pasaba                                                                                                                                                                                                 | Qué hicimos                                                                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Se quedaba mirando la puerta**               | Después de abrirla, oía el chirrido de la puerta que él mismo había abierto, iba a mirarla y no llegaba nunca: el sonido estaba a 1,1 m de altura, y "llegar" pedía estar a menos de un metro de su altura | Lo que oye y lo que ve se ubica en el suelo de la navegación; una puerta o un ascensor que maneja él, o que se mueve al lado suyo, no va a mirarlo |
| **Llamaba el ascensor con vos arriba**         | Te veía subir y lo llamaba a mitad de camino: la placa del ascensor está solo abajo, así que viajar no lo retiene. Es juego legítimo, pero no de guardia                                                   | Primero escucha un momento, y camina para mirar: corre solo cuando ve                                                                              |
| **Se paraba en el borde del ascensor**         | Llegaba a la celda del borde y se quedaba un centímetro afuera de la zona que lo hace subir                                                                                                                | En un viaje, va primero al punto donde empieza                                                                                                     |
| **La navegación no conocía la puerta abierta** | Abierta, la hoja de la puerta queda donde giró, y el guardia se trababa contra ella siguiendo un camino que pasaba por ahí                                                                                 | Una puerta tiene dos estados: donde está cerrada, se pasa solo mientras está abierta; donde queda abierta, solo mientras está cerrada              |
| **Celdas debajo del ascensor**                 | La navegación tenía piso debajo del ascensor, y el guardia, arriba, quería bajar por ahí                                                                                                                   | Nadie se para debajo de un ascensor, solo encima                                                                                                   |
| **Una sala que no andaba en la página**        | Las líneas de mundo de la sala nueva corrían antes de que hubiera un mundo, y dos de sus comandos no se podían usar en una receta. Las pruebas solo jugaban las salas que tenían chequeos                  | `wait 1`, los comandos permitidos en recetas, y una prueba que juega todas las salas del Dojo                                                      |

## Medido

- **El presupuesto, en la sala `moves`:** un paso del motor tarda 0,26 ms sin guardias y 0,81 ms con ocho patrullando, unos 0,07 ms cada uno (su controlador, los rayos de sus ojos). Sus cerebros, 0,16 ms entre todos. La navegación se arma una vez, unos 60 ms, cuando la pide el primer cerebro. La página corre dos copias, la del servidor y la suya, y aun así queda muy lejos de un cuadro: no hizo falta llevar el servidor a otro hilo.
- **La demostración:** oye el ascensor en el paso en que arranca; abre la puerta a los 2,3 s, llama el ascensor a los 4,7, se sube a los 7,4 y llega arriba a los 9,8; con cuatro golpes, a los 12,8 s caíste.
- **Las pruebas:** sin pantalla, 599 (20 nuevas en la etapa, con una por sala del Dojo); en el navegador, la sala del guardia con `bots`, `possess` y `back`.

## Las lecciones que ahora tienen dónde apuntar

- **7.5 seguir un camino** y **7.6 el manejo:** de punto a punto, esperando lo que el camino pide.
- **7.7 el guardia patrulla** y **7.8 máquinas jerárquicas:** patrulla, mira, persigue, busca.
- **7.9 ver, 7.10 oír, 7.11 memoria y sospecha, 7.12 el guardia se da cuenta:** lo que percibe es de la simulación; qué hace con eso, de su cerebro.
- **7.13 una mente determinista:** Manifold eligió lo contrario (decisión 0023), y por qué.
- **3.13 el presupuesto del cuadro:** los números de arriba.

## Lo que sigue

La etapa 4f: las piezas de la aventura. El empuje de una explosión, bloquear, fijar al enemigo, y el diálogo, los objetivos y las escenas cortas como datos.
