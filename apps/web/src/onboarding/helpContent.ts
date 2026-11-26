// Contenido de la ayuda (UX-12): inicio rápido, glosario, atajos, limitaciones, advertencia y enlaces.
// Los atajos no se copian a mano en la interfaz: esta constante es la única fuente, y `helpContent.test.ts` comprueba cada
// entrada contra el código que realmente atiende la tecla (`shortcutFor` y `keyActions`), de modo que si un atajo cambia, la prueba falla.

import type { ShortcutAction } from '../editor/app/shortcuts';
import { CRACK_PW_NOTE, POND_NOTE } from '../report/crackReport';
import { STRUCTURAL_LIMIT_TEXT } from '../report/reinforcementReport';
import { TOUR_STEPS, type TourStep } from './tour';

export interface KeyProbe {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
}

interface ShortcutBase {
  /** Teclas tal como se muestran. */
  keys: string;
  action: string;
  /** Pulsaciones que la prueba envía al código real para confirmar que existen. */
  probes: readonly KeyProbe[];
}
export type Shortcut =
  | (ShortcutBase & { scope: 'global'; shortcutAction: ShortcutAction })
  | (ShortcutBase & { scope: 'canvas' });

export const SHORTCUTS: readonly Shortcut[] = [
  { scope: 'global', keys: 'Ctrl+Z', action: 'Deshacer', probes: [{ key: 'z', ctrl: true }], shortcutAction: 'undo' },
  { scope: 'global', keys: 'Ctrl+Mayús+Z o Ctrl+Y', action: 'Rehacer', probes: [{ key: 'Z', ctrl: true, shift: true }, { key: 'y', ctrl: true }], shortcutAction: 'redo' },
  { scope: 'global', keys: 'Ctrl+S', action: 'Guardar el modelo (.ogs.json)', probes: [{ key: 's', ctrl: true }], shortcutAction: 'save' },
  { scope: 'global', keys: 'Ctrl+O', action: 'Abrir un archivo', probes: [{ key: 'o', ctrl: true }], shortcutAction: 'open' },
  { scope: 'global', keys: 'Ctrl+Intro', action: 'Comprobar (validar y calcular)', probes: [{ key: 'Enter', ctrl: true }], shortcutAction: 'check' },
  { scope: 'global', keys: 'V', action: 'Herramienta «Seleccionar»', probes: [{ key: 'v' }], shortcutAction: 'tool:select' },
  { scope: 'global', keys: 'A', action: 'Herramienta «Agregar vértice»', probes: [{ key: 'a' }], shortcutAction: 'tool:add_vertex' },
  { scope: 'global', keys: 'R', action: 'Herramienta «Dibujar región»: clic o toque (o Espacio) colocan un vértice, Intro cierra la región y Esc cancela', probes: [{ key: 'r' }], shortcutAction: 'tool:draw_region' },
  { scope: 'global', keys: 'D', action: 'Herramienta «Dividir región»: trace una línea que entre y salga del borde de una región; Intro, o un clic en el borde, la divide en dos (un solo paso deshacible)', probes: [{ key: 'd' }], shortcutAction: 'tool:split_region' },
  { scope: 'global', keys: 'E', action: 'Herramienta «Dibujar refuerzo»: elija el tipo y marque la cabeza y la punta con dos clics o toques (o con Espacio); la tablestaca es vertical', probes: [{ key: 'e' }], shortcutAction: 'tool:draw_reinforcement' },
  { scope: 'global', keys: 'H', action: 'Herramienta «Mover vista»', probes: [{ key: 'h' }], shortcutAction: 'tool:pan' },

  {
    scope: 'canvas',
    keys: '] o [ (también AvPág o RePág)',
    action:
      'Tirador siguiente o anterior, dando la vuelta. Tab y Mayús+Tab no recorren los tiradores: el lienzo es una sola parada de tabulación, así que entran al lienzo y salen de él',
    probes: [{ key: ']' }, { key: '[' }, { key: 'PageDown' }, { key: 'PageUp' }],
  },
  {
    scope: 'canvas',
    keys: 'Flechas',
    action: 'Mover el tirador seleccionado un paso de rejilla (0,1 sin rejilla); sin tirador seleccionado, desplazar la vista',
    probes: [{ key: 'ArrowLeft' }, { key: 'ArrowRight' }, { key: 'ArrowUp' }, { key: 'ArrowDown' }],
  },
  { scope: 'canvas', keys: 'Mayús+Flechas', action: 'Mover el tirador diez pasos de una vez', probes: [{ key: 'ArrowRight', shift: true }] },
  { scope: 'canvas', keys: 'Insert o i', action: 'Insertar un vértice en el punto medio de la arista siguiente', probes: [{ key: 'Insert' }, { key: 'i' }] },
  { scope: 'canvas', keys: 'Supr o Retroceso', action: 'Eliminar el vértice o el punto seleccionado (el foco pasa al vecino)', probes: [{ key: 'Delete' }, { key: 'Backspace' }] },
  { scope: 'canvas', keys: '+ o =', action: 'Acercar', probes: [{ key: '+' }, { key: '=' }] },
  { scope: 'canvas', keys: '-', action: 'Alejar', probes: [{ key: '-' }] },
  { scope: 'canvas', keys: '0', action: 'Encuadrar el modelo', probes: [{ key: '0' }] },
  { scope: 'canvas', keys: 'Esc', action: 'Quitar la selección', probes: [{ key: 'Escape' }] },
];

