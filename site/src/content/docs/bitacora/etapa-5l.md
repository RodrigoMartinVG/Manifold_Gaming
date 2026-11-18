---
title: 'Etapa 5l: que la fortaleza se lea'
description: 'Los guardias de la fortaleza ya no te encuentran de un vistazo: su atención se llena mientras te ven, más rápido cerca y con luz, y se vacía si salís de su vista. Se lee en un círculo sobre su cabeza (?, sospecha; !, te descubrió), en sus voces y en la música. Una gema dice cuánto se te ve, tus pasos dibujan hasta dónde se oyen y una piedrita tirada hace que un guardia vaya a mirar. Y de paso, las armas ya no atraviesan las paredes.'
sidebar:
  order: 64
---

> Informe de la 5l, después de la [5k](../etapa-5k/). Es la etapa de la [decisión 0031](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0031-games-that-play.md) para la fortaleza, el juego que el autor encontró con menos juego.

## Lo que faltaba

La decisión 0031 comparó la fortaleza con lo que los juegos de sigilo coinciden en necesitar (Thief, Mark of the Ninja, Dishonored, Splinter Cell, Hitman y la serie "School of Stealth" de GMTK). Le faltaban las dos primeras cosas, que son las que todos tienen:

1. **Que quien se mete pueda leer cuánto se lo ve.**
2. **Que la atención de los guardias se lea, y se llene con el tiempo.** Hasta ahora, un guardia que te veía un instante ya te había descubierto.

## La atención que se llena

Ahora cada guardia de la fortaleza tiene una **atención**, un número de 0 a 1. Es del mundo: está en el hash, el cerebro del guardia la lee y la vista la dibuja. Mientras te ve, se llena. Cada paso suma la parte que le toca del tiempo que tarda en estar seguro:

$$
T = \frac{0{,}35 + (2 - 0{,}35)\,\min\!\left(1, \frac{d}{12}\right)}{\operatorname{clamp}\!\left(\frac{\text{luz} \cdot \text{postura}}{0{,}3},\ 1,\ 2{,}5\right)}\ \text{s}.
$$

- **La distancia.** Va de 0,35 s pegado a él hasta 2 s en el borde de su vista (12 m), en línea recta según $d$.
- **La luz.** Ese tiempo se divide por cuánto más iluminado estás que lo mínimo que necesita para verte (0,3), de 1 a 2,5. Bajo un farol, a dos metros, está seguro en un cuarto de segundo; en la penumbra, lejos, en un par.
- **La postura.** Agachado cuenta la mitad de la luz, como ya pasaba al ver.

Si deja de verte un segundo y medio, se vacía a 0,35 por segundo. Un golpe tuyo lo llena de una vez.

**Sus estados**, cada uno con lo que hace:

| Estado           | Desde                      | Qué hace                                                                  |
| ---------------- | -------------------------- | ------------------------------------------------------------------------- |
| tranquilo        | al empezar                 | su ronda                                                                  |
| sospecha (?)     | atención 0,35              | dice "¿Eh?"; si te ve, se queda mirando; si no, va a mirar donde te vio   |
| te descubrió (!) | atención 1                 | grita, y los guardias que lo oyen vienen; te persigue                     |
| busca            | 3 s sin verte, descubierto | va adonde te vio por última vez y mira alrededor, 10 s                    |
| de vuelta        | después de buscar          | "Nada…", y vuelve a su ronda; medio minuto más atento (sus tiempos × 0,6) |

Si sospecha y salís de su vista, se le pasa: baja a la mitad del umbral y dice "Nada…". Si te ve mientras busca, te descubre en el acto. Son los números del género, cortos para que quedarse bajo un farol siga siendo que te vean enseguida.

**La estrella de la fortaleza** ("Nadie te vio") cuenta ahora las veces que un guardia te **descubrió**, no las veces que te vio un instante y se le pasó.

Los guardias del Dojo no tienen atención: pelean como antes, y sus repeticiones dan el mismo hash.

## Una piedrita

Con <kbd>Q</kbd> se tira una piedrita adonde mirás. Se empieza con tres. Donde pega por primera vez, suena (un golpecito, otro y otro), y se oye a 10 m. Un guardia que la oye se da vuelta, escucha y va a mirar, como con cualquier ruido. Es una herramienta para mover a los guardias, no solo esperarlos. Y es limitada, para que no sea la única forma de pasar.

## Lo que se ve

