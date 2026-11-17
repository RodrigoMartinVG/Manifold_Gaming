---
title: 'Etapa 5a: el gimnasio de métricas y el cielo'
description: 'La primera etapa de los juegos: un nivel de cajas grises que mide lo que el personaje puede hacer (cuán alto y cuán lejos salta, qué escalones y pendientes sube, por dónde entra), una cuenta que dice lo mismo desde sus números, y el cielo que pide la noche de los tres juegos, dibujado por el motor.'
sidebar:
  order: 52
---

> Informe de la 5a, la primera etapa de la [fase 5](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/ROADMAP.md), después de la [decisión 0029](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0029-the-three-games.md), que fijó cuáles son los tres juegos. Los niveles de los tres se van a construir con estas medidas, y el cielo es el de su noche.

## Por qué un gimnasio

La [decisión 0017](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0017-phase-5-scope.md) pidió diseñar los niveles a medida: antes de poner una plataforma, saber cuán lejos llega el personaje. Si no, cada nivel se ajusta a ojo, y un cambio en el salto rompe saltos en todos los niveles sin que nadie se entere.

El gimnasio es un nivel de cajas grises en el Dojo (`load gym`), cada caja nombrada por lo que mide (`inspect height_200`):

- bloques de 0,35 a 2,5 m para subir saltando;
- escalones de 0,2 a 0,5 m;
- huecos de 3 a 12 m entre plataformas a 2 m de altura;
- rampas de 10° a 55° hasta una plataforma a un metro;
- pasillos de 0,55 a 0,8 m de ancho y techos de 0,95 a 1,7 m;
- dos carriles de baldosas del kit, de 1 m y de 4 m, para cruzar sus costuras.

Una prueba lo juega estación por estación como lo jugaría una persona: pone al personaje al principio de cada una y lo maneja desde ahí, sin teletransportarlo en el medio. Lo que alcanza queda al lado de lo que dice una cuenta hecha con sus números.

## La cuenta: el salto en pasos

El paso suma primero la gravedad a la velocidad y después mueve con ella (el orden semi-implícito). Después de $k$ pasos la velocidad hacia arriba es $v - k g \Delta t$, y la altura de los pies

$$
y(n) = \Delta t \sum_{k=1}^{n} (v - k g \Delta t) = \Delta t \left( n v - g \Delta t \, \frac{n(n+1)}{2} \right).
$$

Es más alta en el último paso en que todavía sube, $N = \lfloor v / (g \Delta t) \rfloor$, y vuelve a la altura de donde salió en el primer $n$ con $y(n) \le 0$, que es $n = \lceil 2v/(g\Delta t) - 1 \rceil$.

Con el personaje de los juegos ($v = 6{,}5$ m/s, $g = 9{,}81$ m/s², $\Delta t = 1/60$ s):

- **arriba en el paso 39**, con los pies a **2,0995 m**;
- **de vuelta en el paso 79** (1,32 s);
- la fórmula continua, $v^2 / 2g = 2{,}1534$ m, da unos $v \Delta t / 2 \approx 5$ cm de más: el paso discreto pierde medio paso de velocidad en cada uno.

Lo que el centro recorre en ese salto es la velocidad por el tiempo: $4{,}5 \cdot 79/60 = 5{,}925$ m caminando y $7{,}5 \cdot 79/60 = 9{,}875$ m corriendo.

`metricsOf` hace esa cuenta desde los números de cualquier personaje (su movimiento, su cápsula, su cuerpo agachado y la gravedad), y el gimnasio la confirma: en el piso liso, el salto vuelve en el paso 79, los pies suben 2,0995 m y el centro recorre 5,925 y 9,875 m. En el aire conserva exactamente la velocidad que pidió, en cada paso.

## Lo que midió

