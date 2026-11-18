---
title: 'Etapa 5g: las armas del shooter'
description: 'Las armas, bien hechas: un papel para cada una, una escopeta con sus perdigones en los dados del disparo y un lanzador cuyo cohete explota donde pega; el salto con explosión, con control en el aire que gira sin sumar velocidad sin fin; y cómo se siente cada una: su destello, su retroceso, dónde pega, su sonido, una marca cuando acierta y su modelo.'
sidebar:
  order: 58
---

> Informe de la 5g, después de la [5f](../etapa-5f/). En un shooter las armas son el corazón: la [decisión 0029](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0029-the-three-games.md) les dio una etapa propia antes del juego (5h).

## Un papel para cada una

Las cuatro de antes conservan sus números, con los que se equilibraron la arena y la ciudadela (4g, 4.5a). Lo que ganaron es un papel dicho en palabras y en cómo se sienten. Se sumaron dos.

| Arma            | Su papel                                                                                  | Cuánto                   |
| --------------- | ----------------------------------------------------------------------------------------- | ------------------------ |
| **El dardo**    | El que siempre sirve: rápido, preciso, a cualquier distancia, poco cada vez               | 25 (cuatro para voltear) |
| **La saeta**    | La pesada: tarda más en volver a tirar y viaja (hay que adelantarse a quien se mueve)     | 35                       |
| **El palo**     | El silencioso, al alcance del brazo; por la espalda, en un juego de sigilo, voltea de una | 30                       |
| **La granada**  | A la vuelta de una esquina, a quien no se mueve, detrás de lo que cubre                   | 60 en el centro          |
| **La escopeta** | La de cerca: ocho perdigones, todos a 2 m, uno o dos a 10                                 | 12 cada uno              |
| **El lanzador** | Un lugar más que alguien; y a tus pies, el salto con explosión                            | 90 en el centro          |

## La escopeta

Un disparo son ocho perdigones. Cada uno sale en su dirección, dentro de $6°$ alrededor de la mira, tomada de los dados del disparo (decisión 0022). Los dados se siembran con la semilla del mundo, el paso, el jugador y el número del disparo, así que otra cosa que pida números no los cambia y cada copia del mundo tira los mismos perdigones.

Cada perdigón cae uniforme sobre el disco de ángulos: con dos números $u, v$ de los dados, su ángulo con la mira es $\theta = 6°\sqrt{u}$ y su giro alrededor de ella es $\varphi = 360°\,v$. La raíz es lo que hace uniforme el disco (el área hasta $\theta$ crece como $\theta^2$).

A $D$ metros, el cono tiene un radio $R = D \tan 6° \approx 0{,}105\,D$. El cuerpo de un personaje tiene unos $2a = 0{,}32$ m de ancho, y la fracción de un disco de radio $R$ que cae en una franja $|x| \leq a$ es

$$
f = \frac{2}{\pi}\left(\arcsin\frac{a}{R} + \frac{a}{R}\sqrt{1 - \frac{a^2}{R^2}}\right) \quad (a < R).
$$

A 2 m, $R = 0{,}21$ y $f \approx 0{,}86$. A 5 m, $f \approx 0{,}38$. A 10 m, $f \approx 0{,}19$. A lo alto el cuerpo cubre casi todo el disco. Medido contra un muñeco: 8 perdigones a 1 y a 2 m, 4 a 5 m y 2 a 10 m.

## El lanzador y el salto con explosión

El cohete vuela a 25 m/s. Donde pega, explota con la explosión del mundo (la de la granada, 4f): a cada uno que alcanza lo empuja alejándolo y le saca según lo cerca que esté. La explosión se pone un poco antes de la cara que golpeó, en el camino por donde vino el cohete, para que esa misma cara no la "tape". Para eso, el evento `impact` ahora dice la velocidad del proyectil y quién lo disparó.

A un personaje, una explosión de fuerza $F$ a distancia $d$, con radio $r$, le suma una velocidad

$$
\Delta v = \frac{F\,(1 - d/r)}{80\ \text{kg}}.
$$

Con $F = 900$ y $r = 3{,}5$, un cohete a tus pies (a unos $0{,}72$ m de tu centro) suma unos $8{,}9$ m/s hacia arriba, y $h = \Delta v^2 / 2g \approx 4$ m. Tu propia explosión no te saca nada, solo te arroja. Medido: 4 m solo y 9,5 m con un salto al mismo tiempo. Una pared del kit tiene 3 m.

## Control en el aire, con tope

Hasta la 41, un personaje arrojado por una explosión iba hacia "lo que tenía más lo que pedía". Pidiendo hacia adelante, sumaba aceleración en cada paso mientras estuviera en el aire, sin fin. Ahora, con $\mathbf{v}$ su velocidad sobre el suelo, $\mathbf{d}$ la dirección pedida, $w$ la velocidad pedida y $m$ lo que puede cambiar en el paso:

