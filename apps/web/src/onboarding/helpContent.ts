// Contenido de la ayuda (UX-12): inicio rápido, glosario, atajos, limitaciones, advertencia y enlaces.
// Los atajos no se copian a mano en la interfaz: esta constante es la única fuente, y `helpContent.test.ts` comprueba cada
// entrada contra el código que realmente atiende la tecla (`shortcutFor` y `keyActions`), de modo que si un atajo cambia, la prueba falla.

import type { ShortcutAction } from '../editor/app/shortcuts';
import { POND_CHANGED_TEXT } from '../io/ogsJson';
import { CRACK_PW_NOTE, POND_NOTE } from '../report/crackReport';
import { ITO_MATSUI_STRUCTURAL_LIMIT_TEXT, STRUCTURAL_LIMIT_TEXT } from '../report/reinforcementReport';
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

export interface GlossaryTable {
  caption: string;
  header: readonly string[];
  rows: readonly (readonly string[])[];
}

export interface GlossaryEntry {
  id: string;
  term: string;
  definition: string;
  /** Tabla auxiliar opcional que acompaña la definición en el diálogo de Ayuda (p. ej., Tabla 1 de Hoek et al., 2002). */
  table?: GlossaryTable;
}

/** Tabla 1 de Hoek, Carranza-Torres y Corkum (2002): guía orientativa del factor de perturbación D en excavaciones y taludes. */
export const HOEK_BROWN_D_TABLE: GlossaryTable = {
  caption: 'Tabla 1 (Hoek, Carranza-Torres y Corkum, 2002): guía orientativa del factor de perturbación D',
  header: ['D sugerido', 'Condición de excavación o voladura'],
  rows: [
    ['0', 'Voladura controlada de excelente calidad, tuneladora (TBM) o excavación mecánica en roca débil sin voladura (daño mínimo al macizo confinado).'],
    ['0,5', 'Túnel con roca expansiva (squeezing) y levantamiento importante de la solera, sin contrabóveda (invert) de contención.'],
    ['0,7', 'Voladura controlada de buena calidad en taludes de ingeniería civil, o excavación mecánica (ripping) en taludes de grandes minas a cielo abierto.'],
    ['0,8', 'Túnel en roca dura con voladura muy deficiente (daño local severo de 2 a 3 m en la roca circundante).'],
    ['1,0', 'Voladura deficiente en taludes de ingeniería civil, o voladura de producción en taludes de minas a cielo abierto muy grandes (alivio tensional importante y daño intenso al macizo).'],
  ],
};

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
    id: 'hoek-brown',
    term: 'Hoek-Brown',
    definition:
      'Criterio no lineal de rotura para macizos rocosos fracturados e isótropos (Hoek, Carranza-Torres y Corkum, 2002; formato 0.6). ' +
      'Usted ingresa cuatro propiedades: σci (campo ucs, resistencia a compresión simple de la roca intacta en la unidad de esfuerzo del modelo: kPa en SI o psf en imperial, no en MPa; Diagnósticos avisa bajo 1000 kPa o sobre 300 000 kPa para prevenir errores de 1000×), GSI (índice de resistencia geológica en [0, 100]), mi (constante de la roca intacta, > 0) y D (factor de perturbación del macizo en [0, 1], sin valor por defecto porque D = 0 resulta demasiado optimista en taludes excavados: véase la Tabla 1 abajo). ' +
      'El programa calcula mb = mi·exp((GSI − 100)/(28 − 14·D)), s = exp((GSI − 100)/(9 − 3·D)) y a = 1/2 + (exp(−GSI/15) − exp(−20/3))/6, obtiene en cada dovela la tangente instantánea (cᵢ, φᵢ) en el esfuerzo normal efectivo σ′n de la base y resuelve un lazo exterior (promedio w = 0,5, tolerancia 1e-6, hasta 50 pasadas; si no se estabiliza emite hoek_brown_not_converged). ' +
      'Regla de bajo confinamiento (envolvente completa): cuando σ′n ≤ sn(0) (el esfuerzo normal correspondiente a σ′3 = 0), se evalúa la tangente sobre la misma envolvente cóncava hasta la resistencia a tracción σt = −s·σci/mb, y para σ′n ≤ σt la resistencia es nula (c = 0, tan φ = 0), emitiendo la nota hoek_brown_low_confinement. Otros programas como cSlope extrapolan la recta tangente de σ′3 = 0, que asigna resistencia positiva incluso en tracción; la envolvente completa nunca sobreestima la resistencia y produce una diferencia conservadora de 0 % a −2,9 % frente a cSlope en los modelos de prueba. ' +
      'Advertencia de Hoek (1994, ISRM News Journal, citado en Hoek et al., 2002): la cohesión obtenida ajustando una tangente a la envolvente curvilínea de Mohr es un valor de cota superior y puede dar resultados optimistas en cálculos de estabilidad.',
    table: HOEK_BROWN_D_TABLE,
  },
  {
    id: 'shansep',
    term: 'SHANSEP',
    definition:
      'Modelo de resistencia no drenada normalizada por la historia de esfuerzos para arcillas y limos (Ladd y Foott, 1974; Ladd, 1991; formato 0.6): Su = S · σ′v · OCR^m en el punto medio de la base de cada dovela (φ = 0), donde S es el cociente de resistencia normalmente consolidada (ratio > 0) y m el exponente de sobreconsolidación (exponent en [0, 1], 0,8 por defecto). ' +
      'σ′v = (W + Q + V)/b − u incluye el peso estático del suelo, las cargas estáticas y el agua embalsada menos la presión de poros, sin coeficientes sísmicos kh ni kv; como Su no depende de F, se evalúa en una sola pasada sin iteración extra. Si σ′v ≤ 0, se toma Su = 0 y se emite la nota shansep_nonpositive_stress. ' +
      'Hay tres fuentes excluyentes para la historia de esfuerzos (OCR): (1) ocr constante (≥ 1); (2) pop, presión de sobreconsolidación previa en kPa o psf (≥ 0), con OCR = (σ′v + POP)/σ′v; y (3) ocr_by_elevation, una tabla [[y, OCR], …] con al menos 2 cotas estrictamente crecientes y OCR ≥ 1, interpolada linealmente y constante fuera de los extremos. ' +
      'No hay OCR por defecto: otros programas asumen OCR = 1 en silencio cuando falta el dato, lo que puede ocultar una omisión en suelos sobreconsolidados; aquí el modelo exige elegir explícitamente una de las tres fuentes. ' +
      'Círculo muy ancho: con OCR 1 en un perfil normalmente consolidado, el mínimo de una búsqueda amplia es un círculo muy ancho y poco profundo (por ejemplo, r ≈ 257 m en un talud de 15 m en V047a, y el oráculo cSlope da el mismo). Es una propiedad del perfil y no un fallo numérico, y el programa no agrega un aviso por ello; conviene acotar los rangos de búsqueda o revisar la historia de esfuerzos (OCR) del estrato.',
  },
  {
    id: 'non-circular-search',
    term: 'Búsqueda no circular',
    definition:
      'Refinamiento opcional sobre la búsqueda circular por entrada y salida (analysis.search.non_circular; formato 0.6) mediante la variación alterna de Celestino y Duncan. ' +
      'Semillas: parte de hasta N semillas circulares (seeds en [1, 10], 3 por defecto); la semilla 1 es el círculo crítico refinado del mismo método y las restantes son los mejores círculos de la malla separados entre sí en más del 5 % del tramo de búsqueda en la entrada o en la salida. ' +
      'Niveles de vértices: cada semilla se convierte en una polilínea de 9 vértices sobre el arco inferior con extremos ajustados al terreno y se optimiza por niveles sucesivos de 9 → 17 → 33 vértices insertando puntos medios hasta max_vertices (9, 17 o 33; 33 por defecto), con un presupuesto de 1500 evaluaciones admisibles por semilla y restricción de concavidad (giro hacia abajo ≤ 1° entre tramos). ' +
      'Por qué no se ofrece Bishop: Bishop simplificado plantea el equilibrio de momentos respecto del centro de una superficie circular, y la superficie refinada es una polilínea sin centro ni radio; el panel deshabilita Bishop y el motor lo rechaza (use Spencer, Morgenstern-Price o Janbu). ' +
      'Regla del mínimo entre círculo y polilínea: en cada método se informa el menor FS entre el mejor círculo (semilla 1, seed_fos) y la mejor polilínea refinada (polyline_fos), ganando el círculo en caso de empate; así el FS reportado nunca supera al de la búsqueda circular. ' +
      'Aviso del 15 %: cuando la polilínea reduce el FS más de un 15 % respecto del mejor círculo ((seed_fos − FS)/seed_fos > 0,15, criterio de SLOPE/W), el motor emite la nota non_circular_large_change para que revise la geometría de la superficie crítica.',
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
      'Relación entre la presión de poros en la base de una dovela y el esfuerzo vertical total sobre ella: u = ru · γ · h. Es una forma sencilla de incluir el agua en un material sin dibujar la línea piezométrica. Va entre 0 y 1 (sin incluir 1). Si un material tiene ru y el modelo también tiene línea piezométrica, en ese material manda ru en la presión de poros (no la de la piezométrica), pero la piezométrica sigue definiendo dónde rige γsat y aporta el agua embalsada sobre el terreno, con su peso y su empuje. Con agua embalsada sobre el terreno, la presión de poros es u = ru · (W + V)/b, con W el peso del suelo de la dovela y V el peso del agua embalsada que tiene encima (sin cargas externas ni sismo): es la regla de Slide2 y la conservadora, y da entre 1 % y 4,5 % menos de FS que contar solo el suelo.',
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
      `Agua libre sobre el terreno (un embalse al pie del talud o contra una cara de presa): es la región entre la línea piezométrica y el terreno donde la piezométrica queda sobre el terreno. No tiene campo propio: se carga sola, en todo el modelo, con la línea piezométrica y en todas las versiones del formato. Pesa sobre las dovelas que cubre y empuja con su presión horizontal (en una cara vertical, el empuje hidrostático sobre ella). ${POND_NOTE} El sismo pseudoestático no actúa sobre el agua embalsada: ni kh ni kv. Con un material con ru, el agua embalsada entra en u = ru · (W + V)/b (ver «ru»). El lienzo la dibuja como un relleno azul bajo la línea piezométrica. ${POND_CHANGED_TEXT}`,
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
      'Elementos que aportan una fuerza al equilibrio en cada cruce con la superficie de deslizamiento: Anclaje, Clavo, Geosintético, Pilote y Tablestaca (formato 0.4; el panel «Refuerzos» y la herramienta «Dibujar refuerzo» los crean). Cada elemento va de la cabeza (en el paramento o el terreno) a la punta; un elemento que cruza dos veces da dos fuerzas, y uno que no toca la masa no cambia el FS (nota «reinforcement_outside_mass»). Una tablestaca anclada es una Tablestaca más un Anclaje. En Tablestaca la fuerza de corte es un dato constante que usted fija; en Pilote usted elige entre una fuerza de corte constante («Fuerza dada») y la presión del suelo de Ito-Matsui (formato 0.5).',
  },
  {
    id: 'ito-matsui',
    term: 'Ito-Matsui (presión del suelo sobre un pilote)',
    definition:
      'Opción de la tarjeta del Pilote («Origen de la fuerza» = «Presión del suelo (Ito-Matsui)»; formato 0.5): la fuerza no es un dato, sale de la presión que el suelo ejerce sobre una fila de pilotes, según Ito y Matsui (1975), Soils and Foundations 15(4):43-59. ' +
      'Por pilote y por unidad de profundidad, p(z) = c·A1 + σ′v·A2, integrada desde la cabeza del pilote (o el terreno, si la cabeza queda sobre él) hasta el cruce con la superficie de falla. ' +
      'Usted ingresa el diámetro, el espaciamiento entre ejes (debe ser mayor que el diámetro), la ubicación de la fuerza (en el centroide de la resultante, por defecto, o en la superficie de falla) y, opcionalmente, la capacidad al corte y la capacidad a momento por pilote. ' +
      'La fuerza por pilote es el menor entre la resultante del suelo, el corte y el momento dividido por el brazo, y se divide por el espaciamiento. ' +
      'En la tabla de fuerzas: «Fuerza del suelo» es la fuerza por metro antes del tope, «Gobierna» dice cuál fija la fuerza aplicada (suelo, corte o flexión) y «Brazo» es la distancia de la resultante al cruce. ' +
      'Límites: la fórmula vale con S/D de 2 a 8 (S el espaciamiento y D el diámetro); fuera de ese rango sobrestima la fuerza con S/D pequeño y la subestima con S/D grande (según Ukritchon y Keawsawasvong (2017)), y el programa emite el aviso ito_matsui_spacing_range: revise el espaciamiento. ' +
      'Supuestos del artículo: pilotes rígidos, deformación plana y dos superficies plásticas entre pilotes. σ′v es la tensión efectiva (el agua sobre el terreno y la presión de poros se descuentan; con material no drenado o φ = 0 se usa la tensión total) y las cargas de superficie no entran en σ′v. ' +
      'Con φ casi 0 la fuerza no baja del valor de φ = 0 (regla de cSlope y XSLOPE, que no viene del artículo; solo actúa con S/D ≥ 8). El pilote debe ser vertical; la presión del suelo sobre él es horizontal, así que use la dirección «Ángulo» con 0°. ' +
      'El programa no calcula el empotramiento, la deflexión ni la distribución de momentos a lo largo del pilote.',
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
      'En la tabla de fuerzas de cada refuerzo: applied (la fuerza actúa en el cruce), outside_mass (el cruce cae en el aire o fuera de la masa analizada), compression_ignored (un pasivo comprimido, que no aporta) y no_capacity (la capacidad en ese punto es cero, por ejemplo el tramo libre de un tirante sin placa de cabeza; no emite nota). «Disponible» es la fuerza por metro antes de aplicarla (con el tope de capacidad de un pilote de Ito-Matsui, «Fuerza del suelo» es la anterior al tope, «Gobierna» dice cuál lo fija y «Brazo» es la distancia de la resultante al cruce); en un pasivo, la aplicada se moviliza dividida por F.',
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
  'Es un análisis de equilibrio límite en 2D con material Mohr-Coulomb (peso unitario, cohesión y ángulo de fricción), no drenado (Su constante o variable con la cota), Hoek-Brown generalizado o SHANSEP. No calcula deformaciones ni análisis en tres dimensiones.',
  'La búsqueda de la superficie crítica explora círculos (rangos de entrada y salida) y, opcionalmente, refina las mejores semillas como polilínea no circular de hasta 33 vértices. Una superficie fija puede ser un círculo o una polilínea, que se analiza tal como se define: no se optimiza.',
  'Bishop no se ofrece en superficies no circulares: con una polilínea fija o con la búsqueda no circular su resultado dependería del eje de momentos. Use Spencer, Morgenstern-Price o Janbu; el editor deshabilita Bishop y el cálculo lo rechaza.',
  'En Morgenstern-Price la función de interfaz es una elección del usuario y el FS puede cambiar de una a otra: indique cuál se usó al informar el resultado. Janbu corregido aplica una corrección empírica (f₀) y puede diferir de Spencer y Morgenstern-Price; f₀ se muestra junto al FS.',
  'Spencer barre λ con un paso fijo de 0,05: puede no hallar solución (aviso «no_lambda_root») aunque exista. Con tracción en la base, su FS puede quedar por debajo de Bishop; revise los avisos.',
  'Cambiar el sistema de unidades (SI o imperial) ofrece convertir los valores del modelo (el factor de seguridad no cambia) o cambiar solo la etiqueta. El motor nunca convierte: interpreta los números en las unidades declaradas, y en imperial el peso del agua vacío es 62,4 pcf (con un valor explícito, que sea de pcf).',
  'Una carga puntual o lineal puede generar círculos diminutos con FS muy bajo bajo ella; fije un «ancho mínimo» de búsqueda y revise aparte la capacidad de soporte local.',
  'El peso unitario saturado bajo la piezométrica se verifica con cuatro casos publicados (V082a, V082b, V088 y V089); un γsat menor que γ lleva una nota en Diagnósticos.',
  'Si un material tiene ru y el modelo tiene línea piezométrica, en ese material la presión de poros sale de ru y no de la piezométrica, que sigue definiendo dónde rige γsat y el agua embalsada con su peso y su empuje (aviso en Diagnósticos). Una piezométrica que no cubre todo el ancho del modelo se prolonga en horizontal hasta los bordes (aviso).',
  'Agua embalsada: se incluye siempre que la línea piezométrica pase sobre el terreno (nota water_above_ground), con su peso y su empuje horizontal; no hay interruptor. El sismo pseudoestático no actúa sobre ella ni sobre el agua de la grieta. Con un material con ru, la presión de poros es u = ru·(W + V)/b, que da entre 1 % y 4,5 % menos de FS que contar solo el suelo; esa regla no se pudo contrastar con otro programa.',
  'Grieta de tracción: la profundidad «Automática» no tiene tope por la altura del talud, y con la fracción de agua 1 (la que propone la interfaz) el resultado es el conservador. La monotonía con la profundidad de una grieta seca no está garantizada, porque el bloque que se quita cambia con ella. Con una búsqueda, los círculos que no alcanzan la grieta se descartan; los refuerzos que cruzan la superficie del lado de la cresta de x_c quedan fuera de la masa (nota reinforcement_outside_mass).',
  'Convenciones de signo: kh positivo va en el sentido del deslizamiento y kv positivo hacia abajo, ambos solo sobre el peso del suelo; el ángulo de la carga lineal se mide desde la vertical, positivo hacia +x. El informe PDF las repite.',
  `Refuerzos: el resultado da la fuerza de cada refuerzo en cada cruce con la superficie final (por metro de talud); una fuerza pasiva se moviliza dividida por F. ${STRUCTURAL_LIMIT_TEXT} La fuerza de una tablestaca, y la de un pilote con «Fuerza dada», es un dato que usted fija (el motor emite la nota structural_checks_not_covered): el programa no comprueba que el elemento la resista. Con la presión del suelo de Ito-Matsui el programa calcula el empuje: ${ITO_MATSUI_STRUCTURAL_LIMIT_TEXT}`,
  'Refuerzos que no se modelan todavía: el pretensado como campo aparte (use un anclaje activo con la carga de bloqueo como capacidad), la cizalla y la compresión de los clavos, el arrancamiento que depende del material, los clavos lanzados, los anclajes helicoidales, la presión de fluido equivalente y el soporte definido por el usuario. El sismo no actúa sobre las fuerzas de los refuerzos.',
  'Ito-Matsui: la fórmula del pilote con presión del suelo vale con S/D de 2 a 8 (aviso ito_matsui_spacing_range fuera de ese rango: sobrestima la fuerza con S/D pequeño y la subestima con S/D grande, según Ukritchon y Keawsawasvong, 2017). Supone pilotes rígidos, deformación plana y dos superficies plásticas entre pilotes. El piso de φ = 0 (la fuerza no baja del valor de φ = 0) es la regla de cSlope y XSLOPE y no viene del artículo; la tensión efectiva con presión de poros sigue a Poulos (1995) y Hassiotis y otros (1997). El pilote debe ser vertical, las cargas de superficie no entran en la tensión vertical y no hay empotramiento, deflexión ni diagrama de momentos.',
  'Un cruce con capacidad cero (por ejemplo, el tramo libre de un tirante con adherencia en el bulbo y sin capacidad en la placa de cabeza) no aplica fuerza y queda con el estado no_capacity, sin nota: compruebe la tabla de fuerzas. Un activo comprimido se aplica con su fuerza completa y un pasivo comprimido se descarta; el oráculo instalado de cSlope descarta ambos, así que en un activo comprimido los resultados difieren de él.',
  'Con la búsqueda de la superficie crítica y refuerzos, el FS es discontinuo: un círculo candidato puede ganar o perder un cruce, y cada cruce suma una fuerza completa. La búsqueda también puede esquivar el refuerzo: si el resultado trae la nota reinforcement_outside_mass, el FS mínimo es el de una superficie que el refuerzo no cruza. Mueva el refuerzo o acote los rangos de entrada y salida, y contraste el resultado con superficies fijas cercanas a la crítica.',
  'Con unidades imperiales y agua, γw vacío es 62,4 pcf y el programa lo indica con una nota; las versiones anteriores a la v0.4.0 tomaban 9,81 también en pcf, así que indique el valor para fijarlo. Un γw explícito menor que 20 pcf (un valor como 9,81 es de kN/m³) bloquea el cálculo, tanto en el editor como en «Casos».',
  'Hoek-Brown (formato 0.6): σci se ingresa en kPa (o psf), nunca en MPa, y D es obligatorio sin valor por defecto. En bajo confinamiento (σ′n ≤ sn(0)) se usa la envolvente completa hasta σt = −s·σci/mb (0 % a −2,9 % respecto de cSlope en los modelos de prueba; nota hoek_brown_low_confinement), y según Hoek (1994) la cohesión tangente es una cota superior que puede ser optimista. No se admite junto con grieta de profundidad automática ni con pilotes de Ito-Matsui.',
  'SHANSEP (formato 0.6): exige elegir explícitamente ocr, pop u ocr_by_elevation (sin OCR = 1 silencioso por defecto) y deja fuera su_min, anisotropía, above_water y b_bar; el sismo no entra en σ′v. Con OCR = 1 constante la búsqueda tiende a círculos muy anchos y profundos. No se admite junto con grieta automática ni con pilotes de Ito-Matsui.',
  'Búsqueda no circular (formato 0.6): usa variación alterna (9 → 17 → 33 vértices, hasta 1500 evaluaciones admisibles por semilla, sin etapa de pulido adicional), no admite Bishop, devuelve el mínimo entre el mejor círculo y la mejor polilínea refinada y emite non_circular_large_change si la polilínea reduce el FS más de un 15 %.',
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
