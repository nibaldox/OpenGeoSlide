// Entidades DXF soportadas: LINE, LWPOLYLINE y POLYLINE 2D con VERTEX (X3 §2.7).
//
// Se rechazan, con una incidencia `aviso` y sin entrar en `entities`: bulge distinto de 0 (arcos), geometría 3D
// (cota Z distinta de 0, también en la cabecera de POLYLINE; POLYLINE 3D o malla; ajuste de curva/spline), vector de
// extrusión OCS distinto de (0, 0, 1) (códigos 210/220/230: una polilínea espejada o en un plano inclinado no se
// importaría como se ve en CAD) y coordenadas no finitas (que `dxf-parser`
// deja pasar como `null`). El resto de tipos (SPLINE, CIRCLE, ARC, TEXT…) se ignora con recuento en `unsupported`.
// Límites: 2 MB y 10 000 entidades.

import type { Point } from '../../engine/types';
import type { DxfImportResult, ImportIssue } from '../types';
import { buildLayers, unitsFromInsunits, type MaterialRef } from './layers';
import { DXF_MAX_BYTES, tokenizeDxf, utf8Size, type DxfPair } from './tokenize';

export const DXF_MAX_ENTITIES = 10_000;

export interface DxfEntity {
  type: 'LINE' | 'LWPOLYLINE' | 'POLYLINE';
  layer: string;
  /** Vértices tal como están en el archivo (sin repetir el primero al cerrar). */
  points: Point[];
  /** Bandera de cierre del archivo (70 bit 1). Una LINE nunca es cerrada. */
  closed: boolean;
  /** Línea (desde 1) donde empieza la entidad. */
  line: number;
}

export interface DxfParseResult extends DxfImportResult {
  /** Entidades aceptadas, en el orden del archivo: LINE, LWPOLYLINE y POLYLINE (cerradas o abiertas). */
  entities: DxfEntity[];
  /** Entidades de dibujo que había en ENTITIES (aceptadas, rechazadas e ignoradas). */
  entityCount: number;
}

export interface ParseDxfOptions {
  /** Materiales del modelo, para sugerir el material de cada capa. */
  materials?: readonly MaterialRef[];
}

const DXF_NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

interface Record_ {
  type: string;
  pairs: DxfPair[];
  line: number;
}

type Num = number | 'invalid' | undefined;

function readNumber(pairs: DxfPair[], code: number): Num {
  const p = pairs.find((q) => q.code === code);
  if (!p) return undefined;
  if (!DXF_NUMBER.test(p.value)) return 'invalid';
  const n = Number(p.value);
  return Number.isFinite(n) ? n : 'invalid';
}

function parseNum(p: DxfPair): number | null {
  if (!DXF_NUMBER.test(p.value)) return null;
  const n = Number(p.value);
  return Number.isFinite(n) ? n : null;
}

/** Tolerancia con la que el vector de extrusión se considera (0, 0, 1): absorbe residuos de exportadores CAD/QGIS (R6-05). */
const EXTRUSION_TOL = 1e-9;

/**
 * `null` si el vector de extrusión (210/220/230) es (0, 0, 1) con tolerancia `1e-9`, que es el valor por omisión cuando
 * faltan los códigos; en otro caso, el motivo del rechazo. Una componente no numérica también se rechaza. Solo se usa
 * en entidades con coordenadas OCS (`LWPOLYLINE`, `POLYLINE`): las de `LINE` son WCS y su extrusión no afecta.
 */
function extrusionProblem(pairs: DxfPair[]): { reason: string; detail: string } | null {
  const ex = readNumber(pairs, 210);
  const ey = readNumber(pairs, 220);
  const ez = readNumber(pairs, 230);
  const PLANE = 'no está dibujada en el plano XY estándar (está inclinada, volteada o espejada); llévela al plano XY en su programa de CAD';
  if (ex === 'invalid' || ey === 'invalid' || ez === 'invalid') {
    return { reason: PLANE, detail: 'vector de extrusión (códigos 210/220/230) no numérico o no finito' };
  }
  if (Math.abs(ex ?? 0) > EXTRUSION_TOL || Math.abs(ey ?? 0) > EXTRUSION_TOL || Math.abs((ez ?? 1) - 1) > EXTRUSION_TOL) {
    return { reason: PLANE, detail: `vector de extrusión (${ex ?? 0}, ${ey ?? 0}, ${ez ?? 1}) distinto de (0, 0, 1)` };
  }
  return null;
}

