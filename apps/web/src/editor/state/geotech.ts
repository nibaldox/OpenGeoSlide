// Avisos geotécnicos del modelo (R9-05c/d, R9-12a). Puro: lo usan `validateLocal` (Diagnósticos) y el informe PDF, de modo que
// los dos dicen lo mismo. Ninguno bloquea el cálculo ni cambia el contrato del motor (E12): solo hacen visible lo que el motor hace.
//
// - γsat: el cálculo con γsat todavía no se ha contrastado con otro programa (`helpContent.ts`).
// - γsat < γ: un suelo saturado no pesa menos que el seco; casi siempre es un error de captura.
// - ru y piezométrica a la vez: en un material con `ru`, la presión de poros es `ru·σv` y la piezométrica **no se usa** para esa
//   presión (`crates/ogs-core/src/slicer.rs:604-610`: `if let Some(ru) = m.ru { ru·σv } else if let Some(z) = piezo {…}`).
// - piezométrica corta: fuera de su rango x el motor usa el nivel del extremo más cercano, es decir, la prolonga en horizontal
//   hasta los bordes del modelo (`crates/ogs-core/src/geometry.rs:621-627`, `piezometric_y`).

import type { Material, Point } from '../../engine/types';
import type { ModelDoc } from '../types';
import { isFiniteNumber } from './docUtils';
import { isImperialUnits } from './units';

export interface GeotechAdvisory {
  /** Código estable (`editor.*`). */
  code: 'editor.gamma_sat_unverified' | 'editor.gamma_sat_lt_gamma' | 'editor.ru_over_piezo' | 'editor.piezo_extrapolated';
  text: string;
  /** Puntero JSON al dato que lo causa. */
  path: string | null;
}

const isNum = (v: unknown): v is number => isFiniteNumber(v);

function num(n: number): string {
  return String(Number(n.toPrecision(6))).replace('.', ',');
}

function materialName(m: Material): string {
  return `«${m.id}»`;
}

/** Línea piezométrica válida (≥ 2 puntos finitos), o `null`. */
export function validPiezo(doc: ModelDoc): Point[] | null {
  const line = doc.water?.piezometric_line;
  if (!Array.isArray(line) || line.length < 2) return null;
  for (const p of line) if (!(Array.isArray(p) && isNum(p[0]) && isNum(p[1]))) return null;
  return line;
}

/** Rango x del modelo (mínimo y máximo de los vértices de las regiones), o `null` si no hay vértices. */
export function modelExtentX(doc: ModelDoc): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of doc.regions) {
    for (const p of r.polygon) {
      if (Array.isArray(p) && isNum(p[0])) {
        lo = Math.min(lo, p[0]);
        hi = Math.max(hi, p[0]);
      }
    }
  }
  return Number.isFinite(lo) && Number.isFinite(hi) ? [lo, hi] : null;
}

/**
 * Tramos de la piezométrica que el motor **prolonga** en horizontal hasta los bordes del modelo (misma regla que
 * `geometry.rs:621-627`): a la izquierda con el nivel del primer punto, a la derecha con el del último.
 */
export function piezoExtension(doc: ModelDoc): { left: [Point, Point] | null; right: [Point, Point] | null } | null {
  const line = validPiezo(doc);
  const extent = modelExtentX(doc);
  if (!line || !extent) return null;
  const sorted = [...line].sort((a, b) => a[0] - b[0]);
  const first = sorted[0] as Point;
  const last = sorted[sorted.length - 1] as Point;
  const tol = 1e-9 * Math.max(1, extent[1] - extent[0]);
  const left: [Point, Point] | null = first[0] - extent[0] > tol ? [[extent[0], first[1]], first] : null;
  const right: [Point, Point] | null = extent[1] - last[0] > tol ? [last, [extent[1], last[1]]] : null;
  return left || right ? { left, right } : null;
}

/** Avisos geotécnicos del documento, en el orden γsat, γsat < γ, ru + piezométrica, piezométrica corta. */
export function geotechAdvisories(doc: ModelDoc): GeotechAdvisory[] {
  const out: GeotechAdvisory[] = [];
  const materials = Array.isArray(doc.materials) ? doc.materials : [];
  const piezo = validPiezo(doc);

  const withSat = materials.map((m, i) => ({ m, i })).filter(({ m }) => isNum(m.unit_weight_sat));
  if (withSat.length > 0) {
    const names = withSat.map(({ m }) => materialName(m)).join(', ');
    const noEffect = piezo ? '' : ' Sin línea piezométrica γsat no interviene en el cálculo.';
    out.push({
      code: 'editor.gamma_sat_unverified',
      text:
        `${withSat.length === 1 ? 'El material' : 'Los materiales'} ${names} usa${withSat.length === 1 ? '' : 'n'} γsat: ` +
        `el cálculo con γsat todavía no está verificado frente a otro programa. Contraste el resultado antes de usarlo.${noEffect}`,
      path: `/materials/${(withSat[0] as { i: number }).i}/unit_weight_sat`,
    });
  }

  for (let i = 0; i < materials.length; i += 1) {
    const m = materials[i] as Material;
    if (isNum(m.unit_weight_sat) && isNum(m.unit_weight) && m.unit_weight > 0 && m.unit_weight_sat < m.unit_weight) {
      out.push({
        code: 'editor.gamma_sat_lt_gamma',
        text:
          `Material ${materialName(m)}: γsat (${num(m.unit_weight_sat)}) es menor que γ (${num(m.unit_weight)}). ` +
          'Un suelo saturado no pesa menos que el mismo suelo sin saturar; revise los dos valores. No bloquea el cálculo.',
        path: `/materials/${i}/unit_weight_sat`,
      });
    }
  }

  if (piezo) {
    const withRu = materials.map((m, i) => ({ m, i })).filter(({ m }) => isNum(m.ru));
    if (withRu.length > 0) {
      const names = withRu.map(({ m }) => materialName(m)).join(', ');
      out.push({
        code: 'editor.ru_over_piezo',
        text:
          `El modelo tiene línea piezométrica y, a la vez, ru en ${withRu.length === 1 ? 'el material' : 'los materiales'} ${names}. ` +
          `En ${withRu.length === 1 ? 'ese material' : 'esos materiales'} el cálculo usa ru y no usa la piezométrica: ru tiene precedencia. ` +
          'Quite ru para que actúe la piezométrica.',
        path: `/materials/${(withRu[0] as { i: number }).i}/ru`,
      });
    }

    const ext = piezoExtension(doc);
    const extent = modelExtentX(doc);
    if (ext && extent) {
      const u = isImperialUnits(doc.units) ? 'ft' : 'm';
      const sorted = [...piezo].sort((a, b) => a[0] - b[0]);
      const first = sorted[0] as Point;
      const last = sorted[sorted.length - 1] as Point;
      out.push({
        code: 'editor.piezo_extrapolated',
        text:
          `La línea piezométrica cubre x de ${num(first[0])} a ${num(last[0])} ${u} y el modelo va de ${num(extent[0])} a ${num(extent[1])} ${u}. ` +
          'Fuera de ese tramo el cálculo la extiende en horizontal hasta los bordes con el nivel del extremo más cercano. ' +
          'Agregue puntos hasta los bordes si el nivel real es otro.',
        path: '/water/piezometric_line',
      });
    }
  }
  return out;
}
