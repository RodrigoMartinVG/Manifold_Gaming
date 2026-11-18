---
title: 'Etapa 5d: la torre'
description: 'El juego de plataformas terminado: cuatro pisos que enseñan el salto en la pared en cuatro tiempos, construidos con el kit por la medida del gimnasio; estrellas y un tiempo de oro por piso; los fantasmas compartidos por enlace y dibujados sobre una curva; jugados de punta a punta por una prueba, con sus repeticiones de referencia.'
sidebar:
  order: 55
---

> Informe de la 5d, después de la [5c](../etapa-5c/). Con ella, [la torre](../../jugar/torre/), el juego de plataformas de la [decisión 0029](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0029-the-three-games.md), está terminada.

## Lo que decidiste antes de empezar

Cuatro preguntas, todas con la opción recomendada:

- **Cuatro pisos,** uno por cada tiempo del salto en la pared.
- **La vuelta del tercer piso:** cosas que se mueven.
- **El desafío aparte:** tres estrellas y un tiempo de oro por piso.
- **Los fantasmas:** un enlace al terminar cada piso.

## Los cuatro pisos

Cada piso es un nivel de texto, hecho con el kit (paredes de 3 m, pisos, plataformas) y medido con el personaje del juego de plataformas:

- el salto llega a 2 m si se sostiene;
- el centro avanza 3,4 m caminando y 5,6 corriendo;
- se agarran bordes hasta 3,25 m;
- se suben chimeneas de hasta 4 m de ancho.

| Piso                | El tiempo                         | Qué pide                                                                          | Arriba | La hora | Oro  |
| ------------------- | --------------------------------- | --------------------------------------------------------------------------------- | ------ | ------- | ---- |
| **La entrada**      | Mostrarlo, en el suelo            | Una pared de 3 m (su borde) y una chimenea de 2,4 m hasta la terraza              | 6 m    | 18:36   | 9 s  |
| **El primer piso**  | Pedirlo, sobre el vacío           | Dos chimeneas (2,4 y 3,2 m), un salto de 2,5 m y un borde                         | 15 m   | 19:00   | 14 s |
| **El segundo piso** | Darle una vuelta: lo que se mueve | Una balsa hasta debajo de una chimenea colgada, y un elevador                     | 14 m   | 19:21   | 24 s |
| **La cima**         | Dominarlo, con la última luz      | Un borde, una chimenea de 3 m, una balsa, un descanso, un elevador y una de 3,6 m | 18 m   | 19:42   | 27 s |

La luz baja de piso en piso: el ambiente pasa de 1 a 0,45 y en los dos últimos se prenden lámparas. En los tres de arriba, la tierra queda 40 m más abajo; una caída devuelve al último punto de control.

Cada piso tiene tres estrellas fuera del camino:

- un borde más alto;
- un salto corriendo;
- una chimenea más ancha;
- la cima de un elevador;
- una isla a la que llega una segunda balsa.

## Jugados por una prueba, y lo que eso encontró

Una prueba juega los cuatro pisos hasta la meta como lo haría una persona. Camina hasta un lugar apuntando, salta sosteniendo, sube chimeneas de pared en pared y espera lo que se mueve. Su recorrido de cada piso queda como repetición de referencia: reproducirla tiene que terminar con el hash de su última línea. Las tardanzas son 6,7, 10,5, 21,7 y 23,9 s. En los dos últimos se cuentan las esperas a la balsa y al elevador, que cualquiera tiene que hacer. Los tiempos de oro son unas 1,3 veces esos.

Jugarlos así encontró cosas que a ojo no se veían:

- **El primer piso empezaba con un vacío de 4 m:** el piso de la chimenea no llegaba al balcón.
- **Dos chimeneas de la cima no tenían piso:** se entraba cayendo. Ahora se arranca parado.
- **Las metas no cubrían toda la terraza:** al salir de una chimenea por arriba se quedaba al costado de la meta, y a veces sobre una de sus paredes.
- **La chimenea colgada del segundo piso arrancaba a 2 m,** en el borde de lo que se alcanza saltando desde la balsa. Ahora baja hasta 1 m, sobre los últimos 2 m del recorrido de la balsa: al llegar, entre sus paredes, alcanza con saltar.
- **La balsa y el elevador de la cima no se sincronizan:** coinciden cada 24 s. Ahora hay un descanso fijo entre los dos, donde se espera el elevador.
- **El motor dejaba agarrarse del borde de un elevador** y quedaba colgado del aire mientras el elevador seguía. Ahora solo se agarra de lo que se queda quieto. Cambia la simulación, así que la versión pasa a 40 y las repeticiones de referencia del Dojo y de la torre se grabaron de nuevo.

