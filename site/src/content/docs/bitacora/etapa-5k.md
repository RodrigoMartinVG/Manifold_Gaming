---
title: 'Etapa 5k: explosiones, sonidos, el balanceo al caminar y el salto'
description: 'Lo que el autor pidió después de la 5j. Las explosiones, en capas de partículas: destello, bola de fuego, chispas, humo que sube, escombros, una marca en el suelo y una luz que tiembla. Los sonidos, hechos como los hacen los diseñadores de sonido, que llegan como llega el sonido: más apagados de lejos, tarde y con el eco del lugar. La vista que se balancea al caminar en primera persona. Y el salto de la fortaleza y la muralla, que era flotante: era la gravedad.'
sidebar:
  order: 63
---

> Informe de la 5k, después de la [5j](../etapa-5j/). Es una etapa que no estaba en la [decisión 0031](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0031-games-that-play.md): la pidió el autor mientras se hacía la 5j, y va antes que las demás.

## Lo que pidió el autor

Cuatro cosas, en cuatro mensajes: que las explosiones y los sonidos mejoren bastante; el balanceo de la vista al caminar en primera persona; y que en algunos juegos el salto no está bien calibrado, "quizás sea la gravedad".

## El salto: era la gravedad

La torre tiene un salto propio desde la 5c: sube 2 m en 0,42 s, con una gravedad que el salto mismo define. La fortaleza y la muralla no tenían ninguno. Usaban el salto de siempre del motor, a 6,5 m/s contra la gravedad de la Tierra, $g = 9{,}81$ m/s². Ese salto sube

$$
h = \frac{v^2}{2g} = \frac{6{,}5^2}{2 \cdot 9{,}81} \approx 2{,}15 \text{ m}
$$

en $t = v/g \approx 0{,}66$ s, y queda 1,3 s en el aire: más alto que el personaje y lento, como en un planeta más chico. Eso era lo flotante.

Ahora los dos tienen el salto de un personaje "de a pie", que es como saltan los shooters y los juegos de sigilo: **1,1 m en 0,36 s**. Como en la torre, se pide la altura $h$ y el tiempo hasta arriba, y de ahí salen la gravedad y la velocidad. Con $N$ pasos de $\Delta t$ para llegar arriba, integrados como los integra el paso,

$$
g = \frac{2h}{N(N-1)\,\Delta t^2}, \qquad v = \frac{2h}{(N-1)\,\Delta t}.
$$

Con $N = 22$ pasos de $1/60$ s, $g \approx 17{,}1$ m/s² y $v \approx 6{,}3$ m/s. Al caer, la gravedad es 1,4 veces mayor: unos 24 m/s², cerca de la de Quake (en su código, 270 unidades/s contra 800 unidades/s², a unas 32 unidades por metro). Baja en 0,3 s, así que pasa unos 0,66 s en el aire. Si se suelta la tecla subiendo, la gravedad se duplica y el salto queda corto.

La gravedad del mundo sigue siendo la de la Tierra: un cajón o una granada caen como antes. Solo cambia la del personaje. La torre conserva su salto, y el Dojo el suyo.

Eso cambia la simulación: la versión pasa a **44**. Las repeticiones de la fortaleza y la muralla se grabaron de nuevo, y las del Dojo y la torre dan el mismo hash que antes.

## Las explosiones

Antes, una explosión era una esfera de luz que crecía. Ahora es lo que los artistas de efectos visuales arman en capas, en el orden en que las ve el ojo:

1. **Un destello**: un núcleo blanco con rayos, una décima de segundo, más grande que la bola.
2. **Una bola de fuego**: bocanadas que salen disparadas y que el aire frena enseguida. Pasan de blanco a amarillo, a naranja y a rojo oscuro, y en medio segundo no están. Suman luz: donde se superponen, arde más fuerte, y el brillo de la 5j las hace resplandecer.
3. **Chispas y brasas**: estelas que vuelan lejos y caen, y unas pocas brasas lentas que flotan.
4. **Humo**: la bola se vuelve humo mientras muere. Al principio está iluminado desde adentro, después sube (está caliente) y se abre durante dos a tres segundos y medio.
5. **En el suelo**, si está cerca: un anillo que corre por el piso (la onda), el polvo que levanta y una marca chamuscada que dura doce segundos.

Además, **escombros** de verdad: nueve trozos que vuelan y rebotan contra el nivel, en la física propia de los fragmentos (la de la 3e). Y **una luz** que se enciende naranja y tiembla al apagarse, en una décima de segundo. Es la misma luz del destello del arma, así que la escena nunca cambia de cantidad de luces y nada se compila de nuevo.