/** Gestos de ratón y táctiles del lienzo (documentados en `docs/fase2/ux/U2C_lienzo_teclado.md`). */
export const POINTER_HINTS: readonly string[] = [
  'Arrastrar un tirador mueve el vértice, el punto de la piezométrica o el círculo de falla.',
  'Con «Agregar vértice», un clic sobre una arista inserta un vértice.',
  'Cada refuerzo tiene tres tiradores: la cabeza y la punta mueven un extremo (en la tablestaca solo cambia la y) y el centro mueve el refuerzo entero en un solo paso.',
  'La rueda del ratón y el pellizco con dos dedos acercan y alejan; con «Mover vista» se arrastra el lienzo.',
  'Los botones «Acercar», «Alejar» y «Encuadrar» sobre el lienzo hacen lo mismo que + − y 0.',
];

/** Inicio rápido: los mismos 5 pasos de la guía, sin duplicar el texto. */
export const QUICK_START: readonly TourStep[] = TOUR_STEPS;

export interface GlossaryEntry {
  id: string;
  term: string;
  definition: string;
}

export const GLOSSARY: readonly GlossaryEntry[] = [
  {
    id: 'fs',
    term: 'FS (factor de seguridad)',
    definition:
      'Cociente entre la resistencia al corte disponible y la que se necesita para el equilibrio a lo largo de la superficie de deslizamiento. FS = 1 es el equilibrio límite; el valor mínimo aceptable lo fija el criterio de diseño aplicable, no el programa.',
  },
  {
    id: 'bishop',
    term: 'Bishop simplificado',
    definition:
      'Método de dovelas para superficies circulares. Desprecia el cortante entre dovelas, cumple el equilibrio de momentos respecto al centro del círculo y el equilibrio vertical de cada dovela. El FS sale de una iteración en la que interviene m_α.',
  },
  {
    id: 'spencer',
    term: 'Spencer',
    definition:
      'Método de dovelas que cumple el equilibrio de fuerzas y de momentos. Supone que la fuerza tangencial entre dovelas es una fracción constante (λ) de la normal. El programa calcula el FS y λ a la vez; si no hay una solución admisible, el método no converge y no se informa FS.',
  },
  {
    id: 'morgenstern-price',
    term: 'Morgenstern-Price (M-P)',
    definition:
      'Método de dovelas que cumple el equilibrio de fuerzas y de momentos, como Spencer, pero con una fuerza vertical entre dovelas que varía a lo largo de la masa: X = λ·f(ξ)·E, donde f es la función de interfaz. El programa calcula el FS y λ a la vez; con la función «Constante» da el mismo resultado que Spencer. Si no se elige función, usa el medio seno.',
  },
  {
    id: 'interslice-function',
    term: 'Función de interfaz f(ξ)',
    definition:
      'Forma en que la fuerza vertical entre dovelas crece y decrece a lo largo de la masa en Morgenstern-Price. ξ vale 0 en el borde izquierdo de la primera dovela y 1 en el borde derecho de la última. Hay cinco: «Constante» (1), «Medio seno» (sen πξ), «Seno recortado (mín. 0,35)», «Trapezoidal (20 %-80 %)» y «Definida por puntos», una tabla de pares (ξ, f) con ξ creciente de 0 a 1, f igual o mayor que 0 y algún f mayor que 0, que se interpola linealmente. En un tramo de la masa sin suelo (sobre el terreno) f se mantiene en el valor del borde izquierdo del tramo.',
  },
  {
    id: 'janbu',
    term: 'Janbu simplificado, Janbu corregido y f₀',
    definition:
      'Janbu simplificado cumple solo el equilibrio horizontal de fuerzas de toda la masa (no usa momentos) y da F₀. Janbu corregido multiplica ese resultado por un factor f₀ que compensa que se haya despreciado el cortante entre dovelas: F = f₀·F₀, con f₀ = 1 + b₁·(d/L − 1,4·(d/L)²). L es la longitud de la cuerda de la superficie, d la mayor distancia de esa cuerda a la superficie (hacia abajo) y b₁ depende del suelo: 0,69 si solo hay cohesión (también el material no drenado), 0,31 si solo hay fricción y 0,50 si hay de las dos. El informe muestra f₀ junto al FS del método corregido.',
  },
  {
    id: 'su',
    term: 'Su (resistencia no drenada)',
    definition:
      'Resistencia al corte de un suelo fino saturado cargado sin drenaje (φ = 0): vale lo mismo en cualquier punto de la base de la dovela, sin depender de la tensión normal. Se elige el modelo «No drenado (Su)» en el material. Con «Su variable con la cota», Su = Su de referencia + (cota de referencia − y) · gradiente, con y la cota del punto medio de la base de la dovela; el gradiente es positivo si Su crece hacia abajo y puede llevar un límite (máximo si el gradiente es positivo, mínimo si es negativo). Su nunca es negativa. La cota de referencia es una cota (la y del modelo), no una profundidad. Las unidades del gradiente son kPa/m o psf/ft; ru no cambia la resistencia porque φ = 0.',
  },
  {
    id: 'polyline',
    term: 'Superficie polilínea',
    definition:
      'Superficie de falla fija definida por una lista de puntos (x, y) con x estrictamente creciente, en lugar de un círculo. El cálculo prolonga cada extremo en la dirección de su tramo hasta el terreno, o lo recorta si ya está sobre él; los puntos intermedios deben quedar bajo el terreno y dentro del modelo. Con una polilínea se ofrecen Spencer, Morgenstern-Price y Janbu; Bishop no, porque su resultado depende del eje de momentos.',
  },
  {
    id: 'lambda',
    term: 'λ (lambda)',
    definition:
      'En Spencer, relación constante entre la fuerza tangencial y la fuerza normal entre dovelas (X = λ·E, la tangente de su inclinación). Se obtiene junto con el FS. Un λ negativo genera un aviso: conviene revisar la superficie y la distribución de esfuerzos.',
  },
  {
    id: 'ru',
    term: 'ru (coeficiente de presión de poros)',
    definition:
      'Relación entre la presión de poros en la base de una dovela y el esfuerzo vertical total sobre ella: u = ru · γ · h. Es una forma sencilla de incluir el agua en un material sin dibujar la línea piezométrica. Va entre 0 y 1 (sin incluir 1). Si un material tiene ru y el modelo también tiene línea piezométrica, en ese material manda ru y la piezométrica no se usa. Con agua embalsada sobre el terreno, la presión de poros es u = ru · (W + V)/b, con W el peso del suelo de la dovela y V el peso del agua embalsada que tiene encima (sin cargas externas ni sismo): es la regla de Slide2 y la conservadora, y da entre 1 % y 4,5 % menos de FS que contar solo el suelo.',
  },
  {
    id: 'piezometric',
    term: 'Línea piezométrica',
    definition:
      'Poligonal que da la cota hasta la que sube el agua. En cada dovela, la presión de poros en el centro de la base es u = γw · (cota de la línea − cota de la base), nunca negativa. Se edita en la pestaña «Agua» y en el lienzo. Fuera de su rango en x el cálculo la prolonga en horizontal hasta los bordes del modelo, con el nivel de su extremo más cercano.',
  },
  {
    id: 'ponded-water',
    term: 'Agua embalsada',
    definition:
      `Agua libre sobre el terreno (un embalse al pie del talud o contra una cara de presa): es la región entre la línea piezométrica y el terreno donde la piezométrica queda sobre el terreno. No tiene campo propio: se carga sola, en todo el modelo, con la línea piezométrica y en todas las versiones del formato. Pesa sobre las dovelas que cubre y empuja con su presión horizontal (en una cara vertical, el empuje hidrostático sobre ella). ${POND_NOTE} El sismo pseudoestático no actúa sobre el agua embalsada: ni kh ni kv. Con un material con ru, el agua embalsada entra en u = ru · (W + V)/b (ver «ru»). El lienzo la dibuja como un relleno azul bajo la línea piezométrica.`,
  },
  {
    id: 'tension-crack',
    term: 'Grieta de tracción',
    definition:
      'Grieta vertical en la cresta del talud, que se activa en el panel «Análisis» con una profundidad (un número o «Automática») y la fracción de agua que la llena (de 0, seca, a 1, llena). No se dibuja ni se coloca a mano: su posición x_c sale de la superficie y de la profundidad, es el primer punto desde la cresta donde el terreno queda a esa profundidad o más sobre la superficie de falla. La masa deslizante termina en una cara vertical en x_c: el suelo del lado de la cresta se quita, su peso no se conserva como carga y la cara no tiene resistencia. Una superficie que nunca llega a esa profundidad no tiene masa y el cálculo la descarta (nota tension_crack_not_reached); si se descartan todas, no hay superficie válida. ' +
      `${CRACK_PW_NOTE} La fracción 1 es lo conservador y lo que usan Slide2 y USACE EM 1110-2-1902, por eso es la que propone la interfaz al crear la grieta. El agua de la grieta no cambia la presión de poros de la base. Con la profundidad «Automática» se usa z = 2c/(γ·tan(45° − φ/2)) − q/γ con el material bajo el terreno en cada x; no hay tope por la altura del talud. El resultado trae x_c, la profundidad usada y Pw, y el lienzo, el informe PDF, el CSV y Diagnósticos los muestran.`,
  },
  {
    id: 'seismic',
    term: 'kh y kv (coeficientes sísmicos)',
    definition:
      'Coeficientes pseudoestáticos. kh positivo actúa en el sentido del deslizamiento (fuerza horizontal kh·W). kv positivo actúa hacia abajo: el peso del suelo pasa a W·(1 + kv), así que con kv negativo la fuerza vertical va hacia arriba. Los dos se aplican solo al peso del suelo W, no a las sobrecargas. Otros programas pueden usar el signo contrario para kv: compare con cuidado.',
  },
  {
    id: 'load-angle',
    term: 'Ángulo de la carga lineal',
    definition:
      'Se mide desde la vertical hacia abajo y es positivo hacia +x: 0° es una carga vertical hacia abajo y 10° la inclina hacia +x (componente vertical p·cos θ, componente horizontal p·sen θ). La carga distribuida q es positiva hacia abajo. Las dos solo actúan sobre las dovelas de suelo y no llevan coeficiente sísmico.',
  },
  {
    id: 'm-alpha',
    term: 'm_α',
    definition:
      'Factor de la base de cada dovela en Bishop y Spencer: m_α = cos α + sen α · tan φ / FS, con α la inclinación de la base. Si es demasiado pequeño, el cálculo se vuelve inestable. «m_α mínimo» (pestaña «Análisis») descarta las superficies que lo incumplen.',
  },
  {
    id: 'reinforcements',
    term: 'Refuerzos',
    definition:
      'Elementos que aportan una fuerza al equilibrio en cada cruce con la superficie de deslizamiento: Anclaje, Clavo, Geosintético, Pilote y Tablestaca (formato 0.4; el panel «Refuerzos» y la herramienta «Dibujar refuerzo» los crean). Cada elemento va de la cabeza (en el paramento o el terreno) a la punta; un elemento que cruza dos veces da dos fuerzas, y uno que no toca la masa no cambia el FS (nota «reinforcement_outside_mass»). Una tablestaca anclada es una Tablestaca más un Anclaje. En Pilote y Tablestaca la fuerza de corte es un dato constante que usted fija.',
  },
  {
    id: 'pullout',
    term: 'Arrancamiento (pullout)',
    definition:
      'Cuánta tracción puede transmitir un Anclaje, Clavo o Geosintético en cada punto de su largo, hasta su capacidad de tracción. Adherencia: una fuerza por metro de elemento, solo donde el elemento está dentro del suelo, en todo el largo o en los últimos metros hacia la punta (el bulbo). Interfaz suelo-geosintético: adhesión y fricción con la tensión vertical efectiva del suelo (sin sobrecargas), por ambas caras y con el factor de cobertura. Desarrollo lineal de la capacidad: una rampa desde cada extremo hasta la capacidad. Sin arrancamiento, el elemento está anclado en todo su largo. En un tramo libre de un tirante, sin capacidad en la placa de cabeza, la fuerza en el cruce es cero: ponga la capacidad de la placa de cabeza igual a la de tracción (el panel lo propone al crear un anclaje).',
  },
  {
    id: 'active-passive',
    term: 'Refuerzo activo y pasivo',
    definition:
      'Un refuerzo activo es una carga externa conocida (por ejemplo, la carga de bloqueo de un tirante) y no se divide por F; se aplica siempre, también si el deslizamiento lo comprimiría. Un refuerzo pasivo se moviliza con el deslizamiento y entra dividida por F en las ecuaciones de equilibrio; trabaja solo a tracción, así que si el movimiento lo comprimiría (más de 2° pasada la normal a la base) no aporta. La dirección de la fuerza es axial (a lo largo del elemento), tangente (opuesta al movimiento en la base) o bisectriz de las dos; en Pilote y Tablestaca, un ángulo sobre la horizontal, la tangente o la perpendicular al eje, siempre opuestos al movimiento y sin regla de compresión.',
  },
  {
    id: 'reinforcement-status',
    term: 'Estado de un cruce',
    definition:
      'En la tabla de fuerzas de cada refuerzo: applied (la fuerza actúa en el cruce), outside_mass (el cruce cae en el aire o fuera de la masa analizada), compression_ignored (un pasivo comprimido, que no aporta) y no_capacity (la capacidad en ese punto es cero, por ejemplo el tramo libre de un tirante sin placa de cabeza; no emite nota). «Disponible» es la fuerza por metro antes de aplicarla; en un pasivo, la aplicada se moviliza dividida por F.',
  },
  {
    id: 'slice',
    term: 'Dovela',
    definition:
      'Cada franja vertical en que se divide la masa de suelo sobre la superficie de deslizamiento. Se calcula el equilibrio de cada una con su peso, su cohesión, su fricción y su presión de poros. «Dovelas» en la pestaña «Análisis» fija cuántas son.',
  },
  {
    id: 'critical-surface',
    term: 'Superficie crítica',
    definition:
      'La superficie de deslizamiento con el menor FS entre todas las que se probaron. Es la que se dibuja tras «Comprobar» con una búsqueda. Si el método no convergió, la superficie mostrada es solo la última evaluada y no debe leerse como resultado.',
  },
  {
    id: 'search',
    term: 'Búsqueda (entrada y salida)',
    definition:
      'El programa prueba muchos círculos que entran en el terreno dentro del rango de «entrada» (el coronamiento) y salen dentro del rango de «salida» (el pie), con varios radios por par, y se queda con el de menor FS. Ambos rangos se editan en la pestaña «Búsqueda» y se ven como bandas sobre el lienzo.',
  },
];

