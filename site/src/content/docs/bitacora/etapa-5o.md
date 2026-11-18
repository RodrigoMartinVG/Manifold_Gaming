---
title: 'Etapa 5o: la muralla, en altura'
description: 'Los cuatro niveles de la muralla, rehechos con pisos sobre pisos: balcones, puentes, galerías, un sótano, ascensores, plataformas que se mueven, escaleras que vuelven y salas redondas. Un cuerno trae a los que llama un nivel. Dos armas nuevas, el fusil y el lanzallamas; cargadores y una recarga que se oye y se ve; y el balanceo al caminar, equilibrado.'
sidebar:
  order: 67
---

> Informe de la 5o, después de la [5n](../etapa-5n/). Es una etapa del autor, como la [5k](../etapa-5k/): la pidió después de jugar la muralla de la 5n, antes de la torre, que pasa a ser la 5p ([decisión 0031](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0031-games-that-play.md)).

## Lo que pidió el autor

Jugó los cuatro niveles de la 5n y escribió tres cosas:

1. "Los niveles son todos prácticamente iguales y súper planos". Pidió niveles mucho más complejos, "con pisos, plataformas, ascensores, plataformas móviles, puentes, varios pisos, balcones, salas redondas".
2. "El movimiento de balanceo está poco equilibrado, tanto cuando camina como cuando corre".
3. "Las armas están buenas, pero faltan otras tantas, y quizás alguna animación de recarga".

## Niveles con pisos sobre pisos

Los cuatro niveles conservan su hilo (recuperar la muralla tramo por tramo antes del alba), sus llaves y sus enemigos. Pero ahora cada uno se recorre también hacia arriba y hacia abajo, y ninguno se parece a otro:

| Nivel                | Hora | Lo que tiene de alto                                                                                                                    |
| -------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------- |
| El adarve            | 4:30 | un patio con un balcón a 3 m en cada lado y un puente entre ellos; una casa de guardia de dos pisos, con ascensor; una torre redonda    |
| La casa de la puerta | 5:00 | una sala de dos pisos con una galería alrededor, sobre columnas; una capilla redonda; un sótano; un ascensor de 6 m hasta la galería    |
| Las torres           | 5:30 | un foso a 3 m de profundidad con una balsa que lo cruza; dos torres redondas, un puente entre sus techos a 6 m; una escalera que vuelve |
| El portón            | 6:00 | un estante a 3 m al que se sube saltando; un patio con adarves en tres lados, uno roto (una balsa); un torreón redondo; un montacargas  |

- **El adarve.** Desde el pie de la escalera se entra a un patio con un balcón a cada lado, una escalera a cada uno y un puente entre los dos. Hay centinelas abajo y arriba. Del balcón oeste se pasa a la armería, en el piso de arriba de la casa de guardia, donde está la escopeta. Abajo están las barracas, con un ascensor que sube a la armería. De la armería sale un puente sobre el patio interior hasta la torre redonda, donde hay un estrado a 3 m con la llave roja. Una escalera sube desde la puerta sur de la torre y atraviesa el estrado por el medio. La puerta roja es la norte de la torre.
- **La casa de la puerta.** Una sala de dos pisos, con una galería alrededor a 3 m sobre columnas y una escalera para subir. En la galería están los que lanzan orbes. Al oeste, una capilla redonda: la repetidora sobre su altar, y en su pared una mano que abre el cuarto de atrás. Desde una esquina de la sala se baja al sótano, entre pilares, donde está la llave azul. Del sótano sube un ascensor, solo en el aire de la sala, hasta la galería. Desde la galería, la puerta azul da al ala de arriba, con la llave roja.
- **Las torres.** Un foso de 8 m de ancho y 3 de profundidad. Lo cruza una balsa que va y viene, y en su extremo oeste hay un puente. Si caés, el foso tiene una escalera para salir, y bajo la orilla, detrás de una puerta que abre una mano, la armadura y las granadas. Al norte, un patio entre dos torres redondas de 14 m. La oeste tiene un ascensor hasta su techo, a 6 m, con el fusil arriba. Desde ahí, un puente cruza hasta el techo de la otra, donde está la llave amarilla. En la torre este, una escalera sube hasta un descanso y otra vuelve por encima.
- **El portón.** Una sala de columnas con el bruto al fondo. Al oeste, la armería: el lanzador está en un estante a 3 m, y se sube saltando por bloques de un metro. Al este, el lanzallamas y una mano que abre el cuarto del sur. Al norte, el patio del portón, con un adarve a 3 m en tres de sus lados. Al oeste, una balsa cruza el tramo roto. En la esquina, un torreón redondo con la llave roja. Detrás de la puerta roja, una plataforma sube y baja sin parar hasta la sala del torno, que es la salida.

