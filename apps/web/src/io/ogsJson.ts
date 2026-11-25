// Abrir y guardar `.ogs.json` (X3 §2.6, F1.1, F1.4).
//
// - `openOgsJson` acepta v0.1 y v0.2 (y `{model, checks}`), valida la forma y devuelve un `ModelDoc` v0.2.
// - `saveOgsJson` escribe siempre `version: "0.2"`, con el orden de claves canónico de 00_CONTRATOS.md §1
//   (`loads` después de `water`, `analysis.seismic` al final de `analysis`) y 2 espacios. Los números se escriben
//   **sin redondear**, con la representación de ida y vuelta más corta de JS (E12g): abrir y guardar no cambia el
//   resultado del motor ni un bit.
// - `openOgsJson` es estricto, igual que el motor (`deny_unknown_fields`, E12h): un campo desconocido, o `loads` o
//   `analysis.seismic` en un archivo v0.1, es un error con su puntero JSON, no un aviso.

import type { Issue, ModelDoc } from '../editor/types';

export const OGS_FORMAT = 'opengeoslide';
export const OGS_SAVE_VERSION = '0.2';

export interface OpenOgsResult {
  /** `null` si el archivo se rechaza (hay al menos una incidencia con severidad `error`). */
  doc: ModelDoc | null;
  issues: Issue[];
}

// ---------------------------------------------------------------------------------------------------------------
// Orden canónico de claves
// ---------------------------------------------------------------------------------------------------------------

