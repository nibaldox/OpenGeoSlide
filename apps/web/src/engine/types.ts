// Tipos fieles a briefs/00_CONTRATOS.md: §1 (modelo .ogs.json), §2 (caso de verificación)
// y §3 (AnalysisReport), con las enmiendas de briefs/01_CONTRATOS_FASE1.md (v0.2) y
// briefs/02_CONTRATOS_FASE3.md (v0.3, F3.1-F3.7). Los nombres son snake_case, igual que el JSON del motor.
// Los campos marcados como opcionales son los que tienen default en el motor (#[serde(default)]).

export type Point = [number, number];

/** `undrained` exige version "0.3" (F3.2). */
export type MaterialModel = 'mohr_coulomb' | 'undrained';

export interface Meta {
  id?: string | null;
  title?: string | null;
  notes?: string | null;
}

export interface Material {
  id: string;
  name: string;
  model: MaterialModel;
  /** kN/m³ (SI) o pcf (imperial). */
  unit_weight: number;
  unit_weight_sat?: number | null;
  /** kPa (SI) o psf. Obligatoria con `mohr_coulomb` y prohibida con `undrained` (F3.2). */
  cohesion?: number | null;
  /** Grados. Obligatoria con `mohr_coulomb` y prohibida con `undrained` (F3.2). */
  friction_angle?: number | null;
  ru?: number | null;
  /** Su en `strength_datum` (kPa o psf, ≥ 0). Obligatoria con `undrained`; prohibida con `mohr_coulomb`. Solo version "0.3". */
  undrained_strength?: number | null;
  /** Cota y de referencia de Su (no una profundidad). Va junto con `strength_gradient`. Solo version "0.3". */
  strength_datum?: number | null;
  /** Variación de Su por unidad de longitud en y (kPa/m o psf/ft, finito y de cualquier signo): Su = Su₀ + (datum − y)·gradient. Solo version "0.3". */
  strength_gradient?: number | null;
  /** Tope de Su (≥ 0); solo con `strength_gradient`. Solo version "0.3". */
  strength_limit?: number | null;
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
}

export interface Model {
  format: string;
  version: '0.1' | '0.2' | '0.3';
  meta: Meta;
  units?: string;
  materials: Material[];
  regions: Region[];
  water?: Water | null;
  /** Solo con version "0.2". Va después de `water` y antes de `slope`. */
  loads?: Load[];
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

export interface SearchStats {
  evaluated: number;
  valid: number;
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
}

/** Superficie de un informe con polilínea (F3.7): la polilínea ajustada, ya prolongada o recortada al terreno. */
export interface PolylineReportSurface {
  points: Point[];
}

/** `surface` del informe, untagged: `{xc, yc, r}` para un círculo o `{points}` para una polilínea. */
export type ReportSurface = Circle | PolylineReportSurface;

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
}

export interface AnalysisReport {
  /** "ogs-core <version>" en el motor real; "mock" en el simulado. */
  engine: string;
  results: MethodReport[];
}
