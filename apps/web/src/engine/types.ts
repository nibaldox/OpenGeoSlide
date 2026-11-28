// Tipos fieles a briefs/00_CONTRATOS.md: §1 (modelo .ogs.json), §2 (caso de verificación)
// y §3 (AnalysisReport), con las enmiendas de briefs/01_CONTRATOS_FASE1.md (v0.2),
// briefs/02_CONTRATOS_FASE3.md (v0.3, F3.1-F3.7), briefs/03_CONTRATOS_REFUERZOS.md (v0.4, F4.1-F4.2 y F4.9),
// briefs/04_CONTRATOS_GRIETA_AGUA.md (v0.5, F5.1-F5.2) y briefs/05_CONTRATOS_FASE3B.md (v0.6, F6.1-F6.4 y F6.6).
// Los nombres son snake_case, igual que el JSON del motor.
// Los campos marcados como opcionales son los que tienen default en el motor (#[serde(default)]).

export type Point = [number, number];

/** `undrained` exige version "0.3" (F3.2); `hoek_brown` y `shansep` exigen version "0.6" (F6.1-F6.3); `non_circular.global` exige "0.7" (F7.1). */
export type MaterialModel = 'mohr_coulomb' | 'undrained' | 'hoek_brown' | 'shansep';

export interface Meta {
  id?: string | null;
  title?: string | null;
  notes?: string | null;
}

/**
 * Parámetros del modelo `shansep` (v0.6, F6.3): `Su = ratio · σ′v · OCR^exponent`.
 * `exponent` vale 0,8 si se omite; debe existir exactamente uno de `ocr`, `pop` o `ocr_by_elevation`.
 */
export interface ShansepSpec {
  /** Cociente S, finito y > 0. */
  ratio: number;
  /** Exponente m, finito en [0, 1]; por defecto 0,8. */
  exponent?: number | null;
  /** Razón de sobreconsolidación constante (≥ 1). */
  ocr?: number | null;
  /** Presión de sobreconsolidación en la unidad de esfuerzo del modelo (≥ 0). */
  pop?: number | null;
  /** Tabla [[y, OCR], …] con al menos 2 filas, y estrictamente creciente y OCR ≥ 1. */
  ocr_by_elevation?: Point[] | null;
}

export interface Material {
  id: string;
  name: string;
  model: MaterialModel;
  /** kN/m³ (SI) o pcf (imperial). */
  unit_weight: number;
  unit_weight_sat?: number | null;
  /** kPa (SI) o psf. Obligatoria con `mohr_coulomb` y prohibida con los demás modelos (F3.2, F6.2, F6.3). */
  cohesion?: number | null;
  /** Grados. Obligatoria con `mohr_coulomb` y prohibida con los demás modelos (F3.2, F6.2, F6.3). */
  friction_angle?: number | null;
  ru?: number | null;
  /** Su en `strength_datum` (kPa o psf, ≥ 0). Obligatoria con `undrained`; prohibida con los demás modelos. Solo version "0.3" o superior. */
  undrained_strength?: number | null;
  /** Cota y de referencia de Su (no una profundidad). Va junto con `strength_gradient`. Solo version "0.3" o superior. */
  strength_datum?: number | null;
  /** Variación de Su por unidad de longitud en y (kPa/m o psf/ft, finito y de cualquier signo): Su = Su₀ + (datum − y)·gradient. Solo version "0.3" o superior. */
  strength_gradient?: number | null;
  /** Tope de Su (≥ 0); solo con `strength_gradient`. Solo version "0.3" o superior. */
  strength_limit?: number | null;
  /** Resistencia a compresión simple de la roca intacta σci (kPa o psf, > 0). Obligatoria con `hoek_brown` (v0.6, F6.2). */
  ucs?: number | null;
  /** Índice de resistencia geológica en [0, 100]. Obligatorio con `hoek_brown` (v0.6, F6.2). */
  gsi?: number | null;
  /** Constante mi de la roca intacta (> 0). Obligatoria con `hoek_brown` (v0.6, F6.2). */
  mi?: number | null;
  /** Factor de perturbación D en [0, 1], sin valor por defecto. Obligatorio con `hoek_brown` (v0.6, F6.2). */
  disturbance?: number | null;
  /** Parámetros SHANSEP. Obligatorio con `shansep` (v0.6, F6.3). */
  shansep?: ShansepSpec | null;
}

