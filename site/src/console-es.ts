/**
 * THE CONSOLE'S REFERENCE, IN SPANISH (decision 0011: the site in Spanish, the console in English):
 * what each name is, in a sentence for the site. Its name, how it is written, the values it takes,
 * its default and its class come from the declarations themselves (`dojoDeclarations`, stage 2.5a).
 * A name declared without its sentence here, or a sentence for a name nobody declares, stops the
 * site's build (ConsoleReference.astro). In the sentences, `code`, **bold** and [links](…).
 */
export const CONSOLE_ES: Readonly<Record<string, string>> = {
  // ---------- The engine's variables ----------
  seed: 'la semilla del azar del mundo: la misma semilla, el mismo mundo',
  'physics.gravity':
    'la gravedad, en m/s² a lo largo de cada eje (x y z): la de la Tierra es `0 -9.81 0`; la de la Luna, `0 -1.62 0`',
  'show.stats': 'el paso, la huella, las entidades y los cuadros por segundo',
  'show.wireframe': 'las mallas como alambre',
  'show.sensors': 'las zonas del nivel',
  'show.axes': 'los ejes del mundo en el origen',
  'show.physics': 'los colisionadores, como los ve la física',
  'show.vectors': 'velocidades, y hacia dónde mira cada personaje',
  'show.contacts': 'los puntos de contacto, con su normal',
  'show.gravity': 'el campo de gravedad, como flechas',
  'show.signals':
    'las señales: una línea desde cada mecanismo hasta las zonas de donde sale su señal, verde mientras está prendida',
  'view.timescale': 'mostrar el mundo más lento (0.2) o más rápido (2), sin cambiar la física',
  'view.paused': 'el mundo frenado (con `step` avanza de a un paso)',
  'controls.scheme': 'cómo manejan las teclas al personaje ([las dos maneras](../como-se-juega/#las-teclas-de-dos-maneras))',
  'view.camera': 'cómo lo sigue la cámara ([las cámaras](../como-se-juega/#las-cámaras))',

  // ---------- The engine's commands ----------
  'players.join':
    'un jugador entra a la partida. Lo dice el servidor, en un paso: el juego decide qué significa (en el recorrido del Dojo, un personaje para cada uno)',
  'players.leave': 'un jugador deja la partida (en el recorrido del Dojo, su personaje se va)',
  signal: 'pone una señal del nivel que es una entrada, en un paso (las que se calculan dicen de qué)',
  signals: 'las señales del nivel, en el orden en que se calculan: su valor, de qué están hechas y qué mecanismos las siguen',
  help: 'cómo se usa la consola, o la ayuda de un nombre',
  find: 'busca en los nombres y en las descripciones',
  vars: 'las variables y sus valores, por clase (todas, o las que empiezan con un prefijo: `vars show.`)',
  changed: 'solo las variables que no están en su valor de siempre',
  toggle: 'da vuelta una variable de prendido y apagado',
  reset: 'vuelve una variable a su valor de siempre (sin nombre, todas); las de arranque hacen empezar de nuevo el mundo',
  inspect: 'de qué está hecha una entidad: por su número, su nombre, `me` o `it` (sin nada: cuántas hay, y sus nombres)',
  watch:
    'deja una entidad fija en la pantalla, con sus valores al día mientras jugás; `watch clear` las saca, y `watch` solo dice cuáles mirás',
  inputs: 'qué puede pedir un jugador en este juego, y qué tecla lo aprieta',
  pause: 'frena o reanuda el mundo (lo mismo que `toggle view.paused`)',
  step: 'avanza el mundo n pasos (uno, si no se dice) y lo deja en pausa',
  hash: 'el paso del mundo y su huella: un número que resume todo su estado',
  restart: 'el mundo empieza de nuevo, con los valores de ahora',
  snapshot: 'guardar este momento (`snapshot`), y volver a él (`snapshot load`)',
  net: 'la partida, y dónde vive',
  'camera.reset': 'la cámara a donde empezó, o detrás del personaje',
  export: 'un enlace con la receta de lo que cambiaste',
  load: 'carga una sala guardada (sin nombre: la lista)',
  startup: 'tu receta de inicio para este juego: guardarla o borrarla',
  bind: 'una tecla para un comando, con la consola cerrada (sin nada: la lista)',
  unbind: 'libera una tecla',
  clear: 'borra lo escrito en la consola',
  replay: 'la repetición del mundo desde que nació',
  ghost: 'correr contra lo que acabás de hacer',

  // ---------- The Dojo's own ----------
  'dojo.level':
    'qué es la sala: `empty` (un piso y el cubo grande), o un nivel de `games/dojo/levels/`, que trae todo su suelo, como `course`, con un personaje para manejar',
  'dojo.cubes': 'cubos chicos al empezar, en lugares que salen del azar del mundo: con la misma semilla, siempre los mismos',
  'dojo.climb': 'trepar: empujando contra una pared, el personaje la sube',
  'dojo.glide': 'planear: manteniendo el salto mientras cae, cae despacio y se dirige mejor',
  'dojo.doublejump': 'un salto más en el aire',
  'dojo.air': 'cuánto se puede corregir un salto en el aire, en m/s²',
  'dojo.spin': 'cómo gira el cubo grande (en el Dojo sin nivel): radianes por segundo alrededor de cada eje (x y z)',
  'dojo.goto': 'pone quieto en ese punto al personaje del jugador 1: para explorar un nivel',
  'dojo.spawn': 'deja caer una pelota desde ese punto, con un tamaño y un color que salen del azar del mundo',
};