| Estación                  | Lo que dice la cuenta               | Lo que alcanza en el gimnasio                        |
| ------------------------- | ----------------------------------- | ---------------------------------------------------- |
| **Subir saltando**        | Los pies suben 2,0995 m             | Un bloque de 2,2 m; uno de 2,5, no                   |
| **Escalón**               | El del controlador, 0,35 m          | 0,4 m; 0,5, no                                       |
| **Hueco a 2 m de altura** | El centro llega a 5,93 y 9,88 m     | 6 m caminando, 10 corriendo                          |
| **Pendiente, quieto**     | Se para hasta 30°                   | Quieto hasta 30°; desde 35°, resbala                 |
| **Pendiente, subiendo**   | Sube hasta 50°, empujando           | Sube 45°; 55°, no                                    |
| **Pasillo**               | Mide 0,6 m y deja 2 cm de cada lado | Pasa por 0,65 m; por 0,6, no                         |
| **Techo**                 | Mide 1,6 m de pie y 1,1 agachado    | De pie pasa bajo 1,65 m; agachado, bajo 1,15         |
| **Costuras del kit**      | Ninguna                             | 40 baldosas de 1 m y 9 de 4 m, ni un paso en el aire |

Lo que no es obvio:

- **El pie redondo monta un borde un poco más alto.** La cápsula termina en media esfera de radio $r = 0{,}3$ m. Un borde a una altura $h$ sobre su punto más bajo la toca donde la superficie está inclinada $\arccos\big((r - h)/r\big)$, y el controlador sube por ahí como por una pendiente mientras eso no pase los 50° que sube:
  - **Arriba del salto,** con los pies a 2,0995 m, el borde del bloque de 2,2 la toca 10 cm arriba: $\arccos(0{,}2/0{,}3) \approx 48°$, y sube. El de 2,5 queda arriba del centro de la esfera: es una pared.
  - **En un escalón,** el controlador primero levanta el cuerpo sus 0,35 m para probar si sigue. Un borde a 0,4 queda entonces apenas arriba del punto más bajo, casi plano, y sube. Uno a 0,5 queda unos 12 cm arriba, unos 53°: no sube.

  Para un nivel: lo que tiene que subirse caminando, a 0,35 m o menos; lo que tiene que frenar, a más de 0,5.

- **Un hueco se cruza un poco más largo que el alcance.** El cuerpo aterriza sobre el borde con su centro todavía afuera, hasta un ancho de cuerpo. La prueba lo deja escrito: el hueco más largo queda a menos de un ancho de cuerpo del alcance.
- **Quedarse quieto y subir no son lo mismo.** En el suelo se queda quieto mientras la fricción lo sostiene: con la del piso, $\mu = 0{,}6$, eso es $\mu \cos\theta \ge \sin\theta$, o sea $\theta \le \arctan 0{,}6 \approx 31°$. Pero sube caminando hasta 50°, empujando contra lo que resbala.

La primera corrida tuvo cinco fallas, y cuatro eran de la prueba, no del personaje:

- juzgaba el aterrizaje en el primer paso con suelo, con el centro todavía en el borde (corriendo daba 9 m, no 10);
- confundía quedarse quieto en una pendiente con subirla;
- tomaba el cuerpo agachado por defecto (un metro) en vez del de los juegos (1,1 m);
- y la orden que lo teletransporta actúa en el paso siguiente: hasta entonces el personaje sigue donde estaba, y la estación medía la anterior.

La quinta era un hallazgo de verdad: el pie redondo que monta bordes.

## `metrics`, en la consola

`metrics` dice lo mismo para tu personaje, desde sus propios números. `inspect me` muestra cómo cambiar el salto (`set` con su id, `character.movement.jump.speed 4.5`), y `metrics` de nuevo dice lo que sigue: con 4,5 m/s salta un metro. Así se prueba un personaje distinto antes de construir un nivel para él.

## El cielo

La [0029](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0029-the-three-games.md) pone los tres juegos en una noche: el atardecer en la torre, la noche en la fortaleza, antes del alba en la muralla. El motor no dibujaba cielo: el fondo era un color liso que se oscurecía con la luz ambiente.

Un nivel dice ahora a qué hora está su cielo, con una línea nueva (el formato de nivel pasa a 10):

```
sky 19.5
```

Es solo el dibujo. Cuánta luz hay, lo que ve un guardia, sigue siendo el `ambient` del nivel, que es de la simulación. Un nivel sin `sky` se ve como antes, y su mundo da el mismo hash. La ciudadela está a las 19:30, con el sol recién puesto y las lámparas prendidas. El gimnasio, a las 15:30, para ver bien la forma de las cajas.

