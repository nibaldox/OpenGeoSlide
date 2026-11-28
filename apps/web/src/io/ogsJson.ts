// Abrir y guardar `.ogs.json` (X3 §2.6, F1.1, F1.4).
//
// - `openOgsJson` acepta v0.1 a v0.7 (y `{model, checks}`), valida la forma y devuelve un `ModelDoc` con la versión
//   mínima que lo describe (F3.9, F4.1, F5.1, F6.1): `"0.2"` sin campos posteriores, `"0.3"` con alguno de v0.3, `"0.4"` si hay
//   refuerzos, `"0.5"` con grieta de tracción o pilote con presión del suelo `"0.6"` si usa Hoek-Brown, SHANSEP o búsqueda no circular y `"0.7"` con la búsqueda global (`non_circular.global`).
// - `saveOgsJson` escribe esa versión mínima, con el orden de claves canónico de 00_CONTRATOS.md §1
//   (`loads` después de `water`, `reinforcements` después de `loads`, `analysis.seismic`, `interslice` y `tension_crack` al
//   final de `analysis`) y 2 espacios. Los números se escriben
//   **sin redondear**, con la representación de ida y vuelta más corta de JS (E12g): abrir y guardar no cambia el
//   resultado del motor ni un bit.
// - `openOgsJson` es estricto, igual que el motor (`deny_unknown_fields`, E12h): un campo desconocido, o un campo en una
//   versión anterior a la de su puerta, es un error con su puntero JSON, no un aviso. Un `null` cuenta como campo ausente,
//   como en el motor.

import type { Issue, ModelDoc } from '../editor/types';
// Con extensión `.ts` (R12, E15l-19): `verification/tools/web_roundtrip_save.mjs` carga este módulo con `node --experimental-strip-types`,
// que no resuelve importaciones de valor sin extensión (la cadena pond → polylineGround también la lleva).
import { pondPolygons } from '../render/pond.ts';
// Mismo motivo para la extensión: `globalSearch.ts` solo importa tipos, así que `--experimental-strip-types` lo carga.
import { isGlobalAlgorithm } from '../engine/globalSearch.ts';

export const OGS_FORMAT = 'opengeoslide';
/** Versión que se guarda cuando el modelo no usa ningún campo de la v0.3 o superior (F3.9). */
export const OGS_SAVE_VERSION = '0.2';
/** Versión que se guarda cuando el modelo usa algún campo de la v0.3 (F3.9). */
export const OGS_V03 = '0.3';
/** Versión que se guarda cuando el modelo tiene refuerzos (F4.1). */
export const OGS_V04 = '0.4';
/** Versión que se guarda cuando el modelo tiene la grieta de tracción `analysis.tension_crack` o un pilote con presión del suelo (F5.1, E15i-1). */
export const OGS_V05 = '0.5';
/** Versión que se guarda cuando el modelo usa materiales `hoek_brown` o `shansep` o `analysis.search.non_circular` (F6.1). */
export const OGS_V06 = '0.6';
/** Versión que se guarda cuando el modelo usa la búsqueda global `analysis.search.non_circular.global` (F7.1). */
export const OGS_V07 = '0.7';

export const OGS_VERSIONS = ['0.1', OGS_SAVE_VERSION, OGS_V03, OGS_V04, OGS_V05, OGS_V06, OGS_V07] as const;
export type KnownOgsVersion = (typeof OGS_VERSIONS)[number];

type OgsVersion = typeof OGS_SAVE_VERSION | typeof OGS_V03 | typeof OGS_V04 | typeof OGS_V05 | typeof OGS_V06 | typeof OGS_V07;

export function isKnownOgsVersion(v: unknown): v is KnownOgsVersion {
  return typeof v === 'string' && (OGS_VERSIONS as readonly string[]).includes(v);
}

/** ¿`declared` es igual o posterior a `required` dentro de `OGS_VERSIONS`? */
export function versionAtLeast(declared: string, required: KnownOgsVersion): boolean {
  const d = (OGS_VERSIONS as readonly string[]).indexOf(declared);
  const r = OGS_VERSIONS.indexOf(required);
  return d >= r && r >= 0;
}

/** Mensaje de versión desconocida, igual en Rust, Python y la web (F6.1). */
export function unknownVersionMessage(version: unknown): string {
  return `version debe ser "0.1", "0.2", "0.3", "0.4", "0.5", "0.6" o "0.7", no "${String(version)}"`;
}

export interface OpenOgsResult {
  /** `null` si el archivo se rechaza (hay al menos una incidencia con severidad `error`). */
  doc: ModelDoc | null;
  issues: Issue[];
}

// ---------------------------------------------------------------------------------------------------------------
// Orden canónico de claves
// ---------------------------------------------------------------------------------------------------------------

const TOP_KEYS = [
  'format',
  'version',
  'meta',
  'units',
  'materials',
  'regions',
  'water',
  'loads',
  'reinforcements',
  'slope',
  'analysis',
] as const;
const META_KEYS = ['id', 'title', 'notes'] as const;
const MATERIAL_V03_KEYS = ['undrained_strength', 'strength_datum', 'strength_gradient', 'strength_limit'] as const;
const MATERIAL_HB_KEYS = ['ucs', 'gsi', 'mi', 'disturbance'] as const;
const MATERIAL_V06_KEYS = [...MATERIAL_HB_KEYS, 'shansep'] as const;
const MATERIAL_KEYS = [
  'id',
  'name',
  'model',
  'unit_weight',
  'unit_weight_sat',
  'cohesion',
  'friction_angle',
  'ru',
  ...MATERIAL_V03_KEYS,
  ...MATERIAL_V06_KEYS,
] as const;
const SHANSEP_KEYS = ['ratio', 'exponent', 'ocr', 'pop', 'ocr_by_elevation'] as const;
const SHANSEP_OPTIONAL_KEYS = ['exponent', 'ocr', 'pop', 'ocr_by_elevation'] as const;
const REGION_KEYS = ['material', 'polygon'] as const;
const WATER_KEYS = ['unit_weight', 'piezometric_line'] as const;
const UDL_KEYS = ['type', 'id', 'x1', 'x2', 'q'] as const;
const LINE_LOAD_KEYS = ['type', 'id', 'x', 'p', 'angle'] as const;
// Refuerzos (v0.4, F4.2): `type` primero, como el motor (serde con `tag = "type"`). Cada variante rechaza las claves de las otras.
const REINFORCEMENT_COMMON_KEYS = ['type', 'id', 'x1', 'y1', 'x2', 'y2', 'application'] as const;
const TENSION_KEYS = [...REINFORCEMENT_COMMON_KEYS, 'tensile_capacity', 'end1_capacity', 'end2_capacity', 'spacing', 'direction', 'pullout'] as const;
// v0.5 (E15i-1): `lateral_pressure` y `capacity` al final, después de `angle`; `force` pasa a opcional (excluye a `lateral_pressure`).
const PILE_KEYS = [...REINFORCEMENT_COMMON_KEYS, 'force', 'spacing', 'direction', 'angle', 'lateral_pressure', 'capacity'] as const;
const LATERAL_PRESSURE_KEYS = ['model', 'diameter', 'location'] as const;
const PILE_CAPACITY_KEYS = ['shear', 'moment'] as const;
const SHEET_PILE_KEYS = [...REINFORCEMENT_COMMON_KEYS, 'force', 'direction', 'angle'] as const;
const PULLOUT_BOND_KEYS = ['model', 'strength', 'bonded_length'] as const;
const PULLOUT_INTERFACE_KEYS = ['model', 'adhesion', 'friction_angle', 'coverage'] as const;
const PULLOUT_DEVELOPMENT_KEYS = ['model', 'length1', 'length2'] as const;
/** Opcionales de un refuerzo: un `null` cuenta como ausente (igual que en el motor) y no se escribe. */
const REINFORCEMENT_OPTIONAL_KEYS = ['end1_capacity', 'end2_capacity', 'spacing', 'angle', 'pullout', 'force', 'lateral_pressure', 'capacity'] as const;
const TENSION_TYPES: readonly string[] = ['anchor', 'nail', 'geosynthetic'];
const REINFORCEMENT_TYPES: readonly string[] = [...TENSION_TYPES, 'pile', 'sheet_pile'];
const SLOPE_KEYS = ['direction'] as const;
const ANALYSIS_KEYS = [
  'methods',
  'slices',
  'tolerance',
  'max_iterations',
  'min_m_alpha',
  'surface',
  'search',
  'seismic',
  'interslice',
  'tension_crack',
] as const;
const CRACK_KEYS = ['depth', 'water_fill'] as const;
const SURFACE_KEYS = ['type', 'xc', 'yc', 'r', 'points'] as const;
const INTERSLICE_KEYS = ['function', 'points'] as const;
const SEARCH_KEYS = [
  'type',
  'entry',
  'exit',
  'n_entry',
  'n_exit',
  'n_radius',
  'max_radius_factor',
  'min_width',
  'refine',
  'non_circular',
] as const;
const NON_CIRCULAR_KEYS = ['seeds', 'max_vertices', 'global'] as const;
const GLOBAL_KEYS = ['algorithm', 'generated', 'seed', 'polish'] as const;
const SEISMIC_KEYS = ['kh', 'kv'] as const;

