// Contenido de la ayuda (UX-12): inicio rápido, glosario, atajos, limitaciones, advertencia y enlaces.
// Los atajos no se copian a mano en la interfaz: esta constante es la única fuente, y `helpContent.test.ts` comprueba cada
// entrada contra el código que realmente atiende la tecla (`shortcutFor` y `keyActions`), de modo que si un atajo cambia, la prueba falla.

import type { ShortcutAction } from '../editor/app/shortcuts';
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
    id: 'lambda',
    term: 'λ (lambda)',
    definition:
      'En Spencer, relación constante entre la fuerza tangencial y la fuerza normal entre dovelas (X = λ·E, la tangente de su inclinación). Se obtiene junto con el FS. Un λ negativo genera un aviso: conviene revisar la superficie y la distribución de esfuerzos.',
  },
  {
    id: 'ru',
    term: 'ru (coeficiente de presión de poros)',
    definition:
      'Relación entre la presión de poros en la base de una dovela y el esfuerzo vertical total sobre ella: u = ru · γ · h. Es una forma sencilla de incluir el agua en un material sin dibujar la línea piezométrica. Va entre 0 y 1 (sin incluir 1). Si un material tiene ru y el modelo también tiene línea piezométrica, en ese material manda ru y la piezométrica no se usa.',
  },
  {
    id: 'piezometric',
    term: 'Línea piezométrica',
    definition:
      'Poligonal que da la cota hasta la que sube el agua. En cada dovela, la presión de poros en el centro de la base es u = γw · (cota de la línea − cota de la base), nunca negativa. Se edita en la pestaña «Agua» y en el lienzo. Fuera de su rango en x el cálculo la prolonga en horizontal hasta los bordes del modelo, con el nivel de su extremo más cercano.',
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
  'Es un análisis de equilibrio límite en 2D con material Mohr-Coulomb (peso unitario, cohesión y ángulo de fricción). No calcula deformaciones ni análisis en tres dimensiones.',
  'Las superficies de deslizamiento son circulares, ya sea fijas o encontradas por la búsqueda de entrada y salida.',
  'Spencer barre λ con un paso fijo de 0,05: puede no hallar solución (aviso «no_lambda_root») aunque exista. Con tracción en la base, su FS puede quedar por debajo de Bishop; revise los avisos.',
  'Cambiar el sistema de unidades (SI o imperial) ofrece convertir los valores del modelo (el factor de seguridad no cambia) o cambiar solo la etiqueta. El motor nunca convierte: interpreta los números en las unidades declaradas, y con piezométrica en imperial el peso del agua debe ser explícito (62,4 pcf).',
  'Una carga puntual o lineal puede generar círculos diminutos con FS muy bajo bajo ella; fije un «ancho mínimo» de búsqueda y revise aparte la capacidad de soporte local.',
  'El peso unitario saturado bajo la piezométrica aún no está verificado frente a otro programa: cada modelo que usa γsat lleva un aviso en Diagnósticos y en el informe.',
  'Si un material tiene ru y el modelo tiene línea piezométrica, el cálculo usa ru en ese material y no la piezométrica (aviso en Diagnósticos). Una piezométrica que no cubre todo el ancho del modelo se prolonga en horizontal hasta los bordes (aviso).',
  'Convenciones de signo: kh positivo va en el sentido del deslizamiento y kv positivo hacia abajo, ambos solo sobre el peso del suelo; el ángulo de la carga lineal se mide desde la vertical, positivo hacia +x. El informe PDF las repite.',
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
