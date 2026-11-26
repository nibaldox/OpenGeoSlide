// Informe sintético con refuerzos (v0.4) para las pruebas y para revisar el PDF: el motor de esta base todavía no calcula
// refuerzos, así que `reinforcement_forces` se arma a mano sobre un informe real de V047a (círculo fijo). Los cruces se calculan
// con la geometría del círculo, para que las flechas salgan de la superficie dibujada. No se importa desde código de producción.

import type { ModelDoc } from '../editor/types';
import type { AnalysisReport, MethodReport, Reinforcement, ReinforcementForce } from '../engine/types';
import { loadEngineReport, loadPublishedDoc } from './fixtures';
import type { ReportInput } from './types';

const asReinforcement = (o: object): Reinforcement => o as unknown as Reinforcement;

/** Tablestaca de E14m-5 (V047a), un anclaje activo que la sujeta, un clavo y un geosintético. */
export const SHEET = asReinforcement({ id: 'tablestaca-1', type: 'sheet_pile', x1: 40, y1: 33, x2: 40, y2: 22, application: 'passive', force: 120, direction: 'angle', angle: 0 });
export const ANCHOR = asReinforcement({
  id: 'anclaje-1', type: 'anchor', x1: 40, y1: 29, x2: 58, y2: 23, application: 'active', tensile_capacity: 150, end1_capacity: 150, spacing: 2.5, direction: 'axial',
});
export const NAIL = asReinforcement({
  id: 'clavo-1', type: 'nail', x1: 33, y1: 26.5, x2: 45, y2: 23, application: 'passive', tensile_capacity: 100, spacing: 1.5, direction: 'axial', pullout: { model: 'bond', strength: 30 },
});
export const GEO = asReinforcement({
  id: 'geosintetico-1', type: 'geosynthetic', x1: 55, y1: 35, x2: 66, y2: 35, application: 'passive', tensile_capacity: 40, spacing: 1, direction: 'axial',
  pullout: { model: 'interface', adhesion: 2, friction_angle: 20, coverage: 0.8 },
});

/** Cruces del segmento con el arco inferior del círculo, ordenados desde la cabeza: `[x, y, estación]`. */
export function circleCrossings(r: Reinforcement, c: { xc: number; yc: number; r: number }): [number, number, number][] {
  const dx = r.x2 - r.x1;
  const dy = r.y2 - r.y1;
  const a = dx * dx + dy * dy;
  const fx = r.x1 - c.xc;
  const fy = r.y1 - c.yc;
  const b = 2 * (fx * dx + fy * dy);
  const k = fx * fx + fy * fy - c.r * c.r;
  const disc = b * b - 4 * a * k;
  if (disc < 0) return [];
  const root = Math.sqrt(disc);
  const out: [number, number, number][] = [];
  for (const t of [(-b - root) / (2 * a), (-b + root) / (2 * a)]) {
    const y = r.y1 + t * dy;
    if (t > 1e-9 && t < 1 - 1e-9 && y <= c.yc) out.push([r.x1 + t * dx, y, t * Math.sqrt(a)]);
  }
  return out;
}

/** Fuerza sintética de un cruce: la dirección de `u` y la magnitud `available` (por metro). */
function crossingForce(r: Reinforcement, i: number, at: [number, number, number], available: number, u: [number, number], status: ReinforcementForce['status'] | 'no_capacity'): ReinforcementForce {
  const applied = status === 'applied';
  return { id: r.id, crossing: i, x: at[0], y: at[1], station: at[2], available, fx: applied ? available * u[0] : 0, fy: applied ? available * u[1] : 0, application: r.application, status } as ReinforcementForce;
}

export interface SyntheticOptions {
  /** Referencias de las fuerzas por método (`bishop` y `spencer` por omisión). */
  methods?: ('bishop' | 'spencer')[];
  reinforcements?: Reinforcement[];
}

/** Modelo V047a (círculo fijo) con refuerzos, en versión 0.4, y su informe con `reinforcement_forces`. */
export function syntheticReinforcedInput(options: SyntheticOptions = {}): ReportInput {
  const list = options.reinforcements ?? [SHEET, ANCHOR, NAIL, GEO];
  const doc: ModelDoc = { ...loadPublishedDoc('V047a'), version: '0.4', reinforcements: list.map((r) => ({ ...r })) } as ModelDoc;
  // Círculo fijo de F3.8: el informe real trae esa superficie con 51 dovelas.
  const base: AnalysisReport = loadEngineReport('v047a-search-rtl');
  const circle = { xc: 29.54334963719809, yc: 53.63784815923435, r: 28.641487934160704 };
  const forcesOf = (): ReinforcementForce[] => {
    const out: ReinforcementForce[] = [];
    for (const r of list) {
      const hits = circleCrossings(r, circle);
      const len = Math.hypot(r.x2 - r.x1, r.y2 - r.y1);
      const d: [number, number] = [(r.x2 - r.x1) / len, (r.y2 - r.y1) / len];
      if (r.id === 'tablestaca-1') hits.forEach((h, i) => out.push(crossingForce(r, i, h, 120, [1, 0], 'applied')));
      else if (r.id === 'anclaje-1') hits.forEach((h, i) => out.push(crossingForce(r, i, h, 60, d, 'applied')));
      else if (r.id === 'clavo-1') hits.forEach((h, i) => out.push(crossingForce(r, i, h, 28.4, d, 'compression_ignored')));
      else if (r.id === 'geosintetico-1') out.push(crossingForce(r, 0, [58, 33.2, 3.1], 0, d, 'outside_mass'));
    }
    return out;
  };
  const wanted = options.methods ?? ['bishop', 'spencer'];
  const results: MethodReport[] = base.results.filter((m) => (wanted as string[]).includes(m.method)).map((m) => ({ ...m, reinforcement_forces: forcesOf() }));
  return {
    generatedAt: '2026-11-26T12:00:00Z',
    engineName: 'ogs-core 0.4.0',
    model: doc,
    modelSha256: 'c'.repeat(64),
    results,
    warnings: [],
    checks: [],
    disclaimer: '',
  };
}