type Rec = Record<string, unknown>;

function isRecord(v: unknown): v is Rec {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ---------------------------------------------------------------------------------------------------------------
// Ubicación en términos de usuario
// ---------------------------------------------------------------------------------------------------------------

const FIELD_NAME: Readonly<Record<string, string>> = {
  id: 'identificador',
  name: 'nombre',
  model: 'modelo constitutivo',
  unit_weight: 'peso unitario',
  unit_weight_sat: 'peso unitario saturado',
  cohesion: 'cohesión',
  friction_angle: 'ángulo de fricción',
  ru: 'coeficiente ru',
  material: 'material',
  polygon: 'contorno',
  piezometric_line: 'línea piezométrica',
  x: 'posición x',
  x1: 'inicio x1',
  x2: 'fin x2',
  q: 'carga q',
  p: 'carga p',
  angle: 'ángulo',
  direction: 'sentido de deslizamiento',
  methods: 'métodos',
  slices: 'dovelas',
  tolerance: 'tolerancia',
  max_iterations: 'iteraciones máximas',
  min_m_alpha: 'm_α mínimo',
  xc: 'centro xc',
  yc: 'centro yc',
  r: 'radio',
  entry: 'rango de entrada',
  exit: 'rango de salida',
  n_entry: 'puntos de entrada',
  n_exit: 'puntos de salida',
  n_radius: 'radios por par',
  max_radius_factor: 'factor de radio máximo',
  min_width: 'ancho mínimo',
  refine: 'refinamiento',
  kh: 'coeficiente sísmico horizontal kh',
  kv: 'coeficiente sísmico vertical kv',
  title: 'título',
  notes: 'notas',
  units: 'unidades',
  undrained_strength: 'resistencia no drenada Su',
  strength_datum: 'cota de referencia de Su',
  strength_gradient: 'gradiente de Su',
  strength_limit: 'límite de Su',
  function: 'función',
  points: 'puntos',
  depth: 'profundidad',
  water_fill: 'fracción de agua',
  ucs: 'resistencia a compresión simple σci',
  gsi: 'índice GSI',
  mi: 'constante mi',
  disturbance: 'factor de perturbación D',
  shansep: 'parámetros SHANSEP',
  ratio: 'cociente S',
  exponent: 'exponente m',
  ocr: 'OCR',
  pop: 'presión de sobreconsolidación POP',
  ocr_by_elevation: 'perfil de OCR por cota',
  non_circular: 'búsqueda no circular',
  seeds: 'semillas',
  max_vertices: 'vértices máximos',
  global: 'búsqueda global',
  algorithm: 'algoritmo',
  generated: 'candidatos',
  seed: 'semilla',
  polish: 'pulido',
};

/** Campos de un refuerzo en palabras de la interfaz (v0.4). */
const REINFORCEMENT_FIELD_NAME: Readonly<Record<string, string>> = {
  type: 'tipo',
  id: 'identificador',
  x1: 'cabeza x1',
  y1: 'cabeza y1',
  x2: 'punta x2',
  y2: 'punta y2',
  application: 'aplicación activa o pasiva',
  tensile_capacity: 'capacidad a tracción',
  end1_capacity: 'capacidad del extremo 1',
  end2_capacity: 'capacidad del extremo 2',
  spacing: 'espaciamiento',
  direction: 'dirección de la fuerza',
  angle: 'ángulo',
  force: 'fuerza',
  pullout: 'arrancamiento',
  lateral_pressure: 'presión del suelo',
  capacity: 'capacidad',
  diameter: 'diámetro',
  location: 'ubicación de la fuerza',
  shear: 'corte',
  moment: 'momento',
  model: 'modelo de arrancamiento',
  strength: 'resistencia por metro',
  bonded_length: 'longitud adherida',
  adhesion: 'adhesión',
  friction_angle: 'ángulo de fricción de la interfaz',
  coverage: 'cobertura Rc',
  length1: 'longitud de desarrollo 1',
  length2: 'longitud de desarrollo 2',
};

/** Describe un puntero JSON (`/regions/0/polygon/2/1`) con palabras de la interfaz («región 1, vértice 3»). */
export function describePath(path: string): string {
  const seg = path.split('/').filter((x) => x !== '');
  const n = (k: string | undefined): number => Number(k) + 1;
  const field = (k: string | undefined): string => (k !== undefined && FIELD_NAME[k]) || (k ?? 'valor');
  const [a, b, c, d] = seg;
  switch (a) {
    case undefined:
      return 'el nivel principal del archivo';
    case 'materials':
      if (b === undefined) return 'la lista de materiales';
      if (c === undefined) return `el material ${n(b)}`;
      if (c === 'shansep' && d !== undefined) {
        if (d === 'ocr_by_elevation' && seg[4] !== undefined) return `el material ${n(b)} (parámetros SHANSEP, fila ${n(seg[4])})`;
        return `el material ${n(b)} (parámetros SHANSEP, ${field(d)})`;
      }
      return `el material ${n(b)} (${field(c)})`;
    case 'regions':
      if (b === undefined) return 'la lista de regiones';
      if (c === 'polygon' && d !== undefined) return `la región ${n(b)}, vértice ${n(d)}`;
      return c === undefined ? `la región ${n(b)}` : `la región ${n(b)} (${field(c)})`;
    case 'water':
      if (b === 'piezometric_line' && c !== undefined) return `la línea piezométrica, punto ${n(c)}`;
      return b === undefined ? 'los datos de agua' : `los datos de agua (${field(b)})`;
    case 'loads':
      return b === undefined ? 'la lista de cargas' : c === undefined ? `la carga ${n(b)}` : `la carga ${n(b)} (${field(c)})`;
    case 'reinforcements': {
      if (b === undefined) return 'la lista de refuerzos';
      if (c === undefined) return `el refuerzo ${n(b)}`;
      const rf = (k: string | undefined): string => (k !== undefined && REINFORCEMENT_FIELD_NAME[k]) || (k ?? 'valor');
      if (c === 'pullout') return d === undefined ? `el refuerzo ${n(b)} (arrancamiento)` : `el refuerzo ${n(b)} (arrancamiento, ${rf(d)})`;
      // v0.5 (E15i-1): la presión del suelo de Ito-Matsui y la capacidad del pilote.
      if (c === 'lateral_pressure' || c === 'capacity') {
        const whole = rf(c);
        if (d === undefined) return `el refuerzo ${n(b)} (${whole})`;
        return `el refuerzo ${n(b)} (${whole}, ${c === 'lateral_pressure' && d === 'model' ? 'modelo' : rf(d)})`;
      }
      return `el refuerzo ${n(b)} (${rf(c)})`;
    }
    case 'analysis': {
      const section: Record<string, string> = {
        surface: 'la superficie fija',
        search: 'la búsqueda',
        seismic: 'el sismo',
        interslice: 'la función de fuerzas entre dovelas',
        tension_crack: 'la grieta de tracción',
      };
      if (b === undefined) return 'la configuración del análisis';
      if (b === 'surface' && c === 'points' && d !== undefined) return `la polilínea fija, punto ${n(d)}`;
      if (b === 'interslice' && c === 'points' && d !== undefined) return `la función de fuerzas entre dovelas, punto ${n(d)}`;
      if (b === 'search' && c === 'non_circular') {
        if (d === 'global') {
          const e = seg[4];
          return e === undefined ? 'la búsqueda global' : `la búsqueda global (${field(e)})`;
        }
        return d === undefined ? 'la búsqueda no circular' : `la búsqueda no circular (${field(d)})`;
      }
      if (c === undefined) return section[b] ? section[b] : `la configuración del análisis (${field(b)})`;
      return `${section[b] ?? 'el análisis'} (${field(c)})`;
    }
    case 'meta':
      return 'los datos del proyecto';
    case 'slope':
      return 'el sentido de deslizamiento';
    default:
      return `el campo «${a}»`;
  }
}

/** Posición «línea L, columna C» de un desplazamiento dentro del texto (ambas desde 1). */
function lineColumn(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset);
  const line = before.split(/\r\n|\r|\n/).length;
  const column = offset - Math.max(before.lastIndexOf('\n'), before.lastIndexOf('\r'));
  return { line, column };
}

