---
title: 'Etapa 5.5g: la forma de la vista'
description: 'Un nivel de calidad dueño del presupuesto y de cada perilla; el aspecto como dato, con el plano lejano sacado de la niebla; un índice de entidades en lugar de recorrer el mundo en cada cuadro; materiales compartidos y lotes rehechos por cuadrado; un servicio de recursos que carga cada archivo una vez y lo libera, con copias simples para los objetos; una sola física cosmética y un solo par de sistemas de partículas; una tubería para la cámara; alcances que devuelven lo que cada pieza agregó; el sentir de cada arma como dato en su biblioteca; bandas de detalle para la animación y un presupuesto de voces.'
sidebar:
  order: 75
---

> Informe de la 5.5g, después de la [5.5f](../etapa-5-5f/). Es la séptima etapa de la [decisión 0033](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0033-the-shape-before-the-forest.md): la forma de la vista, para que el bosque (terreno, vegetación en celdas, agua, cuatro patas) se apoye en servicios y no reinvente cada uno.

## Lo que pedía

La auditoría encontró en la vista trece problemas (V1 a V13). V3, la carga por zonas, es del bosque (F3), y V5, la cadena de posprocesado, la hizo la 5.5a. El resto:

- **Nadie era dueño del presupuesto.** Los 300 draw calls y 50.000 triángulos existían solo en una prueba de navegador, y cada perilla era una constante en otro archivo.
- **Un objeto por entidad, tocado en cada cuadro**: un material por primitiva, la pose de cada entidad copiada en cada paso (también la de las paredes), y los lotes de lo quieto rehechos enteros ante cualquier cambio.
- **El aspecto era un booleano** y un bloque de constantes; el plano lejano (200 m), la cúpula del cielo (150 m) y el final de la niebla (180 m) coincidían porque los números se eligieron así.
- **Los recursos**: un cargador por montaje, sin caché ni liberación, y cada modelo como el esqueleto completo de un personaje: las 293 piezas del kit de la ciudadela clonaban cada una un esqueleto y armaban un mezclador, extremidades, un andar y manos.
- **Recorridos de todo el mundo**: ocho piezas recorrían todas las entidades en cada cuadro, y la página encontraba a su jugador copiándolas todas, dos veces por cuadro y una por evento.
- **La cámara**: el balanceo del andar, el retroceso, el temblor y el final de la torre la movían y la devolvían cada uno a su manera, en el orden en que estaban listadas las piezas.
- **La limpieza dependía de que cada pieza se acordara**: los cuerpos no tenían `stop`, otras nueve tampoco, y la historia dejaba un escucha de teclas en la ventana.
- **La vista conocía las armas por nombre**: el destello y el retroceso de cada una, hasta dónde se oye, un `switch` de sonidos por arma, y la lanza de fuego y el cohete como casos especiales.
- **Los mismos servicios construidos dos a cuatro veces**: dos físicas cosméticas con las cajas del nivel, dos sistemas de "lo que cubre", la luz del lugar calculada dos veces.
- **La animación a costo completo** para cada personaje, a cualquier distancia; ningún presupuesto de voces; las sondas de las pruebas escritas en cada cuadro.

## Lo que hay ahora

### El nivel de calidad (V1)

`quality.ts` tiene los niveles; hoy uno, **el piso**, con los números de la decisión 0026: 300 draw calls, 50.000 triángulos, seis luces, resolución 1×, cuatro muestras de anti-aliasing, el filtrado de las texturas, las partículas, el lado de los cuadrados de los lotes, las voces y las bandas de la animación. El escenario es dueño del nivel activo y cada pieza lo lee ahí. La página publica su presupuesto (`data-budget-draws`, `data-budget-triangles`), y la prueba de la ciudadela lo lee de ahí en lugar de tenerlo escrito.

### El aspecto como dato, y el plano lejano de la niebla (V4)

Un `Look` dice la niebla de día y de noche, la exposición, el relleno frío, la luz de luna, el brillo y la viñeta. Un juego o un nivel puede dar el suyo (`atmosphere: Look`). **El plano lejano sale de la niebla del momento**: su final al 90 % del camino, y la cúpula del cielo a tres cuartos. De día, con la niebla de los juegos, son los mismos 200 m; de noche, la niebla termina a 85 m y el plano lejano en 94: lo que la niebla ya tapaba no se dibuja.

### El índice de entidades (V7)