function layerOf(pairs: DxfPair[]): string {
  return pairs.find((p) => p.code === 8)?.value ?? '0';
}

function splitRecords(pairs: DxfPair[]): Record_[] {
  const out: Record_[] = [];
  let cur: Record_ | null = null;
  for (const p of pairs) {
    if (p.code === 0) {
      cur = { type: p.value, pairs: [p], line: p.line };
      out.push(cur);
    } else if (cur) {
      cur.pairs.push(p);
    }
  }
  return out;
}

interface Section {
  name: string;
  pairs: DxfPair[];
}

function splitSections(pairs: DxfPair[]): Section[] {
  const sections: Section[] = [];
  let cur: Section | null = null;
  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i] as DxfPair;
    if (p.code === 0 && p.value === 'SECTION') {
      const next = pairs[i + 1];
      cur = { name: next && next.code === 2 ? next.value.toUpperCase() : '', pairs: [] };
      sections.push(cur);
      i += 1;
    } else if (p.code === 0 && (p.value === 'ENDSEC' || p.value === 'EOF')) {
      cur = null;
    } else if (cur) {
      cur.pairs.push(p);
    }
  }
  return sections;
}

type Parsed = { ok: true; entity: DxfEntity } | { ok: false; reason: string; detail?: string };

function reject(reason: string, detail?: string): Parsed {
  return detail === undefined ? { ok: false, reason } : { ok: false, reason, detail };
}

const BAD_NUMBERS = 'tiene coordenadas que no son números válidos';
const ARCS = 'tiene tramos curvos (arcos); solo se importan tramos rectos, así que reemplácelos por segmentos rectos en su programa de CAD';
const TOO_FEW = 'tiene menos de 2 vértices';
const THREE_D = 'es 3D (tiene cota Z distinta de 0); aplánela al plano XY en su programa de CAD';

function parseLine(r: Record_): Parsed {
  const c = { x1: readNumber(r.pairs, 10), y1: readNumber(r.pairs, 20), x2: readNumber(r.pairs, 11), y2: readNumber(r.pairs, 21) };
  if ([c.x1, c.y1, c.x2, c.y2].includes('invalid')) return reject(BAD_NUMBERS);
  if ([c.x1, c.y1, c.x2, c.y2].includes(undefined)) return reject('le faltan coordenadas');
  const z1 = readNumber(r.pairs, 30);
  const z2 = readNumber(r.pairs, 31);
  if (z1 === 'invalid' || z2 === 'invalid') return reject(BAD_NUMBERS);
  if ((z1 ?? 0) !== 0 || (z2 ?? 0) !== 0) return reject(THREE_D);
  // Sin comprobar la extrusión: los extremos de una LINE están en WCS (R6-05).
  return {
    ok: true,
    entity: {
      type: 'LINE',
      layer: layerOf(r.pairs),
      points: [[c.x1 as number, c.y1 as number], [c.x2 as number, c.y2 as number]],
      closed: false,
      line: r.line,
    },
  };
}

