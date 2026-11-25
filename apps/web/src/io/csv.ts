// Importación y exportación CSV con papaparse 5.7.1 (X3 §2.8).
//
// Importación: cabecera obligatoria, delimitador automático (`,`, `;`, tabulación), BOM fuera, cabeceras en
// minúsculas. La coma decimal solo se acepta cuando el delimitador NO es la coma (R11).
// Exportación: los textos que empiezan por `= + - @` (o tabulación / retorno) llevan un `'` delante (R10).

import { parse, unparse } from 'papaparse';
import type { MethodReport, Point } from '../engine/types';
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
  return unparse({ fields: header.map(escapeCsvText), data }, { delimiter, newline: '\r\n', escapeFormulae: false });
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

/**
 * Tabla de FS por método. El FS y `lambda` solo se escriben si el método convergió; `avisos` lleva los códigos del
 * motor separados por `|` (el texto pasa por `toCsv`, que protege contra fórmulas).
 */
export function resultsToCsv(results: MethodReport[], options: ToCsvOptions = {}): string {
  const rows: CsvCell[][] = results.map((r) => [
    r.method,
    r.status,
    r.status === 'converged' ? r.fos : null,
    r.iterations,
    r.status === 'converged' ? r.lambda : null,
    r.surface.xc,
    r.surface.yc,
    r.surface.r,
    r.search?.evaluated ?? null,
    r.search?.valid ?? null,
    r.warnings.join(WARNING_SEPARATOR),
  ]);
  return toCsv(['metodo', 'estado', 'fs', 'iteraciones', 'lambda', 'xc', 'yc', 'r', 'evaluadas', 'validas', 'avisos'], rows, options);
}