La página tiene un índice (`page.index`): las entidades por componente, en orden de id, mantenido con los eventos del mundo y rehecho cuando el mundo es otro (sea cual sea el camino: un recomienzo, una carga, una instantánea, una repetición, unirse a una partida), y el jugador de la página en caché. Las luces, los vigías, el sigilo, el sonido de los cohetes y de los deslizamientos, la historia, la cámara, el polvo, el fuego y la sonda ya no recorren el mundo. Y el sigilo ya no lee el ancho de la página después de escribirla (forzaba a recalcular el diseño en cada cuadro): lo mide cuando cambia.

### Lo que se mueve y lo que no (V2)

- **Los materiales de las primitivas, compartidos** por color y opacidad: un nivel de 300 cajas grises ya no tiene 300 materiales. Lo que brilla (una lámpara, un vigía) toma su propia copia, como desde la 5.5a.
- **Solo lo que puede moverse guarda su pose del paso anterior** (personajes, proyectiles, lo que mueve la física o un programa); lo demás se dibuja donde está.
- **Lo quieto, en lotes, no se toca en cada cuadro**, y los lotes se rehacen **solo en los cuadrados que cambiaron**, no todos ante cualquier cambio.

### Los recursos (V6)

Un servicio de recursos (`assets.ts`) con **un solo cargador**, que ya lee archivos comprimidos con meshopt y, si la página le dice dónde está el transcodificador de Basis, texturas KTX2 (que la GPU guarda comprimidas; para eso el cargador necesita el renderer, y antes no lo tenía). **Cada archivo se carga una vez para todas las páginas**, se cuenta quién lo usa y **se libera cuando nadie lo usa**: antes nada se liberaba nunca. Tiene una señal de listo y su progreso. Y **lo que no tiene animaciones se dibuja con una copia simple** que comparte la geometría y los materiales: el esqueleto completo es solo para los personajes.

### Servicios de la página (V11)

- **Una sola física cosmética** (`cosmetic.ts`) para los fragmentos, los escombros y las caídas, con las cajas quietas del nivel, hecha cuando nace el mundo (no en la primera explosión, el tirón de entonces) y avanzada una vez por cuadro aunque la usen dos piezas.
- **Un solo par de sistemas de partículas** (`particle-service.ts`), lo que suma luz y lo que cubre, para el fuego y el polvo, movido y alumbrado una vez por cuadro.
- **La luz del lugar**, una vez por cuadro, del escenario.

### La cámara, una tubería (V8)

La pieza de la cámara pone su pose base en cada cuadro; lo demás la pide al escenario (`effects`): movimientos y giros sobre sus propios ejes con un peso, o tomarla con una prioridad. El escenario los aplica una vez, al dibujar, y al empezar el cuadro siguiente los deshace: lo que se movió vuelve, y quien la tomó la devuelve entera. Lo que la rueda o el ratón cambiaron en el medio se queda. El balanceo del andar, el temblor, el retroceso y el final de la torre pasaron a ella. El final de la torre la toma con `look(desde, hacia, prioridad)`, con números simples: un juego no necesita three.js para eso.

### Alcances (V9)

Una pieza pide un alcance a su página (`page.scope()`) y agrega por él objetos de la escena, elementos de la página y escuchas; cuando la página se detiene, cada alcance devuelve todo. Los cuerpos tienen su `stop` (sus mallas, lotes, sombras, trazadoras, formas compartidas y materiales); la historia ya no deja su escucha en la ventana; las vistas de depuración, las señales y la navegación devuelven lo que dibujaron.

### El sentir de cada arma, como dato (V10)

`arms` da cómo se siente cada arma al lado de cómo se ve (`ARMS_FEEL`: su destello, su retroceso, hasta dónde se oye, qué sonido hace; la lanza de fuego echa llamas; el cohete deja estela y silba, y lo que toca lo hace explotar), y los juegos se lo pasan a la vista al montar. La vista se queda con recetas genéricas, con nombres de cómo suenan (`crack`, `boom`, `roar`, `whoosh`…) y no de qué las hace. Los números son los que tenía la vista.

### Bandas de detalle, voces, sondas (V12, V13)

- **La animación por distancia a la cámara**: hasta 15 m (y el personaje propio, siempre), toda, con los rayos de manos y pies; hasta 40 m, sin esos rayos; más lejos, un cuadro de cada tres, con el tiempo de los que saltó.
- **Un presupuesto de voces**: con 32 sonidos sonando, uno nuevo más débil al oído que todos ellos no se crea.
- **Las sondas de las pruebas** se escriben solo cuando cambian. Las sombras, que nunca se dibujan, ya no se marcan: lo dice el nivel.

## Lo medido

La ciudadela en los cinco lugares de su prueba de presupuesto, y cada nivel de cada juego desde su pantalla de título, en Chromium sin GPU (contra la compilación de la 5.5f y la de la 5.5g):