function parseLwPolyline(r: Record_): Parsed {
  const verts: { x: number | null; y: number | null; bulge: number }[] = [];
  for (const p of r.pairs) {
    if (p.code === 10) {
      verts.push({ x: parseNum(p), y: null, bulge: 0 });
    } else if (p.code === 20) {
      const v = verts[verts.length - 1];
      if (!v) return reject('tiene una coordenada Y sin su X');
      v.y = parseNum(p);
      if (v.y === null) return reject(BAD_NUMBERS);
    } else if (p.code === 42) {
      const v = verts[verts.length - 1];
      const b = parseNum(p);
      if (b === null) return reject('tiene un tramo curvo con un valor no numérico', 'bulge (código 42) no numérico');
      if (v) v.bulge = b;
      else if (b !== 0) return reject(ARCS, `bulge = ${b}`);
    }
  }
  if (verts.some((v) => v.x === null)) return reject(BAD_NUMBERS);
  if (verts.some((v) => v.y === null)) return reject('le faltan coordenadas Y');
  if (verts.some((v) => v.bulge !== 0)) return reject(ARCS, 'bulge distinto de 0');
  const elevation = readNumber(r.pairs, 38);
  if (elevation === 'invalid') return reject('tiene una cota (altura Z) que no es un número válido');
  if ((elevation ?? 0) !== 0) return reject(THREE_D, `cota (código 38) = ${elevation}`);
  const extrusion = extrusionProblem(r.pairs);
  if (extrusion) return reject(extrusion.reason, extrusion.detail);
  const count = readNumber(r.pairs, 90);
  if (typeof count === 'number' && count !== verts.length) {
    return reject(`está incompleta o dañada (declara ${count} vértices y solo tiene ${verts.length})`, `código 90 = ${count}; vértices leídos = ${verts.length}`);
  }
  if (verts.length < 2) return reject(TOO_FEW);
  const flags = readNumber(r.pairs, 70);
  return {
    ok: true,
    entity: {
      type: 'LWPOLYLINE',
      layer: layerOf(r.pairs),
      points: verts.map((v) => [v.x as number, v.y as number] as Point),
      closed: typeof flags === 'number' && (flags & 1) === 1,
      line: r.line,
    },
  };
}

function parsePolyline(head: Record_, vertices: Record_[]): Parsed {
  const flags = readNumber(head.pairs, 70);
  const f = typeof flags === 'number' ? flags : 0;
  if (f & (8 | 16 | 64)) return reject('es una polilínea 3D, una malla o una polycara, no un perfil plano', `bandera 70 = ${f}`);
  if (f & (2 | 4)) return reject('es una polilínea curva (ajustada con spline); reemplácela por tramos rectos en su programa de CAD', `bandera 70 = ${f}`);
  // Cabecera: cota Z (30; para una POLYLINE 2D es la elevación) y extrusión. Los VERTEX no traen 210/220/230.
  const headerZ = readNumber(head.pairs, 30);
  if (headerZ === 'invalid') return reject(BAD_NUMBERS);
  if ((headerZ ?? 0) !== 0) return reject(THREE_D, `cota de la cabecera (código 30) = ${headerZ}`);
  const extrusion = extrusionProblem(head.pairs);
  if (extrusion) return reject(extrusion.reason, extrusion.detail);
  const points: Point[] = [];
  for (const v of vertices) {
    const x = readNumber(v.pairs, 10);
    const y = readNumber(v.pairs, 20);
    const z = readNumber(v.pairs, 30);
    const bulge = readNumber(v.pairs, 42);
    if (x === 'invalid' || y === 'invalid' || z === 'invalid' || bulge === 'invalid') return reject(BAD_NUMBERS);
    if (x === undefined || y === undefined) return reject('tiene un vértice sin coordenada X o Y');
    if ((z ?? 0) !== 0) return reject(THREE_D, `cota de un vértice (código 30) = ${z}`);
    if ((bulge ?? 0) !== 0) return reject(ARCS, `bulge = ${bulge}`);
    points.push([x, y]);
  }
  if (points.length < 2) return reject(TOO_FEW);
  return { ok: true, entity: { type: 'POLYLINE', layer: layerOf(head.pairs), points, closed: (f & 1) === 1, line: head.line } };
}

function samePoint(a: Point, b: Point): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/** Polilínea abierta que cierra con sus extremos coincidentes (≥ 4 puntos): se promueve a región. */
function hasCoincidentEnds(e: DxfEntity): boolean {
  return e.points.length >= 4 && samePoint(e.points[0] as Point, e.points[e.points.length - 1] as Point);
}

/**
 * Importa un DXF de texto. `ok` es `false` si hay un error estructural, se pasan los límites o no queda ninguna
 * entidad utilizable. `regions` contiene las polilíneas cerradas (bandera de cierre, o extremos coincidentes con
 * aviso); las abiertas y las LINE quedan en `entities` para que la UI ofrezca cerrarlas con una base.
 */
