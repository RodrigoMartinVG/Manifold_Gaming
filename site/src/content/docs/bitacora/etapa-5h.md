---
title: 'Etapa 5h: la muralla'
description: 'El shooter terminado: en primera persona, aguantar la muralla de la fortaleza contra oleadas de bots desde las cuatro y media hasta el amanecer, en tres niveles, con un ritmo que sube; las armas de la 5g; jugados por una prueba que apunta desde los ojos, con sus repeticiones de referencia.'
sidebar:
  order: 59
---

> Informe de la 5h, después de la [5g](../etapa-5g/). Con ella, [la muralla](../../jugar/muralla/), el shooter de la [decisión 0029](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0029-the-three-games.md), está terminada, y con ella los tres juegos de la fase 5.

## La historia

Sigue donde terminó la fortaleza: al amanecer van a venir a buscar la llama. La guardiana dice que entran por el portón, de a varios, cada vez más rápido, y que hay que aguantar hasta que salga el sol. Al final, el sol sale y se van, y la guardiana cierra la noche: subiste la torre, recuperaste la llama y la defendiste.

## Los tres niveles

Son patios de la fortaleza hechos con el kit. Los tres se juegan en primera persona, cada uno a una hora de la última parte de la noche:

| Nivel               | La hora | Oleadas | Cómo es                                                                                                     | Oro  |
| ------------------- | ------- | ------- | ----------------------------------------------------------------------------------------------------------- | ---- |
| **El patio**        | 4:30    | 3       | Entran por el portón del norte, por tres caminos; cobertura baja; una saeta y una escopeta en sus soportes. | 28 s |
| **Las dos puertas** | 5:15    | 4       | Entran por dos portones a la vez; cajones y muros bajos; también el lanzador.                               | 41 s |
| **El amanecer**     | 6:00    | 3       | El portón roto, más atacantes por oleada, y escopetas entre ellos.                                          | 48 s |

Cada oleada entra pocos segundos después de que cayó la anterior (la primera, a los 3 s; las demás, 4 s después). En la pausa, la salud del defensor vuelve entera.

Los atacantes son los guardias de `@manifold/arms` con su arma (un dardo, una saeta o una escopeta). Cada uno sigue su camino de entrada hasta que ve al defensor; entonces se queda quieto, apunta y dispara. Ven a 30 m y en 120°, más lejos y más ancho que un guardia de ronda (12 m y 100°): vienen a buscarte.

Un guardia con escopeta solo dispara de cerca, a 8 m o menos (a diez metros pegan uno o dos perdigones). Si está más lejos, se acerca primero.

## Un ritmo que sube

Cada oleada tiene un número de ritmo: $p = 3n + w$, con $n$ el lugar del nivel en la noche ($0, 1, 2$) y $w$ el de la oleada ($0, 1, \dots$). Con él, los atacantes salen de los tiradores de la arena (4g) y van hacia unos más rápidos:

$$
\text{ver} = \max(30,\ 60 - 6p), \qquad \text{volver a tirar} = \max(45,\ 90 - 6p), \qquad \text{puntería} = \min(0{,}3,\ 0{,}15 + 0{,}02p).
$$

Las dos primeras se cuentan en pasos, a 60 por segundo. Es decir:

- **para verte antes del primer tiro**, un segundo, y una décima menos por cada paso del ritmo, hasta medio segundo;
- **entre tiro y tiro**, un segundo y medio, y una décima menos por paso, hasta tres cuartos.

La puntería es la parte del camino hasta vos que la mira recorre en cada paso. Contra alguien que camina a $v$, una mira que recorre la parte $k$ queda atrás, en régimen, a

$$
\frac{v\,\Delta t\,(1-k)}{k}.
$$

Con $v = 4{,}5$ m/s y $\Delta t = 1/60$ s, eso da 0,42 m con $k = 0{,}15$ y 0,18 m con $k = 0{,}3$. Con 0,42 m erra más de lo que pega; con 0,18, la mayoría de los tiros pegan.

## Caer, y los caídos

El defensor que cae vuelve al punto de control a los 3 s. Los atacantes lo sueltan y vuelven a su camino. El resultado del nivel dice las veces que caíste, y su estrella es no haber caído nunca.

Los atacantes caídos se retiran a los 2 s. Primero se quedaban en el piso, y su cuerpo seguía siendo del mundo, así que estorbaba. En la segunda prueba, dos atacantes que buscaban al defensor quedaron empujando contra los caídos para siempre, y esa oleada no terminaba nunca. El guardia que no avanza y no lo nota es una deuda del cerebro, ya anotada en la 4.5. Acá la resuelve la regla del juego: los caídos no se quedan.

## La música

Las horas antes del amanecer, en mi menor pentatónico. Entre oleadas, un bordón grave y un llamado suave cada 16 tiempos. Mientras hay atacantes, un pulso cada cuatro tiempos bajo el bordón, y el llamado con respuesta. Las dos tienen mucho silencio ([decisión 0027](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0027-music.md)): menos de un quinto de los tiempos con nota al esperar, y como mucho un tercio al pelear.

## Pruebas

- **Los tres niveles, aguantados hasta la última oleada,** por una prueba que maneja al defensor como una persona:
  - se para junto a la cobertura;
  - apunta desde los ojos al pecho del atacante más cercano que ve;
  - dispara cada vez que el arma está lista.

  Los atacantes piensan cada paso, como en una página. El primer nivel costó 60 de salud, el segundo 135 (en cuatro oleadas, con la salud de vuelta entre una y otra) y el tercero 310, con dos caídas. Cada partida es una repetición de referencia que vuelve a su hash.

- **Las reglas:**
  - la primera oleada a los 3 s;
  - la siguiente 4 s después de que cae el último atacante, con la salud de vuelta;
  - después de la última, el nivel aguantado;
  - el defensor caído, de vuelta a los 3 s;
  - el ritmo, que nunca baja y llega a su tope.
- **El guardia con escopeta:** a 6 m se queda y dispara; a 11 m corre hasta 8 m y recién ahí dispara.
- **En el navegador:**
  - su título y sus créditos (las armas, de `art/weapons.py`);
  - en primera persona, con la mira;
  - el primer nivel aguantado, con su tiempo de oro y "Sin caer", y lo que se guarda.

## Lo que queda

- **Los atacantes no se cubren:** van por su camino y, cuando te ven, se quedan donde están. Que lean `affords` (dónde hay cobertura) sigue pendiente desde la 4e.
- **Un disparo no se oye en el mundo:** los atacantes te encuentran porque te ven, no porque te oyen. Queda de la 5g.
- **En red, contra otras personas,** en la fase 6.

Sigue el cierre de la fase 5.
