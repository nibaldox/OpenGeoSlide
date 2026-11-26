// Importación y exportación CSV con papaparse 5.7.1 (X3 §2.8).
//
// Importación: cabecera obligatoria, delimitador automático (`,`, `;`, tabulación), BOM fuera, cabeceras en
// minúsculas. La coma decimal solo se acepta cuando el delimitador NO es la coma (R11).
// Exportación: los textos que empiezan por `= + - @` (o tabulación / retorno) llevan un `'` delante (R10).

import { parse, unparse } from 'papaparse';
import { isPolylineReport, reportCircle } from '../engine/surface';
import { analyzedPolyline, methodDetails } from '../report/methodInfo';
import type { ForceRecord } from '../report/reinforcementReport';
import type { MethodReport, Point } from '../engine/types';
import { isImperialUnits } from '../editor/state/units';
import type { ModelDoc } from '../editor/types';
import type { CsvImportResult, ImportIssue } from './types';

const TEXT_COLUMNS = new Set(['capa', 'layer', 'material', 'nombre', 'name', 'id']);
const DECIMAL_COMMA = /^[-+]?\d+,\d+$/;
const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

/** Tamaño máximo de un CSV importado: 2 MB en UTF-8, igual que el DXF (R5-06). */
export const CSV_MAX_BYTES = 2 * 1024 * 1024;

