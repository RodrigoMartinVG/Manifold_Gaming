---
title: 'El tutorial, más ancho: lo que el motor ya sabía'
description: 'Antes de la fase 4, una pasada por el tutorial: ocho lecciones nuevas donde el motor ya tenía la idea y el tutorial la salteaba (rayos y barridos, un personaje animado, fricción y rebote, la masa, la cámara contra las paredes, la interfaz del juego, un nivel que se prueba solo, un calabozo con una semilla), las sutilezas que le faltaban a la etapa 3, y una lectura con ojos nuevos que dice qué no funciona.'
sidebar:
  order: 36
---

> Informe de la pasada por el tutorial antes de la fase 4. Una revisión encontró que las etapas 2 y 3 salteaban ideas que el motor ya tenía, y que las lecciones de la etapa 3 habían nacido sin sus sutilezas. La decisión [0013](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0013-a-deeper-tutorial.md) pide justamente eso: lecciones donde el motor ya tiene la idea y el tutorial la saltea.

## Qué hicimos

- **Ocho lecciones nuevas**, cada una con su ejemplo en vivo, sus capas y una prueba en el navegador que lee lo que su ejemplo muestra:
  - en la etapa 2, [preguntarle al mundo: rayos y barridos](../../tutorial/etapa-2/05-rayos-y-barridos/) y [un personaje animado](../../tutorial/etapa-2/06-un-personaje-animado/);
  - en la etapa 3, [fricción y rebote](../../tutorial/etapa-3/05-friccion-y-rebote/), [la masa: empujar y agarrar](../../tutorial/etapa-3/06-la-masa/), [la cámara contra las paredes](../../tutorial/etapa-3/07-la-camara-contra-las-paredes/), [la interfaz del juego](../../tutorial/etapa-3/08-la-interfaz-del-juego/), [un nivel que se prueba solo](../../tutorial/etapa-3/09-un-nivel-que-se-prueba-solo/) y [un calabozo con una semilla](../../tutorial/etapa-3/10-un-calabozo-con-una-semilla/).
- **Las etapas quedan con 8, 8, 7 y 11 lecciones.** Antes eran 8, 8, 5 y 5, aunque las fases 2 y 3 construyeron más que la 0 y la 1.
- **Las sutilezas de la etapa 3.** Las 21 lecciones de las etapas 0 a 2 las tenían y las 5 de la etapa 3 no. Ahora las tienen, y la prueba del tutorial pide al menos dos en cada lección, así no vuelve a pasar.
- **Ejemplos que se manejan.** Los nuevos que tienen algo que se mueve andan solos hasta que tocás una tecla, y una casilla les devuelve el piloto automático.
- **Lo que les faltaba a los repartidos:**
  - el glosario ganó una sección, "Modelos y animación", y los términos nuevos van con una definición corta;
  - la página de patrones ganó el objeto tipo (_type object_);
  - el índice del tutorial suma las ocho lecciones;
  - las lecciones viejas enlazan a las nuevas donde ya hablaban del tema.
- **Lo que una lectura con ojos nuevos encontró y se arregló acá:**
  - tres ejemplos de la etapa 2 suavizaban la cámara por cuadro, justo lo que enseña a evitar la lección de la cámara;
  - el libro de Gregory se citaba con dos ediciones distintas;
  - faltaba decir que la regla contra la trigonometría del navegador es del motor, no de los ejemplos;
  - algunas sutilezas contaban la historia del motor en vez de la trampa.

## Una lectura con ojos nuevos

Le pedimos a un lector sin contexto que recorriera el tutorial entero como alguien que programa un poco y quiere hacer juegos. Su veredicto: explica muy bien por qué funciona cada mecanismo, pero enseña cómo está hecho este motor, no a hacer juegos.

- **No hay un hilo.** Cada lección es una demo suelta: el personaje se reescribe en cada una, y nunca se arma algo que se juegue de punta a punta.
- **Casi nada se juega.** En la etapa 3, nada.
- **Faltan los vectores antes de los cuaterniones,** y un poco de TypeScript.
- **El material sobre el motor tapa la lección.** Las menciones a "etapa 3h" chocan con las etapas del propio tutorial.

Lo que salió de ahí se aplicó a las lecciones nuevas: el motor en un párrafo, nada de historia, ejemplos que se manejan. Lo demás es la forma misma del tutorial, y no se arregla con otra pasada: de ahí salió la decisión de pensarlo de nuevo (abajo, en lo que sigue).

