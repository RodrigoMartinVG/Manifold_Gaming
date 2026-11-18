---
title: 'Etapa 5f: la fortaleza'
description: 'La aventura terminada: tres niveles de noche para entrar a la fortaleza y recuperar la llama de la torre sin que te vean, con las piezas de la 5e. La luz como cuenta (un guardia ve lo que está iluminado), guardias en su ronda o en su puesto, el resultado de cada nivel en "te vieron" y "te atraparon"; jugados sin ser visto por una prueba, con sus repeticiones de referencia.'
sidebar:
  order: 57
---

> Informe de la 5f, después de la [5e](../etapa-5e/). Con ella, [la fortaleza](../../jugar/fortaleza/), la aventura de la [decisión 0029](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0029-the-three-games.md), está terminada.

## La historia

Sigue donde terminó la torre, que llega con lo último del día y ve a la fortaleza prender sus faroles. La guardiana cuenta que, mientras subías, se llevaron la llama de lo alto de la torre a la fortaleza, y que la noche es tuya: un guardia ve lo que alumbra un farol. Al final, la llama vuelve, y la guardiana avisa que al amanecer van a venir a buscarla. Eso es la 5h: defender la muralla.

## La cuenta de la luz

Todo el juego se apoya en una cuenta que la simulación ya hacía desde la [3d](../etapa-3d/). La luz en el centro del cuerpo de un personaje es

$$
L = a + \sum_{\text{faroles}} i \left(1 - \frac{d}{r}\right),
$$

donde $a$ es la luz ambiente, y cada farol suma su intensidad $i$ por lo que le falta a su distancia $d$ para llegar a su alcance $r$ (si $d < r$ y nada se interpone). Un guardia ve a alguien que está en su alcance (12 m) y en su campo de visión (100°), sin nada en el medio, si

$$
L \cdot t \cdot p \geq 0{,}3,
$$

donde $t$ es lo que pasa a través del humo ($t = 1$ sin humo) y $p$ es la postura: $p = 1$ de pie y $p = 0{,}5$ agachado.

De noche la ambiente es $a = 0{,}12$, muy por debajo de 0,3: **en la oscuridad no te ve nadie**, ni de cerca. Un farol de alcance 4 a 3 m suma $1 - 3/4 = 0{,}25$, y $0{,}12 + 0{,}25 = 0{,}37$: de pie te ven, agachado ($0{,}185$) no. Ese es el tipo de cuenta que cada nivel pone delante.

El oído es la otra mitad. Un paso caminando sobre piedra se oye a 6 m; agachado, a 1,5 m (la mitad por ir más lento, y la mitad otra vez por la postura). Un guardia que oye algo se da vuelta, escucha y va a mirar: si estás a oscuras no te ve, pero se acerca.

## Los tres niveles

Son niveles de texto hechos con el kit, todos a las 22 h, con la ambiente de la noche.

| Nivel                     | Qué enseña                | Cómo es                                                                                                                                                                                                        | Oro  |
| ------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **La muralla**            | La oscuridad como refugio | Una brecha en la muralla, con un farol que la alumbra por dentro; un guardia que va y viene por el patio; al fondo, el portón.                                                                                 | 19 s |
| **El patio**              | Guardias alertas          | Dos guardias, uno por el costado oeste y otro cruzando; un farol en el medio; el portón del torreón, alumbrado de los dos lados; cajones para esconderse; humo y una bengala para levantar.                    | 28 s |
| **La torre del homenaje** | La llama, que te delata   | Un salón oscuro; al fondo, la llama en un pedestal, y un guardia en su puesto mirándola, de espaldas al salón; una puerta lateral a un pasillo con otro guardia de ronda, y una poterna cerca de su punta sur. | 23 s |

En **la muralla**, el farol de la brecha te muestra si un guardia mira hacia ahí; apagado, el patio entero es oscuro. El guardia alerta que lo vio prendido y lo encuentra apagado va a prenderlo de nuevo, y te deja el paso libre.

En **el patio**, el portón tiene dos faroles. Con los dos prendidos, agachado junto a uno de ellos tenés $L \approx 0{,}6$, y $0{,}6 \cdot 0{,}5 = 0{,}3$: te ven, justo. Apagado el más cercano, el otro deja $L \approx 0{,}32$ en el portón, y agachado $0{,}16$: pasás. El humo también sirve.