const isDigit = (c: number): boolean => c >= 0x30 && c <= 0x39;
const isHex = (c: number): boolean => isDigit(c) || (c >= 0x41 && c <= 0x46) || (c >= 0x61 && c <= 0x66);

/**
 * Desplazamiento (en unidades UTF-16) del primer carácter que rompe la sintaxis JSON, o `text.length` si el texto
 * termina antes de tiempo, o `null` si es JSON válido (UX-13). V8 ya no escribe «position N» en sus mensajes
 * (Node 22), así que la posición sale de este escáner, que sigue la gramática de RFC 8259 y es iterativo (sin
 * recursión: un archivo con miles de niveles no desborda la pila). El mensaje del motor de JS queda solo como detalle.
 */
export function jsonErrorOffset(text: string): number | null {
  const n = text.length;
  let i = 0;
  const at = (k: number): number => (k < n ? text.charCodeAt(k) : -1);
  const ws = (): void => {
    for (;;) {
      const c = at(i);
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) i++;
      else return;
    }
  };
  /** `-1` si la cadena (que empieza en `i`, en la comilla) es válida; si no, el desplazamiento del error. */
  const scanString = (): number => {
    i++;
    for (;;) {
      const c = at(i);
      if (c === -1) return n;
      if (c === 0x22) {
        i++;
        return -1;
      }
      if (c < 0x20) return i;
      if (c !== 0x5c) {
        i++;
        continue;
      }
      i++;
      const e = at(i);
      if (e === -1) return n;
      if ('"\\/bfnrt'.includes(String.fromCharCode(e))) i++;
      else if (e === 0x75) {
        for (let k = 1; k <= 4; k++) {
          const h = at(i + k);
          if (h === -1) return n;
          if (!isHex(h)) return i + k;
        }
        i += 5;
      } else return i;
    }
  };
  const scanNumber = (): number => {
    if (at(i) === 0x2d) i++;
    const first = at(i);
    if (first === 0x30) i++;
    else if (first >= 0x31 && first <= 0x39) while (isDigit(at(i))) i++;
    else return first === -1 ? n : i;
    if (at(i) === 0x2e) {
      i++;
      if (!isDigit(at(i))) return at(i) === -1 ? n : i;
      while (isDigit(at(i))) i++;
    }
    if (at(i) === 0x65 || at(i) === 0x45) {
      i++;
      if (at(i) === 0x2b || at(i) === 0x2d) i++;
      if (!isDigit(at(i))) return at(i) === -1 ? n : i;
      while (isDigit(at(i))) i++;
    }
    return -1;
  };
  const scanLiteral = (word: string): number => {
    for (let k = 0; k < word.length; k++) {
      if (at(i + k) !== word.charCodeAt(k)) return at(i + k) === -1 ? n : i + k;
    }
    i += word.length;
    return -1;
  };

  const stack: number[] = []; // 0x7b `{` o 0x5b `[`
  let state: 'value' | 'key' | 'after' = 'value';
  for (;;) {
    ws();
    const c = at(i);
    if (state === 'value') {
      let err = -1;
      if (c === 0x7b) {
        stack.push(c);
        i++;
        ws();
        if (at(i) === 0x7d) {
          stack.pop();
          i++;
          state = 'after';
        } else state = 'key';
      } else if (c === 0x5b) {
        stack.push(c);
        i++;
        ws();
        if (at(i) === 0x5d) {
          stack.pop();
          i++;
          state = 'after';
        }
      } else {
        if (c === 0x22) err = scanString();
        else if (c === 0x2d || isDigit(c)) err = scanNumber();
        else if (c === 0x74) err = scanLiteral('true');
        else if (c === 0x66) err = scanLiteral('false');
        else if (c === 0x6e) err = scanLiteral('null');
        else return c === -1 ? n : i;
        if (err !== -1) return err;
        state = 'after';
      }
    } else if (state === 'key') {
      if (c !== 0x22) return c === -1 ? n : i;
      const err = scanString();
      if (err !== -1) return err;
      ws();
      if (at(i) !== 0x3a) return at(i) === -1 ? n : i;
      i++;
      state = 'value';
    } else {
      const top = stack[stack.length - 1];
      if (top === undefined) return c === -1 ? null : i;
      if (c === 0x2c) {
        i++;
        state = top === 0x7b ? 'key' : 'value';
      } else if ((top === 0x7b && c === 0x7d) || (top === 0x5b && c === 0x5d)) {
        stack.pop();
        i++;
      } else return c === -1 ? n : i;
    }
  }
}

interface Ctx {
  onUnknown(path: string, key: string): void;
  /**
   * Un número no finito en `path` (JSON no admite NaN ni Infinity; `JSON.parse` convierte `1e400` en `Infinity`).
   * Al abrir se registra como incidencia (R6-02); al guardar lanza.
   */
  onNonFinite(path: string, key: string): void;
}

type Sub = (v: unknown, path: string, ctx: Ctx) => unknown;

/** Un número se guarda tal cual; solo se exige que sea finito. */
function checkedNumber(v: number, path: string, key: string, ctx: Ctx): number {
  if (!Number.isFinite(v)) ctx.onNonFinite(path, key);
  return v;
}

function plain(v: unknown, path: string, key: string, ctx: Ctx): unknown {
  if (typeof v === 'number') return checkedNumber(v, path, key, ctx);
  if (Array.isArray(v)) return v.map((x, i) => plain(x, `${path}/${i}`, key, ctx));
  if (isRecord(v)) {
    const out: Rec = {};
    for (const k of Object.keys(v)) {
      if (v[k] !== undefined) out[k] = plain(v[k], `${path}/${k}`, k, ctx);
    }
    return out;
  }
  return v;
}

const throwNonFinite = (path: string): never => {
  throw new Error(`No se puede guardar: ${describePath(path)} tiene un valor no finito (infinito o indefinido); corríjalo antes de guardar.`);
};

function ordered(v: unknown, order: readonly string[], path: string, ctx: Ctx, sub: Record<string, Sub> = {}): unknown {
  if (!isRecord(v)) return v;
  const out: Rec = {};
  for (const key of order) {
    const value = v[key];
    if (value === undefined) continue;
    const f = sub[key];
    out[key] = f ? f(value, `${path}/${key}`, ctx) : plain(value, `${path}/${key}`, key, ctx);
  }
  for (const key of Object.keys(v)) {
    if (!order.includes(key) && v[key] !== undefined) ctx.onUnknown(path, key);
  }
  return out;
}

function listOf(item: Sub): Sub {
  return (v, path, ctx) => (Array.isArray(v) ? v.map((x, i) => item(x, `${path}/${i}`, ctx)) : v);
}

const orderedWith =
  (order: readonly string[], sub: Record<string, Sub> = {}): Sub =>
  (v, path, ctx) =>
    ordered(v, order, path, ctx, sub);

const loadSub: Sub = (v, path, ctx) => {
  if (isRecord(v) && v.type === 'line') return ordered(v, LINE_LOAD_KEYS, path, ctx);
  return ordered(v, UDL_KEYS, path, ctx);
};

/** Como `orderedWith`, pero sin las claves `keys` cuando valen `null`: los campos de la v0.3 vacíos no se escriben (un `null` es ausente). */
const dropNull =
  (inner: Sub, keys: readonly string[]): Sub =>
  (v, path, ctx) => {
    const out = inner(v, path, ctx);
    if (!isRecord(out)) return out;
    for (const key of keys) if (out[key] === null) delete out[key];
    return out;
  };

const pulloutSub: Sub = (v, path, ctx) => {
  const keys = !isRecord(v)
    ? PULLOUT_BOND_KEYS
    : v.model === 'interface'
      ? PULLOUT_INTERFACE_KEYS
      : v.model === 'development'
        ? PULLOUT_DEVELOPMENT_KEYS
        : PULLOUT_BOND_KEYS;
  return dropNull(orderedWith(keys), ['bonded_length'])(v, path, ctx);
};

