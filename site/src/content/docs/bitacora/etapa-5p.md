---
title: 'Etapa 5p: la torre, con ritmo'
description: 'La torre pasa de cuatro pisos cortos a seis, cada uno con una idea que se enseña, se desarrolla, se tuerce y se cierra, y una baliza encendida en su meta. El salto perdona como en Celeste: salto de pared desde cualquier lado, tiempo de coyote en las paredes y un instante colgado arriba. Polvo al despegar, al caer y en la pared, el roce al deslizarse, la sombra siempre visible. La música suma una capa por piso y resuelve en la cima, donde la cámara se aleja sobre la tierra al atardecer.'
sidebar:
  order: 68
---

> Informe de la 5p, después de la [5o](../etapa-5o/). Es la última etapa de la [decisión 0031](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0031-games-that-play.md): la torre, el juego de saltos.

## Lo que pedía

La investigación de la 0031 le pedía a la torre cuatro cosas:

1. **Contacto y profundidad**: una sombra siempre debajo del que salta, polvo al despegar, al caer y en la pared, y el sonido de deslizarse.
2. **Perdón para los saltos de pared**, como en Celeste.
3. **Pisos con ritmo**: más pisos y más largos, cada uno con una idea que se enseña sin riesgo, se desarrolla, se tuerce y se cierra; lugares para descansar; la cima siempre a la vista y encendida.
4. **Atmósfera**: música que suma una capa por piso y resuelve arriba, y un final.

## Contacto y profundidad

- **La sombra.** Desde la 4a, cada personaje tiene una sombra justo debajo. Se achicaba y se aclaraba con la altura, hasta 20 m. Pero a 10 m su opacidad ya era 0,07, casi invisible, justo cuando más importa saber dónde vas a caer. Ahora se achica hasta la mitad y no queda más clara que 0,15.
- **El polvo**, en una sola llamada de dibujo:
  - al caer, un anillo de polvo que sale a lo largo del suelo, más y más grande cuanto más rápido bajabas (desde 2,5 m/s);
  - al despegar en un salto, uno más chico;
  - contra una pared en el aire, al deslizarse, un soplo al llegar y otro cada 0,08 s donde la tocás.
- **El roce.** Mientras te deslizás por una pared se oye un raspado: ruido rosa por un filtro de banda que sube de 700 a 1500 Hz y suena más fuerte cuanto más rápido bajás, hacia el lado donde estás.

## El perdón

Tres cosas, en el controlador, solo para quien salta de las paredes:

- **Un salto de pared desde cualquier lado.** Antes contaba solo si empujabas hacia la pared en ese momento. Pero el gesto natural es empujar hacia afuera y saltar. Ahora un salto en el aire busca una pared a menos de 45 cm del cuerpo: hacia donde empujás y al revés, y en ocho direcciones alrededor de donde mirás, a 45° una de otra. Para las diagonales usa su propio $\sqrt{1/2}$, así da los mismos bits en todos lados. Se queda con la más cercana.
- **Tiempo de coyote en las paredes.** Un salto desde el suelo podía llegar hasta 0,1 s tarde. Ahora uno desde una pared también: si empujaste contra ella hace menos de seis pasos, todavía te despegás de ella. Pero nunca dos veces de la misma.
- **Un instante colgado arriba.** Con el salto apretado, en el paso donde empezarías a bajar, la velocidad hacia arriba queda en 0 durante $h = 0{,}08$ s más (5 pasos). La altura no cambia, porque el arco ya llegaba ahí: siguen siendo 2 m. Pero el salto dura más:

$$
n_{\text{vuelta}} = 45 + \frac{h}{\Delta t} = 50, \qquad \text{alcance} = v \, n_{\text{vuelta}} \, \Delta t = 4{,}5 \cdot \tfrac{50}{60} = 3{,}75\ \text{m}.
$$

El modelo de métricas lo cuenta igual que el paso, y el gimnasio lo mide:

| Medida                         | Antes           | Ahora         |
| ------------------------------ | --------------- | ------------- |
| Altura del salto               | 2 m             | 2 m           |
| De vuelta al suelo, en el paso | 45              | 50            |
| Alcance caminando / corriendo  | 3,375 / 5,625 m | 3,75 / 6,25 m |
| La chimenea más ancha que sube | 4,46 m          | 4,83 m        |

Con eso se sube una chimenea de 4,5 m, que antes no se podía.

Solo los personajes del juego de saltos tienen estas reglas, y su estado nuevo solo existe en ellos. Por eso las repeticiones del Dojo, la fortaleza y la muralla dan el mismo hash.

## Seis pisos con ritmo

Los cuatro pisos de la 5d siguen, más largos: su meta vieja es ahora un descanso con su punto de control. Entre ellos entran dos pisos nuevos. Cada meta tiene una **baliza**, una columna con una luz fuerte, que se ve desde el principio del piso.

