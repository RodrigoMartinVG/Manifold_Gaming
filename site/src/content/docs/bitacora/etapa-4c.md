---
title: 'Etapa 4c: lo que lastima'
description: 'Cada personaje guarda sus últimas 16 poses, y un golpe se juzga contra ellas, mirando hacia atrás lo que vio quien tiró. La salud como mecanismo del motor y política de cada juego; un muñeco de entrenamiento que cae, inerte, y se levanta. Y tres armas: un dardo al instante, una saeta que vuela y no atraviesa un vidrio de 2 cm, y un palo que barre.'
sidebar:
  order: 40
---

> Informe de la etapa 4c, la tercera de la [fase 4](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/ROADMAP.md). La 4a le dio un cuerpo al personaje y la 4b lo que ese cuerpo puede hacer; esta, lo que lo lastima, y contra qué se juzga un golpe.

## Qué hicimos

- **Una decisión primero, la [0022](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0022-hits-and-the-history-of-poses.md):** los golpes y la historia de las poses. Una pose es dónde está un personaje, cómo está girado su cuerpo, su inclinación y su modo. Cada uno guarda las últimas 16, y un tiro mira hacia atrás hasta 15 pasos (un cuarto de segundo: la decisión 0016 había dicho de 200 a 250 ms) contra las partes que golpean, pero prueba el mundo como está ahora: solo las poses de los blancos vuelven atrás, nunca el mundo. Un golpe es un evento, nunca un mensaje.
- **La historia de las poses y los golpes contra ella.** Una fase después de leer la física escribe la pose de cada personaje; va en la huella y en las instantáneas (la de un personaje, unos 1,3 KB). Las partes que golpean son datos de cada modo: cabeza, cuerpo y piernas; inclinadas planeando; una bola encogida rodando. `castHit` prueba un rayo, o una bola arrastrada por él, contra las partes como estaban `back` pasos atrás, con nuestro propio rayo contra una bola y contra una cápsula. Las entradas tienen un tipo nuevo, `count`: un número entero hasta un máximo, para el `back` de un tiro.
- **La salud, mecanismo del motor y política de cada juego.** Un componente `health` (sus puntos, su máximo, el paso en que cayó) y `World.hurt`: cada golpe pasa por el filtro del juego (`Cartridge.filterDamage`, el gancho que tomó la decisión 0000) antes de sacar puntos, y lo dice (`hurt`). Sin puntos, cae (`down`), y un personaje caído no pide nada hasta que el juego lo levanta (`World.revive`). La política del Dojo: muñecos de entrenamiento donde un nivel tiene una zona `dummy`, una pelota que lastima cuatro puntos por joule, la cabeza el doble, la pelota propia nada, y el muñeco de pie otra vez a los tres segundos.
- **El golpe y la caída, solo en la vista.** Un golpe patea la columna de quien lo recibe hacia donde iba, con un resorte amortiguado (unos diez grados para un golpe entero, quieto en un segundo y medio). Caído, su modelo cae como un muñeco de trapo pasivo: una cápsula por hueso, articulaciones de rótula, en una física propia de la vista con las cajas fijas del nivel. Se levanta por inercia. El mundo sigue teniendo la cápsula.
- **Las armas, el mecanismo.** La semilla del mundo pasa a ser parte de su estado, y cada tiro tiene sus propios dados (`shotDice`: la semilla, el paso, el jugador y el número de tiro, no el azar del mundo), así que son los mismos en cada copia, tire lo que tire otra cosa. Los proyectiles son entidades (`projectile`), y una fase propia los avanza: en cada paso, un tramo de rayo, así que nada se cruza entre dos pasos. Pegan en lo primero que encuentran (`impact`) y lastiman lo que tiene salud. El trazo de un tiro instantáneo es un evento (`shot`: de dónde a dónde, a qué le dio).
- **Las armas del Dojo, su política.** Tres soportes en la sala `moves`, y el arma se agarra pasando por encima: es un componente del Dojo (`dojo.weapon`), como el inventario de la aventura es de la aventura, y una zona lo da. Se usa con la X, con el clic si el puntero está capturado, o con RB. El **dardo** es instantáneo: 25 puntos, un grado de dispersión, cada 12 pasos. La **saeta** es un proyectil a 80 m/s: 35. El **palo** es un golpe: su punta barre 120° adelante en 12 pasos, una bola arrastrada por el tramo de cada paso; 30, y a cada uno una vez por golpe. Detrás de un vidrio de 2 cm hay otro muñeco.
- **Lo que lleva en las manos, dibujado.** El juego dice qué lleva cada personaje (`tools`: una caja, dónde van las manos, un golpe en curso), y la vista lo sostiene adelante del pecho, hacia donde apunta su cuerpo dibujado. Las dos manos van a él por la cinemática inversa de la 4a. El palo se barre como lo barre el mundo, sin una animación propia. El trazo de un dardo sale de la punta dibujada y se apaga en 0,15 s.
- **La repetición de referencia de la fase 4** creció: el muñeco golpeado, caído y de pie, y cada arma una vez. Versión de la simulación, 33.