const reinforcementSub: Sub = (v, path, ctx) => {
  if (!isRecord(v) || typeof v.type !== 'string' || !REINFORCEMENT_TYPES.includes(v.type)) return plain(v, path, '', ctx);
  const keys = TENSION_TYPES.includes(v.type) ? TENSION_KEYS : v.type === 'pile' ? PILE_KEYS : SHEET_PILE_KEYS;
  const subs: Record<string, Sub> = { pullout: pulloutSub };
  if (v.type === 'pile') {
    subs.lateral_pressure = orderedWith(LATERAL_PRESSURE_KEYS);
    subs.capacity = dropNull(orderedWith(PILE_CAPACITY_KEYS), PILE_CAPACITY_KEYS);
  }
  return dropNull(orderedWith(keys, subs), REINFORCEMENT_OPTIONAL_KEYS)(v, path, ctx);
};

const globalSub: Sub = dropNull(orderedWith(GLOBAL_KEYS), GLOBAL_KEYS);
const nonCircularSub: Sub = dropNull(orderedWith(NON_CIRCULAR_KEYS, { global: globalSub }), NON_CIRCULAR_KEYS);
const searchSub: Sub = dropNull(orderedWith(SEARCH_KEYS, { non_circular: nonCircularSub }), ['non_circular']);

const analysisSub: Sub = (v, path, ctx) => {
  const out = orderedWith(ANALYSIS_KEYS, {
    surface: orderedWith(SURFACE_KEYS),
    search: searchSub,
    seismic: orderedWith(SEISMIC_KEYS),
    interslice: orderedWith(INTERSLICE_KEYS),
    tension_crack: orderedWith(CRACK_KEYS),
  })(v, path, ctx);
  if (isRecord(out) && out.interslice === null) delete out.interslice;
  // Un `null` es ausente (como en el motor): la grieta vacía no se escribe.
  if (isRecord(out) && out.tension_crack === null) delete out.tension_crack;
  return out;
};

const shansepSub: Sub = dropNull(orderedWith(SHANSEP_KEYS), SHANSEP_OPTIONAL_KEYS);
const materialSub: Sub = dropNull(orderedWith(MATERIAL_KEYS, { shansep: shansepSub }), [...MATERIAL_V03_KEYS, ...MATERIAL_V06_KEYS]);

const INTERSLICE_FUNCTIONS: readonly string[] = ['constant', 'half_sine', 'clipped_sine', 'trapezoidal', 'data_points'];

const NEW_METHODS: readonly string[] = ['morgenstern_price', 'janbu_simplified', 'janbu_corrected'];

const present = (v: unknown): boolean => v !== undefined && v !== null;

/** Un campo asociado a una versión del formato: puntero JSON, nombre canónico del motor y etiqueta de la interfaz. */
export interface VersionField {
  path: string;
  field: string;
  what: string;
}

/** Alias compatible con los tests de la v0.3-v0.5. */
export type V03Field = VersionField;

/**
 * Campos de la v0.2 que usa un modelo (F1.1, E12a/E12h): `loads` no vacío y `analysis.seismic`. `loads: []` y `seismic: null`
 * cuentan como ausentes, igual que en el motor.
 */
export function v02Fields(model: unknown): VersionField[] {
  const out: VersionField[] = [];
  if (!isRecord(model)) return out;
  if (Array.isArray(model.loads) && model.loads.length > 0) {
    out.push({ path: '/loads', field: 'loads', what: 'las cargas' });
  }
  if (isRecord(model.analysis) && present(model.analysis.seismic)) {
    out.push({ path: '/analysis/seismic', field: 'analysis.seismic', what: 'el sismo (coeficientes kh y kv)' });
  }
  return out;
}

/**
 * Campos de la v0.3 que usa un modelo, en el orden del motor (`first_v03_field`): material por material (el modelo y luego sus
 * campos), polilínea, métodos y `interslice`. Un `null` cuenta como ausente. Trabaja sobre el JSON sin tipar, así que sirve
 * tanto al abrir un archivo como al guardar.
 */
export function v03Fields(model: unknown): VersionField[] {
  const out: VersionField[] = [];
  if (!isRecord(model)) return out;
  if (Array.isArray(model.materials)) {
    model.materials.forEach((m, i) => {
      if (!isRecord(m)) return;
      const base = `/materials/${i}`;
      const label = `el material ${i + 1}`;
      if (m.model === 'undrained') {
        out.push({ path: `${base}/model`, field: `materials[${i}].model = "undrained"`, what: `${label} con el modelo «No drenado (Su)»` });
      }
      const names: Record<(typeof MATERIAL_V03_KEYS)[number], string> = {
        undrained_strength: 'la resistencia no drenada Su',
        strength_datum: 'la cota de referencia de Su',
        strength_gradient: 'el gradiente de Su',
        strength_limit: 'el límite de Su',
      };
      for (const key of MATERIAL_V03_KEYS) {
        if (present(m[key])) out.push({ path: `${base}/${key}`, field: `materials[${i}].${key}`, what: `${names[key]} de ${label}` });
      }
    });
  }
  const a = model.analysis;
  if (isRecord(a)) {
    if (isRecord(a.surface) && a.surface.type === 'polyline') {
      out.push({ path: '/analysis/surface', field: 'analysis.surface.type = "polyline"', what: 'la superficie fija como polilínea' });
    }
    if (Array.isArray(a.methods)) {
      const names: Record<string, string> = { morgenstern_price: 'Morgenstern-Price', janbu_simplified: 'Janbu simplificado', janbu_corrected: 'Janbu corregido' };
      a.methods.forEach((method, i) => {
        if (typeof method === 'string' && NEW_METHODS.includes(method)) {
          out.push({ path: `/analysis/methods/${i}`, field: `analysis.methods = "${method}"`, what: `el método ${names[method]}` });
        }
      });
    }
    if (present(a.interslice)) out.push({ path: '/analysis/interslice', field: 'analysis.interslice', what: 'la función de fuerzas entre dovelas' });
  }
  return out;
}

/**
 * Campos de la v0.4 que usa un modelo (F4.1): `reinforcements` no vacío. Una lista vacía o `null` cuenta como ausente, como en el
 * motor (`first_v04_field`).
 */
export function v04Fields(model: unknown): VersionField[] {
  if (!isRecord(model) || !Array.isArray(model.reinforcements) || model.reinforcements.length === 0) return [];
  return [{ path: '/reinforcements', field: 'reinforcements', what: 'los refuerzos' }];
}

/**
 * Campos de la v0.5 que usa un modelo (F5.1, E15i-1): `analysis.tension_crack` y, en un `pile`, `lateral_pressure` y `capacity`. Un `null`
 * cuenta como ausente, como en el motor (`first_v05_field`).
 */
export function v05Fields(model: unknown): VersionField[] {
  const out: VersionField[] = [];
  if (isRecord(model) && isRecord(model.analysis) && present(model.analysis.tension_crack)) {
    out.push({ path: '/analysis/tension_crack', field: 'tension_crack', what: 'la grieta de tracción' });
  }
  if (isRecord(model) && Array.isArray(model.reinforcements)) {
    model.reinforcements.forEach((r, i) => {
      if (!isRecord(r) || r.type !== 'pile') return;
      if (present(r.lateral_pressure)) {
        out.push({ path: `/reinforcements/${i}/lateral_pressure`, field: 'lateral_pressure', what: 'la presión del suelo de un pilote (Ito-Matsui)' });
      }
      if (present(r.capacity)) {
        out.push({ path: `/reinforcements/${i}/capacity`, field: 'capacity', what: 'la capacidad de un pilote' });
      }
    });
  }
  return out;
}

/**
 * Campos de la v0.6 que usa un modelo, en el orden exacto de F6.1 (`first_v06_field` de `loads.rs`):
 * 1. material por material: `materials[i].model = "hoek_brown"` o `"shansep"`, y después `ucs`, `gsi`, `mi`, `disturbance` y `shansep`;
 * 2. `analysis.search.non_circular`.
 * Un `null` cuenta como ausente.
 */