export interface Region {
  material: string;
  polygon: Point[];
}

export interface Water {
  /** Por defecto 9.81. */
  unit_weight?: number;
  piezometric_line?: Point[] | null;
}

/** Hacia dónde se mueve la masa. */
export type Direction = 'auto' | 'left_to_right' | 'right_to_left';

export interface SlopeSettings {
  direction?: Direction;
}

/** `morgenstern_price`, `janbu_simplified` y `janbu_corrected` exigen version "0.3" (F3.4-F3.5). */
export type MethodKind = 'bishop' | 'spencer' | 'morgenstern_price' | 'janbu_simplified' | 'janbu_corrected';

export interface Circle {
  xc: number;
  yc: number;
  r: number;
}

export interface CircleSurfaceSpec extends Circle {
  type: 'circle';
}

/** Superficie polilínea fija (v0.3, F3.3): x estrictamente creciente, al menos 2 puntos. */
export interface PolylineSurfaceSpec {
  type: 'polyline';
  points: Point[];
}

export type SurfaceSpec = CircleSurfaceSpec | PolylineSurfaceSpec;

/** Función de fuerzas entre dovelas de Morgenstern-Price (v0.3, F3.4). */
export type IntersliceFunction = 'constant' | 'half_sine' | 'clipped_sine' | 'trapezoidal' | 'data_points';

/** `analysis.interslice` (v0.3, F3.4). `points` [[ξ, f], …] solo con `data_points` y obligatorio con ella. */
export interface IntersliceSpec {
  function: IntersliceFunction;
  points?: Point[];
}

/** Refinamiento no circular de la búsqueda circular (v0.6, F6.4). `{}` usa los valores por defecto (`seeds` = 3, `max_vertices` = 33). */
export interface NonCircularSpec {
  /** Número de semillas circulares a refinar, entero en [1, 10]; por defecto 3. */
  seeds?: number | null;
  /** Número máximo de vértices de la polilínea (9, 17 o 33); por defecto 33. */
  max_vertices?: number | null;
  /** Búsqueda global (v0.7, F7.1). Exige version "0.7". `{}` toma todos los valores por defecto; null cuenta como ausente. */
  global?: GlobalSpec | null;
}

/** Algoritmo de la búsqueda global (F7.1): `auto` elige `block` con contactos entre regiones y `annealing` si no (E17a). */
export type GlobalAlgorithm = 'auto' | 'block' | 'annealing';

/** Búsqueda global no circular (v0.7, F7.1). Todos los campos son opcionales; `{}` es válido. */
export interface GlobalSpec {
  /** Por defecto `"auto"`. */
  algorithm?: GlobalAlgorithm | null;
  /** Candidatos admisibles que se generan y evalúan, entero en [50, 2000]; por defecto 500. */
  generated?: number | null;
  /** Semilla del generador pseudoaleatorio, entero en [0, 2^53 − 1]; por defecto 0. */
  seed?: number | null;
  /** Pulido final; por defecto `true`. Solo corre si gana el generador. */
  polish?: boolean | null;
}

export interface SearchSpec {
  type: 'circular_entry_exit';
  /** Rango en x del punto de entrada (coronamiento). */
  entry?: [number, number] | null;
  /** Rango en x del punto de salida (pie). */
  exit?: [number, number] | null;
  n_entry?: number;
  n_exit?: number;
  n_radius?: number;
  max_radius_factor?: number;
  min_width?: number | null;
  refine?: boolean;
  /** Refinamiento no circular (v0.6, F6.4). Exige version "0.6". Un valor null cuenta como ausente. */
  non_circular?: NonCircularSpec | null;
}

/** Coeficientes sísmicos pseudoestáticos (v0.2). Ausente equivale a kh = kv = 0. */
export interface Seismic {
  /** En [0, 1). La fuerza kh·W actúa en el sentido del deslizamiento. */
  kh?: number;
  /** En (−1, 1). Con kv > 0, la fuerza kv·W actúa hacia abajo. */
  kv?: number;
}

/** Carga distribuida vertical sobre el terreno entre x1 y x2 (v0.2). */
export interface UdlLoad {
  type: 'udl';
  /** Si existe, no puede repetirse. */
  id?: string | null;
  /** x1 < x2, ambos dentro del rango x del modelo. */
  x1: number;
  x2: number;
  /** kPa (SI) o psf (imperial); q ≥ 0. */
  q: number;
}

