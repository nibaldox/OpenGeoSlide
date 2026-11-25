import type { AnalysisSettings, Direction, Material, Meta, Model, Point, Region,
              SearchSpec, SurfaceSpec, Load } from '../engine/types';
import type { Viewport } from '../geometry/viewport';

/** Documento = Model v0.2 completo (el editor abre v0.1 y v0.2, y guarda siempre v0.2). Nunca lleva campos de UI (deny_unknown_fields). */
export type ModelDoc = Model;
export type Tool = 'select' | 'add_vertex' | 'draw_region' | 'split_region' | 'pan';

export type Selection =
  | { kind: 'none' }
  | { kind: 'vertex'; regionIndex: number; vertexIndex: number }
  | { kind: 'region'; regionIndex: number }
  | { kind: 'material'; materialId: string }
  | { kind: 'piezo_point'; index: number }
  | { kind: 'surface_circle' }
  | { kind: 'search_range'; which: 'entry' | 'exit' }
  | { kind: 'load'; index: number };

export interface EditorUi {
  tool: Tool;
  selection: Selection;
  viewport: Viewport | null;          // no se persiste
  snap: { vertex: boolean; axis: boolean; gridStep: number | null; radiusPx: number };
  /** Puntos del trazo en curso de «Dibujar región» o «Dividir región» (los publica el lienzo; 0 = sin trazo). No se persiste. */
  tracePoints: number;
}

/** Códigos de las incidencias locales del editor (prefijo `editor.`). */
export type EditorIssueCode =
  | 'editor.self_intersection'
  | 'editor.region_overlap'
  | 'editor.too_few_vertices'
  | 'editor.duplicate_vertex'
  | 'editor.missing_material'
  | 'editor.duplicate_material'
  | 'editor.out_of_range'
  | 'editor.piezo_order'
  | 'editor.load_range'
  | 'editor.degenerate_region'
  | 'editor.no_surface'
  | 'editor.water_unit_weight';

/** `path` es un puntero JSON, p. ej. "/regions/0/polygon/2". */
export interface Issue {
  source: 'local' | 'engine';
  severity: 'error' | 'aviso' | 'nota';
  code: string;        // local: un EditorIssueCode ("editor.self_intersection"); motor: "InvalidModel" o código de aviso
  text: string;        // español, sin voseo
  path: string | null;
  /** Detalle técnico (código del analizador, posición…), aparte del texto: la UI lo muestra colapsado. */
  detail?: string;
}

export interface Diagnostics {
  status: 'idle' | 'checking' | 'ok' | 'error' | 'stale';
  issues: Issue[];
  revision: number;    // revisión de doc a la que corresponden
}

export interface EditorState {
  doc: ModelDoc;
  revision: number;                       // sube con cada cambio de doc (no de ui)
  /** Sube con cada `doc/load` y `doc/replace`: lo que el lienzo guarda aparte del documento (el trazo en curso) deja de valer. */
  docEpoch: number;
  ui: EditorUi;
  history: { past: ModelDoc[]; future: ModelDoc[] };  // máx. 200
  file: { name: string | null; savedRevision: number };
  diagnostics: Diagnostics;
  gesture: { label: string; before: ModelDoc } | null;
}

export type EditorCommand =
  | { type: 'vertex/move'; regionIndex: number; vertexIndex: number; to: Point }
  | { type: 'vertex/insert'; regionIndex: number; afterIndex: number; at: Point }
  | { type: 'vertex/remove'; regionIndex: number; vertexIndex: number }
  | { type: 'region/add'; region: Region }
  | { type: 'region/remove'; regionIndex: number }
  | { type: 'region/setPolygon'; regionIndex: number; polygon: Point[] }   // reemplaza el contorno (dividir región); mínimo 3 puntos
  | { type: 'region/setMaterial'; regionIndex: number; materialId: string }
  | { type: 'material/upsert'; material: Material }
  | { type: 'material/remove'; materialId: string }   // falla si una región lo usa
  | { type: 'water/setUnitWeight'; value: number | undefined }
  | { type: 'piezo/set'; points: Point[] | null }
  | { type: 'surface/set'; surface: SurfaceSpec | null }
  | { type: 'search/set'; search: SearchSpec | null }
  | { type: 'analysis/patch'; patch: Partial<AnalysisSettings> }
  | { type: 'slope/setDirection'; direction: Direction }
  | { type: 'meta/patch'; patch: Partial<Meta> }
  | { type: 'units/set'; units: string }               // cambia el sistema de unidades; NO convierte ningún valor
  | { type: 'seismic/set'; seismic: { kh: number; kv: number } | null }
  | { type: 'loads/set'; loads: Load[] }
  | { type: 'load/upsert'; index: number | null; load: Load }   // index null = agregar
  | { type: 'load/remove'; index: number }
  | { type: 'doc/replace'; doc: ModelDoc; fileName: string | null }  // deshacible (importación)
  | { type: 'doc/load'; doc: ModelDoc; fileName: string | null };    // Nuevo, Abrir, Ejemplos, Recuperar: reinicia el historial

export type UiAction =                 // no entra en historial
  | { type: 'ui/select'; selection: Selection }
  | { type: 'ui/tool'; tool: Tool }
  | { type: 'ui/viewport'; viewport: Viewport | null }
  | { type: 'ui/snap'; patch: Partial<EditorUi['snap']> }
  | { type: 'ui/trace'; points: number };

/** Fachada para canvas y paneles. Solo W1 la implementa. */
export interface EditorStore {
  getState(): EditorState;
  subscribe(listener: () => void): () => void;
  dispatch(action: EditorCommand | UiAction): void;
  undo(): void;
  redo(): void;
  beginGesture(label: string): void;   // un gesto = una entrada de historial
  endGesture(): void;
  cancelGesture(): void;
  setDiagnostics(d: Diagnostics): void;
}