Todo eso son **partículas**: cuadrados chicos que siempre miran a la cámara, cada uno con su lugar, su velocidad, su resistencia del aire, su gravedad (negativa, para el humo que sube) y sus colores a lo largo de la vida. Se dibujan en dos sistemas, de una sola llamada cada uno, tengan las que tengan. Uno **suma luz** (fuego, chispas, destellos). El otro **cubre** (humo, polvo): se dibuja de lo lejano a lo cercano y lo ilumina el lugar, así que de noche el humo es oscuro. La forma de cada partícula la dibuja el shader con ruido, sin texturas que descargar.

Lo mismo para lo demás:

- el destello de un arma tiene rayos, las grandes tiran chispas y todas dejan un poco de humo;
- donde pega un tiro saltan chispas hacia donde vino y se levanta el polvo de la superficie (gris en la piedra, marrón en la madera);
- un cohete deja una estela.

Las partículas van **al ritmo del mundo**: en pausa se quedan quietas, y a media velocidad van a la mitad. Con `view.timescale 0.1`, una explosión se ve en cámara lenta.

## Los sonidos

Siguen sin archivos grabados ([decisión 0027](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0027-music.md): uno grabado solo donde no se puede hacer, y por decisión del autor). Pero ahora se hacen como los diseñadores de sonido, en **capas**, como desarma una explosión o un disparo el libro de Andy Farnell, _Designing Sound_:

- **un transitorio**, los primeros milisegundos, de todas las frecuencias, que le dicen al oído que algo pasó y dónde;
- **un cuerpo**, el color propio del sonido: un ruido filtrado, un tono que cae;
- **un golpe grave**, un seno que baja de tono, pasado por una saturación suave para que sus armónicos se oigan también en parlantes chicos (una laptop no toca 40 Hz, pero sí 80, 120 y 160);
- **una cola**: lo que devuelve el lugar y, en las grandes, lo que cae después.

Una explosión tiene cinco capas: el chasquido, el golpe (de 90 Hz a 30), el rugido (ruido grave bajo un filtro que se cierra de 2,4 kHz a 180 Hz en un segundo y medio, crepitando), el retumbe que queda y lo que cae después. La escopeta tiene el estampido, un cuerpo que se cierra, el golpe grave y, medio segundo después, la corredera de ida y vuelta. Los pasos son talón y punta, con la arenilla de la superficie. El grito de un guardia es ahora una voz: un zumbido (las cuerdas vocales) por dos bandas donde resuenan la "a" y la "e" (sus formantes).

**Cómo llega un sonido.** Desde una distancia $d$, y si se oye hasta $r$:

| Qué                             | Cuánto                               |
| ------------------------------- | ------------------------------------ |
| El sonido directo               | $(1 - d/r)^2$                        |
| El eco del lugar                | $\sqrt{1 - d/r}$: cae más despacio   |
| Los agudos (un filtro, el aire) | de 18 kHz cerca a 700 Hz en el borde |
| La demora                       | $d / 343$ s: la velocidad del sonido |

Así, una explosión lejana se ve antes de oírse (a 34 m, una décima de segundo) y llega apagada, casi toda eco.

**El eco del lugar** es una reverberación por convolución, con una respuesta al impulso hecha, no grabada. Primero unas pocas reflexiones tempranas (las paredes más cercanas, de 11 a 53 ms, distintas en cada oído). Después, una cola de ruido que cae 60 dB en 1,6 s: su amplitud es $e^{-t \ln(1000)/T}$ con $T = 1{,}6$, que en $t = T$ vale $1/1000$. Sus agudos mueren antes, como los absorben el aire y la piedra. Y todo pasa por un **compresor**, que impide que muchos sonidos a la vez saturen y les da cuerpo.

**Sonidos nuevos:**

