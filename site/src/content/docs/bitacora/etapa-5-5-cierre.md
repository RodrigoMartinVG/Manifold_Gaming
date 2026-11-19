---
title: 'Cierre de la etapa 5.5: la forma antes del bosque'
description: 'Las metas de la decisión 0033, medidas: cuáles se cumplen, cuáles no y por qué. Lo que dejó cada una de sus nueve etapas, y lo que queda para el bosque, cada cosa anotada en la etapa que primero la necesita.'
sidebar:
  order: 77
---

> Informe del cierre de la 5.5, después de la [5.5h](../etapa-5-5h/). Con él, la [decisión 0033](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0033-the-shape-before-the-forest.md) está completa, y lo que sigue es [el bosque](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0032-the-forest.md), desde las medidas de su F0.

## Lo que fue la 5.5

Entre la fase 5 y el bosque, ninguna mecánica nueva: cada pieza en un solo lugar, los lugares vigilados por defecto y las pruebas hechas para crecer. La [auditoría](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/audits/the-code-before-the-forest.md) leyó el código capa por capa y encontró, entre otras cosas, nueve errores de hoy, una cuarta capa (la biblioteca de los juegos) que nadie había nombrado, una sola versión de la simulación para todos los juegos, las formas de moverse como tres ganchos y quince casos especiales, una vista sin dueño para su presupuesto, sus luces y sus recursos, la carrera de un nivel copiada en cada juego, y un entorno lento.

Cada etapa, en una línea:

- **[5.5a](../etapa-5-5a/), lo que estaba mal hoy:** los ganchos de un cartucho al nacer, al cargar y en `level.diff`; el material que brilla, de cada copia; el conjunto de luces con el destello adentro; la cadena de posprocesado con anti-aliasing.
- **[5.5b](../etapa-5-5b/), los guardias por defecto:** una tabla de capas que lee el linter; un archivo nuevo, vigilado sin que nadie lo liste.
- **[5.5c](../etapa-5-5c/), las pruebas que escalan:** las versiones por partes (el cambio de un juego reescribe solo sus repeticiones); las referencias por convención, en los cuatro navegadores.
- **[5.5d](../etapa-5-5d/), el entorno:** los tipos en paralelo e incrementales, la integración continua en trabajos paralelos, las pruebas de navegador por área.
- **[5.5e](../etapa-5-5e/), la forma de la simulación:** en once partes, sin cambiar un bit; las formas de moverse como registros, un formato de nivel con un registro de líneas, los sistemas como módulos.
- **[5.5f](../etapa-5-5f/), lo que cambiaba bits, junto:** el estado agrupado por forma de moverse y el hash sin lo que vale su valor por defecto, en la versión 50 del motor.
- **[5.5g](../etapa-5-5g/), la forma de la vista:** un nivel de calidad dueño del presupuesto, un índice de entidades, un servicio de recursos, una tubería para la cámara, alcances que devuelven lo que se agregó.
- **[5.5h](../etapa-5-5h/), los juegos sobre una biblioteca:** la carrera de un nivel, los archivos por nombre y un conductor sin pantalla en el shell; las corrientes en el núcleo; un juego de prueba que no copia nada.

## Las metas, medidas

La decisión las escribió como hipótesis que el cierre confirma o corrige. Medidas en esta máquina (la del autor), con nada más corriendo:

|                                                      | Antes de la 5.5                                | Meta                   | Ahora                                              |
| ---------------------------------------------------- | ---------------------------------------------- | ---------------------- | -------------------------------------------------- |
| La verificación de tipos, desde cero                 | 77 s                                           | 30 s                   | 42 s                                               |
| La verificación de tipos, después de un cambio       | 77 s                                           | 10 s                   | 27 s sin cambios; 33 s después de uno en el núcleo |
| Todas las pruebas sin pantalla (`test:all`)          | 118 s                                          | 45 s                   | 97 s (940 pruebas)                                 |
| `npm test`, sin los recorridos                       | —                                              | 20 s                   | 50 s (892 pruebas)                                 |
| La integración continua, un push                     | 15 a 46 min                                    | 12 min                 | sin medir                                          |
| Los archivos que copia un juego nuevo                | unos 9                                         | ninguno                | ninguno                                            |
| Las repeticiones que reescribe el cambio de un juego | las 21                                         | las de ese juego       | las de ese juego                                   |
| Las referencias de cada juego, comprobadas en        | Node (las del Dojo, en los cuatro navegadores) | los cuatro navegadores | los cuatro navegadores                             |
| Un archivo nuevo, vigilado                           | si alguien lo lista                            | siempre                | siempre                                            |