export function v06Fields(model: unknown): VersionField[] {
  const out: VersionField[] = [];
  if (!isRecord(model)) return out;
  if (Array.isArray(model.materials)) {
    model.materials.forEach((m, i) => {
      if (!isRecord(m)) return;
      const base = `/materials/${i}`;
      const num = i + 1;
      if (m.model === 'hoek_brown') {
        out.push({
          path: `${base}/model`,
          field: `materials[${i}].model = "hoek_brown"`,
          what: `el material ${num} con el modelo «Hoek-Brown»`,
        });
      } else if (m.model === 'shansep') {
        out.push({
          path: `${base}/model`,
          field: `materials[${i}].model = "shansep"`,
          what: `el material ${num} con el modelo «SHANSEP»`,
        });
      }
      const names: Record<(typeof MATERIAL_V06_KEYS)[number], string> = {
        ucs: 'la resistencia a compresión simple σci',
        gsi: 'el índice GSI',
        mi: 'la constante mi',
        disturbance: 'el factor de perturbación D',
        shansep: 'los parámetros SHANSEP',
      };
      for (const key of MATERIAL_V06_KEYS) {
        if (present(m[key])) {
          out.push({
            path: `${base}/${key}`,
            field: `materials[${i}].${key}`,
            what: `${names[key]} del material ${num}`,
          });
        }
      }
    });
  }
  if (isRecord(model.analysis) && isRecord(model.analysis.search) && present(model.analysis.search.non_circular)) {
    out.push({
      path: '/analysis/search/non_circular',
      field: 'analysis.search.non_circular',
      what: 'la búsqueda no circular',
    });
  }
  return out;
}

/**
 * Campos de la v0.7 que usa un modelo (F7.1, `first_v07_field` del motor): `analysis.search.non_circular.global`.
 * Un `null` cuenta como ausente. `global: {}` también exige 0.7.
 */
export function v07Fields(model: unknown): VersionField[] {
  const out: VersionField[] = [];
  if (!isRecord(model)) return out;
  const search = isRecord(model.analysis) ? model.analysis.search : undefined;
  if (isRecord(search) && isRecord(search.non_circular) && present(search.non_circular.global)) {
    out.push({
      path: '/analysis/search/non_circular/global',
      field: 'analysis.search.non_circular.global',
      what: 'la búsqueda global',
    });
  }
  return out;
}

export interface VersionGate {
  readonly version: OgsVersion;
  readonly fields: (model: unknown) => VersionField[];
}

/**
 * Única tabla «campo → versión mínima» de la web (F3.9, F4.1, F5.1, F6.1, X27 §2.1), en orden creciente de versión
 * y con el mismo orden de campos que el motor (`loads.rs`). La usan `minimalVersion`, `engineModel`, `openOgsJson`,
 * `syncVersion` (`reducer.ts`) y `validateLocal` (`validateLocal.ts`).
 */
export const VERSION_FIELD_TABLE: readonly VersionGate[] = [
  { version: OGS_SAVE_VERSION, fields: v02Fields },
  { version: OGS_V03, fields: v03Fields },
  { version: OGS_V04, fields: v04Fields },
  { version: OGS_V05, fields: v05Fields },
  { version: OGS_V06, fields: v06Fields },
  { version: OGS_V07, fields: v07Fields },
] as const;

/**
 * Versión mínima con la que se guarda el modelo (F3.9, F4.1, F5.1, F6.1): la mayor versión de `VERSION_FIELD_TABLE` cuyos campos
 * estén presentes, con `"0.2"` como piso al guardar. El agua embalsada no tiene campo y no sube la versión.
 */
export function minimalVersion(model: unknown): OgsVersion {
  for (let i = VERSION_FIELD_TABLE.length - 1; i >= 0; i -= 1) {
    const gate = VERSION_FIELD_TABLE[i]!;
    if (gate.version !== OGS_SAVE_VERSION && gate.fields(model).length > 0) return gate.version;
  }
  return OGS_SAVE_VERSION;
}

function canonicalObject(doc: ModelDoc, ctx: Ctx, version: OgsVersion): Rec {
  const out = ordered(doc, TOP_KEYS, '', ctx, {
    meta: orderedWith(META_KEYS),
    materials: listOf(materialSub),
    regions: listOf(orderedWith(REGION_KEYS)),
    water: orderedWith(WATER_KEYS),
    loads: listOf(loadSub),
    reinforcements: listOf(reinforcementSub),
    slope: orderedWith(SLOPE_KEYS),
    analysis: analysisSub,
  }) as Rec;
  // Una lista de refuerzos vacía no se escribe (el motor la omite igual): el archivo vuelve a ser el de la v0.2 o v0.3.
  if (Array.isArray(out.reinforcements) && out.reinforcements.length === 0) delete out.reinforcements;
  // Se reconstruye para fijar el valor de `format` y `version` sin perder la posición de las claves.
  const result: Rec = {};
  for (const key of Object.keys(out)) {
    if (key === 'format') result[key] = OGS_FORMAT;
    else if (key === 'version') result[key] = version;
    else result[key] = out[key];
  }
  if (!('format' in result)) throw new Error('No se puede guardar: el documento no tiene el campo de formato.');
  return result;
}

/** Documento en orden canónico y con la versión mínima (`"0.2"` a `"0.7"`), sin serializar (para borradores y pruebas). Sin redondeo. */
export function canonicalDoc(doc: ModelDoc): ModelDoc {
  const version = minimalVersion(doc);
  const withVersion = { ...doc, format: OGS_FORMAT, version } as ModelDoc;
  return canonicalObject(withVersion, { onUnknown: () => undefined, onNonFinite: throwNonFinite }, version) as unknown as ModelDoc;
}

/** Texto `.ogs.json` canónico: orden de claves de §1, 2 espacios, números sin redondear, versión mínima, salto de línea final. */
export function saveOgsJson(doc: ModelDoc): string {
  return `${JSON.stringify(canonicalDoc(doc), null, 2)}\n`;
}

/**
 * Copia del modelo lista para el motor: sube `version` solo si su contenido exige una mayor en `VERSION_FIELD_TABLE` (un modelo de
 * la v0.1 o v0.2 sin campos nuevos se envía tal cual) y quita `analysis.interslice` cuando `morgenstern_price` no está entre los
 * métodos (el motor lo rechaza: solo tiene sentido con ese método).
 */
export function engineModel(model: ModelDoc): ModelDoc {
  const analysis = { ...model.analysis };
  if (analysis.interslice !== undefined && !(analysis.methods ?? []).includes('morgenstern_price')) delete analysis.interslice;
  const copy: ModelDoc = { ...model, analysis };
  for (let i = VERSION_FIELD_TABLE.length - 1; i >= 0; i -= 1) {
    const gate = VERSION_FIELD_TABLE[i]!;
    if (gate.fields(copy).length > 0) {
      return versionAtLeast(copy.version, gate.version) ? copy : { ...copy, version: gate.version };
    }
  }
  return copy;
}

// ---------------------------------------------------------------------------------------------------------------
// Abrir
// ---------------------------------------------------------------------------------------------------------------

function issue(severity: Issue['severity'], code: string, text: string, path: string | null = null, detail?: string): Issue {
  return detail === undefined ? { source: 'local', severity, code, text, path } : { source: 'local', severity, code, text, path, detail };
}

function isPoint(v: unknown): boolean {
  return Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
}

const isNum = (v: unknown): boolean => typeof v === 'number';
const OPTIONAL_ABSENT = (v: unknown): boolean => v === undefined || v === null;

/**
 * Forma de `reinforcements` (v0.4): lista de objetos con `type` conocido, `id` de texto, números donde van números y las
 * enumeraciones del contrato (F4.2). Los rangos (≥ 0, ángulos, longitudes…) y los ids repetidos los señala `validateLocal`,
 * como con los materiales y las cargas. Un número no finito lo registra `canonicalObject` (`io.non_finite`).
 */