## La dispersión, uniforme en el disco

Un tiro con una dispersión de $R$ grados sale dentro de un cono de semiángulo $R$ alrededor de hacia donde apunta. Los dados dan dos números uniformes $u, v \in [0,1)$, y la dirección se aparta un ángulo $r$ hacia el rumbo $\varphi$:

$$r = R\sqrt{u}, \qquad \varphi = 360°\, v.$$

La raíz es lo que hace uniforme al disco de ángulos: la proporción de tiros dentro de $r \le \rho$ tiene que ser la del área, $\rho^2 / R^2$, y $P(R\sqrt{u} \le \rho) = P(u \le \rho^2/R^2) = \rho^2/R^2$. Con $r = R u$, en cambio, se amontonarían en el centro. En promedio,

$$\mathbb{E}[r] = \int_0^R r \,\frac{2r}{R^2}\, dr = \tfrac{2}{3} R,$$

y es lo que mide la prueba: en 400 tiros con $R = 2°$, una media de $4/3°$. El seno y el coseno son los de la simulación, así que la misma dirección sale con los mismos bits en todos los navegadores.

## Contra una cápsula

Una parte que golpea es una bola o una cápsula: un segmento de $a$ a $b$ y un radio $\rho$. Un rayo $o + t\,d$ (con $|d| = 1$) le pega en el menor $t \ge 0$ en que toca uno de tres: el cilindro, o las dos bolas de los extremos. Con $\ell = b - a$ y $w = o - a$, el cilindro infinito es $|(w + t\,d) \times \ell|^2 = \rho^2 |\ell|^2$, una cuadrática en $t$,

$$A t^2 + 2 B t + C = 0, \quad A = |\ell|^2 - (\ell\cdot d)^2, \quad B = |\ell|^2 (d\cdot w) - (\ell\cdot w)(\ell\cdot d), \quad C = |\ell|^2 |w|^2 - (\ell\cdot w)^2 - \rho^2 |\ell|^2,$$

y vale su raíz menor si cae entre los dos extremos ($0 < \ell\cdot w + t\,\ell\cdot d < |\ell|^2$). Si no, decide la bola. Son sumas, productos, una división y una raíz cuadrada: los mismos bits en todos los navegadores.

## Hallazgos