- donde pega un tiro suena un golpe seco con el color de la superficie y, a veces, el silbido de un rebote;
- un tiro que pasa cerca de los oídos se oye pasar, con el tono cayendo;
- un cohete en vuelo sisea, y su tono sube cuando se acerca y baja cuando se aleja (efecto Doppler: $f' = f\,c/(c + v)$, con $v$ la velocidad a la que crece la distancia).

**Medidos sin oírlos.** Cada sonido se renderizó fuera de línea, en un navegador sin pantalla, por la misma cadena del juego (compresor y eco), y se midió:

- ninguno satura: la explosión cercana llega a 0,51 de pico con el volumen de fábrica;
- la explosión lejana empieza tarde, como debe;
- tres avisos (el grito, el arma levantada, el silbido de un tiro) eran demasiado bajos para su función y se subieron.

## El balanceo al caminar

En primera persona, la vista se mueve con los pasos. Los pasos son los de la simulación: cada paso que se oye cuenta uno entero, y lo caminado desde el último (`stride`) es la parte entre medio. Así, los ojos están más abajo justo cuando suena el paso. Con $s$ los pasos caminados:

$$
\text{altura} = -A\,\frac{1 + \cos 2\pi s}{2}, \qquad \text{costado} = B \sin \pi s.
$$

La altura es más baja cuando pisa ($s$ entero) y más alta entre pasos. El costado va hacia el pie de apoyo, a un lado en un paso y al otro en el siguiente. Como $\sin \pi(k + s) = -\sin \pi s$ para $k$ impar, el movimiento es suave en cada paso: se continúan el valor y la pendiente. $A$ es 3,5 cm caminando, hasta 1,6 veces más corriendo y menos agachado; $B$ es 2,2 cm. La vista se inclina un poco hacia el pie y hacia donde camina de costado (como Quake, más suave).

**Al aterrizar**, los ojos se hunden y vuelven, como un resorte con amortiguamiento crítico que se suelta de golpe:

$$
y(t) = -v\,t\,e^{-t/\tau},
$$

que es más bajo en $t = \tau = 0{,}07$ s y vuelve sin pasarse. Lo que tiene en las manos se balancea en forma de U, como el arma de Doom, y se atrasa un poco cuando la vista gira.

Se apaga en los ajustes, "Balancear la vista al caminar, en primera persona", y también con `view.calm`. Es una recomendación de accesibilidad: a algunas personas el balanceo las marea.

**Un error, encontrado.** La primera versión dejaba la vista negra en primera persona. Antes de cualquier aterrizaje, el tiempo desde el último era infinito, y $t\,e^{-t/\tau}$ en $t = \infty$ es $\infty \cdot 0$: en coma flotante, "no es un número", y una cámara en "no es un número" no dibuja nada. Se arregló donde nace: el hundimiento vale cero mucho después de aterrizar. Una prueba lo pide, y otra en el navegador mira que la cámara tenga tres números.

## Pruebas

- **El salto:** en la fortaleza y la muralla, los pies suben 1,1 m en 0,36 s y vuelven al piso entre 0,6 y 0,72 s.
- **El sonido, como números:**
  - de cerca, todo; en el borde, nada;
  - a mitad de camino, el directo es un cuarto y el eco 0,71;
  - cuanto más lejos, más apagado;
  - el eco cae más de 50 dB de su primer décimo al último, y los dos oídos oyen ecos distintos.
- **Las explosiones, como recetas:**
  - un destello, la bola, chispas y humo, y en el suelo también el anillo, el polvo y la marca;
  - la bola se va en menos de un segundo, el humo dura segundos y sube;
  - con el doble de radio, el doble de tamaño.
- **El balanceo, como curvas:**
  - más abajo al pisar, en el medio entre pasos;
  - un lado y el otro, suave en cada paso;
  - el hundimiento, más bajo en $\tau$, sin pasarse, y cero, no "no es un número", antes de cualquier aterrizaje.
- **En el navegador:**
  - el lanzador en cámara lenta: la estela, la explosión (sus partículas, su luz, sus escombros, su sonido) y, al ritmo normal, todo se va menos la marca;
  - en primera persona, los ojos suben y bajan al caminar y se hunden al aterrizar, y con `view.bob false` se deslizan;
  - en la arena del Dojo, yendo de un lado a otro delante de un guardia (su puntería, que sigue, queda atrás), se oye pasar un tiro que no pegó. Al principio la prueba lo esperaba en la muralla, pero ahí el defensor nace detrás de tres cajones, y los tiros que no le pegan terminan en ellos antes de pasar cerca: eso está bien, y la prueba buscaba en el lugar equivocado.

## De paso

- **La referencia de la consola.** La integración continua estaba en rojo desde la 5i: `view.shake` llegaba a la consola del Dojo, pero no al catálogo de la presentación del que se genera la página de la consola, ni a sus palabras en castellano, ni a la prueba que pone todas las variables de la vista por un enlace. Ahora está en los tres (commit aparte), y `view.bob` también. `view.glow` no va: solo la declara la página de un juego con atmósfera, y la del Dojo no tiene, como la música.
- **La prueba de la cámara `steady`** (5i) leía cuánto había girado `follow` después de que se asentara. Pero una zona del recorrido le sugiere hacia dónde mirar, y la vuelve de a poco, así que el número dependía de cuánto tardaba en asentarse (una vez dio 0,086). Ahora lo lee apenas termina la corrida.

## Lo que queda

La 5l: que la fortaleza se lea. Una gema de luz, anillos de ruido, una alerta que se llena con signos y voces, la última posición vista, una piedrita para distraer y música por niveles de alerta.
