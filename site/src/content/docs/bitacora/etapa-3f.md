---
title: 'Etapa 3f: el sonido'
description: 'Lo que pasa en la simulación se oye: pasos según el material del piso, aterrizajes, golpes según su energía, puertas, ascensores y lo que se rompe. Cada sonido es un evento, con un radio en el que se oye, para los guardias de la fase 4. El navegador los sintetiza con esos números, sin archivos grabados.'
sidebar:
  order: 29
---

> Informe de la etapa 3f, la sexta de la fase 3. Lo que un guardia va a oír en la fase 4, y lo que el jugador oye desde ahora.

## Qué hicimos

- **El sonido es un evento de la simulación.** Dice qué lo hizo, dónde, qué es (un paso, un aterrizaje, un golpe, una puerta, un ascensor, algo que se rompe), sobre qué superficie (un material de la 3b), qué tan rápido o qué tan fuerte, y **hasta dónde se oye**: un radio en metros, para los bots de la fase 4. Nada de eso queda guardado: un evento es lo que pasó en un paso.
- **Los pasos.** Uno cada zancada caminada sobre el piso (80 cm). Lo que lleva caminado desde el último es estado del personaje, y va en el hash. Su radio sale del material del piso (el metal se oye a 10 m, la madera a 7, la piedra a 6, el vidrio a 8, el hielo a 4) y de qué tan rápido iba: corriendo, más lejos.
- **Los aterrizajes**, según qué tan rápido venía cayendo.
- **Los golpes**, según su energía. Sale de lo que el mundo ya tiene: la velocidad de lo que mueve la física antes y después del paso, quitando lo que le dio la gravedad. La mitad de su masa por ese cambio al cuadrado es la energía del golpe. Suena sobre el material de lo que tocó. Por debajo de 0,02 J, es algo que se acomoda o se desliza, y no se oye.
- **Las puertas y los ascensores**, cuando empiezan a moverse; **lo que se rompe**, más lejos que nada.
- **El navegador los sintetiza**, con Web Audio y sin archivos grabados (decisión 0015): ruido por una banda y unos parciales que resuenan, según la superficie. La piedra golpea sordo, la madera repica, el metal resuena, el vidrio tintinea, el hielo cruje. Suenan tan fuerte como lo rápido o lo duro, más bajo con la distancia a la cámara hasta el radio del sonido, y del lado en que están. Una puerta cruje, un ascensor zumba, lo que se rompe se hace añicos. `view.volume` regula el volumen, y el navegador deja empezar el sonido recién después de una tecla o un clic.
- **El comienzo de la sala de superficies**, en tres pisos lado a lado: madera, piedra y metal.

## Hallazgos

| Hallazgo                                              | Qué pasaba                                                                                                                                                                                                                                            | Qué hicimos                                                                                                                     |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Los golpes, sin eventos de la física**              | Rapier puede avisar los choques, pero lo que avisa queda fuera del estado del mundo: una instantánea no lo guarda, y una copia restaurada podría oír un golpe de más o de menos. Para un guardia que reacciona a lo que oye, eso cambiaría la partida | El golpe sale de las velocidades de antes y de después, que están en el mundo: igual en cada copia y después de una instantánea |
| **La energía del golpe, algo más que la de la caída** | Una pelota que cae desde 2 m llega con m g h, pero el piso le devuelve un poco: el cambio de velocidad es la llegada más el rebote                                                                                                                    | Es lo que mide: la energía del cambio. La prueba pide m g h como mínimo, y menos de una vez y media                             |
| **El primer paso, más bajo**                          | Mientras arranca, el personaje va más lento que su paso, y su primer paso se oye un poco menos                                                                                                                                                        | Es lo que dice la regla: el radio va con la velocidad, y la prueba lo pide del último paso, a velocidad de caminata             |
| **El sonido se escucha desde la cámara**              | El jugador oye lo que ve: la cámara está unos metros detrás del personaje                                                                                                                                                                             | Se oye un poco más allá del radio, por lo lejos que está la cámara. El radio de la simulación, el de los bots, no cambia        |

## Medido

- **Los pasos:** caminando 4,5 m, uno cada 80 cm, todos sobre la madera, a 7 m. Sobre el metal, a 10 m caminando, y a 16,7 corriendo (10 × 7,5 / 4,5).
- **Un aterrizaje** desde 2,2 m: más de 5,5 m/s, oído más lejos que un paso.
- **Los golpes:** una pelota desde 2 m se oye más lejos que desde 0,5 m. Después, el rebote cae mucho más suave, y quieta no hace ruido.
- **Las repeticiones de referencia** cambiaron de huella (la zancada va en el hash). La simulación pasó a la versión 20.
- **Las pruebas:** sin pantalla, 342 (4 nuevas: los pasos por material y velocidad, el aterrizaje, los golpes por energía, puertas, ascensores y roturas). En el navegador, 135: pasos sobre el metal y sobre la madera, cada uno con su sonido, sin errores.

## Lo que sigue

La 3g: la masa, agarrar cosas y las uniones. Empujar según la masa, agarrar un objeto que sigue siendo dinámico, y lo que quedó pendiente de la 3b: que una corriente arrastre lo que mueve la física.