| Hallazgo                                    | Qué pasaba                                                                                                                                                                                                                           | Qué hicimos                                                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **El mezclador escribe solo lo que cambia** | Al levantarse, la cadera del maniquí se quedaba acostada. El mezclador de three.js escribe un hueso solo cuando el valor de su animación cambia, y lo que las capas de después le hicieron a un hueso quieto se quedaba, y se sumaba | Cada cuadro empieza desde la última pose del mezclador. Eso arregló también una cabeza que, corriendo unos segundos, giraba de más al apuntar |
| **El Dojo sacaba a sus muñecos**            | Los muñecos son del jugador 0, y la regla que quita a los personajes de los jugadores que se fueron los quitaba                                                                                                                      | El jugador 0 queda siempre                                                                                                                    |
| **El muñeco, fuera del alcance del palo**   | En la repetición de referencia, el palo no le pegaba: el muñeco había retrocedido 1,3 m. Quieto y sin pedir moverse, retrocede de 1 a 8 cm con cada pelota que lo toca: lo aparta el controlador, no un empujón por su masa          | El acto se pone al lado del muñeco, esté donde esté. Lo del controlador, anotado para la 4e, donde los guardias van a recibir golpes          |
| **El trazo, de un píxel**                   | El trazo del dardo era una línea, y WebGL dibuja las líneas de un píxel, pida el ancho que pida: casi no se veía                                                                                                                     | Una caja fina que brilla                                                                                                                      |
| **El palo bajaba tarde**                    | En reposo, el palo apunta 50° arriba; al golpear bajaba a 400°/s, y la punta ya barría mientras el palo dibujado seguía arriba                                                                                                       | Baja en tres cuadros y vuelve a subir despacio                                                                                                |
| **Las pelotas que se caen del nivel**       | Una pelota que sale del nivel sigue cayendo para siempre: en la repetición, algunas iban por los 700 m bajo el piso                                                                                                                  | Anotado. Cuesta poco, pero se acumula: para el presupuesto de la 4e                                                                           |

## Medido

- **La historia:** una fase de menos de un microsegundo, en un paso de 0,28 ms; 1,3 KB por personaje en una instantánea.
- **El dardo:** 25 al cuerpo, 50 a la cabeza (apuntando 2,7° arriba a 5 m). Apretado y sostenido no tira de nuevo, ni antes de 12 pasos. Un segundo jugador corre cruzando la puntería; el dardo, tirado cuando ya está más de 0,5 m adelante, erra si no mira hacia atrás, y le pega mirando 10 pasos atrás.
- **La saeta:** a 80 m/s (1,33 m por paso), el vidrio de 2 cm la frena y el muñeco de atrás queda con sus 100 puntos. En el núcleo, a 120 m/s (2 m por paso), una pared de 2 cm la frena, y el impacto dice dónde: su cara, a $z = -9{,}99$.
- **El palo:** 30, una vez por golpe; otro golpe, cuando está listo, otra vez.
- **El maniquí armado:** las dos manos a menos de 2 cm de donde van, también apuntando 30° arriba; el palo dibujado sigue el barrido del mundo (600°/s), y vuelve arriba.
- **Las pruebas:** sin pantalla, 567 (30 nuevas en la etapa); en el navegador, la misma huella en Node, Chromium, Firefox y WebKit, el muñeco que cae y se levanta, y el dardo en las dos manos que lo derriba.

## Las lecciones que ahora tienen dónde apuntar

- **3.9, rayos contra formas:** un rayo contra una bola y contra una cápsula, con la cuadrática de arriba.
- **3.15, lo que va rápido atraviesa:** la saeta, un tramo de rayo por paso, contra un vidrio de 2 cm.
- **4.14, tirar cosas:** la pelota que lastima por su energía; la saeta, un proyectil con su propia vida.
- **9.8, ver a los otros en el pasado:** la historia de las poses y el dardo que mira hacia atrás, para cuando la fase 6 tenga red.

**Lo que no hicimos como decía el plan:** el plan pedía un colisionador simple para los escombros de lo que se rompe, si hacía falta. No hizo falta: los fragmentos de la 3e son de la vista, y ningún escombro frena tiros ni pasos todavía. Y el palo no tiene una animación de Blender: lo barre el mundo, y los brazos lo siguen por la cinemática inversa.

## Lo que sigue

La etapa 4d: dónde piensa un bot y por dónde puede ir. Dos decisiones antes del código: si el cerebro de un bot corre en la simulación o como un jugador cuyas entradas llegan por la sesión, y qué grafo de navegación sale de las cajas y los mapas de un nivel.