/** Carga lineal aplicada en (x, y_top(x)) (v0.2). */
export interface LineLoad {
  type: 'line';
  /** Si existe, no puede repetirse. */
  id?: string | null;
  /** Dentro del rango x del modelo. */
  x: number;
  /** kN/m (SI) o lbf/ft (imperial); p ≥ 0. */
  p: number;
  /** Grados en [−90, 90], desde la vertical hacia abajo; positivo inclina la carga hacia +x del modelo. */
  angle: number;
}

/** Carga externa (v0.2), discriminada por `type`. */
export type Load = UdlLoad | LineLoad;

/** Refuerzo (v0.4, F4.2). `active` es una fuerza conocida; `passive` se moviliza con el deslizamiento (se divide por F). Obligatorio. */
export type ReinforcementApplication = 'active' | 'passive';

/** Dirección de la fuerza de `anchor`, `nail` y `geosynthetic` (F4.2). Obligatoria. */
export type TensionDirection = 'axial' | 'tangent' | 'bisector';

/** Dirección de la fuerza de `pile` y `sheet_pile` (F4.2). `angle` exige el campo `angle` y los otros dos lo prohíben. */
export type PileDirection = 'angle' | 'tangent' | 'perpendicular';

/** Modelo de arrancamiento, etiquetado por `model` (F4.2). Sin `pullout`, el elemento está totalmente anclado en ambos extremos. */
export type Pullout =
  | {
      model: 'bond';
      /** Fuerza por metro de elemento, ≥ 0. */
      strength: number;
      /** > 0 y ≤ L: la adherencia actúa solo en los últimos metros hacia la punta (extremo 2). Sin él, en todo el elemento. */
      bonded_length?: number | null;
    }
  | {
      model: 'interface';
      /** ≥ 0. */
      adhesion: number;
      /** Grados en [0, 90). */
      friction_angle: number;
      /** En (0, 1]. */
      coverage: number;
    }
  | {
      model: 'development';
      /** ≥ 0: la capacidad crece linealmente desde la cabeza hasta `tensile_capacity` en esta longitud. */
      length1: number;
      /** ≥ 0: igual, desde la punta. */
      length2: number;
    };

/** Campos comunes de todo refuerzo (v0.4). Cabeza (x1, y1) y punta (x2, y2): longitud L > 0. */
export interface ReinforcementBase {
  /** No vacío y único en `reinforcements`. */
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  application: ReinforcementApplication;
}

/** `anchor`, `nail` y `geosynthetic` (v0.4). Fuerzas por elemento; `spacing` las pasa a fuerza por metro de talud. */
export interface TensionReinforcement extends ReinforcementBase {
  type: 'anchor' | 'nail' | 'geosynthetic';
  /** ≥ 0. Tope de la barra o tira, por elemento. */
  tensile_capacity: number;
  /** ≥ 0, por defecto 0. Placa o anclaje en la cabeza. */
  end1_capacity?: number | null;
  /** ≥ 0, por defecto 0. Anclaje en la punta. */
  end2_capacity?: number | null;
  /** > 0, por defecto 1. Espaciamiento fuera del plano, centro a centro. */
  spacing?: number | null;
  direction: TensionDirection;
  pullout?: Pullout | null;
}

/**
 * Presión del suelo sobre un pilote (v0.5, E15i-1): la fuerza sale de Ito y Matsui (1975) en vez de ser un dato. `diameter` es una
 * longitud finita > 0; `location` dice dónde actúa la fuerza (E15i-5): `centroid`, a `L_m` sobre el cruce (por defecto en la web), o
 * `slip_surface`, en el cruce. Obligatorio. Sin otros campos.
 */
export interface LateralPressure {
  model: 'ito_matsui';
  diameter: number;
  location: 'centroid' | 'slip_surface';
}

/**
 * Tope de un pilote con presión del suelo (v0.5, E15i-1): `shear` es una fuerza por pilote y `moment`, un momento por pilote (fuerza por
 * longitud). Lleva uno o los dos, no puede ir vacío, y cada valor es finito y > 0.
 */
export interface PileCapacity {
  shear?: number | null;
  moment?: number | null;
}

/**
 * `pile` (v0.4): fuerza de corte constante por pilote, o (v0.5) la presión del suelo de Ito-Matsui. `force` y `lateral_pressure` se
 * excluyen: tiene que haber exactamente uno.
 */
