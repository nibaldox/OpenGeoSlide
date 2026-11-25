// Tipos fieles a briefs/00_CONTRATOS.md: §1 (modelo .ogs.json v0.1), §2 (caso de verificación)
// y §3 (AnalysisReport). Los nombres son snake_case, igual que el JSON del motor.
// Los campos marcados como opcionales son los que tienen default en el motor (#[serde(default)]).

export type Point = [number, number];

export type MaterialModel = 'mohr_coulomb';

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
  /** kPa (SI) o psf. Para φ = 0 (no drenado) es Su. */
  cohesion: number;
  /** Grados. */
  friction_angle: number;
  ru?: number | null;
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

export type MethodKind = 'bishop' | 'spencer';

export interface Circle {
  xc: number;
  yc: number;
  r: number;
}

export interface SurfaceSpec extends Circle {
  type: 'circle';
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
  /** Solo con version "0.2". */
  seismic?: Seismic | null;
}

export interface Model {
  format: string;
  version: '0.1' | '0.2';
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
}

export interface MethodReport {
  method: MethodKind;
  /** null cuando el FS no es finito (E4f); `status` y los avisos explican el motivo. */
  fos: number | null;
  status: SolveStatus;
  iterations: number;
  lambda: number | null;
  surface: Circle;
  slices: Slice[];
  search: SearchStats | null;
  warnings: string[];
}

export interface AnalysisReport {
  /** "ogs-core <version>" en el motor real; "mock" en el simulado. */
  engine: string;
  results: MethodReport[];
}