function checkReinforcementsShape(model: Rec, issues: Issue[]): void {
  const list = model.reinforcements;
  if (list === undefined) return;
  const err = (text: string, path: string, detail?: string): void => {
    issues.push(issue('error', 'io.shape', text, path, detail));
  };
  if (!Array.isArray(list)) {
    err('Los refuerzos deben ser una lista (puede estar vacía).', '/reinforcements');
    return;
  }
  list.forEach((r, i) => {
    const base = `/reinforcements/${i}`;
    if (!isRecord(r) || typeof r.type !== 'string' || !REINFORCEMENT_TYPES.includes(r.type)) {
      err(
        `El refuerzo ${i + 1} no tiene un tipo reconocible: debe ser anclaje, clavo, geosintético, pilote o tablestaca.`,
        `${base}`,
        isRecord(r) ? `type = ${JSON.stringify(r.type) ?? 'ausente'}` : undefined,
      );
      return;
    }
    const where = describePath(base);
    const bad = (key: string, what: string): void =>
      err(`En ${where} falta ${what} o no tiene la forma esperada; revise ese dato.`, `${base}/${key}`, `${key} = ${JSON.stringify(r[key]) ?? 'ausente'}`);
    if (typeof r.id !== 'string') bad('id', 'el identificador de texto');
    for (const key of ['x1', 'y1', 'x2', 'y2'] as const) if (!isNum(r[key])) bad(key, `la coordenada ${key}`);
    if (r.application !== 'active' && r.application !== 'passive') bad('application', 'la aplicación («active» o «passive»)');
    const tension = TENSION_TYPES.includes(r.type);
    const directions: readonly string[] = tension ? ['axial', 'tangent', 'bisector'] : ['angle', 'tangent', 'perpendicular'];
    if (typeof r.direction !== 'string' || !directions.includes(r.direction)) bad('direction', `la dirección de la fuerza (${directions.join(', ')})`);
    if (tension) {
      if (!isNum(r.tensile_capacity)) bad('tensile_capacity', 'la capacidad a tracción');
      for (const key of ['end1_capacity', 'end2_capacity', 'spacing'] as const) if (!OPTIONAL_ABSENT(r[key]) && !isNum(r[key])) bad(key, `un número en ${key}`);
      const p = r.pullout;
      if (OPTIONAL_ABSENT(p)) return;
      if (!isRecord(p)) {
        bad('pullout', 'el modelo de arrancamiento como un bloque { … }');
        return;
      }
      const pb = `${base}/pullout`;
      const need = (keys: readonly string[]): void => {
        for (const key of keys) if (!isNum(p[key])) err(`En ${describePath(`${pb}/${key}`)} falta el valor numérico.`, `${pb}/${key}`);
      };
      if (p.model === 'bond') {
        need(['strength']);
        if (!OPTIONAL_ABSENT(p.bonded_length) && !isNum(p.bonded_length)) need(['bonded_length']);
      } else if (p.model === 'interface') need(['adhesion', 'friction_angle', 'coverage']);
      else if (p.model === 'development') need(['length1', 'length2']);
      else err(`El modelo de arrancamiento de ${where} no se reconoce: debe ser adherencia (bond), interfaz (interface) o desarrollo (development).`, `${pb}/model`, `model = ${JSON.stringify(p.model) ?? 'ausente'}`);
    } else {
      // v0.5 (E15i-1): en un `pile`, `force` es opcional si hay `lateral_pressure` (la exclusión de los dos la valida `validateLocal`).
      if (r.type === 'pile') {
        if (OPTIONAL_ABSENT(r.force)) {
          if (OPTIONAL_ABSENT(r.lateral_pressure)) bad('force', 'la fuerza (o la presión del suelo, lateral_pressure)');
        } else if (!isNum(r.force)) bad('force', 'la fuerza');
      } else if (!isNum(r.force)) bad('force', 'la fuerza');
      if (r.type === 'pile' && !OPTIONAL_ABSENT(r.spacing) && !isNum(r.spacing)) bad('spacing', 'un número en spacing');
      if (!OPTIONAL_ABSENT(r.angle) && !isNum(r.angle)) bad('angle', 'un número en el ángulo');
      if (r.type === 'pile') {
        const lp = r.lateral_pressure;
        if (!OPTIONAL_ABSENT(lp)) {
          if (!isRecord(lp)) bad('lateral_pressure', 'la presión del suelo como un bloque { … }');
          else {
            const lb = `${base}/lateral_pressure`;
            if (lp.model !== 'ito_matsui') err(`En ${describePath(`${lb}/model`)} el modelo debe ser «ito_matsui».`, `${lb}/model`, `model = ${JSON.stringify(lp.model) ?? 'ausente'}`);
            if (!isNum(lp.diameter)) err(`En ${describePath(`${lb}/diameter`)} falta el valor numérico.`, `${lb}/diameter`, `diameter = ${JSON.stringify(lp.diameter) ?? 'ausente'}`);
            if (lp.location !== 'centroid' && lp.location !== 'slip_surface') {
              err(`En ${describePath(`${lb}/location`)} falta la ubicación: «centroid» o «slip_surface».`, `${lb}/location`, `location = ${JSON.stringify(lp.location) ?? 'ausente'}`);
            }
          }
        }
        const cap = r.capacity;
        if (!OPTIONAL_ABSENT(cap)) {
          if (!isRecord(cap)) bad('capacity', 'la capacidad como un bloque { shear, moment }');
          else {
            for (const key of ['shear', 'moment'] as const) {
              if (!OPTIONAL_ABSENT(cap[key]) && !isNum(cap[key])) err(`En ${describePath(`${base}/capacity/${key}`)} falta el valor numérico.`, `${base}/capacity/${key}`);
            }
          }
        }
      }
    }
  });
}