export function parseDxf(text: string, options: ParseDxfOptions = {}): DxfParseResult {
  const materials = options.materials ?? [];
  const issues: ImportIssue[] = [];
  const empty = (): DxfParseResult => ({
    ok: false,
    regions: [],
    layers: [],
    unsupported: [],
    unitsFromHeader: null,
    issues,
    entities: [],
    entityCount: 0,
  });

  if (utf8Size(text) > DXF_MAX_BYTES) {
    issues.push({ severity: 'error', text: 'El archivo DXF pesa más de 2 MB, el máximo admitido. Exporte solo el perfil del talud, sin planos ni anotaciones.' });
    return empty();
  }

  const tokens = tokenizeDxf(text);
  issues.push(...tokens.issues);
  if (tokens.issues.some((i) => i.severity === 'error')) return empty();

  const sections = splitSections(tokens.pairs);
  const header = sections.find((s) => s.name === 'HEADER');
  const entitiesSection = sections.find((s) => s.name === 'ENTITIES');
  if (!header && !entitiesSection) {
    issues.push({
      severity: 'error',
      text: 'El archivo no parece un DXF: no se encontró ni el encabezado ni el dibujo. Compruebe que sea un archivo .dxf de texto.',
      detail: 'sin secciones HEADER ni ENTITIES',
    });
    return empty();
  }
  if (!entitiesSection) {
    issues.push({
      severity: 'error',
      text: 'El DXF no contiene dibujo: no se encontró la lista de elementos. Compruebe que se exportó con el perfil del talud.',
      detail: 'sin sección ENTITIES',
    });
    return empty();
  }

  // Unidades.
  let insunits: number | null = null;
  if (header) {
    for (let i = 0; i < header.pairs.length; i++) {
      const p = header.pairs[i] as DxfPair;
      const next = header.pairs[i + 1];
      if (p.code === 9 && p.value === '$INSUNITS' && next && next.code === 70) {
        const n = parseNum(next);
        insunits = n !== null && Number.isInteger(n) ? n : null;
      }
    }
  }
  const unitsFromHeader = unitsFromInsunits(insunits);
  if (insunits !== null && unitsFromHeader === null && insunits !== 0) {
    issues.push({
      severity: 'aviso',
      text: `El DXF declara unas unidades que no se reconocen (código ${insunits}); elija la unidad del dibujo al importar.`,
      detail: `$INSUNITS = ${insunits}`,
    });
  }

  // Capas declaradas.
  const layerNames: string[] = [];
  const tables = sections.find((s) => s.name === 'TABLES');
  if (tables) {
    for (const r of splitRecords(tables.pairs)) {
      if (r.type !== 'LAYER') continue;
      const name = r.pairs.find((p) => p.code === 2)?.value;
      if (name !== undefined && name !== '') layerNames.push(name);
    }
  }

  // Entidades.
  const records = splitRecords(entitiesSection.pairs);
  const topLevel = records.filter((r) => r.type !== 'VERTEX' && r.type !== 'SEQEND');
  if (topLevel.length > DXF_MAX_ENTITIES) {
    issues.push({
      severity: 'error',
      text: `El DXF tiene ${topLevel.length} elementos de dibujo y el máximo es ${DXF_MAX_ENTITIES}. Exporte solo el perfil del talud, sin planos ni anotaciones.`,
    });
    return { ...empty(), entityCount: topLevel.length };
  }

  const entities: DxfEntity[] = [];
  const unsupported = new Map<string, number>();
  const rejectEntity = (type: string, line: number, reason: string, detail?: string): void => {
    const what = type === 'LINE' ? 'línea (LINE)' : `polilínea (${type})`;
    const base = { severity: 'aviso' as const, entity: type, line, text: `La ${what} de la línea ${line} no se importó: ${reason}.` };
    issues.push(detail === undefined ? base : { ...base, detail });
  };

  for (let i = 0; i < records.length; i++) {
    const r = records[i] as Record_;
    if (r.type === 'LINE' || r.type === 'LWPOLYLINE') {
      const res = r.type === 'LINE' ? parseLine(r) : parseLwPolyline(r);
      if (res.ok) entities.push(res.entity);
      else rejectEntity(r.type, r.line, res.reason, res.detail);
    } else if (r.type === 'POLYLINE') {
      const vertices: Record_[] = [];
      let j = i + 1;
      while (j < records.length && (records[j] as Record_).type === 'VERTEX') {
        vertices.push(records[j] as Record_);
        j += 1;
      }
      if ((records[j] as Record_ | undefined)?.type === 'SEQEND') j += 1;
      else issues.push({ severity: 'aviso', entity: 'POLYLINE', line: r.line, text: `La polilínea de la línea ${r.line} está incompleta (le falta la marca de fin); se usó lo que contiene. Si el perfil se ve mal, vuelva a exportar el DXF.`, detail: 'POLYLINE sin SEQEND' });
      i = j - 1;
      const res = parsePolyline(r, vertices);
      if (res.ok) entities.push(res.entity);
      else rejectEntity('POLYLINE', r.line, res.reason, res.detail);
    } else if (r.type !== 'VERTEX' && r.type !== 'SEQEND') {
      unsupported.set(r.type, (unsupported.get(r.type) ?? 0) + 1);
    }
  }

  // Regiones: polilíneas cerradas.
  const regions: DxfImportResult['regions'] = [];
  for (const e of entities) {
    if (e.type === 'LINE') continue;
    const coincident = hasCoincidentEnds(e);
    if (!e.closed && !coincident) continue;
    const polygon = coincident ? e.points.slice(0, -1) : e.points.slice();
    if (!e.closed) {
      issues.push({
        severity: 'aviso',
        entity: e.type,
        line: e.line,
        text: `La polilínea abierta de la línea ${e.line} (capa ${e.layer}) tiene los extremos coincidentes y se trata como cerrada.`,
      });
    }
    if (polygon.length < 3) {
      issues.push({ severity: 'aviso', entity: e.type, line: e.line, text: `La polilínea de la línea ${e.line} tiene menos de 3 vértices distintos y no forma una región; se ignoró.` });
      continue;
    }
    regions.push({ layer: e.layer, polygon });
  }

  if (entities.some((e) => e.layer === '0')) {
    issues.push({ severity: 'aviso', text: 'Hay elementos en la capa «0», que no indica un material: asigne uno manualmente al importar.' });
  }
  // Las abiertas con extremos coincidentes ya se promovieron a región (con su propio aviso): no se cuentan de nuevo.
  const open = entities.filter((e) => e.type !== 'LINE' && !e.closed && !hasCoincidentEnds(e)).length;
  if (open > 0) {
    issues.push({
      severity: 'aviso',
      text: `${open} ${open === 1 ? 'polilínea abierta no forma' : 'polilíneas abiertas no forman'} una región: ciérre${open === 1 ? 'la' : 'las'} con una línea base o descártel${open === 1 ? 'a' : 'as'}.`,
    });
  }

  const layers = buildLayers([...layerNames, ...entities.map((e) => e.layer)], materials);
  const ok = entities.length > 0 && !issues.some((i) => i.severity === 'error');
  if (entities.length === 0) {
    issues.push({
      severity: 'error',
      text: 'El DXF no contiene líneas ni polilíneas 2D que se puedan importar. Dibuje el perfil con líneas o polilíneas y vuelva a exportarlo.',
      detail: 'se leen LINE, LWPOLYLINE y POLYLINE 2D',
    });
  } else if (regions.length === 0) {
    issues.push({
      severity: 'aviso',
      text: 'El DXF no contiene polilíneas cerradas, así que no se creará ninguna región. Dibuje cada región como polilínea cerrada, o ciérrelas con una línea base al importar.',
    });
  }

  return {
    ok,
    regions,
    layers,
    unsupported: [...unsupported].map(([type, count]) => ({ type, count })),
    unitsFromHeader,
    issues,
    entities,
    entityCount: topLevel.length,
  };
}
