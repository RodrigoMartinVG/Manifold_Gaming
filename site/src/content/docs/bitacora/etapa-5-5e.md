---
title: 'Etapa 5.5e: la forma de la simulación, sin cambiar un bit'
description: 'Las formas de moverse son registros, lo que el personaje percibe se lee una vez y lo que se suma a su movimiento es una lista; el personaje tiene el marco de su propio cuerpo y su propio controlador; los sistemas del mundo son módulos; cada tipo de línea de un nivel está en un solo lugar, y cada componente en una tabla; las palabras de un juego llevan su nombre; la luz tiene un emisor y receptores. Las 21 repeticiones dan exactamente el mismo hash, y el primer paso de un nivel grande cuesta la mitad.'
sidebar:
  order: 73
---

> Informe de la 5.5e, después de la [5.5d](../etapa-5-5d/). Es la quinta etapa de la [decisión 0033](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0033-the-shape-before-the-forest.md): la forma del código de la simulación, para que lo que trae el bosque (nadar, una liana, montar, el viento, criaturas que no son el maniquí) sea un registro nuevo y no doce cambios. Con una condición: **ni un bit distinto**.

## Lo que pedía

La auditoría encontró nueve problemas de forma en la simulación (S1 a S9). Los más grandes:

- **Las formas de moverse** eran tres ganchos por modo y unos quince casos especiales en una sola función de 500 líneas. Nadar, una liana o montar habrían tocado unos doce lugares cada uno.
- **El cuerpo del personaje** se leía con los números del maniquí escritos a mano (0,5, 0,8, 0,3), y lo que pisaba solo se encontraba si era una cápsula.
- **El formato de niveles** era un lector de 570 líneas, y sus tipos de línea se distinguían en seis lugares: agregar la línea `terrain` del bosque eran unos trece cambios.
- **Un componente** se describía en cinco lugares, y los juegos escribían `e.game = {…}` directamente.
- **Las palabras de un juego** (el grito de un guardia, el cuerno de la muralla) estaban en las listas cerradas del núcleo.
- **La luz**: las lámparas iluminaban en todas direcciones, los vigías tenían un cono y ninguna luz, y la luz se calculaba solo en los personajes.

## Cómo se prueba que no cambió nada

Cada parte terminó igual: `npm run references` vuelve a grabar las 21 repeticiones de referencia, y **los 21 archivos tienen que quedar idénticos byte a byte**. Si un solo número de un solo paso cambia, cambia el hash de la última línea y el archivo ya no es el mismo. Pasó en las once partes. La versión del motor sigue en 49 y la de cada juego, donde estaba.

Además, cada parte que cambia lo que el código hace tiene pruebas nuevas, que fallaron con el código de antes (lo comprobé poniendo el código viejo un momento). Las que solo mudan código de lugar se prueban con las de siempre y con las repeticiones.

## Las partes

### 1. Una palabra, una tabla de señales, el borde del mundo

Lo que es un nombre (`door_north`, `ice`, `opacity`) tiene un solo patrón, y cuántas señales lee cada tipo de señal es una sola tabla, que comparten el mundo y el lector de niveles. El borde del mundo (500 m desde el origen) es un dato del mundo y no una constante: un valle de 500 × 500 m con el origen en una esquina tiene esquinas a 707 m. Un mundo que no lo cambia hashea como antes.

### 2. Los sistemas del mundo, en módulos

`World` tenía su estado y unos diez sistemas como métodos privados. Ahora cada sistema es un módulo (`systems/`: el movimiento de lo que mueve el programa, la lectura de la física, la historia de poses, los proyectiles, lo que se rompe, la luz, las señales, las zonas, la historia), y el mundo guarda el estado, el ciclo de vida, las consultas y los índices. `world.ts` pasó de 1.359 a 881 líneas.

Dos índices nuevos: **por nombre**, porque `named()` recorría todas las entidades, y se llamaba en cada paso por cada zona y señal que la lee; y **por handle de la física**, que ya existía pero que el empuje del personaje no usaba.

### 3. Las palabras de un juego, con el nombre de su dueño

Los sonidos y lo que una cosa permite (_affordances_) son ahora el motor (`step`, `land`, `hit`, `door`, `lift`, `break`, `blast`) o la palabra de un juego con su dueño: `arms.ready`, `wall.horn`, `forest.perch`. Hay un evento genérico de juego (`{ type: 'game', name: 'wall.horn' }`). El búho, los lobos o la Podredumbre del bosque no van a tocar el núcleo.