function checkShape(model: Rec, issues: Issue[]): void {
  const err = (code: string, text: string, path: string, detail?: string): void => {
    issues.push(issue('error', code, text, path, detail));
  };

  if (!Array.isArray(model.materials)) err('io.shape', 'El archivo no tiene la lista de materiales (o no tiene la forma de una lista).', '/materials');
  else {
    model.materials.forEach((m, i) => {
      if (!isRecord(m) || typeof m.id !== 'string') {
        err('io.shape', `El material ${i + 1} no tiene un identificador de texto (por ejemplo, «arcilla»).`, `/materials/${i}`);
        return;
      }
      if (
        m.model !== undefined &&
        m.model !== 'mohr_coulomb' &&
        m.model !== 'undrained' &&
        m.model !== 'hoek_brown' &&
        m.model !== 'shansep'
      ) {
        err(
          'io.shape',
          `El modelo constitutivo del material ${i + 1} no se reconoce: debe ser «Mohr-Coulomb» (mohr_coulomb), «No drenado (Su)» (undrained), «Hoek-Brown» (hoek_brown) o «SHANSEP» (shansep).`,
          `/materials/${i}/model`,
          `model = ${JSON.stringify(m.model) ?? 'ausente'}`,
        );
      }
      for (const key of MATERIAL_HB_KEYS) {
        if (!OPTIONAL_ABSENT(m[key]) && !isNum(m[key])) {
          err(
            'io.shape',
            `En ${describePath(`/materials/${i}/${key}`)} falta un valor numérico; revise ese dato.`,
            `/materials/${i}/${key}`,
            `${key} = ${JSON.stringify(m[key]) ?? 'ausente'}`,
          );
        }
      }
      if (!OPTIONAL_ABSENT(m.shansep)) {
        const sb = `/materials/${i}/shansep`;
        if (!isRecord(m.shansep)) {
          err('io.shape', `En ${describePath(sb)} los datos deben ser un bloque { … }.`, sb, `shansep = ${JSON.stringify(m.shansep) ?? 'ausente'}`);
        } else {
          const sh = m.shansep;
          if (!isNum(sh.ratio)) {
            err('io.shape', `En ${describePath(`${sb}/ratio`)} falta el valor numérico.`, `${sb}/ratio`, `ratio = ${JSON.stringify(sh.ratio) ?? 'ausente'}`);
          }
          for (const key of ['exponent', 'ocr', 'pop'] as const) {
            if (!OPTIONAL_ABSENT(sh[key]) && !isNum(sh[key])) {
              err('io.shape', `En ${describePath(`${sb}/${key}`)} falta un valor numérico.`, `${sb}/${key}`, `${key} = ${JSON.stringify(sh[key]) ?? 'ausente'}`);
            }
          }
          const isPairOfNumbers = (row: unknown): boolean => Array.isArray(row) && row.length === 2 && isNum(row[0]) && isNum(row[1]);
          if (!OPTIONAL_ABSENT(sh.ocr_by_elevation) && (!Array.isArray(sh.ocr_by_elevation) || !sh.ocr_by_elevation.every(isPairOfNumbers))) {
            err(
              'io.shape',
              `En ${describePath(`${sb}/ocr_by_elevation`)} el perfil debe ser una lista de pares [cota, OCR] numéricos.`,
              `${sb}/ocr_by_elevation`,
            );
          }
        }
      }
    });
  }

  if (!Array.isArray(model.regions)) err('io.shape', 'El archivo no tiene la lista de regiones (o no tiene la forma de una lista).', '/regions');
  else {
    model.regions.forEach((r, i) => {
      if (!isRecord(r) || typeof r.material !== 'string') {
        err('io.shape', `La región ${i + 1} no tiene un material asignado; indique el identificador de uno de los materiales.`, `/regions/${i}`);
        return;
      }
      if (!Array.isArray(r.polygon) || !r.polygon.every(isPoint)) {
        err(
          'io.shape',
          `El contorno de la región ${i + 1} debe ser una lista de puntos [x, y] con números finitos; revise que cada vértice tenga dos números.`,
          `/regions/${i}/polygon`,
        );
      }
    });
  }

  // Como el motor y el esquema (R6-03): si están presentes deben ser objetos; `null` no vale.
  const sectionName = {
    meta: 'Los datos del proyecto no tienen',
    analysis: 'La configuración del análisis no tiene',
    slope: 'El sentido de deslizamiento no tiene',
  } as const;
  for (const key of ['meta', 'analysis', 'slope'] as const) {
    if (model[key] !== undefined && !isRecord(model[key])) {
      err('io.shape', `${sectionName[key]} la forma esperada: debe ser un bloque de datos { … }, no un valor suelto ni «null».`, `/${key}`);
    }
  }
  if (isRecord(model.analysis)) {
    const blockName = {
      surface: 'La superficie fija',
      search: 'La búsqueda de superficies',
      seismic: 'El sismo (coeficientes kh y kv)',
      interslice: 'La función de fuerzas entre dovelas',
      tension_crack: 'La grieta de tracción',
    } as const;
    for (const key of ['surface', 'search', 'seismic', 'interslice', 'tension_crack'] as const) {
      const v = model.analysis[key];
      if (v !== undefined && v !== null && !isRecord(v)) {
        err('io.shape', `${blockName[key]} no tiene la forma esperada: debe ser un bloque de datos { … } o estar vacío (null).`, `/analysis/${key}`);
      }
    }
    // F5.2: `depth` es un número o «auto»; `water_fill` es un número y no tiene valor por defecto. Los rangos son de `validateLocal`.
    const crack = model.analysis.tension_crack;
    if (isRecord(crack)) {
      if (!(typeof crack.depth === 'number' || crack.depth === 'auto')) {
        err(
          'io.shape',
          'La profundidad de la grieta de tracción debe ser un número o «auto» (profundidad automática); indique uno de los dos.',
          '/analysis/tension_crack/depth',
          `depth = ${JSON.stringify(crack.depth) ?? 'ausente'}`,
        );
      }
      if (typeof crack.water_fill !== 'number') {
        err(
          'io.shape',
          'La fracción de agua de la grieta de tracción es obligatoria y debe ser un número de 0 a 1 (0 seca, 1 llena); no tiene valor por defecto.',
          '/analysis/tension_crack/water_fill',
          `water_fill = ${JSON.stringify(crack.water_fill) ?? 'ausente'}`,
        );
      }
    }
    // F6.4: `analysis.search.non_circular` es un objeto opcional con `seeds` y `max_vertices` numéricos opcionales (`{}` es válido).
    const search = model.analysis.search;
    if (isRecord(search) && !OPTIONAL_ABSENT(search.non_circular)) {
      const nb = '/analysis/search/non_circular';
      if (!isRecord(search.non_circular)) {
        err('io.shape', 'La búsqueda no circular no tiene la forma esperada: debe ser un bloque de datos { … } o estar vacío (null).', nb);
      } else {
        for (const key of NON_CIRCULAR_KEYS) {
          if (key === 'global') continue;
          if (!OPTIONAL_ABSENT(search.non_circular[key]) && !isNum(search.non_circular[key])) {
            err(
              'io.shape',
              `En ${describePath(`${nb}/${key}`)} falta un valor numérico.`,
              `${nb}/${key}`,
              `${key} = ${JSON.stringify(search.non_circular[key]) ?? 'ausente'}`,
            );
          }
        }
        // F7.1: `global` es un objeto opcional con `algorithm` (texto), `generated` y `seed` (números) y `polish` (sí/no); `{}` es válido.
        const g = search.non_circular.global;
        const gb = `${nb}/global`;
        if (!OPTIONAL_ABSENT(g)) {
          if (!isRecord(g)) {
            err('io.shape', 'La búsqueda global no tiene la forma esperada: debe ser un bloque de datos { … } o estar vacía (null).', gb);
          } else {
            for (const key of GLOBAL_KEYS) {
              const v = g[key];
              if (OPTIONAL_ABSENT(v)) continue;
              // RCM-B-03: `algorithm` es un enum cerrado (auto, block, annealing), como `interslice.function` y `material.model`: un
              // texto desconocido se rechaza aquí, igual que el motor (serde). Los números fuera de rango siguen abriéndose y los
              // señala `validateLocal`.
              if (key === 'algorithm' && typeof v === 'string' && !isGlobalAlgorithm(v)) {
                err(
                  'io.shape',
                  `En ${describePath(`${gb}/${key}`)} el valor no se reconoce: debe ser automático (auto), bloque (block) o recocido (annealing).`,
                  `${gb}/${key}`,
                  `${key} = ${JSON.stringify(v)}`,
                );
                continue;
              }
              const ok = key === 'algorithm' ? typeof v === 'string' : key === 'polish' ? typeof v === 'boolean' : isNum(v);
              if (!ok) {
                err(
                  'io.shape',
                  `En ${describePath(`${gb}/${key}`)} falta un valor ${key === 'algorithm' ? 'de texto' : key === 'polish' ? 'de sí o no' : 'numérico'}.`,
                  `${gb}/${key}`,
                  `${key} = ${JSON.stringify(v) ?? 'ausente'}`,
                );
              }
            }
          }
        }
      }
    }
  }

  if (isRecord(model.analysis)) {
    const surface = model.analysis.surface;
    if (isRecord(surface) && surface.type === 'polyline' && (!Array.isArray(surface.points) || !surface.points.every(isPoint))) {
      err(
        'io.shape',
        'La polilínea fija debe ser una lista de puntos [x, y] con números finitos; revise que cada punto tenga dos números.',
        '/analysis/surface/points',
      );
    }
    const interslice = model.analysis.interslice;
    if (isRecord(interslice)) {
      if (!INTERSLICE_FUNCTIONS.includes(interslice.function as string)) {
        err(
          'io.shape',
          'La función de fuerzas entre dovelas no se reconoce: debe ser constante, medio seno, seno recortado, trapezoidal o definida por puntos.',
          '/analysis/interslice/function',
          `function = ${JSON.stringify(interslice.function) ?? 'ausente'}`,
        );
      }
      const pts = interslice.points;
      if (pts !== undefined && pts !== null && (!Array.isArray(pts) || !pts.every(isPoint))) {
        err(
          'io.shape',
          'Los puntos de la función entre dovelas deben ser una lista de pares [ξ, f] con números finitos.',
          '/analysis/interslice/points',
        );
      }
    }
  }

  if (model.water !== undefined && model.water !== null) {
    if (!isRecord(model.water)) err('io.shape', 'Los datos de agua no tienen la forma esperada: deben ser un bloque de datos { … }.', '/water');
    else {
      const line = model.water.piezometric_line;
      if (line !== undefined && line !== null && (!Array.isArray(line) || !line.every(isPoint))) {
        err('io.shape', 'La línea piezométrica debe ser una lista de puntos [x, y] con números finitos; revise que cada punto tenga dos números.', '/water/piezometric_line');
      }
    }
  }

  checkReinforcementsShape(model, issues);

  if (model.loads !== undefined) {
    if (!Array.isArray(model.loads)) err('io.shape', 'Las cargas deben ser una lista (puede estar vacía).', '/loads');
    else {
      model.loads.forEach((l, i) => {
        if (!isRecord(l) || (l.type !== 'udl' && l.type !== 'line')) {
          err(
            'io.shape',
            `La carga ${i + 1} no tiene un tipo reconocible: debe ser distribuida o lineal.`,
            `/loads/${i}`,
            isRecord(l) ? `type = ${JSON.stringify(l.type) ?? 'ausente'}` : undefined,
          );
        }
      });
    }
  }
}

