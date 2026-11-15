---
title: 'Etapa 3g: la masa, y agarrar cosas'
description: 'Cada cosa pesa lo que dice su material para su tamaño. El personaje empuja con una fuerza que el roce de lo que empuja tiene que no superar: una caja de madera se desliza, un bloque de piedra de una tonelada no se mueve. Agarra lo que tiene adelante y lo lleva, sin que deje de ser de la física. Y una corriente arrastra también lo que mueve la física.'
sidebar:
  order: 30
---

> Informe de la etapa 3g, la séptima de la fase 3. Lo que la fase 4 va a empujar, y lo que un juego de aventura va a cargar.

## Qué hicimos

- **La masa sale del material.** Un cuerpo toma la densidad de su material (3b): una caja de madera de 40 cm pesa 45 kg; un bloque de piedra de 80 cm, 1.229. Sin material, la de la física, como hasta ahora.
- **Empujar según la masa.** El personaje empuja lo que se le cruza por el piso, hacia donde va, a lo sumo tan rápido como camina, con una fuerza de 900 N como máximo. El roce de la cosa con el piso (su masa, por la gravedad, por su fricción) tiene que ser menor para que se mueva: la caja se desliza (220 N de roce); el bloque no (7.000).
- **Un juego empuja lo que mueve la física** (`World.push`): un cambio de velocidad, con el impulso que eso pide para su masa, despertándolo si dormía. Lo usan el agarre y la corriente.
- **Agarrar** (`grab`: la G, o el gatillo derecho). Lo que mueve la física frente al personaje (lo busca abajo y arriba) sigue siendo de la física: en cada paso se lo empuja hacia un punto adelante del personaje, con 1.200 N como máximo para su masa. La caja va; el bloque no se despega del piso. A 2 m, lo suelta. Lo que tiene agarrado es estado del personaje, y va en el hash.
- **Una corriente arrastra lo que mueve la física**, lo que quedó anotado después de la 3b: lo empuja hacia su caudal según el arrastre de su material, por el piso. Una pelota se va con ella; un cubo de piedra en el fondo se queda, porque lo sostiene su roce.
- **El formato de nivel, versión 6:** `dynamic`, una caja que mueve la física.
- **En la sala de las máquinas:** una segunda puerta que abre una placa, una caja para dejar encima, y un bloque de piedra demasiado pesado.

## Hallazgos

| Hallazgo                                            | Qué pasaba                                                                                                                                                                      | Qué hicimos                                                                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **El bloque de una tonelada se movía como la caja** | Rapier empuja con un impulso según la masa del personaje en cada paso que lo toca. Esos impulsos se suman: el bloque terminaba yendo a la velocidad del personaje, como la caja | El personaje empuja con su propia regla: una fuerza máxima, que el roce de la cosa tiene que no superar. La de Rapier quedó apagada |
| **Agarrar lo que está bajo**                        | La búsqueda salía del pecho, y una caja en el piso quedaba por debajo                                                                                                           | Busca a dos alturas, abajo y arriba, y toma lo más cercano                                                                          |
| **Al arrancar a caminar, la soltaba**               | El personaje gira de una vez hacia donde va, y el punto donde sostiene la caja gira con él: un cuarto de vuelta la dejaba a 1,54 m, más allá de los 1,5 a los que la soltaba    | La suelta a 2 m                                                                                                                     |
| **La dirección de "mirar"**                         | Un paso de 0,1 hacia un costado no lo giraba: solo gira hacia donde camina si lo que le piden pasa de 0,1                                                                       | En las pruebas, 0,3                                                                                                                 |

## Medido

- **La masa:** la caja de madera, 0,4³ × 700 = 44,8 kg; el bloque, 0,8³ × 2.400 = 1.229 kg.
- **Empujar:** caminando contra ellos dos segundos, la caja avanza más de 2 m; el bloque, menos de 30 cm (en realidad, nada).
- **Agarrar:** la caja se levanta del piso y sigue al personaje, que la lleva hasta la placa; soltada, cae. El bloque no se despega, y al alejarse, lo suelta.
- **La corriente:** una pelota avanza más de un metro en dos segundos; un cubo de piedra, menos de 5 cm.
- **Las repeticiones de referencia** cambiaron de huella. La simulación pasó a la versión 21.
- **Las pruebas:** sin pantalla, 353 (11 nuevas: la masa del material, empujar según la masa, el empujón de un juego, agarrar, soltar y lo que no se levanta, el estado del agarre, el formato 6, la masa calculada; en la sala, la caja sobre la placa y el bloque; en el arroyo, la pelota y el cubo). En el navegador, 136: la G agarra la caja.

## Lo que sigue

La 3h: la cámara contra las paredes. Que nunca termine adentro de una pared, y que una zona pueda sugerir hacia dónde mirar.