$$
\mathbf{v}' = \mathbf{v} + \min\bigl(m,\ \max(0,\ w - \mathbf{v}\cdot\mathbf{d})\bigr)\,\mathbf{d}.
$$

Solo cambia la parte de la velocidad a lo largo de lo pedido. Sube hacia $w$, nunca la pasa, y el resto se conserva:

- **pidiendo de costado** ($\mathbf{v}\cdot\mathbf{d} = 0$), gira;
- **pidiendo en contra**, frena;
- **pidiendo a favor**, cuando ya iba más rápido que $w$, no suma nada.

Una prueba arroja a un personaje con una explosión y lo empuja hacia adelante todo el vuelo: nunca va más rápido que lo que le dieron la explosión y su paso.

La versión de la simulación pasa a 42. Las repeticiones de referencia se grabaron de nuevo:

- **doce dan el mismo hash** (en ninguna un personaje arrojado pedía algo);
- **dos cambian, la de la fase 4 y la de la ciudadela,** porque sus soportes de armas ahora muestran el modelo del arma, y lo que se ve de una cosa es parte del estado.

## Cómo se siente cada una

El mundo dice qué hizo un arma (`fired`, un evento nuevo: quién, desde dónde, hacia dónde, de qué tipo). La presentación lo muestra sin tocar el mundo:

- **El destello:** un brillo corto en la punta de lo que disparó, del tamaño de lo fuerte que suena el arma (la escopeta, el más grande).
- **El retroceso:** tus propios disparos levantan la vista y vuelve, con una constante de tiempo de 0,09 s. Son 1,2° el dardo, 2° la saeta, 6° la escopeta y 4,5° el lanzador, y como mucho 10° juntos. Lo que apuntás no se mueve: el disparo fue a donde estaba la mira, y el siguiente va a donde está.
- **Dónde pega:** chispas contra lo que no vive, un destello pálido contra quien lastima.
- **La explosión, vista:** una bola de luz que crece hasta casi su radio y se apaga. Las granadas explotaban sin verse.
- **La marca cuando acierta:** cuatro trazos alrededor de la mira cuando tu disparo lastima a alguien, rojos en la cabeza y más grandes cuando lo voltea.
- **Su sonido**, hecho en el navegador como los demás. El dardo chasquea, la saeta vibra, la escopeta retumba (un golpe grave bajo un soplido ancho), el lanzador golpea y su cohete silba; lo que se tira o se barre es un soplido. Los subtítulos lo dicen: "Un escopetazo", "Un cohete".

## Sus modelos

Los seis los hace un guion, `art/weapons.py`, con Blender sin pantalla: una pistola de dardos, una ballesta, un bastón, una granada, una escopeta de corredera y un lanzador. Tienen entre 64 y 208 triángulos y cuatro materiales, sin texturas. Cada uno cabe en la caja de su aspecto, con su boca en el extremo $+Z$ (de ahí sale el trazo del disparo). Un personaje los lleva en las manos, y en primera persona los dibuja la cámara.

El guion hace el mismo archivo cada vez. La primera granada usaba una esfera UV, y el exportador sacaba sus triángulos en otro orden en cada corrida. Con una icoesfera sale igual.

## La sala

En el Dojo, **The armory**: las seis armas en sus soportes, muñecos a 2, 5, 10 y 20 m, y dos bloques de 3 y 6 m para llegar con un salto con explosión.

## Pruebas

- **La escopeta:**
  - ocho perdigones, cada uno dentro de 6°, iguales en otra copia;
  - a un metro pegan todos, a diez como mucho tres;
  - no vuelve a tirar antes de un segundo.
- **El lanzador:**
  - contra una pared explota ahí, y lastima a quien está cerca según lo cerca, sin llegar a 90;
  - a tus pies no te saca nada, te sube más de 1,5 m, y con un salto más todavía.
- **El control en el aire:** la cuenta en sus cuatro casos, y un personaje arrojado que no acelera sin fin.
- **Los modelos:** cada arma es un nodo en su origen, cabe en su caja y tiene menos de 300 triángulos.
- **En el navegador:** la escopeta tomada de su soporte y disparada a un muñeco, con su destello, su sonido y su marca; y el cohete del lanzador, que explota.

## Lo que queda

- **Los guardias todavía no usan la escopeta ni el lanzador.** Los bots de la muralla (5h) van a elegir cuál.
- **Un disparo no es un sonido del mundo:** los guardias no lo oyen. Que lo oyeran cambiaría las partidas grabadas del Dojo. Queda para cuando la muralla lo pida.
- **El arma en primera persona no retrocede por su cuenta:** se mueve con la vista. Un movimiento propio queda para después de jugarla.

Sigue la 5h: la muralla, oleadas de bots hasta el amanecer.