/** Nota al abrir un modelo con la piezométrica sobre el terreno (E15l-19). */
export const POND_CHANGED_TEXT =
  'La piezométrica pasa sobre el terreno: desde la v0.4.0 se suma el agua embalsada (peso y empuje), así que el FS puede diferir del calculado con la v0.3.0 o anteriores.';

/** ¿La piezométrica del documento queda sobre el terreno en algún tramo (agua embalsada)? */
function hasPondAboveGround(doc: ModelDoc): boolean {
  try {
    const line = doc.water?.piezometric_line;
    return Array.isArray(line) && line.length >= 2 && pondPolygons(doc.regions, line).length > 0;
  } catch {
    return false;
  }
}

/** Abre el texto de un `.ogs.json` (v0.1, v0.2 o `{model, checks}`). Con `doc: null` el archivo se rechaza. */
export function openOgsJson(text: string): OpenOgsResult {
  const issues: Issue[] = [];
  const reject = (code: string, msg: string, path: string | null = null, detail?: string): OpenOgsResult => {
    issues.push(issue('error', code, msg, path, detail));
    return { doc: null, issues };
  };

  let raw: unknown;
  try {
    raw = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    // UX-13: V8 (Node 22, Chrome reciente) ya no dice «position N»; la posición sale del escáner propio. Si el
    // escáner no encuentra el fallo, se usa el «position N» del motor (versiones antiguas) cuando exista.
    const offset = jsonErrorOffset(body) ?? (/position (\d+)/.exec(detail)?.[1] ?? null);
    const at = offset === null ? null : lineColumn(body, Number(offset));
    const where = at ? ` (línea ${at.line}, columna ${at.column})` : '';
    const empty = text.trim() === '';
    return reject(
      'io.invalid_json',
      empty
        ? 'El archivo está vacío: abra un archivo .ogs.json guardado con OpenGeoSlide.'
        : `El archivo no es un JSON válido${where}. Revise que no falte ni sobre alguna coma, llave o comilla cerca de ese punto, y que el archivo no esté truncado.`,
      null,
      detail,
    );
  }
  if (!isRecord(raw)) {
    return reject('io.shape', 'El archivo no tiene la forma esperada: debe ser un modelo OpenGeoSlide { … }, no una lista ni un valor suelto.');
  }

  let model: Rec = raw;
  if (!('format' in raw) && isRecord(raw.model)) {
    model = raw.model;
    if ('checks' in raw) {
      issues.push(
        issue(
          'aviso',
          'io.checks_discarded',
          'El archivo es un caso de verificación: se abre solo el modelo y se descartan los valores de referencia y las comprobaciones que incluye.',
        ),
      );
    }
  }

  if (model.format !== OGS_FORMAT) {
    const found = model.format === undefined ? 'no tiene marca de formato' : `declara el formato ${JSON.stringify(model.format)}`;
    return reject(
      'io.format',
      `No es un archivo OpenGeoSlide: ${found} en lugar de "${OGS_FORMAT}". Abra un archivo .ogs.json guardado con esta aplicación.`,
      '/format',
      `format = ${JSON.stringify(model.format) ?? 'ausente'}`,
    );
  }
  if (!isKnownOgsVersion(model.version)) {
    const shown = typeof model.version === 'string' ? `la versión "${model.version}"` : 'ninguna versión';
    return reject(
      'io.version',
      `El archivo declara ${shown} del formato, y esta aplicación solo abre las versiones 0.1, 0.2, 0.3, 0.4, 0.5, 0.6 y 0.7. Guárdelo de nuevo con una versión compatible.`,
      '/version',
      `version = ${JSON.stringify(model.version) ?? 'ausente'}`,
    );
  }

  checkShape(model, issues);
  if (issues.some((i) => i.severity === 'error')) return { doc: null, issues };

  // Compuertas de versión a partir de la tabla única `VERSION_FIELD_TABLE` (E12a/E12h, E13a, E14a, E15a, E16a):
  // las puertas anteriores quedan abiertas a 0.7; las de 0.6 y 0.7 emiten el mensaje exacto del motor (`<campo> requiere version "0.6"`).
  for (const gate of VERSION_FIELD_TABLE) {
    if (versionAtLeast(model.version, gate.version)) continue;
    for (const { path, field, what } of gate.fields(model)) {
      const msg =
        gate.version === OGS_V07 || gate.version === OGS_V06
          ? `${field} requiere version "${gate.version}"`
          : gate.version === OGS_SAVE_VERSION
            ? path === '/loads'
              ? 'El archivo declara el formato 0.1, que no admite cargas. Cambie la versión del archivo a "0.2" o quite las cargas.'
              : 'El archivo declara el formato 0.1, que no admite el sismo (coeficientes kh y kv). Cambie la versión del archivo a "0.2" o quite el sismo.'
            : `El archivo declara el formato ${model.version}, que no admite ${what}. Cambie la versión del archivo a "${gate.version}" o quite ese dato.`;
      issues.push(issue('error', 'io.version_fields', msg, path));
    }
  }

  const version = minimalVersion(model);
  const input: Rec = { ...model, version };
  if (input.meta === undefined) input.meta = {};
  if (input.analysis === undefined) input.analysis = {};

  const unknown: { parent: string; key: string }[] = [];
  const nonFinite: string[] = [];
  const canonical = canonicalObject(
    input as unknown as ModelDoc,
    {
      onUnknown: (parent, key) => unknown.push({ parent, key }),
      onNonFinite: (path) => nonFinite.push(path),
    },
    version,
  );
  for (const { parent, key } of unknown) {
    issues.push(
      issue(
        'error',
        'io.unknown_field',
        `Hay un dato que esta versión no reconoce: «${key}», en ${describePath(parent)}. Quítelo del archivo (puede ser un error de escritura o un campo de otra versión).`,
        `${parent}/${key}`,
        `campo desconocido ${parent}/${key}`,
      ),
    );
  }
  for (const path of nonFinite) {
    issues.push(
      issue(
        'error',
        'io.non_finite',
        `En ${describePath(path)} hay un valor que no es un número finito (por ejemplo, un exponente demasiado grande como 1e400). Escriba un valor corriente.`,
        path,
      ),
    );
  }
  if (issues.some((i) => i.severity === 'error')) return { doc: null, issues };

  // E15l-19 (R12 B-10): la piezométrica sobre el terreno suma el agua embalsada (peso y empuje) desde la v0.4.0, en cualquier versión del
  // archivo: el FS puede diferir del que dio la v0.3.0. Por eso el aviso de actualización de v0.1 no puede decir que el cálculo no cambia.
  const doc = canonical as unknown as ModelDoc;
  const pond = hasPondAboveGround(doc);
  if (model.version === '0.1') {
    issues.push(
      issue(
        'nota',
        'io.version_upgraded',
        pond
          ? 'El archivo usa el formato 0.1; al guardarlo se actualizará al 0.2.'
          : 'El archivo usa el formato 0.1; al guardarlo se actualizará al 0.2 (el resultado del cálculo no cambia).',
      ),
    );
  }
  if (pond) issues.push(issue('nota', 'io.pond_changed', POND_CHANGED_TEXT));
  return { doc, issues };
}

// ---------------------------------------------------------------------------------------------------------------
// SHA-256
// ---------------------------------------------------------------------------------------------------------------

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be,
  0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa,
  0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85,
  0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
  0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** SHA-256 en JS puro, solo como respaldo cuando `crypto.subtle` no existe (contexto no seguro). */
export function sha256Bytes(data: Uint8Array): Uint8Array {
  const len = data.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(data);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor((len * 8) / 0x100000000));
  view.setUint32(padded.length - 4, (len * 8) >>> 0);

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15] as number;
      const b = w[i - 2] as number;
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      w[i] = ((w[i - 16] as number) + s0 + (w[i - 7] as number) + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h as unknown as [number, number, number, number, number, number, number, number];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + (K[i] as number) + (w[i] as number)) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    const next = [a, b, c, d, e, f, g, hh];
    for (let i = 0; i < 8; i++) h[i] = ((h[i] as number) + (next[i] as number)) >>> 0;
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, h[i] as number);
  return out;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 (hexadecimal en minúsculas) del texto en UTF-8. Usa `crypto.subtle`; sin él, un respaldo en JS. */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  if (subtle) {
    return toHex(new Uint8Array(await subtle.digest('SHA-256', bytes)));
  }
  return toHex(sha256Bytes(bytes));
}