export interface PileReinforcement extends ReinforcementBase {
  type: 'pile';
  /** ≥ 0, por pilote. Excluye a `lateral_pressure`. */
  force?: number | null;
  /** > 0, por defecto 1. Con `lateral_pressure` debe ser mayor que `diameter`. */
  spacing?: number | null;
  direction: PileDirection;
  /** Grados en (−90, 90) sobre la horizontal (0 es horizontal). Obligatorio solo con `direction: \"angle\"`; prohibido con las otras. */
  angle?: number | null;
  /** v0.5 (E15i-1): la fuerza sale de la presión del suelo de Ito-Matsui; el pilote debe ser vertical. Excluye a `force`. */
  lateral_pressure?: LateralPressure | null;
  /** v0.5 (E15i-1): tope por corte y por momento; solo junto con `lateral_pressure`. */
  capacity?: PileCapacity | null;
}

/** `sheet_pile` (v0.4): una fila continua de pilotes, vertical (x1 = x2). `force` es por metro de muro; no hay `spacing`. */
export interface SheetPileReinforcement extends ReinforcementBase {
  type: 'sheet_pile';
  /** ≥ 0, por metro de muro. */
  force: number;
  direction: PileDirection;
  /** Como en `pile`. */
  angle?: number | null;
}

/** Refuerzo (v0.4, F4.2), discriminado por `type`. Exige version "0.4". */
export type Reinforcement = TensionReinforcement | PileReinforcement | SheetPileReinforcement;

/** Profundidad de la grieta de tracción (v0.5, F5.2): un número finito > 0 en la unidad de longitud del modelo, o `"auto"` (G6). */
export type CrackDepth = number | 'auto';

/**
 * `analysis.tension_crack` (v0.5, F5.2). Exige version "0.5". Sin campo de posición: `x_c` sale de la superficie y de la
 * profundidad (G1). Sin otros campos (`deny_unknown_fields`).
 */
export interface TensionCrack {
  depth: CrackDepth;
  /** Fracción de la grieta llena de agua, en [0, 1]. **Obligatoria y sin valor por defecto**: 0 seca, 1 llena. */
  water_fill: number;
}

export interface AnalysisSettings {
  /** Por defecto ["bishop"]. */
  methods?: MethodKind[];
  /** Por defecto 50. */
  slices?: number;
  tolerance?: number;
  max_iterations?: number;
  min_m_alpha?: number;
  surface?: SurfaceSpec | null;
  search?: SearchSpec | null;
  /** Solo con version "0.2" o superior. */
  seismic?: Seismic | null;
  /** Solo con version "0.3", y solo con `morgenstern_price` en `methods`. Por defecto `half_sine`. */
  interslice?: IntersliceSpec | null;
  /** Solo con version "0.5" (F5.1, F5.2). Un valor null cuenta como ausente. */
  tension_crack?: TensionCrack | null;
}

export interface Model {
  format: string;
  version: '0.1' | '0.2' | '0.3' | '0.4' | '0.5' | '0.6' | '0.7';
  meta: Meta;
  units?: string;
  materials: Material[];
  regions: Region[];
  water?: Water | null;
  /** Solo con version "0.2". Va después de `water` y antes de `slope`. */
  loads?: Load[];
  /** Solo con version "0.4" (F4.1). Va después de `loads` y antes de `slope`. */
  reinforcements?: Reinforcement[];
  slope?: SlopeSettings;
  analysis: AnalysisSettings;
}

// §2: caso de verificación

export type CheckKind = 'fixed' | 'search';

export interface VerificationCheck {
  method: MethodKind;
  kind: CheckKind;
  published: number;
  published_by?: string;
  /** Relativa: |FS − published| / published ≤ tolerance. */
  tolerance: number;
  options?: { slices?: number };
}

export interface VerificationCase {
  id: string;
  title: string;
  model: Model;
  checks: VerificationCheck[];
  source?: {
    reference?: string;
    derived_from?: string;
    notes?: string[];
  };
}

// §3: AnalysisReport

export type SolveStatus = 'converged' | 'not_converged' | 'invalid';

/** Estadísticas del refinamiento no circular (v0.6, F6.6). */
export interface NonCircularStats {
  seeds: number;
  evaluated: number;
  /** FS del mejor círculo antes de refinar. */
  seed_fos: number;
  /** FS de la mejor polilínea refinada; el motor lo omite si ninguna fue admisible (E16p). */
  polyline_fos?: number;
  /** Estadísticas de la búsqueda global (v0.7, F7.2); el motor lo omite sin `non_circular.global`. */
  global?: GlobalStats;
}