## Cómo se dibujan

Los planos de la 5m tenían una sola grilla, a ras del suelo. Ahora un plano tiene **varias**, cada una a su altura (`plan x z y`):

- en una grilla en altura, el piso va exactamente donde hay celdas, en baldosas de 4, 2 y 1 m. Un balcón de dos celdas no tapa la sala que mira;
- `=` es una baranda de un metro.

Lo que una grilla no puede decir lo escriben, como líneas del nivel, los guiones que dibujan los planos: escaleras, ascensores, balsas, puentes y paredes redondas.

**Una pared redonda** se arma con las piezas de pared del kit, de $w = 2$ m, alrededor de un círculo de radio $r$. La pieza $k$ va en el ángulo $\theta_k = 2\pi k / N$ y se gira $90° - \theta_k$, para quedar tangente. Para que no queden huecos, cada pieza tiene que cubrir su cuerda:

$$
2r \sin\frac{\pi}{N} \le w \iff N \ge \frac{\pi}{\arcsin\!\left(\frac{w}{2r}\right)}.
$$

$N$ se redondea hacia arriba al múltiplo de 4 siguiente, así cada cuarto de vuelta tiene una pieza en su centro. Las puertas se abren en esos lugares, quitando la pieza del piso que haga falta (la de abajo para una puerta, la de arriba para un puente). Con $r = 6$, $N = 20$; con $r = 7$, 24.

**El piso de arriba de una torre redonda** son las celdas con sus cuatro esquinas dentro del radio de afuera de la pared. Así no asoma fuera de la torre, y lo que queda entre el piso y la pared es menos de lo que necesita un cuerpo para caer.

**Un ascensor** sube mientras alguien está en una zona del alto de todo su recorrido. Al bajarte arriba, vuelve abajo para el siguiente, como los de Doom. Los del nivel también lo usan: en el adarve, un centinela tomó el ascensor de las barracas para buscar al defensor arriba.

## El cuerno

Los atacantes son guardias: solo van a lo que ven o a lo que oyen. Un grupo que llamaba una llave aparecía, pero si no te veía, se quedaba donde estaba. Ahora, cuando un nivel llama a un grupo, suena **un cuerno** donde está el defensor, y se oye en todo el nivel. Los que llegan lo oyen y van a mirar. Es un sonido del mundo, con su subtítulo ("Un cuerno: vienen a buscarte"): los del torreón vienen por el adarve, y los que cargan, por el puente entre las torres.

## La escalera que vuelve

En la torre este, los atacantes que subían se quedaban parados al final del primer tramo. La navegación los mandaba bien por el descanso, pero al suavizar el camino cortaba en diagonal del primer tramo al segundo. Los dos tramos están lado a lado: arriba de todo los separan 0,2 m, pero un poco más abajo ya son 0,4 m, más de lo que sube un cuerpo (0,35). Ahora hay **una baranda entre los dos tramos** donde se juntan, como en cualquier escalera que vuelve, y el camino pasa por el descanso. Arregla esta escalera, no la navegación: el suavizado todavía no conoce el costado de una escalera, y eso queda para después.

## Dos armas nuevas

| Arma           | Daño       | Alcance | Cada   | Precisión | Cargador | Munición |
| -------------- | ---------- | ------- | ------ | --------- | -------- | -------- |
| El fusil       | 60         | 90 m    | 0,75 s | 0,15°     | 4 (2 s)  | dardos   |
| El lanzallamas | 4 por rayo | 6 m     | 1/15 s | 10°       | —        | aceite   |

- **El fusil**: largo y lento, para tirar desde lejos. Dos tiros voltean al que carga. Está en el techo de la torre oeste, desde donde se ve el otro techo.
- **El lanzallamas**: dispara mientras se mantiene apretado, quince rayos por segundo, unos 60 de daño por segundo a menos de 6 m. Se ve como llamas que salen, se frenan con el aire, crecen, suben un poco y dejan humo. Está en la sala este del portón, para los que cargan y para el bruto.

Las dos tienen su modelo, hecho por el guion de Blender (headless): el fusil con su mira encima y el lanzallamas con su tanque rojizo debajo de la boquilla. También tienen su sonido: un estampido más seco que el de la saeta, con su cerrojo, y un rugido que se encadena con el siguiente. Las teclas ahora van de <kbd>1</kbd> a <kbd>9</kbd>.

