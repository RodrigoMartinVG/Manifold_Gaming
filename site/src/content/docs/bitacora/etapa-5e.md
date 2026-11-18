---
title: 'Etapa 5e: las piezas de la aventura'
description: 'Las armas y los guardias, sacados del Dojo a un paquete del motor que comparten los juegos; y lo que la aventura necesita para el sigilo: la luz como herramienta (apagar una lámpara, el humo, la bengala), guardias que notan lo que cambió y se avisan, y un golpe por la espalda que vale más que pelear de frente.'
sidebar:
  order: 56
---

> Informe de la 5e, después de la [5d](../etapa-5d/). Es lo que la aventura de la [decisión 0029](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0029-the-three-games.md) necesita para su fortaleza de noche (5f): pasar sin ser visto es la mejor manera, y la luz es la herramienta.

## Las armas y los guardias, del motor

Los guardias, su cerebro, las armas (el dardo, la saeta, el palo, las granadas), lo que saca un golpe y lo que salva un bloqueo vivían en las reglas del Dojo. La aventura y el shooter también pelean. Pero un juego importa el motor, nunca otro juego ([decisión 0003](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0003-boundaries.md)), así que pasaron a un paquete del motor, `@manifold/arms`. Ahora el Dojo los importa de ahí.

Sus nombres en el estado pasaron de `dojo.*` a `arms.*`:

- el arma que se lleva, la mecha de una granada, quién tiró qué y cómo pelea un guardia con arma;
- atacar es `arms.attack`;
- el cerebro del guardia es `arms.guard`.

Eso cambia los hashes, así que la versión de la simulación pasa a 41 y las repeticiones de referencia se grabaron de nuevo. El comportamiento es el mismo bit por bit: las repeticiones viejas, con sus nombres devueltos, dan su hash viejo.

## La luz como herramienta

Un guardia ve con la luz de la simulación (3d). Por eso la oscuridad es por donde se pasa.

- **Apagar una lámpara:** "usar" cerca de ella, medido sobre el piso, aunque cuelgue alta, la apaga, y no da luz hasta que una mano la prende de nuevo. Es un campo opcional de la lámpara: las de siempre no lo tienen y sus hashes no cambian.
- **El humo:** se tira. Un segundo después, donde cayó, una nube de 5 m de ancho y 3 de alto, con 2,5 de opacidad por metro, tapa lo que hay adentro y detrás. La luz y la vista ya atravesaban zonas con opacidad (3d). Dura 8 s.
- **La bengala:** se tira, y es una luz de 7 m donde cae, por 20 s. Los guardias ven a quien alumbra.

Lo que un personaje lleva de cada cosa es su bolsa, y la llena pasando por una zona `item`.

## Guardias que notan, y se avisan

Un guardia que su juego hace **alerta** (`arms.wary`) suma tres reacciones a las de siempre:

- **Una lámpara que vio prendida y ahora ve apagada:** va hasta ella, como hacia un sonido, y la prende de nuevo con la mano.
- **Un guardia caído a la vista:** va a mirar alrededor.
- **En el momento en que empieza a perseguir a alguien, grita.** Los alertas cerca lo oyen y van.

Ver algo es tenerlo dentro de su alcance y su campo de visión, sin nada en el medio.

El grito respeta la [decisión 0023](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0023-where-a-bot-thinks.md): un cerebro solo pide entradas. Gritar es una entrada más (`arms.shout`), la simulación la convierte en un sonido de 15 m de alcance, y los demás lo oyen como cualquier sonido. Suena como dos tonos cortos que caen, y su subtítulo dice "un guardia grita: da la alarma".

Los guardias sin ese componente siguen como en la 4e. Los del Dojo y de la ciudadela no cambian.

## El sigilo paga, pelear cuesta

Con el filtro de daño de un juego de sigilo (`stealthDamage`), un golpe de palo por la espalda a un guardia que no ve a quien lo golpea lo voltea de una. De frente, el guardia ve venir el golpe y lo bloquea: le saca un cuarto. El juego elige ese filtro; el Dojo sigue con el de siempre.

## Pruebas

- **El refactor:** las siete repeticiones viejas, con sus nombres devueltos, dan su hash; todo el resto del Dojo pasa igual.
- **La luz:**
  - una mano apaga y prende la lámpara a su alcance;
  - en la oscuridad, un ojo deja de ver a quien tenía por su lámpara;
  - el humo tapa y se va;
  - la bengala deja ver en la oscuridad y se apaga.
- **Los guardias:**
  - el palo por la espalda voltea, y de frente se bloquea;
  - uno alerta prende de nuevo la lámpara que encontró apagada;
  - uno alerta que te ve grita, y el otro, de espaldas a todo, va hacia el grito.

## Lo que queda

- **Que los guardias lean `affords`** (dónde hay cobertura, para buscar ahí) queda para cuando la fortaleza lo pida.
- **El Dojo no trae todavía una sala con estas piezas.** Su "usar" también aprieta botones cerca de lámparas, y meterlas cambiaría sus partidas grabadas. Se prueban en la fortaleza.

Sigue la 5f: la fortaleza, de noche, con estas piezas.