| Dónde                     | Draw calls | Triángulos      |
| ------------------------- | ---------- | --------------- |
| La ciudadela, en -2 1 9   | 72 → 72    | 34.356 → 34.356 |
| La ciudadela, en 2 1 -2   | 103 → 103  | 39.440 → 39.440 |
| La ciudadela, en 11 4 1.5 | 47 → 47    | 25.984 → 25.984 |
| La ciudadela, en 13 7 4   | 55 → 55    | 26.756 → 26.756 |
| La ciudadela, en 0 8 -24  | 40 → 40    | 19.604 → 19.604 |
| La torre, piso 1          | 53 → 53    | 27.996 → 27.996 |
| La torre, piso 2          | 39 → 39    | 17.056 → 17.056 |
| La torre, piso 3          | 44 → 44    | 16.464 → 16.464 |
| La torre, piso 4          | 51 → 51    | 10.244 → 10.244 |
| La torre, piso 5          | 50 → 50    | 13.828 → 13.828 |
| La torre, piso 6          | 44 → 44    | 22.304 → 22.304 |
| La fortaleza, nivel 1     | 112 → 108  | 33.528 → 33.360 |
| La fortaleza, nivel 2     | 40 → 40    | 17.116 → 17.116 |
| La fortaleza, nivel 3     | 53 → 53    | 26.796 → 26.796 |
| La fortaleza, nivel 4     | 46 → 46    | 23.224 → 23.224 |
| La muralla, nivel 1       | 267 → 251  | 64.196 → 63.644 |
| La muralla, nivel 2       | 274 → 256  | 81.860 → 81.268 |
| La muralla, nivel 3       | 268 → 256  | 81.068 → 80.680 |
| La muralla, nivel 4       | 216 → 208  | 81.664 → 81.368 |

**Los draw calls y los triángulos casi no cambian**, y es lo esperable: los lotes de lo quieto existían desde la 5m, y lo de esta etapa es trabajo de CPU, memoria y forma (materiales, poses copiadas, recorridos, esqueletos de objetos, servicios duplicados). **El tiempo de cuadro en la Iris Plus no lo medí**: en Chromium sin GPU dibuja la CPU y el número no dice nada de una GPU integrada.

**Un hallazgo: los cuatro niveles de la muralla pasan el presupuesto de triángulos** (de 63.000 a 81.000, contra 50.000). La prueba de presupuesto solo miraba la ciudadela, así que nadie lo vio. El plano lejano de la niebla no lo resuelve: todo lo que dibuja está a menos de 85 m. Queda como tarea propia: saber qué lo compone (¿los atacantes, cada uno con su modelo completo?) y darle a lo lejano menos triángulos.

## Pruebas

- **Nuevas**: el nivel de calidad y el plano lejano; el índice (orden de id, los eventos, lo que perdió su componente, otro mundo); los alcances (objetos fuera y liberados, escuchas quitados, en orden inverso, una sola vez); la física cosmética (una por página, otra para otro mundo, un paso por cuadro aunque la pidan dos); y en el navegador, **un mundo nacido cien veces en la misma página** (el torreón: modelos, lámparas, guardias armados, una lámpara que se rompe): las geometrías y texturas que guarda la GPU y los objetos de la escena quedan como estaban.
- La prueba de la ciudadela lee su presupuesto de la página.
- **Lo que encontraron las de navegador**: la primera versión de la tubería de la cámara la devolvía entera a su pose base al empezar cada cuadro, y borraba lo que la rueda y el ratón habían cambiado en el medio. Dos pruebas de Chromium fallaron por eso; ahora se deshace solo lo que se movió, y la pose entera vuelve solo cuando alguien la tomó.
- Pasan las pruebas sin pantalla, la verificación de tipos, el lint y el formato, las 152 pruebas de navegador en Chromium y las 22 de Firefox y WebKit.

## Lo que queda

- **Una página montada y detenida cien veces** no la pude medir entera: no hay forma de montar y desmontar una página desde una prueba sin agregarle código de prueba al sitio, y cada montaje crea su propio contexto WebGL. Lo medido es el mundo nacido cien veces (lo que pasa al recomenzar y al cargar niveles), y que cada pieza devuelva lo que agregó.
- **Las opciones del montaje siguen siendo una lista**: agruparlas cambia la forma en que cada juego se monta. Queda con lo que deja la [5.5h](../etapa-5-5h/).
- **El sonido de ambiente y el del juego** todavía hacen cada uno su ruido de fondo.
- **Los niveles de la muralla y su presupuesto de triángulos**, arriba.
- Lo que sigue es la **5.5h**: los juegos sobre una sola biblioteca.