/** Estadísticas de la etapa global (v0.7, F7.2). */
export interface GlobalStats {
  /** El algoritmo que corrió: `block` o `annealing`; nunca `auto`. */
  algorithm: 'block' | 'annealing';
  /** Candidatos admisibles generados y evaluados. */
  generated: number;
  /** Intentos geométricos, incluidos los no admisibles. */
  attempts: number;
  /** Candidatos con solución convergida. */
  converged: number;
  /** Convergidos que pasan la guarda de tracción (F7.4). */
  eligible: number;
  /** Convergidos que rechazó la guarda. */
  tension_rejected: number;
  /** Polilíneas del generador que se refinaron (≤ 3). */
  refined: number;
  /** Evaluaciones de toda la etapa global: generación, refinamiento y pulido. */
  evaluated: number;
  /** Evaluaciones del pulido (0 si no corrió). */
  polish_evaluated: number;
  /** Mejor FS elegible de la etapa global, después de refinar y pulir; null si no hubo ninguno. */
  global_fos?: number | null;
  /** Quién dio la superficie crítica. */
  winner: 'global' | 'refinement';
}

export interface SearchStats {
  evaluated: number;
  valid: number;
  /** Estadísticas del refinamiento no circular (v0.6, F6.6); el motor lo omite sin `non_circular`. */
  non_circular?: NonCircularStats;
}

/** Dovela. Ver contratos §3 para el significado de cada campo. */
export interface Slice {
  x_left: number;
  x_right: number;
  y_base_left: number;
  y_base_right: number;
  y_top_mid: number;
  width: number;
  /** Radianes; positivo cuando la base sube hacia el coronamiento. */
  alpha: number;
  base_length: number;
  /** W por metro de ancho (fuera del plano). */
  weight: number;
  cohesion: number;
  tan_phi: number;
  pore_pressure: number;
  /** Índice en Model.materials. */
  material: number;
  // Campos de E12b (v0.2): cargas y sismo resueltos por el motor. Todos son 0 en una dovela aérea y en un modelo sin kh, kv ni cargas.
  /** Fuerza vertical añadida al peso del suelo, hacia abajo: kv·W + Q + V. La fuerza vertical de la dovela es W* = weight + weight_extra. */
  weight_extra: number;
  /** Fuerza horizontal en el sentido del deslizamiento: H = kh·W + H^P. */
  h_force: number;
  /** Momento de H respecto del punto medio de la base (Spencer y M-P). */
  h_moment_base: number;
  /** Aporte de H al momento motor respecto del centro del círculo, dividido por el radio (Bishop). */
  driving_extra: number;
  /** Ordenada ȳ del centroide del suelo de la dovela, ponderado por peso. Solo se calcula con kh > 0; en otro caso es 0. */
  y_centroid: number;
  // Campos de E14g (v0.4): fuerzas de los refuerzos pasivos, antes de dividir por F. El motor los omite cuando valen 0.
  /** Fuerza vertical pasiva, hacia abajo, antes de dividir por F. */
  passive_v?: number;
  /** Fuerza horizontal pasiva en el sentido del deslizamiento, antes de dividir por F. */
  passive_h?: number;
  /** Momento de `passive_h` respecto del punto medio de la base, antes de dividir por F. */
  passive_h_moment_base?: number;
  /** Aporte de `passive_h` al momento motor respecto del centro, dividido por el radio y antes de dividir por F. */
  passive_driving_extra?: number;
}

/** Superficie de un informe con polilínea (F3.7): la polilínea ajustada, ya prolongada o recortada al terreno. */
export interface PolylineReportSurface {
  points: Point[];
}

/** `surface` del informe, untagged: `{xc, yc, r}` para un círculo o `{points}` para una polilínea. */
export type ReportSurface = Circle | PolylineReportSurface;

/** Qué gobierna la fuerza de un pilote con presión del suelo (E15i-4): `soil` (la presión), `shear` (el corte) o `bending` (el momento). */
export type PileGoverns = 'soil' | 'shear' | 'bending';

/** Estado de un cruce de un refuerzo con la superficie final (F4.9). */
export type ReinforcementForceStatus = 'applied' | 'outside_mass' | 'compression_ignored' | 'no_capacity';