En **la torre del homenaje**, la llama, una vez tomada, se lleva prendida: es un farol de alcance 2,6 e intensidad 0,7 sobre vos, así que $L \geq 0{,}82$ y cualquier guardia que mire hacia tu lado te ve, aunque vayas agachado ($0{,}41$). La salida es más difícil que la entrada: hay que salir por la puerta lateral cuando el guardia del pasillo va hacia el norte, de espaldas, y llegar a la poterna antes de que se dé vuelta.

Las dos piezas del sigilo tienen sus números:

- **El palo por la espalda:** alcanza 1,2 m desde el pecho. Contando su grosor y el del otro cuerpo, llega a un centro a unos 1,65 m. El primer guion de prueba golpeaba desde 1,7 m y no llegaba.
- **Agachado, se te oye a 1,5 m:** acercarse desde atrás a un guardia quieto es posible, por poco.

## Guardias en su puesto

Hasta acá, un guardia sin ruta se quedaba donde terminara cualquier cosa que hubiera ido a hacer. Ahora, un guardia alerta sin ruta tiene un **puesto**: el lugar donde empezó, mirando hacia donde miraba. Cuando termina de mirar o de buscar, vuelve ahí y mira hacia el mismo lado. Un nivel lo pide con una zona `post` en vez de `guard`, y la función que crea un guardia acepta `false` como ruta: ninguna.

Los guardias de la 4e no lo tienen, así que las partidas grabadas del Dojo dan sus mismos hashes.

## El resultado de cada nivel

El cascarón de los juegos muestra, al terminar un nivel, sus estrellas y sus caídas. La fortaleza dice las dos cosas a su manera:

- **Las estrellas** son 1 si ningún guardia de pie te vio ("Nadie te vio") y 0 si alguno te vio ("Te vieron"). Un guardia volteado todavía tiene ojos en la simulación, pero el juego no los cuenta.
- **Las caídas** son las veces que te atraparon. Atrapado, quedás en el suelo 3 s y volvés al último punto de control, con lo que llevabas.

## La música

De noche y más lenta que la de la torre: un bordón grave en re menor pentatónico y un pulso suave dos veces cada 16 tiempos. Mientras un guardia te ve, el bordón cambia el doble de seguido, el pulso suena cada cuatro tiempos y aparece una nota aguda encima. Las dos siguen la [decisión 0027](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0027-music.md), con mucho silencio: menos de un quinto de los tiempos con una nota al acechar, y como mucho un tercio en alerta.

## Los calabozos de una semilla

El comienzo de la aventura de la [3k](../etapa-3k/), sus calabozos hechos de una semilla con la partida que se guarda, sigue en [su página](../../jugar/aventura/). Ahora es lo extra de la fortaleza, y su tarjeta lleva a los dos.

## Pruebas

- **Los tres niveles, jugados sin ser visto,** por una prueba que maneja al intruso como una persona que los conoce. Los guardias piensan cada paso, como en una página. Ninguno se pasa sin esperar: hay que esperar a que el guardia mire para otro lado. Cada partida es una repetición de referencia que vuelve a su hash.
- **Las reglas:**
  - atrapado, volvés al punto de control a los 3 s;
  - la salida de la torre del homenaje no cuenta sin la llama, y lo dice;
  - un guardia de pie que te ve cuenta, y uno volteado no.
- **El puesto:** un guardia alerta sin ruta oye un grito, va a mirar y vuelve a su lugar, mirando hacia donde miraba.
- **En el navegador:**
  - su título, sus líneas, un nivel terminado con su tiempo de oro y "Nadie te vio", y lo que se guarda;
  - el final: la llama llevada fuera de la torre del homenaje, las últimas líneas, los créditos y otra vez el título.

## Lo que queda

- **En la oscuridad no te ve nadie,** ni a un paso. Es la regla más simple, y la que estos niveles enseñan. Un sentido de cercanía (sentir a quien está casi encima) haría la oscuridad menos absoluta. Queda para cuando un nivel lo pida.
- **Que los guardias lean `affords`** (dónde hay cobertura) sigue esperando. Estos niveles no lo necesitaron.
- **Tres niveles,** el mínimo que pedía el plan (tres a cinco). Cada uno enseña una cosa. Más niveles quedan para después de jugarlos.

Sigue la 5g: las armas del shooter, bien hechas.