export function glossaryTerms(): string[] {
  return GLOSSARY.map((g) => g.term);
}

/** Limitaciones principales; el detalle completo está en el README (`HELP_LINKS.limitations`). */
export const LIMITATIONS: readonly string[] = [
  'Es un análisis de equilibrio límite en 2D con material Mohr-Coulomb (peso unitario, cohesión y ángulo de fricción) o no drenado (Su constante o variable con la cota). No calcula deformaciones ni análisis en tres dimensiones.',
  'La búsqueda de la superficie crítica solo encuentra círculos (rangos de entrada y salida). Una superficie fija puede ser un círculo o una polilínea, que se analiza tal como se define: no se optimiza.',
  'Bishop no se ofrece en superficies no circulares: con una polilínea fija su resultado dependería del eje de momentos. Use Spencer, Morgenstern-Price o Janbu; el editor deshabilita Bishop y el cálculo lo rechaza.',
  'En Morgenstern-Price la función de interfaz es una elección del usuario y el FS puede cambiar de una a otra: indique cuál se usó al informar el resultado. Janbu corregido aplica una corrección empírica (f₀) y puede diferir de Spencer y Morgenstern-Price; f₀ se muestra junto al FS.',
  'Spencer barre λ con un paso fijo de 0,05: puede no hallar solución (aviso «no_lambda_root») aunque exista. Con tracción en la base, su FS puede quedar por debajo de Bishop; revise los avisos.',
  'Cambiar el sistema de unidades (SI o imperial) ofrece convertir los valores del modelo (el factor de seguridad no cambia) o cambiar solo la etiqueta. El motor nunca convierte: interpreta los números en las unidades declaradas, y con piezométrica en imperial el peso del agua debe ser explícito (62,4 pcf).',
  'Una carga puntual o lineal puede generar círculos diminutos con FS muy bajo bajo ella; fije un «ancho mínimo» de búsqueda y revise aparte la capacidad de soporte local.',
  'El peso unitario saturado bajo la piezométrica aún no está verificado frente a otro programa: cada modelo que usa γsat lleva un aviso en Diagnósticos y en el informe.',
  'Si un material tiene ru y el modelo tiene línea piezométrica, el cálculo usa ru en ese material y no la piezométrica (aviso en Diagnósticos). Una piezométrica que no cubre todo el ancho del modelo se prolonga en horizontal hasta los bordes (aviso).',
  'Agua embalsada: se incluye siempre que la línea piezométrica pase sobre el terreno (nota water_above_ground), con su peso y su empuje horizontal; no hay interruptor. El sismo pseudoestático no actúa sobre ella ni sobre el agua de la grieta. Con un material con ru, la presión de poros es u = ru·(W + V)/b, que da entre 1 % y 4,5 % menos de FS que contar solo el suelo; esa regla no se pudo contrastar con otro programa.',
  'Grieta de tracción: la profundidad «Automática» no tiene tope por la altura del talud, y con la fracción de agua 1 (la que propone la interfaz) el resultado es el conservador. La monotonía con la profundidad de una grieta seca no está garantizada, porque el bloque que se quita cambia con ella. Con una búsqueda, los círculos que no alcanzan la grieta se descartan; los refuerzos que cruzan la superficie del lado de la cresta de x_c quedan fuera de la masa (nota reinforcement_outside_mass).',
  'Convenciones de signo: kh positivo va en el sentido del deslizamiento y kv positivo hacia abajo, ambos solo sobre el peso del suelo; el ángulo de la carga lineal se mide desde la vertical, positivo hacia +x. El informe PDF las repite.',
  `Refuerzos: el resultado da la fuerza de cada refuerzo en cada cruce con la superficie final (por metro de talud); una fuerza pasiva se moviliza dividida por F. ${STRUCTURAL_LIMIT_TEXT} La fuerza de un pilote o de una tablestaca es un dato que usted fija (el motor emite la nota structural_checks_not_covered): el programa no comprueba que el elemento la resista.`,
  'Refuerzos que no se modelan todavía: la fuerza de pilote por el empuje del suelo (Ito-Matsui), el pretensado como campo aparte (use un anclaje activo con la carga de bloqueo como capacidad), la cizalla y la compresión de los clavos, el arrancamiento que depende del material, los clavos lanzados, los anclajes helicoidales, la presión de fluido equivalente y el soporte definido por el usuario. El sismo no actúa sobre las fuerzas de los refuerzos.',
  'Un cruce con capacidad cero (por ejemplo, el tramo libre de un tirante con adherencia en el bulbo y sin capacidad en la placa de cabeza) no aplica fuerza y queda con el estado no_capacity, sin nota: compruebe la tabla de fuerzas. Un activo comprimido se aplica con su fuerza completa y un pasivo comprimido se descarta; el oráculo instalado de cSlope descarta ambos, así que en un activo comprimido los resultados difieren de él.',
  'Con la búsqueda de la superficie crítica y refuerzos, el FS es discontinuo: un círculo candidato puede ganar o perder un cruce, y cada cruce suma una fuerza completa. La búsqueda también puede esquivar el refuerzo: si el resultado trae la nota reinforcement_outside_mass, el FS mínimo es el de una superficie que el refuerzo no cruza. Mueva el refuerzo o acote los rangos de entrada y salida, y contraste el resultado con superficies fijas cercanas a la crítica.',
  'Con unidades imperiales y piezométrica, γw debe ser explícito y no menor que 20 pcf (se usa 62,4): un valor como 9,81 es de kN/m³ y bloquea el cálculo, tanto en el editor como en «Casos».',
];

export const PROFESSIONAL_WARNING =
  'OpenGeoSlide es software en desarrollo y no es una herramienta certificada. Los resultados deben ser validados por un profesional competente antes de usarlos en un diseño. El criterio profesional y la responsabilidad sobre el diseño son del usuario.';

const REPO = 'https://github.com/nibaldox/OpenGeoSlide';
export const HELP_LINKS = {
  repo: REPO,
  releases: `${REPO}/releases`,
  cite: `${REPO}/blob/main/CITATION.cff`,
  limitations: `${REPO}#limitaciones-conocidas`,
} as const;

export interface HelpSection {
  id: 'quick-start' | 'glossary' | 'shortcuts' | 'limits' | 'warning' | 'links';
  title: string;
}

/** Índice interno de la ayuda. */
export const HELP_SECTIONS: readonly HelpSection[] = [
  { id: 'quick-start', title: 'Inicio rápido' },
  { id: 'glossary', title: 'Glosario' },
  { id: 'shortcuts', title: 'Atajos de teclado' },
  { id: 'limits', title: 'Limitaciones' },
  { id: 'warning', title: 'Advertencia profesional' },
  { id: 'links', title: 'Enlaces y cita' },
];