## Cargadores y recarga

Para quien tiene un arsenal, las armas de fuego tienen **cargador**: lo que se dispara sale de ahí, y la munición es lo que se lleva aparte. El HUD lo muestra así: "saeta 12/28".

| Arma          | Cargador | Recarga |
| ------------- | -------- | ------- |
| La saeta      | 12       | 1,2 s   |
| La repetidora | 30       | 1,8 s   |
| La escopeta   | 6        | 2 s     |
| La ballesta   | 5        | 1,5 s   |
| El lanzador   | 3        | 2,2 s   |
| El fusil      | 4        | 2 s     |

- <kbd>R</kbd> recarga. Disparar con el cargador vacío también recarga, si llevás munición. Cambiar de arma deja la recarga a medias.
- **Se oye** dos veces: al salir el cargador viejo (un clic y el roce) y, al 65 % del tiempo, al entrar el nuevo (un golpe y el cerrojo, ida y vuelta).
- **Se ve**: el arma baja de golpe, 38°. Cuando entra el cargador nuevo da un tirón hacia arriba, a 18°. Vuelve a bajar y, en el último octavo, sube. La vista sigue esos ángulos a su propio ritmo (rápido al bajar, despacio al subir), y eso redondea las esquinas.
- La repetidora y el lanzallamas **disparan mientras se mantiene apretado**. Las otras, una vez por toque.
- Un arma tomada viene cargada.

Los personajes sin arsenal (el Dojo, la fortaleza, los guardias) no tienen cargador, y sus repeticiones dan el mismo hash.

## El balanceo, equilibrado

En la 5k, los ojos bajaban en cada paso que se oía, uno cada 0,8 m. Caminando eso daba unos seis pasos por segundo, y corriendo más: más un temblor que un andar. Ahora el balanceo tiene **su propia cadencia, que depende de la velocidad**: 1,9 pasos por segundo caminando y 2,6 corriendo (entre las dos, en proporción a la velocidad). Para comparar, una persona camina a unos dos pasos por segundo, y en Quake el balanceo da una vuelta cada 0,6 s, vaya a la velocidad que vaya.

También es más suave: los ojos bajan 2,2 cm en vez de 3,5, se mueven 1,4 cm de lado en vez de 2,2 y giran 0,3° en vez de 0,45. Corriendo, todo eso se multiplica por 1,45 en vez de 1,6, y al ir de costado se inclina menos.

## Pruebas

- **Los cuatro niveles**: cada uno se juega entero en una prueba, con todo su alto: escaleras, balcones, puentes, ascensores, la balsa, los bloques saltados, el montacargas. Pelea con todos y los voltea, toma las armas, las llaves y el secreto, y llega a la salida sin caer nunca. Su corrida es su repetición de referencia. Tardan 63, 82, 114 y 99 s, y los tiempos de oro son 82, 106, 148 y 129 s.
- **La recarga**:
  - pedida con R, se oye al sacar el cargador y otra vez, al 65 %, al meter el nuevo;
  - mientras dura, no dispara;
  - al terminar, el cargador está lleno y la munición llevada bajó lo justo;
  - con el cargador vacío, disparar recarga;
  - una tecla de arma deja la recarga.
- **Lo que dispara mientras se mantiene**: la repetidora, unas diez por segundo; el lanzallamas, quince, sin pasar de 6 m y gastando su aceite; el fusil, una vez por toque.
- **Cómo se ve la recarga**: abajo, el tirón al entrar el cargador, y arriba al final.
- **Un grupo llamado**: al tomar la llave del torreón, sus tres atacantes llegan con su rol, suena un cuerno donde está el defensor, y no vuelven a venir.
- **En el navegador**: el HUD con el cargador ("saeta 12/28"); un disparo ("11/28"), R ("recargando…") y el cargador lleno de nuevo ("12/27"); el primer nivel terminado, con su tiempo de oro ("1:22,0") y su resumen ("Atacantes: 0 de 12").

La versión de la simulación pasa a **48**. Cambian las repeticiones de la muralla, y las del Dojo, la torre y la fortaleza dan el mismo hash.

## Lo que queda

- La 5p: la torre. Contacto y profundidad (una sombra, polvo, el sonido al deslizarse), saltos en la pared más permisivos, seis pisos y un final.
- Que el suavizado de la navegación conozca el costado de una escalera.