## Hallazgos del motor

Escribir las lecciones obligó a medir el motor de cerca. Nada de esto se arregló acá: cada cosa queda para la etapa que la toca.

| Hallazgo                                        | Qué pasa                                                                                                                                                                                                                                                  | Para cuándo                            |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Un cuerpo puesto en otro lugar desaparece**   | Movido de golpe entre dos pasos (como hace `place`), un cuerpo fijo no aparece en las consultas ni donde estaba ni donde quedó, hasta el paso siguiente. Medido con Rapier solo                                                                           | Lo que pregunten los guardias (fase 4) |
| **Un rayo que empieza adentro no tiene normal** | Rapier la da como `NaN`, y el motor la pasa tal cual. La sombra bajo los personajes usa esa normal                                                                                                                                                        | Revisarlo en la 4.5                    |
| **Los pies del maniquí patinan**                | El ciclo de caminar mueve cada pie unos 0,42 m respecto de la cadera, y la vista supone pasos de 2,7 m. "Los pies no patinan" vale para el ritmo, no para el pie apoyado. Además, las diagonales mezclan los pasos un poco torcidos (`directions`)        | El personaje compartido (fase 4)       |
| **Colisiones fantasma**                         | Una pelota que rueda sobre cajas pegadas salta en las costuras. Rapier tiene cómo evitarlo (`FIX_INTERNAL_EDGES`), y el motor no lo usa: los rectángulos de un mapa también se tocan en costuras                                                          | Los calabozos (fase 4)                 |
| **Lo que casi resbala se duerme**               | Rapier duerme un cuerpo que va muy despacio: una caja apenas pasada su ángulo de fricción baja unos centímetros y se queda para siempre                                                                                                                   | La 4.5                                 |
| **El empujón de Rapier, otra vez**              | La 3g dijo que el empujón propio de Rapier movía el bloque como la caja; ahora no se reprodujo: con la masa que Rapier le da a la cápsula del motor (0,4 kg), no lo mueve. Y el rozamiento de la caja es de 242 N, no de 220: Rapier promedia con el piso | Corregir el comentario en la 4.5       |
| **Nada fija el calabozo**                       | La misma huella compara los navegadores con Node, pero los dos corren el código de hoy: un cambio sin querer al generador pasaría todas las pruebas, y las partidas guardadas apuntarían a otros calabozos. Hace falta una huella fija por semilla        | La aventura (fase 4)                   |
| **Las palabras del Dojo no tienen plurales**    | "1 tomadas", "quedan 1". Los subtítulos además pegan pedazos de frase (que funciona porque el español y el inglés ordenan igual), su flecha usa la mirada de la cámara sin aplanarla, y la fecha de una partida guardada no se traduce                    | La historia (fase 4)                   |

## Medido

- **Las pruebas sin pantalla:** 435. Hay 19 nuevas: la forma de cada lección, sus enlaces y las sutilezas.
- **En el navegador:** cada página del tutorial con sus ejemplos corre y dibuja (42 pruebas), y 8 pruebas nuevas leen lo que muestra cada lección nueva.
- **Algunos números de los ejemplos:**
  - una pelota de 25 cm para 4,75 m donde el rayo para a 5;
  - la caja de hielo resbala desde los 18° y la de piedra no;
  - el pie apoyado patina 2 a 9 cm/s con la fase por la distancia, y 23 a 68 sin ella;
  - el calabozo de la semilla 7 tiene 6 salas, conectadas, con huella `744db12f`.

## Lo que sigue

Un tutorial nuevo, pensado desde cero en lugar de reformar este, que queda archivado. Lo decidió el autor:

- **Lo atraviesa un proyecto que crece:** el lector arma su propio mundo lección a lección, con código que se acumula, y cada parte termina en algo que se juega.
- **La matemática entra justo cuando el juego la pide,** enseñada entera y con precisión en esa lección, sin una parte previa.
- **Puede ir adelante del motor:** enseña también lo que Manifold todavía no tiene, diciéndolo.
- **Este tutorial y Manifold Lab** (el otro que escribió el autor) son la materia prima.

Primero, su diseño escrito (una decisión) y una lección piloto que se juzga antes de multiplicarla. Después, la fase 4, empezando por partirla en etapas (4.0); desde ahí, cada informe anota las lecciones que van a necesitar sus ideas.