### El sol y la luna

La hora da todo lo demás:

- **La altura del sol** es un seno sobre el día, de la salida (6:15) a la puesta (19:24), con 62° arriba. De noche, otro seno bajo el horizonte, con 34° abajo en el medio de la noche.
- **Su dirección** gira 15° por hora y está al sur en el medio del día. Las direcciones del mundo son arriba $+Y$, norte $-Z$ (adonde mira un nivel si no dice otra cosa) y este $+X$. Sale por el este, un poco al norte, como un día de verano.
- **La luna** está donde no está el sol, enfrente.
- **Los colores** (el cenit, el horizonte, el suelo, el color de la luz y cuántas estrellas hay) salen de una docena de horas clave, con una línea recta entre dos. Una prueba recorre el día de a centésimas de hora y ningún valor cambia más de un 4% en una.

El domo es una esfera alrededor de la cámara, pintada por dentro:

- del horizonte al cenit, rápido cerca del horizonte, como un cielo de verdad;
- el resplandor del sol y su disco, de 2,4° (el real tiene medio grado: más grande, para que se vea), y el de la luna;
- las estrellas, cada una una celda de una grilla de direcciones que un hash prende o no, así se quedan en su lugar al girar la cámara;
- medio escalón de ruido, porque un degradé tan suave en 8 bits mostraría bandas.

### El error del primer intento

El primer intento oscurecía las luces con la hora además de con el `ambient`. La ciudadela, al atardecer y con su ambiente de 0,3, quedaba iluminada por una fracción de eso: la luz del sol ya puesto se apagaba.

Ahora la hora da solo el color y la dirección de la luz, y el `ambient` su fuerza, a cualquier hora:

- La luz que viene de un lado es la del sol mientras su resplandor sigue afuera, baja desde el oeste y cálida al final del día.
- Después pasa a la de la luna, celeste pálido.
- La fuerza de cada una es $|2w - 1|$, donde $w$ es cuánto del resplandor queda (de 1 con el sol en el horizonte a 0 cuando está 8° abajo). Vale 0 justo en el medio del crepúsculo, donde cambia de una a la otra, así que nada salta.

`view.sky` prueba otra hora en esta página: `view.sky 6`, un amanecer; `view.sky 0`, una noche con estrellas; `view.sky -1` vuelve a la del nivel.

## Pruebas

- **La cuenta:** el salto en pasos, el alcance, el cuerpo, un salto suave de un metro.
- **El gimnasio:** sus nueve estaciones, `metrics` y `set` que la cambia.
- **El formato 10:** el cielo leído y escrito de vuelta igual, el mundo sin él como antes, y sus errores con su línea.
- **El cielo:** el sol arriba de día y abajo de noche, de este a oeste, la luz del sol y la de la luna, la hora de la ciudadela, y ningún salto en el día.
- **En el navegador:** `metrics` en el gimnasio, `view.sky` y la hora del nivel; un nivel sin cielo; la ciudadela a las 19:30.

La repetición de referencia de la ciudadela se grabó de nuevo: su mundo guarda ahora la hora de su cielo, y eso cambia el hash. Solo cambió su última línea.

Y una prueba que fallaba con carga: esa misma repetición tarda 5 s sola, y con cuatro grupos de pruebas a la vez tardó 23, más que los 20 que se le dan a una prueba. Ahora tiene 60, como la prueba de la ciudadela. Es margen, no un arreglo: la repetición es larga.

## Lo que queda para después

- **La medida del salto en la pared y la de los agarres** (los agarres encontrados donde no hay, o perdidos) van con lo que miden. Ni el salto en la pared ni el agarre de bordes existen todavía: son de la 5c, el controlador del juego de plataformas.
- **La hora no avanza:** cada nivel tiene la suya. Si la torre quiere que caiga la noche mientras subís, va a ser parte de la simulación, con su hora en el estado.

Sigue la 5b: lo que comparten los tres juegos (su página, su menú, su HUD, el guardado, los créditos y la música).