## Los fantasmas, por enlace

Al terminar un piso, el cuadro ofrece compartir tu fantasma. Arma un enlace con su tira de poses, comprimida, y la copia si el navegador lo permite. Quien lo abre ve en el título la opción de correr contra él en ese piso.

Correr contra el fantasma de otro guarda tu mejor tiempo, pero no abre pisos: un enlace no te saltea la historia.

El piso de un fantasma se reconoce por su nacimiento: los valores que su receta cambia. El primer piso no cambia ninguno (todo está como viene), así que se elige el piso cuyos valores están todos en el nacimiento de la tira, el que más tenga.

La página del juego le ofrece ahora a cualquier juego sin consola dos cosas: la tira de lo que vas jugando, y una tira contra la cual correr desde el próximo mundo que nazca.

## Los fantasmas, sobre una curva

Hasta ahora, un fantasma se dibujaba sobre la recta entre sus dos poses vecinas (guarda una cada 6 pasos). Ahora se dibuja sobre una cúbica de Hermite que pasa por las dos con la velocidad de sus vecinas. Entre las poses $p_1$ (en el paso $t_1$) y $p_2$ (en $t_2$), con $h = t_2 - t_1$ y $u = (t - t_1)/h$:

$$
m_1 = \frac{p_2 - p_0}{t_2 - t_0}, \qquad m_2 = \frac{p_3 - p_1}{t_3 - t_1},
$$

$$
p(u) = (2u^3 - 3u^2 + 1)\,p_1 + (u^3 - 2u^2 + u)\,h\,m_1 + (-2u^3 + 3u^2)\,p_2 + (u^3 - u^2)\,h\,m_2 .
$$

Pasado un extremo, la pose se refleja: $p_0 = 2p_1 - p_2$. Con eso:

- a velocidad constante, la curva es la recta;
- una parábola de salto, muestreada a pasos iguales, la dibuja exacta.

Los tiempos son los de cada pose, así que el último tramo, más corto, no la desarma.

La primera medición dio peor que la recta. La razón: una caída devuelve al punto de control y el personaje aparece 20 m más allá entre dos poses, y la curva, al tomar como vecina una pose del otro lado de ese salto, hacía un rulo. Ahora, un tramo más largo que cualquier movimiento (3 m en 6 pasos) es un salto y no un movimiento: el fantasma está en la primera pose la mitad del tramo y en la segunda el resto, y ninguna curva toma vecinas a través de él.

Sobre un minuto de recorrido del circuito, sin los saltos, la curva queda a 1,25 cm de donde estuvo el personaje en promedio y la recta a 1,75: un 29% más cerca. Es lo que habían medido los compendios (un 30 a 40%).

## La música de la cima

Arriba se suma una campana aguda que suena con las dos notas del bordón. Así no empieza nada en un tiempo nuevo y la música sigue siendo escasa: una prueba lo exige para cada estado de ánimo.

## Pruebas

- **Los pisos:** los cuatro hasta la meta sin caídas; sus cuatro repeticiones hasta su hash.
- **Las estrellas:** dos de la entrada (el pilar por su borde, la chimenea de 3,2 m); las palabras; la música, escasa en cada estado.
- **Los fantasmas:** la curva más cerca que la recta; a velocidad constante, la recta; el final, donde terminó.
- **El progreso:** lo corrido contra un fantasma no abre pisos.
- **En el navegador:**
  - el título, los créditos, las líneas, un piso terminado con su tiempo de oro, y el enlace del fantasma;
  - ese enlace, abierto por otro, que corre en su piso sin abrir nada;
  - el final, después de la cima.

  Los pisos los termina un enlace que pone al personaje en la meta: jugarlos lo prueba la prueba sin pantalla.

## Lo que queda

- **Deslizarse y colgar** todavía usan las animaciones de caer y de trepar quieto. Animaciones propias, al cierre de la fase.
- **Las líneas del hilo** quedan como están: al final, desde arriba, se ven prenderse los faroles de la fortaleza. Es la noche de la aventura, que sigue.
- **Los números** (el salto, los tiempos de oro, dónde está cada estrella) se afinan jugando.

Con esto, el juego de plataformas está terminado. Sigue la 5e: las piezas de la aventura (la luz como herramienta, guardias que notan lo que cambió, el sigilo antes que el combate).