**Se cumplen las cuatro metas de forma**: un juego nuevo no copia ningún archivo (el juego de prueba de la 5.5h es solo sus reglas, su nivel, sus palabras y su música); el cambio de un juego reescribe solo sus repeticiones (las versiones por partes de la 5.5c); las referencias de los cuatro juegos se comprueban en los cuatro navegadores; y un archivo nuevo está vigilado desde su primera línea (la 5.5b).

**No se cumplen las tres de tiempo**, y la medida dice por qué. Corrige las hipótesis:

- **Los tipos** bajaron de 77 s a 42 s desde cero, pero el piso tiene dos partes. Una es el chequeo del sitio (`astro check` más el del tutorial), que tarda 23 s solo. La otra es que cada paquete vuelve a verificar el código del núcleo que importa: el shell, 23 s. Para bajar a 30 s y a 10 s hacen falta las _project references_ de TypeScript, que cada paquete se verifique una vez. Chocan con los JSON de recursos que se comparten los paquetes (como encontró la 5.5d), y eso es un trabajo propio.
- **Las pruebas rápidas** ya no esperan a un archivo lento: sus 104 archivos suman 230 s de trabajo, que en los 8 núcleos de esta máquina son unos 29 s aun repartidos a la perfección, más lo que tarda en cargarse cada uno. Los 20 s piden menos trabajo, no otro orden.
- **Todas las pruebas** tienen un piso de un solo archivo: la reproducción de las cuatro referencias de la muralla, unos 20 s cada una, en serie, 85 s. Separarlas, como la 5.5c separó las grabadoras, bajaría el total hacia los 70 s: el trabajo entero suma 554 s. Los 45 s piden jugar cada nivel una vez y no dos (hoy lo juega su grabadora y después se reproduce su repetición), y eso es una decisión sobre qué prueba cada una, no un arreglo.
- **La integración continua** no la pude medir: en esta etapa no hubo un push. Los trabajos en paralelo y la imagen de Playwright existen desde la 5.5d, y el primer push del autor va a dar el número.

## Lo que queda

Lo que la 5.5 encontró y no hizo, cada cosa anotada en el roadmap donde primero se la necesita (casi todo, en una etapa del bosque):

- **Los puntajes de cada juego y la migración del progreso guardado** (G3): cuando un juego del bosque cuente otra cosa que pasos, estrellas y caídas.
- **Las armas desde tablas con opciones, las de la muralla en la muralla, y sus contratos probados en `arms`** (G4, G6): con las criaturas.
- **El generador de la aventura en la biblioteca** (G7), **las superficies públicas recortadas** (G10) y **un registro de juegos para las páginas, las tarjetas y las referencias del sitio** (G11, con las páginas del bosque).
- **Las opciones del montaje, agrupadas** (de la 5.5g).
- **Los triángulos de la muralla**, de 63.000 a 81.000 contra los 50.000 del piso (medido en la 5.5g): con el dibujo a escala, la F3.
- Y de la 5.5e: los `Vec3` de los comandos (la base no importa nada, decisión 0003), y los ejes de la corrección de esquinas y las costuras de los compuestos (fase 7).
- Y del entorno, lo que piden las metas de tiempo: las _project references_ de TypeScript, con los JSON de recursos exportados de otra forma; la reproducción de cada referencia en su propio archivo; y decidir si cada nivel tiene que jugarse dos veces.

## El roadmap, el plan

El roadmap pasó de 208 KB a 66 KB. Cada etapa terminada es su título y el enlace a su informe; lo que hizo y midió está acá, en la Bitácora. «Ahora» son cinco líneas. La sección de la 5.5 quedó como las demás, y la del bosque tiene lo que la 5.5 le deja. La prueba de estado (`status.test.ts`) sigue comprobando su tabla contra `site/src/stages.ts`.

## Pruebas

- Este cierre no cambia código: mide. Los tiempos son de esta máquina, con nada más corriendo; los de cada archivo, de la corrida de todas a la vez.
- La prueba de estado (`status.test.ts`) pasa con el roadmap nuevo.
- Al cerrar pasan las 940 pruebas sin pantalla, la verificación de tipos, el lint y el formato, las 152 pruebas de navegador en Chromium y las 22 de Firefox y WebKit.