/**
 * Fuerza de un refuerzo en un cruce con la superficie final, por metro de talud (v0.4, F4.9). `fx` y `fy` son la fuerza
 * aplicada; en un pasivo es la disponible, antes de dividir por F («pasiva: se moviliza dividida por F»).
 */
export interface ReinforcementForce {
  id: string;
  /** Orden del cruce a lo largo del elemento desde la cabeza (0, 1…). */
  crossing: number;
  x: number;
  y: number;
  /** Distancia a la cabeza a lo largo del elemento. */
  station: number;
  /** T(s_c) por metro, o la fuerza del pilote por metro. */
  available: number;
  fx: number;
  fy: number;
  application: ReinforcementApplication;
  status: ReinforcementForceStatus;
  /**
   * Solo en un pilote con `lateral_pressure` (v0.5, E15i-7; se omite en uno con `force`): la fuerza del suelo por metro de talud,
   * **antes del tope** de `capacity`.
   */
  soil_force?: number;
  /** Quién fija `available` en un pilote con `lateral_pressure`: el suelo, el corte o la flexión (E15i-4). */
  governs?: PileGoverns;
  /** Brazo `L_m` de la resultante sobre el cruce, en la unidad de longitud del modelo (E15i-5). */
  arm?: number;
}

/**
 * La grieta de tracción de una superficie truncada (v0.5, F5.2): `x` es `x_c` (G1), `depth` la profundidad usada (la
 * fija, o la automática en `x_c`, G6) y `water_force` es `Pw = ½·γw·hw²`, `hw = depth·water_fill` (G3), por metro de
 * talud; 0 con la grieta seca.
 */
export interface CrackReport {
  x: number;
  depth: number;
  water_force: number;
  /**
   * Altura de la cara cortada `ground(x_c) − base(x_c)`, en la unidad de longitud del modelo (E15m-15). Opcional: el motor la omite cuando
   * coincide con `depth`. Con `depth = 0` y `face_height > 0` la masa se cortó sin grieta de tracción (p. ej., bajo una sobrecarga).
   */
  face_height?: number;
}

/** Estado de esfuerzo en la base de una dovela `hoek_brown` o `shansep` (v0.6, F6.6). */
export type SliceStrength =
  | {
      /** Índice en `MethodReport.slices`. */
      index: number;
      law: 'hoek_brown';
      normal_stress: number;
    }
  | {
      /** Índice en `MethodReport.slices`. */
      index: number;
      law: 'shansep';
      vertical_stress: number;
      ocr: number;
    };

/** Informe de resistencia por método (v0.6, F6.6); el motor lo omite sin materiales `hoek_brown` ni `shansep`. */
export interface StrengthReport {
  /** Número de pasadas del lazo de Hoek-Brown de ese método; el motor lo omite sin Hoek-Brown. */
  passes?: number;
  /** Solo las dovelas cuya base es `hoek_brown` o `shansep`. */
  slices: SliceStrength[];
}

export interface MethodReport {
  method: MethodKind;
  /** null cuando el FS no es finito (E4f); `status` y los avisos explican el motivo. */
  fos: number | null;
  status: SolveStatus;
  iterations: number;
  lambda: number | null;
  surface: ReportSurface;
  slices: Slice[];
  search: SearchStats | null;
  warnings: string[];
  /** F₀·f₀ = fos / correction_factor. Solo existe con `janbu_corrected` (F3.5). */
  correction_factor?: number;
  /** Función de fuerzas entre dovelas usada. Solo existe con `morgenstern_price` (F3.7). */
  interslice?: IntersliceSpec;
  /** Fuerzas de los refuerzos en la superficie final (v0.4, F4.9); el motor lo omite si está vacío. Solo en métodos convergidos. */
  reinforcement_forces?: ReinforcementForce[];
  /** La grieta de tracción que truncó la superficie (v0.5, F5.2); el motor lo omite sin grieta. */
  tension_crack?: CrackReport;
  /** Estado de resistencia en las dovelas `hoek_brown` y `shansep` (v0.6, F6.6); el motor lo omite si no hay ninguna. */
  strength?: StrengthReport;
}

export interface AnalysisReport {
  /** "ogs-core <version>" en el motor real; "mock" en el simulado. */
  engine: string;
  results: MethodReport[];
}