const TOP_KEYS = ['format', 'version', 'meta', 'units', 'materials', 'regions', 'water', 'loads', 'slope', 'analysis'] as const;
const META_KEYS = ['id', 'title', 'notes'] as const;
const MATERIAL_KEYS = ['id', 'name', 'model', 'unit_weight', 'unit_weight_sat', 'cohesion', 'friction_angle', 'ru'] as const;
const REGION_KEYS = ['material', 'polygon'] as const;
const WATER_KEYS = ['unit_weight', 'piezometric_line'] as const;
const UDL_KEYS = ['type', 'id', 'x1', 'x2', 'q'] as const;
const LINE_LOAD_KEYS = ['type', 'id', 'x', 'p', 'angle'] as const;
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
] as const;
const SURFACE_KEYS = ['type', 'xc', 'yc', 'r'] as const;
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
] as const;
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
      return b === undefined ? 'la lista de materiales' : c === undefined ? `el material ${n(b)}` : `el material ${n(b)} (${field(c)})`;
    case 'regions':
      if (b === undefined) return 'la lista de regiones';
      if (c === 'polygon' && d !== undefined) return `la región ${n(b)}, vértice ${n(d)}`;
      return c === undefined ? `la región ${n(b)}` : `la región ${n(b)} (${field(c)})`;
    case 'water':
      if (b === 'piezometric_line' && c !== undefined) return `la línea piezométrica, punto ${n(c)}`;
      return b === undefined ? 'los datos de agua' : `los datos de agua (${field(b)})`;
    case 'loads':
      return b === undefined ? 'la lista de cargas' : c === undefined ? `la carga ${n(b)}` : `la carga ${n(b)} (${field(c)})`;
    case 'analysis': {
      const section: Record<string, string> = { surface: 'la superficie fija', search: 'la búsqueda', seismic: 'el sismo' };
      if (b === undefined) return 'la configuración del análisis';
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
  const column = offset - Math.max(before.lastIndexOf('\n'), before.lastIndexOf('\r')) ;
  return { line, column };
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

const analysisSub = orderedWith(ANALYSIS_KEYS, {
  surface: orderedWith(SURFACE_KEYS),
  search: orderedWith(SEARCH_KEYS),
  seismic: orderedWith(SEISMIC_KEYS),
});

function canonicalObject(doc: ModelDoc, ctx: Ctx): Rec {
  const out = ordered(doc, TOP_KEYS, '', ctx, {
    meta: orderedWith(META_KEYS),
    materials: listOf(orderedWith(MATERIAL_KEYS)),
    regions: listOf(orderedWith(REGION_KEYS)),
    water: orderedWith(WATER_KEYS),
    loads: listOf(loadSub),
    slope: orderedWith(SLOPE_KEYS),
    analysis: analysisSub,
  }) as Rec;
  // Se reconstruye para fijar el valor de `format` y `version` sin perder la posición de las claves.
  const result: Rec = {};
  for (const key of Object.keys(out)) {
    if (key === 'format') result[key] = OGS_FORMAT;
    else if (key === 'version') result[key] = OGS_SAVE_VERSION;
    else result[key] = out[key];
  }
  if (!('format' in result)) throw new Error('No se puede guardar: el documento no tiene el campo de formato.');
  return result;
}

/** Documento en orden canónico y con `version: "0.2"`, sin serializar (para borradores y pruebas). Sin redondeo. */
export function canonicalDoc(doc: ModelDoc): ModelDoc {
  const withVersion = { ...doc, format: OGS_FORMAT, version: OGS_SAVE_VERSION } as ModelDoc;
  return canonicalObject(withVersion, { onUnknown: () => undefined, onNonFinite: throwNonFinite }) as unknown as ModelDoc;
}

/** Texto `.ogs.json` canónico: orden de claves de §1, 2 espacios, números sin redondear, `version: "0.2"`, salto de línea final. */
export function saveOgsJson(doc: ModelDoc): string {
  return `${JSON.stringify(canonicalDoc(doc), null, 2)}\n`;
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

function checkShape(model: Rec, issues: Issue[]): void {
  const err = (code: string, text: string, path: string, detail?: string): void => {
    issues.push(issue('error', code, text, path, detail));
  };

  if (!Array.isArray(model.materials)) err('io.shape', 'El archivo no tiene la lista de materiales (o no tiene la forma de una lista).', '/materials');
  else {
    model.materials.forEach((m, i) => {
      if (!isRecord(m) || typeof m.id !== 'string') {
        err('io.shape', `El material ${i + 1} no tiene un identificador de texto (por ejemplo, «arcilla»).`, `/materials/${i}`);
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
    const blockName = { surface: 'La superficie fija', search: 'La búsqueda de superficies', seismic: 'El sismo (coeficientes kh y kv)' } as const;
    for (const key of ['surface', 'search', 'seismic'] as const) {
      const v = model.analysis[key];
      if (v !== undefined && v !== null && !isRecord(v)) {
        err('io.shape', `${blockName[key]} no tiene la forma esperada: debe ser un bloque de datos { … } o estar vacío (null).`, `/analysis/${key}`);
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
    const pos = /position (\d+)/.exec(detail);
    const at = pos ? lineColumn(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text, Number(pos[1])) : null;
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
  if (model.version !== '0.1' && model.version !== '0.2') {
    const shown = typeof model.version === 'string' ? `la versión "${model.version}"` : 'ninguna versión';
    return reject(
      'io.version',
      `El archivo declara ${shown} del formato, y esta aplicación solo abre las versiones 0.1 y 0.2. Guárdelo de nuevo con una versión compatible.`,
      '/version',
      `version = ${JSON.stringify(model.version) ?? 'ausente'}`,
    );
  }

  checkShape(model, issues);
  if (issues.some((i) => i.severity === 'error')) return { doc: null, issues };

  // Como el motor (E12a/E12h): `loads: []` y `seismic: null` cuentan como ausentes; con datos, exigen v0.2.
  const hasLoads = Array.isArray(model.loads) && model.loads.length > 0;
  const hasSeismic = isRecord(model.analysis) && model.analysis.seismic !== undefined && model.analysis.seismic !== null;
  if (model.version === '0.1') {
    if (hasLoads) {
      issues.push(
        issue(
          'error',
          'io.version_fields',
          'El archivo declara el formato 0.1, que no admite cargas. Cambie la versión del archivo a "0.2" o quite las cargas.',
          '/loads',
        ),
      );
    }
    if (hasSeismic) {
      issues.push(
        issue(
          'error',
          'io.version_fields',
          'El archivo declara el formato 0.1, que no admite el sismo (coeficientes kh y kv). Cambie la versión del archivo a "0.2" o quite el sismo.',
          '/analysis/seismic',
        ),
      );
    }
  }

  const input: Rec = { ...model, version: OGS_SAVE_VERSION };
  if (input.meta === undefined) input.meta = {};
  if (input.analysis === undefined) input.analysis = {};

  const unknown: { parent: string; key: string }[] = [];
  const nonFinite: string[] = [];
  const canonical = canonicalObject(input as unknown as ModelDoc, {
    onUnknown: (parent, key) => unknown.push({ parent, key }),
    onNonFinite: (path) => nonFinite.push(path),
  });
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

  if (model.version === '0.1') {
    issues.push(issue('nota', 'io.version_upgraded', 'El archivo usa el formato 0.1; al guardarlo se actualizará al 0.2 (el resultado del cálculo no cambia).'));
  }
  return { doc: canonical as unknown as ModelDoc, issues };
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