### 4. Todos los colisionadores, un controlador por personaje, el marco del cuerpo

- **La física** lee una forma y su colisionador en una sola tabla (bola, cápsula, caja, compuesto) y recorre todos los colisionadores de un cuerpo: antes tomaba el primero.
- **El controlador** recibe su configuración en cada movimiento, y a Rapier solo se le avisa lo que cambió.
- **El marco del cuerpo** (`frameOf`: dónde empieza su base redonda, dónde está su punto más bajo, su radio, sus manos) sale de la forma de su cuerpo. Para la cápsula del maniquí son exactamente los números que estaban escritos; para una bola o una caja, los suyos.
- **Lo que pisa** se encuentra con cualquier forma: una bola o una caja ahora se paran, caminan, se oyen al caer donde tocan el piso y las lleva una plataforma. Antes, una bola que caía se oía 38 cm bajo el piso, y la plataforma no la llevaba.
- **Un juego puede darle a un personaje su propio controlador** (`controller`: un zorro sube escalones más bajos que un ciervo) **y su propio peso** (`mass`: lo que lo empuja una explosión).

### 5. Cada tipo de línea de un nivel, en un solo lugar

`LINES` dice, para cada palabra, desde qué formato se lee, cómo se lee, se escribe y se construye; y, para lo que construye piezas, cómo se hace una, se mueve (`clone`), se guarda y sigue a un `set` de la consola. Un solo lector de las palabras de una línea, y uno para las palabras del final, en lugar de cinco bucles. El formato está ahora en cuatro archivos (`level/`): el formato y sus tipos, el lector, el registro, y un nivel entero leído, escrito y construido recorriendo los tipos en su orden. Ese orden importa: de él sale el id de cada entidad, y por lo tanto el hash.

Antes de tocarlo guardé una línea base de los 30 niveles del repositorio: cada uno leído, escrito de vuelta, construido (su hash, los ids de sus entidades) y escrito desde el mundo. Después, los 30 dieron exactamente lo mismo.

Y tres cosas que se habían desviado: a una línea desconocida se le decían los tipos que hay, sin `kit`; a una palabra que una línea no toma se le decían las que toma solo en algunos tipos; y el material de una pieza del kit no se revisaba como el de una caja.

### 6. Una tabla de componentes, y `setComponent`

`ComponentSpecs` es la única lista de lo que se pide al crear una entidad; el tipo `Components` sale de ella, y `MAKERS` (que tiene que cubrirla, o no compila) revisa cada uno y le da con qué empieza, en el orden en que `createEntity` los corre. `SETTABLE` dice qué no puede cambiar `set`, y por qué. Un juego pone su componente con `setComponent(e, 'wall.wave', …)`, y su nombre se revisa como al nacer; el Dojo, la muralla y el sigilo de `arms` ya lo usan.

### 7. Las formas de moverse, como registros

Es la parte central (S1, su primera pasada). Cada modo es un registro que dice:

- **cuándo aplica**, en el orden de `CHOICE` (agacharse aparece dos veces: un cuerpo bajo sin lugar para pararse sigue bajo, y en su propio turno, si se pide);
- cómo dirige la velocidad, si se sostiene solo contra la gravedad o si frena su caída;
- **su postura**: si el cuerpo va bajo, cuánto se lo ve, si sus pasos suenan y hasta dónde, si sus pies resbalan en una pendiente;
- **su propio salto** (rodando lo guarda para después; trepando salta lejos de la pared), su propio movimiento (colgado de una cornisa), qué hace al dejarlo (el salto sobre el borde de una pared), lo que solo guarda mientras está en él (la cornisa) y hacia dónde mira.

Lo que el personaje percibe al empezar su paso se lee una vez (`sense`), lo que hace es un solo `Motion`, y la gravedad, lo que el juego le hace cargar y la plataforma son `CONTRIBUTIONS`, en orden: ahí van a ir la flotación y el arrastre del agua y el viento del bosque. Una forma de moverse nueva es un registro.

La caída es ahora una sola regla, `pulled`, la del personaje y la de sus métricas, que tenían una copia. La luz lee de la postura cuánto se ve. Y los fantasmas leen los modos que hay: su lista había perdido `slide` y `hang`, así que la tira de un personaje colgado o deslizándose por una pared no se podía volver a leer.

### 8. El personaje, en partes

`character.ts` había crecido a 1.633 líneas. Pasó, sin cambiar lógica, a una carpeta cuyos archivos dependen unos de otros en un solo sentido: su cuerpo y sus números, y la matemática de dirigir, girar y caer, no dependen de nada; lo que encuentra alrededor y sus manos; sus formas de moverse; lo que percibe y lo que se suma a su movimiento; y su paso.