- **Un círculo sobre cada guardia** que notó algo. Se llena con su atención y muestra un **?** ámbar si sospecha, un **!** rojo si te descubrió y un **?** azul pálido si te busca.
- **Donde un guardia te busca**, una silueta pálida tuya en el último lugar donde te vio: adonde va a mirar (lo de Splinter Cell).
- **La gema**, abajo a la izquierda, como la de Thief: oscura en la sombra y brillante donde un guardia te vería, con una palabra ("Oculto", "En penumbra", "A la vista"). Es tu luz, agachado la mitad, dividida por la que un guardia necesita.
- **Tus ruidos**: cada sonido que hacés dibuja en el suelo un anillo tenue hasta donde se oye (lo de Mark of the Ninja). Así, lo que oyen los guardias se ve.
- **La música**, por niveles: con un guardia que sospecha o busca, el bordón un poco más seguido y una nota aguda de vez en cuando; con uno que te descubrió, la de alerta.
- **Las voces**: el "¿Eh?" que sube, como una pregunta, y el "Nada…" que baja, con un suspiro. Son una voz hecha como el grito de la 5k (un zumbido por las bandas de una vocal) y tienen sus subtítulos.

## Las armas ya no atraviesan las paredes

Mientras se hacía esta etapa, el autor vio que algunas armas, o quizás todas, atravesaban las paredes cuando el personaje estaba de frente a una, por ejemplo el palo. Había dos cosas distintas.

**Lo que se dibuja.** El arma se sostiene delante del pecho, a 0,32 m, pero el cuerpo solo se aparta 0,3 m de una pared. Así, un palo o una escopeta, de casi un metro, quedaban metidos en ella casi enteros. Ahora, donde la línea de la mano a la punta tocaría una pared, el arma se levanta sobre su propio costado: lo mínimo que la saca, de a 10°, hasta 80°, como levanta una persona una cosa larga frente a una pared. Sube de golpe, como si rebotara, y baja despacio cuando hay lugar; si ni así sale, se recoge hacia el pecho. Solo cuenta las superficies del nivel, no a los personajes: un palo que barre hacia un guardia le pega, no lo esquiva por arriba.

**Lo que hace el mundo.** El golpe del palo ya no atravesaba: su barrido mira el mundo, y una pared más cerca que un guardia se queda con el golpe. Pero lo que se tira empezaba medio metro delante del pecho (una granada, el humo, una bengala, una piedrita), y un cohete o una saeta a 0,4 m de los ojos. Frente a una pared fina, ese punto quedaba del otro lado, y la granada caía detrás. Ahora cada cosa empieza donde decía, salvo que algo del mundo esté más cerca en esa dirección: entonces empieza un poco antes, de este lado, y lo golpea. Una prueba con una pared de 4 cm lo pide, y falla si se saca el arreglo.

## Pruebas

- **La atención:**
  - cuánto tarda: un séptimo de segundo pegado y con luz, dos en el borde y a oscuras, 1,175 a mitad de camino; más luz que 2,5 cuenta como 2,5, y más atento, 0,6 de eso;
  - un vistazo de tres pasos no es que te vean; un momento más, sospecha ("¿Eh?" antes del grito) y te descubre, y eso cuenta una vez;
  - si sospecha y desaparecés, va a mirar y se le pasa ("Nada…"); si te descubrió y te perdió, a los 3 s busca, 10 s después vuelve, y queda atento medio minuto.
- **La piedrita**: tirada, donde pega suena con un alcance de 10 m; había tres, queda una menos.
- **La música**, por niveles: más notas sospechando que tranquilo, y más en alerta.
- **Las armas frente a una pared**:
  - el arma dibujada se levanta lo justo y nunca mete la punta, ni barriendo; con lugar, vuelve;
  - una granada tirada a una pared fina queda de este lado, el dardo le pega y el cohete explota de este lado.
- **En el navegador:**
  - bajo un farol, la gema dice "A la vista" y el círculo de un guardia llega a "!"; caminando, los pasos dibujan anillos;
  - en la oscuridad, la gema dice "Oculto" y ningún guardia tiene círculo.

La versión de la simulación pasa a **45**. Cambian las repeticiones de la fortaleza; las del Dojo, la torre y la muralla dan el mismo hash.

## Lo que queda

La 5m: los niveles de la fortaleza, rehechos. Más largos, con vueltas que se cruzan, lugares desde donde mirar, objetivos optativos y un resumen al final.
