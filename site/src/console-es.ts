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
  'show.ik':
    'hasta dónde llega cada miembro de cada personaje: una línea desde cada cadera y cada hombro hasta su objetivo, más brillante cuanto más pesa la cinemática inversa; y los contactos que persisten, como puntos (un pie apoyado en verde, una mano en una pared en naranja, en un borde en amarillo, buscando lo que sostiene en celeste, en lo que lleva en las manos en violeta)',
  'show.nav':
    'por dónde puede ir un cuerpo (etapa 4d, decisión 0024): las celdas de la navegación, un punto cada medio metro donde cabe el personaje de los juegos (ámbar, sobre un ascensor: está solo mientras el ascensor está ahí); las aristas que no son caminar: saltos y caídas (azul), trepadas (violeta), por encima de un hueco (celeste), el viaje de un ascensor (ámbar), por una puerta (rojo); y los recorridos del nivel (blanco)',
  'show.light': 'el alcance de las lámparas: amarillo mientras están prendidas, gris mientras están apagadas',
  'show.vision':
    'lo que mira cada observador: el borde de su campo de visión, y una línea a cada personaje en él, verde si lo ve',
  'show.signals':
    'las señales: una línea desde cada mecanismo hasta las zonas de donde sale su señal, verde mientras está prendida',
  'view.volume':
    'qué tan fuerte se oyen los sonidos, de 0 (nada) a 1: se hacen en el navegador con lo que dice la simulación, sin archivos',
  'view.mouse': 'qué tan rápido gira la cámara el mouse, arrastrando o apuntando (1, como viene; 2, el doble)',
  'view.stick': 'qué tan rápido gira la cámara el stick derecho de un mando (1, como viene)',
  'view.invert': 'invertir el eje vertical: el mouse apuntando, o el stick, hacia arriba mira hacia abajo',
  'view.calm':
    'menos movimiento de la cámara, para quien se marea: no sigue girando después de un arrastre, y vuelve atrás del personaje más despacio',
  'view.subtitles': 'subtítulos de los sonidos: cada sonido cerca de la cámara, escrito abajo, con una flecha hacia donde vino',
  'view.hud': 'lo que el juego muestra arriba a la izquierda: en el Dojo, el tiempo, las caídas y las estrellas de un nivel',
  'view.timescale': 'mostrar el mundo más lento (0.2) o más rápido (2), sin cambiar la física',
  'view.paused': 'el mundo frenado (con `step` avanza de a un paso)',
  'controls.scheme': 'cómo manejan las teclas al personaje ([las dos maneras](../como-se-juega/#las-teclas-de-dos-maneras))',
  'view.camera': 'cómo lo sigue la cámara ([las cámaras](../como-se-juega/#las-cámaras))',

  // ---------- The engine's commands ----------
  'players.join':
    'un jugador entra a la partida. Lo dice el servidor, en un paso: el juego decide qué significa (en el recorrido del Dojo, un personaje para cada uno)',
  'players.leave': 'un jugador deja la partida (en el recorrido del Dojo, su personaje se va)',
  signal: 'pone una señal del nivel que es una entrada, en un paso (las que se calculan dicen de qué)',
  add: 'agrega lo que dice una línea de un nivel (`add box 0 1 -3  1 1 1  material wood  name caja`): una caja, una zona, una lámpara, un vigía o un recorrido (`route`); entra en el paso siguiente',
  clone:
    'una copia de lo que hizo una línea de nivel, corrida `x y z` (`clone caja 1 0 0`); la copia no tiene nombre (un recorrido, el siguiente libre después del suyo)',
  delete: 'saca una entidad, por su número o su nombre (`delete caja`); un personaje no: se va con su jugador',
  set: 'cambia un valor de una entidad: `set caja transform.position 0 2 0`, `set lampara lamp.intensity 2`; también relativo, `+0 +1 +0` o `*2`',
  'level.export':
    'el mundo como nivel, en texto: lo que hizo su nivel y lo que se agregó, copió, movió o sacó desde entonces; guardado como archivo `.level`, se carga igual',
  'level.diff': 'lo que cambió en el mundo desde que nació, como líneas de su nivel: `- ` lo que se fue, `+ ` lo que vino',
  wait: 'en una receta, lo que sigue corre esa cantidad de pasos después (`wait 60`: un segundo)',
  assert:
    'revisa algo: `assert caja.transform.position.y < 1`, `assert signal.open = 1`; dice sí, o no y cuánto es. Con `wait`, una receta es una prueba',
  signals: 'las señales del nivel, en el orden en que se calculan: su valor, de qué están hechas y qué mecanismos las siguen',
  help: 'cómo se usa la consola, o la ayuda de un nombre',
  find: 'busca en los nombres y en las descripciones',
  vars: 'las variables y sus valores, por clase (todas, o las que empiezan con un prefijo: `vars show.`)',
  changed: 'solo las variables que no están en su valor de siempre',
  toggle: 'da vuelta una variable de prendido y apagado',
  reset: 'vuelve una variable a su valor de siempre (sin nombre, todas); las de arranque hacen empezar de nuevo el mundo',
  'nav.path':
    'el camino desde tu personaje hasta un punto (`nav.path 0 5 -16`) o una entidad (`nav.path last_plate`), como lo planearía un guardia con lo que tu personaje puede hacer (etapa 4d): dibujado, y dicho paso a paso; si una puerta o un ascensor no están como hace falta, primero el botón que aprieta o la placa donde se para. Sin nada, lo saca',
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
  possess:
    'manejar un bot con tus teclas (`possess guard`): su cerebro espera, tu personaje se queda quieto y la cámara va con él; sin nada, volvés al tuyo',
  back: 'la partida vuelve esa cantidad de segundos (1 si no se dice, 10 a lo sumo), con lo que recuerdan sus bots',
  bots: 'qué hace cada bot: su modo (patrulla, mira, persigue, busca), adónde va, qué oyó y qué vio y hace cuánto, los pasos de su camino',
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
  'dojo.roll': 'rodar: con la V, en el piso, el personaje rueda hacia donde se le pide ir, bajo, unos 3 m (prendido de entrada)',
  'dojo.crouch':
    'agacharse: con la C apretada, en el piso, el personaje va más lento, pasa por donde parado no cabe, y se lo ve y se lo oye menos (prendido de entrada)',
  'dojo.air': 'cuánto se puede corregir un salto en el aire, en m/s²',
  'dojo.spin': 'cómo gira el cubo grande (en el Dojo sin nivel): radianes por segundo alrededor de cada eje (x y z)',
  'dojo.goto': 'pone quieto en ese punto al personaje del jugador 1: para explorar un nivel',
  'dojo.guard':
    'pone un guardia en ese punto (etapa 4e): un bot con vida, un palo y ojos, que sigue un recorrido (el que se nombra, o el más cercano), te oye y te ve, va a buscarte y pelea',
  'dojo.spawn': 'deja caer una pelota desde ese punto, con un tamaño y un color que salen del azar del mundo',
};