### 9. Un emisor, un rayo, y la luz recibida

Una lámpara y el ojo de un vigía son ahora `Emitter`s (dónde, hacia dónde, el coseno de la mitad de su cono, su alcance), y `reaches` es el único rayo: dentro del alcance, dentro del cono, nada en el medio. Antes cada uno tenía el suyo, y se habían desviado: la lámpara quedaba afuera justo en su borde y el ojo adentro. Cualquier entidad puede recibir luz (`lit`), y el sistema de luz escribe en cada paso cuánta le llega, como hace con un personaje. Es la base del rayo del escudo, de un reflejo y de la luz del bosque.

### 10. Cada patrón de palabra, una vez

Una palabra, una clave (de las palabras de un juego, el nombre de un modelo, el tipo de una zona), un nombre con puntos de una repetición, y una palabra con su dueño: cada patrón está una vez en `words.ts`. El de las acciones era propio, y aceptaba `dojo.` y `dojo..throw`; ya no.

## Pruebas

- **Las 21 repeticiones, idénticas byte a byte** en cada una de las once partes. La versión del motor sigue en 49.
- **Las 19 pruebas nuevas** (todas fallaron con el código de antes, salvo la del nivel con una línea de cada tipo, que es una guarda de cobertura): una bola y una caja paradas, caminando, oídas donde tocan el piso y llevadas por una plataforma; el escalón de cada personaje y su peso en una explosión; un nivel con una línea de cada tipo (si se agrega un tipo sin línea ahí, la prueba falla); los mensajes del lector; `setComponent` y la tabla de componentes; los modos de los fantasmas; la regla de la caída; la luz recibida y el rayo; el patrón de las acciones.
- Pasan los 876 tests sin pantalla de `npm test`, la verificación de tipos, el lint y el formato.
- **En el navegador**, contra mi propia compilación en el puerto 4420: las 21 repeticiones dan la misma huella en Firefox y WebKit, como en Node, y pasan sus pruebas de física (22 de 22). En Chromium pasan las 151 pruebas de navegador, en 16 minutos.
- **El rendimiento** quedó donde estaba: el paso del motor en un nivel de la muralla, 1,43 ms antes y 1,25 a 1,29 ms después; la sala de estrés y la luz, igual.

### 11. El primer paso lento de un nivel grande

Lo dejó abierto la fase 5, y el roadmap se lo pasó a esta etapa. Antes del primer paso de un mundo, las consultas de Rapier no ven ninguno de sus cuerpos (las actualiza cuando da un paso, y no tiene cómo hacerlo antes), así que cada consulta le preguntaba a cada cuerpo por separado: en el primer nivel de la muralla, 540 entidades, por cada consulta de cada personaje. El primer paso costaba **100 veces el de Rapier** (15 a 16 ms).

Ahora cada colisionador sabe cuánto se extiende desde su centro (el radio de una esfera que lo contiene, sacado de su forma), y una consulta le pregunta a un cuerpo no visto solo si su camino, con lo que lanza, pasa así de cerca, con un centímetro de margen. Lo que deja afuera solo podía decir "no me toca": las respuestas son las mismas, y las repeticiones, idénticas.

|                          | Antes            | Ahora                       |
| ------------------------ | ---------------- | --------------------------- |
| El primer paso del nivel | 100 veces, 16 ms | 47 a 54 veces, 7,2 a 7,7 ms |

Lo que queda del primer paso es el primer paso de Rapier mismo (1,5 ms: arma su estructura de consultas) y el código que corre por primera vez. Su presupuesto pasó de 140 a 75.

## Lo que queda

- **La segunda pasada de S1**, el estado del personaje agrupado por modo, cambia el hash: es de la **5.5f**, con su única versión (la 50).
- **El índice de entidades por componente** que nombra S3 lo pide la vista (V7): es de la 5.5g.
- **El `Vec3` de `commands`** se queda: la base no importa ningún paquete (decisión 0003), y es el mismo tipo.
- **Los ejes de la corrección de esquinas y las costuras de los compuestos**, que solo se cortan en x y z, son de la fase 7, la de los planetas: los ejes ya se proyectan sobre el piso de cada personaje.
- **Tres notas del plan del tutorial** (`docs/tutorial-lessons/`) señalan `core/src/character.ts`, que ahora es una carpeta: son de la sesión del tutorial.