/** Importa un CSV. `rows` trae las cadenas ya normalizadas (coma decimal → punto cuando corresponde). */
export function parseCsv(text: string): CsvImportResult {
  const issues: ImportIssue[] = [];
  // Cada unidad UTF-16 ocupa al menos 1 byte en UTF-8: pasado el límite en unidades, ya no hace falta codificar.
  if (text.length > CSV_MAX_BYTES || new TextEncoder().encode(text).length > CSV_MAX_BYTES) {
    issues.push({ severity: 'error', text: 'El archivo CSV supera el límite de 2 MB.' });
    return { ok: false, delimiter: '', rows: [], issues };
  }
  const parsed = parse<Record<string, string>>(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text, {
    header: true,
    skipEmptyLines: true,
    delimitersToGuess: [',', ';', '\t'],
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const delimiter = parsed.meta.delimiter;

  for (const e of parsed.errors) {
    const row = e.row === undefined ? undefined : e.row + 1; // fila de datos, desde 1
    if (e.type === 'Delimiter') {
      issues.push({ severity: 'aviso', text: `No se pudo detectar el delimitador; se usa «${delimiter}».` });
      continue;
    }
    const where = row === undefined ? '' : ` (fila de datos ${row})`;
    issues.push({
      severity: 'error',
      ...(row === undefined ? {} : { line: row + 1 }),
      text: `${e.type === 'FieldMismatch' ? 'Número de columnas incorrecto' : e.message}${where}.`,
    });
  }

  const decimalComma = delimiter !== ',';
  const rows = parsed.data.map((raw) => {
    const row: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      const v = typeof value === 'string' ? value.trim() : '';
      row[key] = decimalComma && !TEXT_COLUMNS.has(key) && DECIMAL_COMMA.test(v) ? v.replace(',', '.') : v;
    }
    return row;
  });

  if (rows.length === 0) {
    issues.push({ severity: 'error', text: 'El archivo CSV no tiene filas de datos.' });
  }
  return { ok: !issues.some((i) => i.severity === 'error'), delimiter, rows, issues };
}

function toNumber(s: string | undefined): number | null {
  if (s === undefined) return null;
  const v = s.trim();
  if (!NUMBER.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function readPoint(row: Record<string, string>, index: number, issues: ImportIssue[]): Point | null {
  const x = toNumber(row.x);
  const y = toNumber(row.y);
  if (x === null || y === null) {
    issues.push({
      severity: 'error',
      line: index + 2,
      text: `Fila de datos ${index + 1}: x e y deben ser números (recibido x «${row.x ?? ''}», y «${row.y ?? ''}»).`,
    });
    return null;
  }
  return [x, y];
}

function missingColumns(result: CsvImportResult, required: string[], issues: ImportIssue[]): boolean {
  const first = result.rows[0];
  if (!first) return true;
  const missing = required.filter((c) => !(c in first));
  if (missing.length > 0) {
    issues.push({ severity: 'error', text: `Falta la columna ${missing.map((m) => `«${m}»`).join(' y ')} en la cabecera.` });
    return true;
  }
  return false;
}

/** Texto de un número con coma decimal, para los mensajes. */
const shown = (n: number): string => String(n).replace('.', ',');

/**
 * Formato `x,y` de la línea piezométrica: debe tener x estrictamente creciente (la misma regla que aplica el motor).
 * Si no, es un error y no se devuelve ningún punto (UX-07).
 */
export function csvToPoints(result: CsvImportResult): { points: Point[]; issues: ImportIssue[] } {
  const issues: ImportIssue[] = [];
  if (!result.ok || missingColumns(result, ['x', 'y'], issues)) return { points: [], issues };
  const points: Point[] = [];
  result.rows.forEach((row, i) => {
    const p = readPoint(row, i, issues);
    if (p) points.push(p);
  });
  if (issues.length > 0) return { points: [], issues };
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1] as Point;
    const cur = points[i] as Point;
    if (!(cur[0] > prev[0])) {
      issues.push({
        severity: 'error',
        line: i + 2,
        text: `La línea piezométrica necesita x estrictamente creciente: en la fila de datos ${i + 1}, x = ${shown(cur[0])} no es mayor que la anterior (${shown(prev[0])}). Ordene o corrija las filas del archivo.`,
      });
      return { points: [], issues };
    }
  }
  return { points, issues };
}

/**
 * Formato `capa,x,y` (una fila por vértice; también se acepta `layer`). Cada tramo de filas consecutivas con la misma
 * capa es un polígono; si repite el primer vértice al final, el cierre se quita. La UI mapea la capa a un material.
 */
export function csvToRegions(result: CsvImportResult): { regions: { layer: string; polygon: Point[] }[]; issues: ImportIssue[] } {
  const issues: ImportIssue[] = [];
  const first = result.rows[0];
  if (!result.ok || !first) return { regions: [], issues };
  const layerKey = 'capa' in first ? 'capa' : 'layer' in first ? 'layer' : null;
  if (layerKey === null) {
    issues.push({ severity: 'error', text: 'Falta la columna «capa» en la cabecera.' });
    return { regions: [], issues };
  }
  if (missingColumns(result, ['x', 'y'], issues)) return { regions: [], issues };

  const regions: { layer: string; polygon: Point[] }[] = [];
  result.rows.forEach((row, i) => {
    const p = readPoint(row, i, issues);
    if (!p) return;
    const layer = row[layerKey] ?? '';
    if (layer === '') {
      issues.push({ severity: 'error', line: i + 2, text: `Fila de datos ${i + 1}: la capa está vacía.` });
      return;
    }
    const last = regions[regions.length - 1];
    if (last && last.layer === layer) last.polygon.push(p);
    else regions.push({ layer, polygon: [p] });
  });
  if (issues.length > 0) return { regions: [], issues };

  for (const r of regions) {
    const a = r.polygon[0];
    const b = r.polygon[r.polygon.length - 1];
    if (r.polygon.length > 3 && a && b && a[0] === b[0] && a[1] === b[1]) r.polygon.pop();
    if (r.polygon.length < 3) {
      issues.push({ severity: 'aviso', text: `La capa «${r.layer}» tiene menos de 3 vértices en un tramo y no forma una región.` });
    }
  }
  return {
    regions: regions.filter((r) => r.polygon.length >= 3),
    issues,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Exportación
// ---------------------------------------------------------------------------------------------------------------

export type CsvCell = string | number | null | undefined;

/** Protege un texto contra la inyección de fórmulas en hojas de cálculo (prefijo `'`). */
export function escapeCsvText(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export interface ToCsvOptions {
  delimiter?: ',' | ';' | '\t';
  /** Coma decimal en los números; solo con delimitador distinto de la coma. */
  decimalComma?: boolean;
  /** Línea de comentario (`# …`) antes de la cabecera. */
  comment?: string;
}

/** Unidades con que se declaran los CSV de resultados (B-04). Sin sistema indicado, SI (igual que el modelo). */
export interface CsvUnits {
  system: 'SI' | 'imperial';
  /** Longitud: `m` o `ft`. */
  length: string;
  /** Peso unitario. */
  unitWeight: string;
  /** Tensión y presión. */
  stress: string;
  /**
   * Texto de la columna `unidades` de cada fila (`SI` o `imperial`). R9-07: ya no hay línea de comentario `#` (sus comas partían la
   * primera fila en Excel y `pandas.read_csv` fallaba); el CSV es RFC 4180 puro y se lee sin opciones.
   */
  label: string;
  /** Descripción legible de las unidades (para la interfaz, no para el CSV). */
  description: string;
}

export function csvUnits(units: string | null | undefined): CsvUnits {
  return isImperialUnits(units)
    ? { system: 'imperial', length: 'ft', unitWeight: 'pcf', stress: 'psf', label: 'imperial', description: 'imperial (ft, pcf, psf)' }
    : { system: 'SI', length: 'm', unitWeight: 'kN/m³', stress: 'kPa', label: 'SI', description: 'SI (m, kN/m³, kPa)' };
}

function formatNumber(n: number, comma: boolean): string {
  if (!Number.isFinite(n)) return '';
  const s = String(n); // representación de ida y vuelta más corta de JS: sin redondeo (E12g)
  return comma ? s.replace('.', ',') : s;
}

/** Tabla → texto CSV. Los números se escriben tal cual; los textos se protegen contra fórmulas. */
export function toCsv(header: string[], rows: CsvCell[][], options: ToCsvOptions = {}): string {
  const delimiter = options.delimiter ?? ',';
  const comma = (options.decimalComma ?? false) && delimiter !== ',';
  const data = rows.map((r) =>
    r.map((c) => {
      if (c === null || c === undefined) return '';
      if (typeof c === 'number') return formatNumber(c, comma);
      return escapeCsvText(c);
    }),
  );
  const body = unparse({ fields: header.map(escapeCsvText), data }, { delimiter, newline: '\r\n', escapeFormulae: false });
  return options.comment === undefined ? body : `${options.comment}\r\n${body}`;
}

/** Coordenadas de las regiones: `capa,x,y` con el id del material como capa. */
export function modelToCsv(doc: ModelDoc, options: ToCsvOptions = {}): string {
  const rows: CsvCell[][] = [];
  for (const region of doc.regions) {
    for (const [x, y] of region.polygon) rows.push([region.material, x, y]);
  }
  return toCsv(['capa', 'x', 'y'], rows, options);
}

/** Piezométrica: `x,y`. */
export function piezoToCsv(doc: ModelDoc, options: ToCsvOptions = {}): string {
  const rows: CsvCell[][] = (doc.water?.piezometric_line ?? []).map(([x, y]) => [x, y]);
  return toCsv(['x', 'y'], rows, options);
}

/** Separador de los códigos de aviso dentro de la celda `avisos` (no es un delimitador CSV). */
export const WARNING_SEPARATOR = '|';

export interface ResultsCsvOptions extends ToCsvOptions {
  /** `doc.units` del modelo calculado (`'SI'`, `'imperial'` o ausente = SI). */
  units?: string | null;
}

/** Separador entre los pares (ξ; f) de la celda `puntos_interslice` y entre ξ y f (no son delimitadores CSV). */
export const INTERSLICE_PAIR_SEPARATOR = '|';

/** `ξ:f|ξ:f|…` de la función `data_points` de un resultado; `null` si no la usa o no trae los puntos. */
function intersliceCell(r: MethodReport, comma: boolean): string | null {
  const spec = r.interslice;
  if (!spec || spec.function !== 'data_points' || !spec.points || spec.points.length === 0) return null;
  return spec.points.map(([xi, f]) => `${formatNumber(xi, comma)}:${formatNumber(f, comma)}`).join(INTERSLICE_PAIR_SEPARATOR);
}

/**
 * Tabla de FS por método. El FS y `lambda` solo se escriben si el método convergió; `avisos` lleva los códigos del
 * motor separados por `|` (el texto pasa por `toCsv`, que protege contra fórmulas). Las columnas con dimensión llevan
 * la unidad en la cabecera (`xc_m`, `yc_ft`…) y la columna `unidades` (`SI` o `imperial`) repite el sistema en cada fila (B-04, R9-07).
 */
export function resultsToCsv(results: MethodReport[], options: ResultsCsvOptions = {}): string {
  const u = csvUnits(options.units);
  // Columnas que solo existen cuando algún método las necesita: así el CSV de un modelo sin polilínea ni M-P ni Janbu corregido no cambia.
  const withSurface = results.some((r) => isPolylineReport(r.surface));
  const withFunction = results.some((r) => r.interslice !== undefined);
  const withF0 = results.some((r) => methodDetails(r).f0 !== undefined);
  // R10B-07: con `data_points` la función son sus pares (ξ; f); sin ellos el CSV no identifica la f(ξ) usada.
  const withPoints = results.some((r) => intersliceCell(r, false) !== null);
  const decimalComma = (options.decimalComma ?? false) && (options.delimiter ?? ',') !== ',';
  const rows: CsvCell[][] = results.map((r) => {
    const circle = reportCircle(r.surface);
    return [
      r.method,
      r.status,
      r.status === 'converged' ? r.fos : null,
      r.iterations,
      r.status === 'converged' ? r.lambda : null,
      // Una polilínea no tiene centro ni radio: celdas vacías (sus puntos van en el CSV de la superficie).
      circle?.xc ?? null,
      circle?.yc ?? null,
      circle?.r ?? null,
      r.search?.evaluated ?? null,
      r.search?.valid ?? null,
      r.warnings.join(WARNING_SEPARATOR),
      u.label,
      ...(withSurface ? [isPolylineReport(r.surface) ? 'polilinea' : 'circulo'] : []),
      ...(withFunction ? [r.interslice?.function ?? null] : []),
      ...(withPoints ? [intersliceCell(r, decimalComma)] : []),
      ...(withF0 ? [methodDetails(r).f0 ?? null] : []),
    ];
  });
  const header = [
    'metodo',
    'estado',
    'fs',
    'iteraciones',
    'lambda',
    `xc_${u.length}`,
    `yc_${u.length}`,
    `r_${u.length}`,
    'evaluadas',
    'validas',
    'avisos',
    'unidades',
    ...(withSurface ? ['superficie'] : []),
    ...(withFunction ? ['funcion_interslice'] : []),
    ...(withPoints ? ['puntos_interslice'] : []),
    ...(withF0 ? ['f0'] : []),
  ];
  return toCsv(header, rows, options);
}

/**
 * Filas `[método, estado, n, x, y]` de una superficie **polilínea**: un punto del informe por fila (la polilínea ajustada al terreno,
 * sin redondear). Vacío con un círculo, cuya superficie se exporta con los puntos de la base de las dovelas.
 */
export function polylineSurfaceRows(r: MethodReport): CsvCell[][] {
  if (!isPolylineReport(r.surface)) return [];
  return (analyzedPolyline(r) ?? []).map(([x, y], i) => [r.method, r.status, i + 1, x, y]);
}

/**
 * Puntos de la base de las dovelas por método: `metodo,estado,punto,x_<unidad>,y_<unidad>,unidades`.
 * Es el CSV de **resultados** (superficie crítica), distinto del CSV de geometría que se importa (`capa,x,y`).
 */
export function surfaceToCsv(rows: CsvCell[][], options: ResultsCsvOptions = {}): string {
  const u = csvUnits(options.units);
  return toCsv(['metodo', 'estado', 'punto', `x_${u.length}`, `y_${u.length}`, 'unidades'], rows.map((r) => [...r, u.label]), options);
}

/**
 * Tabla de fuerzas de los refuerzos por cruce (F4.9, E14m-4): `metodo,id,tipo,cruce,x_m,y_m,estacion_m,disponible_<fuerza>,fx_<fuerza>,fy_<fuerza>,aplicacion,estado,unidades`.
 * `cruce` empieza en 1; `tipo`, `aplicacion` y `estado` llevan el valor del formato (`anchor`, `active`, `applied`…), como `metodo` y `estado` de los
 * demás CSV; `fx` y `fy` son la fuerza aplicada por metro de talud, en coordenadas del modelo, y en una pasiva la disponible antes de dividir por F.
 */
export function reinforcementForcesToCsv(records: readonly ForceRecord[], options: ResultsCsvOptions = {}): string {
  const u = csvUnits(options.units);
  const line = u.system === 'imperial' ? 'lbf_ft' : 'kn_m';
  const rows: CsvCell[][] = records.map((r) => [r.method, r.id, r.type, r.crossing, r.x, r.y, r.station, r.available, r.fx, r.fy, r.application, r.status, u.label]);
  return toCsv(['metodo', 'id', 'tipo', 'cruce', `x_${u.length}`, `y_${u.length}`, `estacion_${u.length}`, `disponible_${line}`, `fx_${line}`, `fy_${line}`, 'aplicacion', 'estado', 'unidades'], rows, options);
}
