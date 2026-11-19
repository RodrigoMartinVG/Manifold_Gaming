---
title: 'Etapa 5.5b: las guardas, por defecto'
description: 'Las fronteras entre capas salen ahora de una sola tabla, y todo archivo nuevo nace protegido: la simulación, la biblioteca y las reglas de los juegos sin pantalla, sin reloj y con los mismos bits en todos lados. Las reglas de la biblioteca compilan sin el DOM, y la torre, la fortaleza y la muralla tienen su cartucho sin pantalla, así que sus pruebas ya no cargan la vista.'
sidebar:
  order: 70
---

> Informe de la 5.5b, después de la [5.5a](../etapa-5-5a/). Es la segunda etapa de la [decisión 0033](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0033-the-shape-before-the-forest.md), y cumple lo que dejó pendiente la enmienda del 2026-11-19 a la [decisión 0003](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0003-boundaries.md): cuatro capas, y cada pieza en la suya.

## Lo que pedía

La auditoría encontró que las guardas entre capas se escribían a mano, archivo por archivo, y que todo lo nuevo nacía sin protección. Así pasó con `arms` desde la 5e hasta la 5.5a: sus armas y su sigilo corren en el paso de la simulación, y nada impedía que usaran `Math.sin` o dibujaran. Había más huecos:

- un paquete de la biblioteca podía importar un juego;
- el núcleo podía importar la biblioteca;
- nada impedía usar un reloj en la simulación;
- la guarda más fuerte de la 0003, el compilador sin el DOM, no llegaba a la biblioteca;
- la torre, la fortaleza y la muralla armaban su cartucho dentro del archivo de su página, así que sus pruebas sin pantalla cargaban three.js y la presentación.

## Una tabla de capas

`layers.js`, en la raíz, lista cada workspace del repositorio con su capa: base, simulación, servicio del motor, vista, biblioteca de los juegos, cartucho o sitio. Para cada uno, nombra solo los archivos cuyo papel no es el de su capa. Los papeles son cinco:

- **reglas**: corre en el paso o decide lo que pasa en él. Sin pantalla, sin red, nunca un juego, y con los mismos bits en todos lados: nada de `Math.sin`, `**` ni `Math.random`, y ahora tampoco un reloj;
- **cerebro**: piensa donde se hospeda la partida (decisión 0023). Sin pantalla, con cualquier aritmética;
- **vista**: dibuja, suena, arma la página. Nunca un juego;
- **herramienta**: un arnés o un chequeo, como el que maneja los niveles de un juego en las pruebas. Sin pantalla, con cualquier aritmética;
- **sitio**: fuera de las capas.

**Por defecto.** En la base, la simulación, la biblioteca y los cartuchos, un archivo que la tabla no nombra es de reglas: un archivo nuevo ahí nace protegido. El lint arma todas sus fronteras desde la tabla, y un paquete o un juego que todavía no está en ella recibe las reglas más estrictas.

**La prueba de que no se escapa nada:**

- un test exige que cada workspace del `package.json` esté en la tabla, con su nombre;
- otro, que cada archivo que la tabla nombra exista;
- un tercero escribe archivos que no existen en lugares nuevos y comprueba que el lint los rechaza: `Math.sin` en el núcleo, three.js en `arms`, `Date.now()` en el kit, `window` en las reglas de la torre, el shell (que es la página) desde las reglas de la muralla, `./game` desde un arnés nuevo, el kit desde el núcleo, un paquete que no está en la tabla. También comprueba que la vista sigue pudiendo dibujar y que un cerebro sigue pudiendo usar `Math.atan2`.

Con la configuración de antes, esos mismos archivos pasaban sin un solo error.

## Lo que la tabla encontró

Al armar el lint desde la tabla quedaron protegidos archivos que antes no lo estaban: `commands`, el `plan.ts` del kit, los datos del shell, los generadores del Dojo y de la aventura. Pasaron sin cambios. Hubo tres hallazgos:

- **Dos relojes fuera de la vista.** La fecha en que se guarda una partida (el calendario del jugador, decisión 0020) y el reloj con que el servidor dice cuánto tardó un snapshot (una medida de la máquina). Ninguno es el tiempo del mundo. Quedan, nombrados con su razón en el código.
- **Dos archivos que eran de la vista:** las declaraciones del Dojo, que leen el catálogo de la vista para la referencia de la consola, y las palabras del shell. La tabla ahora lo dice.
- **Los arneses de prueba importaban la página.** Una regla de import mira nombres de paquete, y `./game` es una ruta relativa: nada lo veía. Ahora lo que corre sin pantalla tampoco puede importar los archivos de vista de su propio paquete. La guarda nueva encontró los tres arneses enseguida.

## La biblioteca, compilada sin el DOM

`arms`, `character`, `kit` y `shell` compilaban con el DOM, solo porque sus modelos importan un `.glb`. Ahora cada uno tiene además `tsconfig.rules.json`: sus reglas, sin el DOM ni los tipos de Node, como el núcleo. Un archivo de reglas que escriba `document` ya no compila: lo probé con uno temporal en `arms`, rechazado por esa configuración y aceptado por la de la vista. Y si un archivo de reglas importara uno de vista, este entraría en la compilación sin DOM y fallaría. Un test comprueba que cada configuración deja afuera justo los archivos de vista que dice la tabla, y nada más.

## Cada juego, su cartucho sin pantalla

La torre, la fortaleza y la muralla se separan como el Dojo ya estaba:

- `levels.ts`: sus niveles, leídos de sus archivos;
- `cartridge.ts`: su cartucho, la lista de niveles en orden y cuándo un nivel está hecho;
- `game.ts`: solo la página.

El arnés que juega los niveles en las pruebas y los tests de recorrido importan ahora el cartucho, y ninguno carga la vista. El cartucho es el mismo objeto de antes, así que las repeticiones dan el mismo hash.

## Más orden

El lint dejó de recorrer lo que no es del proyecto: los worktrees de sesiones anteriores, los libros, los borradores y las cachés de un sitio viejo. Pasó de 1.405 archivos a los 473 del repositorio.

## Pruebas

- La tabla: 4 tests. Cada workspace está en ella; cada archivo que nombra existe; las reglas de la biblioteca compilan sin el DOM; un archivo nuevo nace protegido (nueve casos rechazados, dos permitidos).
- Los 887 tests sin pantalla pasan. **La versión de la simulación sigue en 49**, y las 21 repeticiones de referencia dan el mismo hash.
- La verificación de tipos completa, con las cuatro configuraciones nuevas y la del repositorio; el lint y el formato, limpios.
- **En el navegador**, contra mi propia compilación: 18 tests pasan. El determinismo (las repeticiones del Dojo y las mazmorras de la aventura, iguales a las de Node) y las páginas de los tres juegos: la torre (título, fantasma, cámara, final), la fortaleza, la muralla y la atmósfera.

## Lo que queda

- Las reglas de los cartuchos todavía compilan con el DOM, porque sus páginas viven en el mismo paquete. Las protege el lint (sin `window`, `document` ni almacenamiento). Separarlas también para el compilador es parte de que cada juego tenga su entrada sin pantalla, y se termina en la 5.5h, cuando los juegos compartan la biblioteca.
- Lo que sigue es la **5.5c**: las pruebas que escalan. Versiones por partes, para que el cambio de un juego no reescriba las repeticiones de los otros; la huella de todos los juegos en los cuatro navegadores; y cada nivel en su propio archivo de prueba.
