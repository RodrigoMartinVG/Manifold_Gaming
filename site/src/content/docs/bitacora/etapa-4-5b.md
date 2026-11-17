---
title: 'Etapa 4.5b: las deudas que cambian la simulación'
description: 'Todas juntas, con una sola versión nueva: contra una pared el personaje ya no guarda la velocidad que pide; en una pendiente demasiado empinada, resbala; una pelota ya no lo corre de lugar; lo que se va del mundo desaparece; el coseno tiene su último término, y los disparos salen de la cabeza agachada.'
sidebar:
  order: 46
---

> Informe de la etapa 4.5b, la segunda de la [4.5](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/ROADMAP.md). Junta todo lo que cambia la huella del mundo, para subir la versión una sola vez y grabar de nuevo las repeticiones de referencia una sola vez, antes de las mediciones de la 4.5c.

## Qué hicimos

- **Contra una pared, la velocidad que tuvo.** Empujando una pared, el personaje guardaba la velocidad que pedía, 4,5 m/s, quieto contra ella, y la soltaba entera al irse. Ahora el controlador dice qué paredes tocó (sus normales) y la velocidad pierde lo que la pared no le dejó hacer: a lo sumo $\mathbf{v} - (\mathbf{v}\cdot\mathbf{n})\,\mathbf{n}$. Solo lo que de verdad se le negó (al subir un escalón, el controlador toca su cara pero lo sube, y la velocidad sigue), y solo una pared: lo que llega más arriba que un escalón, comprobado con un rayo. Vale igual caminando, corriendo, agachado, bloqueando y en el aire.
- **En una pendiente demasiado empinada, resbala.** En 40° avanzaba 14 cm en dos segundos: cada paso que tocaba el suelo perdía la velocidad. Ahora, en una cara más empinada de lo que lo sostiene (30°, comprobada con un rayo desde su centro, para que el borde de una caja no cuente como pendiente), lo que lleva pendiente abajo lo conserva: la gravedad le suma a través del controlador y el rozamiento del piso le resta. Puede seguir subiendo y moverse de costado. Un piso que agarra más de lo que tira la pendiente lo sostiene, como uno plano.
- **Lo liviano no lo corre.** Quieto, un personaje retrocedía de 1 a 8 cm con cada pelota que lo tocaba: el controlador guardaba su distancia también de ellas (el muñeco de la 4c retrocedió 1,3 m en la repetición de referencia). Ahora el controlador no choca con lo que la física mueve si pesa menos de 5 kg (`LIGHT`): una pelota del Dojo pesa 14 g. Lo que queda a pocos centímetros de donde termina el paso, el personaje lo empuja con su propia regla, hacia donde camina y a lo sumo a su paso. Una caja de 45 kg lo sigue frenando.
- **Lo que se va del mundo, se va.** Una pelota que salía de un nivel sin vacío abajo caía para siempre, y la física seguía con ella. Lo que la física mueve, a más de 500 m del origen (`FARTHEST`), desaparece; un personaje nunca, eso es de cada juego.
- **El coseno, con su último término.** Su serie se cortaba un término antes que la del seno. Hasta 45°, ahora los dos quedan a un par de bits del final.
- **Los disparos, desde la cabeza.** Agachado, un dardo sale de donde está la cabeza (0,12 m sobre el centro), donde está la cámara en primera persona desde la 4.5a.
- **Versión de la simulación, 37.** Las seis repeticiones de referencia, grabadas de nuevo.

## Resbalar, con números

En una cara de pendiente $\theta$, la gravedad tira a lo largo de ella con $g\sin\theta$. El controlador lo lleva por la pendiente, así que en cada paso, de los $g\,\Delta t$ que la gravedad le agrega hacia abajo, queda $g\sin\theta\,\Delta t$ a lo largo de la cara. El rozamiento del piso, $\mu$, le resta $\mu\,g\cos\theta\,\Delta t$, nunca más allá de quedarse quieto. Resbala si

$$g\sin\theta > \mu\,g\cos\theta \iff \mu < \tan\theta,$$

y entonces acelera con $a = g(\sin\theta - \mu\cos\theta)$. En 40° sobre piedra ($\mu = 0{,}6$, y $\tan 40° = 0{,}84$) son 1,8 m/s²: 3,6 m a lo largo en dos segundos. Con $\mu = 1$ se queda. El seno sale de una raíz, $\sqrt{1 - \cos^2\theta}$: los mismos bits en todos los navegadores.

## Hallazgos

| Hallazgo                                        | Qué pasaba                                                                                                                                                                                                                                                    | Qué hicimos                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Cuatro deudas ya pagadas**                    | La lista de la 4.5 arrastraba cuatro deudas del tutorial (un cuerpo puesto que las consultas no veían, una normal NaN, cuerpos que se dormían en una pendiente, el comentario de la caja): la etapa de hallazgos de antes de la fase 4 ya las había arreglado | Fuera de la lista                                                                                        |
| **La pared y el escalón**                       | La primera regla quitaba la velocidad hacia todo lo que el controlador tocaba de costado: subiendo un escalón (35 cm), cuya cara toca, el personaje quedaba sin velocidad, y sin ella el escalón ya no lo subía                                               | Solo lo que se le negó, y solo lo que llega más arriba que un escalón                                    |
| **Una pendiente que agarra**                    | Con rozamiento de sobra, la gravedad lo seguía bajando de a un paso: 24 cm en dos segundos                                                                                                                                                                    | Si el piso lo sostiene, se queda como en un piso plano                                                   |
| **Rapier no deja preguntar a mitad de cálculo** | El filtro del controlador no puede preguntarle a Rapier por un cuerpo mientras calcula (lo tiene tomado: "Rust value while it was borrowed")                                                                                                                  | Lo liviano se anota por colisionador al crear el cuerpo, y se arma de nuevo al restaurar una instantánea |
| **Una caja de 125 g no se empujaba**            | Sin chocarla, el cuerpo del personaje la apartaba en el paso de la física solo un poco y la atravesaba                                                                                                                                                        | Lo liviano que queda a 5 cm entra en lo que toca, y lo empuja con su regla                               |
| **Las pelotas, apiladas delante del muñeco**    | La repetición de la fase 4 tiraba diez pelotas al muñeco: como ya no lo corrían, quedaban apiladas delante, y el dardo y la saeta pegaban en la pila. Y el muñeco caía tan tarde que las armas le tiraban caído                                               | Las armas, desde el otro lado (+Z), después de esperar a que se levante                                  |

## Medido

- **Contra la pared:** quieto, de 2 a 7,5 m/s hacia ella antes; a lo sumo lo que de verdad se movió en su margen (milímetros por segundo) ahora. Al irse por al lado, arranca de quieto.
- **En 40°:** 14 cm en dos segundos antes; más de 1,5 m hacia abajo ahora (piedra); con $\mu = 1$, menos de 5 cm.
- **Diez pelotas rodando hasta un personaje quieto:** 64 cm antes; nada ahora.
- **Una pelota cayendo sin piso:** desaparece a los 10 s, a 500 m.
- **Las pruebas:** sin pantalla, 633 (diez nuevas); el circuito, el ferry y los escalones, como antes.

## Lo que sigue

La etapa 4.5c: las repeticiones de referencia y las mediciones base, en una decisión, ahora que la simulación de los juegos quedó fija.