| Piso            | Hora  | La idea           | Cómo sigue                                                                                                    | Prueba / oro |
| --------------- | ----- | ----------------- | ------------------------------------------------------------------------------------------------------------- | ------------ |
| La entrada      | 18:36 | el salto          | después de la terraza: tres pilares, el último a un salto corriendo; un bloque con su borde; una chimenea     | 15,6 / 20 s  |
| El primer piso  | 19:00 | el salto de pared | después de la chimenea de 3,2 m: un pilar y otra chimenea de 4 m sobre el vacío, hasta 24 m                   | 17,5 / 23 s  |
| El segundo piso | 19:21 | lo que se mueve   | después del ascensor: una balsa de 8 m hasta un descanso y otro ascensor, hasta 20 m                          | 45,7 / 59 s  |
| El tercer piso  | 19:27 | lo que gira       | dos tiovivos (uno más rápido y más alto), una barra que se cruza en media vuelta, tres plataformas giratorias | 19 / 25 s    |
| El cuarto piso  | 19:33 | las manos         | el borde de una pared, otro al otro lado de un hueco, un salto corriendo, una caída, una escalera de bordes   | 13,7 / 18 s  |
| La cima         | 19:42 | todo              | después de la terraza a 18 m: un pilar y la última chimenea, de 4,5 m, hasta la cima a 27 m                   | 32,1 / 42 s  |

- **La barra** mide 10 m y da una vuelta cada 12 s. Te subís a su punta cuando apunta hacia vos, te quedás quieto media vuelta y te bajás del otro lado. Las tres plataformas giratorias se toman desde su centro, donde no te arrastran.
- **Las manos**: una escalera de bordes, cada uno 3 m más alto y un metro más allá, que se agarran y se suben.

Cada piso se juega entero en una prueba, sin caer, y su corrida es su repetición de referencia. El oro es 1,3 veces la prueba. Toda la torre es casi dos minutos y medio de prueba. Quien la juega por primera vez tarda bastante más.

## La música y el final

- **Una capa por piso.** El zumbido grave del primer piso; las tres notas del segundo; un pulso grave una octava abajo; una línea aguda; una segunda voz; y arriba, la campana de la 5d. Cada capa suena en los pulsos que ya sonaban, más uno al final. Así la música se vuelve más rica sin volverse más ocupada: en ningún piso empieza una nota en más de uno de cada cinco pulsos (la [decisión 0027](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0027-music.md): sobre todo silencio).
- **Resuelve en la cima.** Al llegar, en vez del silencio de los otros pisos: la raíz, su quinta y su octava, sostenidas.
- **El final.** En la cima, la cámara suelta al que trepó y se aleja hacia arriba y hacia atrás, girando despacio. En 7 s queda a 26 m y 11 m más alta, con el que trepó chiquito en la cima, la tierra abajo y el sol que se pone. Es una pieza de la torre: durante el final toma el lugar de la cámara en cada cuadro y se lo devuelve antes del siguiente, como el balanceo.

## Pruebas

- **El perdón**:
  - empujando hacia afuera, el salto despega de la pared;
  - a 40 cm de la pared, sin empujar, despega; a 60 cm, no;
  - empujando hacia afuera 6 pasos y saltando, despega; a los 8, no;
  - no despega dos veces de la misma pared;
  - con el salto apretado, queda 5 pasos más a 2 m, a la misma altura; si lo soltás ahí, baja enseguida.
- **Las métricas**: con el instante colgado, de vuelta en el paso 50, 3,75 m caminando, chimeneas hasta 4,83 m. **El gimnasio** lo mide: la de 4,5 m se sube, la de 5 no.
- **El polvo**: de 4 a 16 soplos según lo fuerte de la caída, hacia afuera por el suelo; de la pared, alejándose de ella.
- **Los seis pisos**, jugados enteros, sin caer.
- **La música**: dispersa en cada piso, con una voz más que el de abajo; arriba resuelve; abajo, al terminar, silencio.
- **En el navegador**:
  - un salto en el primer piso levanta polvo;
  - la cima terminada, con la cámara que se aleja detrás del panel;
  - el resto de la torre, con sus pisos nuevos.

La versión de la simulación pasa a **49**. Cambian las repeticiones de la torre; las del Dojo, la fortaleza y la muralla dan el mismo hash.

## Lo que queda

Con la 5p terminan las etapas de la 0031: los tres juegos juegan como juegos. Lo que sigue es **el bosque** ([decisión 0032](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0032-the-forest.md)): un segundo mundo para exigirle más al motor antes de la red.

Queda también, de la 5o, que el suavizado de la navegación conozca el costado de una escalera.
