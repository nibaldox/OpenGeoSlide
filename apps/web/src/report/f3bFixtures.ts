// Informes y modelos simulados de prueba para el bloque F3B (F6.2–F6.4, F6.6, F6.7).
// Solo para los tests `*.f3b.test.ts` de la web (nunca en `engine/`).

import type { ModelDoc } from '../editor/types';
import type { AnalysisReport, MethodReport, Point, Slice } from '../engine/types';
import type { ReportInput } from './types';
import { loadCaseDoc } from './fixtures';

export const F3B_CRITICAL_POLYLINE: Point[] = [
  [30, 25],
  [33.5, 24.6],
  [37, 25.1],
  [40.5, 26.4],
  [44, 28.3],
  [47.5, 31.1],
  [51.2, 35],
];

export function f3bSlices(materials: readonly number[] = [0, 1, 1, 2, 2, 0]): Slice[] {
  const xs = [30, 33.5, 37, 40.5, 44, 47.5, 51.2];
  const ys = [25, 24.6, 25.1, 26.4, 28.3, 31.1, 35];
  return materials.map((mat, i) => {
    const xLeft = xs[i]!;
    const xRight = xs[i + 1]!;
    const yLeft = ys[i]!;
    const yRight = ys[i + 1]!;
    const dx = xRight - xLeft;
    const dy = yRight - yLeft;
    return {
      x_left: xLeft,
      x_right: xRight,
      y_base_left: yLeft,
      y_base_right: yRight,
      y_top_mid: Math.min(35, 25 + ((xLeft + xRight) / 2 - 30) * 0.5 + 3),
      width: dx,
      alpha: Math.atan2(dy, dx),
      base_length: Math.hypot(dx, dy),
      weight: 185 + i * 12,
      cohesion: mat === 2 ? 24.5 : 18.2,
      tan_phi: mat === 2 ? 0 : 0.52,
      pore_pressure: 8.4,
      material: mat,
      weight_extra: 0,
      h_force: 0,
      h_moment_base: 0,
      driving_extra: 0,
      y_centroid: 0,
    };
  });
}

/** Modelo v0.6 e informe simulado de Hoek-Brown (F6.2, F6.6, F6.8). */
export function hoekBrownFixture(): { model: ModelDoc; report: AnalysisReport; input: ReportInput } {
  const model = loadCaseDoc('V047a');
  model.version = '0.6';
  model.materials = [
    { id: 'relleno', name: 'Relleno granular', model: 'mohr_coulomb', unit_weight: 19, cohesion: 5, friction_angle: 32 },
    { id: 'roca', name: 'Caliza fracturada', model: 'hoek_brown', unit_weight: 26, ucs: 30000, gsi: 50, mi: 10, disturbance: 0.7 },
  ];
  model.regions = [
    { material: 'roca', polygon: [[20, 20], [70, 20], [70, 30], [40, 30], [30, 25], [20, 25]] },
    { material: 'relleno', polygon: [[40, 30], [70, 30], [70, 35], [50, 35]] },
  ];
  model.analysis = { ...model.analysis, methods: ['bishop', 'spencer'] };
  const slices = f3bSlices([1, 1, 1, 1, 0, 0]);
  const hbStrengthSlices = [
    { index: 0, law: 'hoek_brown' as const, normal_stress: 4.2 },
    { index: 1, law: 'hoek_brown' as const, normal_stress: 52.1 },
    { index: 2, law: 'hoek_brown' as const, normal_stress: 78.6 },
    { index: 3, law: 'hoek_brown' as const, normal_stress: 41.3 },
  ];
  const results: MethodReport[] = [
    {
      method: 'bishop',
      fos: 1.466,
      status: 'converged',
      iterations: 9,
      lambda: null,
      surface: { xc: 29.51, yc: 53.74, r: 28.74 },
      slices,
      search: { evaluated: 8543, valid: 5120 },
      warnings: ['hoek_brown_low_confinement'],
      strength: { passes: 11, slices: hbStrengthSlices },
    },
    {
      method: 'spencer',
      fos: 1.468,
      status: 'converged',
      iterations: 14,
      lambda: 0.2145,
      surface: { xc: 29.51, yc: 53.74, r: 28.74 },
      slices,
      search: { evaluated: 8655, valid: 5098 },
      warnings: ['hoek_brown_low_confinement'],
      strength: { passes: 12, slices: hbStrengthSlices },
    },
  ];
  const report: AnalysisReport = { engine: 'ogs-core 0.4.0', results };
  const input: ReportInput = {
    generatedAt: '2026-11-27T10:00:00Z',
    engineName: report.engine,
    model,
    modelSha256: '1'.repeat(64),
    results,
    warnings: [],
    checks: [],
    disclaimer: '',
  };
  return { model, report, input };
}

/** Modelo v0.6 e informe simulado de SHANSEP con las tres fuentes de OCR (F6.3, F6.6, F6.9). */
export function shansepFixture(): { model: ModelDoc; report: AnalysisReport; input: ReportInput } {
  const model = loadCaseDoc('V047a');
  model.version = '0.6';
  model.materials = [
    { id: 'arc_ocr', name: 'Arcilla OCR fijo', model: 'shansep', unit_weight: 18, shansep: { ratio: 0.23, ocr: 1.5 } },
    { id: 'arc_pop', name: 'Arcilla POP', model: 'shansep', unit_weight: 18.5, shansep: { ratio: 0.25, exponent: 0.82, pop: 30 } },
    {
      id: 'arc_cota',
      name: 'Arcilla por cota',
      model: 'shansep',
      unit_weight: 17.5,
      shansep: { ratio: 0.22, exponent: 0.78, ocr_by_elevation: [[20, 2.2], [28, 1.4], [35, 1.0]] },
    },
  ];
  model.regions = [{ material: 'arc_pop', polygon: [[20, 20], [70, 20], [70, 35], [50, 35], [30, 25], [20, 25]] }];
  model.analysis = { ...model.analysis, methods: ['bishop', 'spencer'] };
  const slices = f3bSlices([0, 1, 1, 2, 2, 1]);
  const shSlices = slices.map((_, index) => ({
    index,
    law: 'shansep' as const,
    vertical_stress: index === 0 ? 0 : 45.2 + index * 14.5,
    ocr: index === 0 ? 1.5 : Number((1.2 + index * 0.15).toFixed(2)),
  }));
  const results: MethodReport[] = [
    {
      method: 'bishop',
      fos: 1.285,
      status: 'converged',
      iterations: 2,
      lambda: null,
      surface: { xc: 29.51, yc: 53.74, r: 28.74 },
      slices,
      search: { evaluated: 8543, valid: 5200 },
      warnings: ['shansep_nonpositive_stress'],
      strength: { slices: shSlices },
    },
  ];
  const report: AnalysisReport = { engine: 'ogs-core 0.4.0', results };
  const input: ReportInput = {
    generatedAt: '2026-11-27T10:00:00Z',
    engineName: report.engine,
    model,
    modelSha256: '2'.repeat(64),
    results,
    warnings: [],
    checks: [],
    disclaimer: '',
  };
  return { model, report, input };
}

/** Búsqueda no circular donde gana la polilínea refinada (`SurfaceOut::Polyline`, `polyline_fos < seed_fos`, F6.6, F6.10). */
export function nonCircularPolylineWinsFixture(largeChange = false): { model: ModelDoc; report: AnalysisReport; input: ReportInput } {
  const model = loadCaseDoc('V047a');
  model.version = '0.6';
  model.analysis = {
    ...model.analysis,
    methods: ['spencer', 'morgenstern_price'],
    interslice: { function: 'half_sine' },
    search: {
      ...(model.analysis.search ?? { type: 'circular_entry_exit' }),
      non_circular: { seeds: 3, max_vertices: 33 },
    },
  };
  const slices = f3bSlices([0, 0, 0, 0, 0, 0]);
  const seedFos = largeChange ? 1.62 : 1.402;
  const polyFos = largeChange ? 1.32 : 1.384;
  const warnings = largeChange ? ['non_circular_large_change'] : [];
  const results: MethodReport[] = [
    {
      method: 'spencer',
      fos: polyFos,
      status: 'converged',
      iterations: 8,
      lambda: 0.198,
      surface: { points: F3B_CRITICAL_POLYLINE.map((p): Point => [p[0], p[1]]) },
      slices,
      search: {
        evaluated: 8085,
        valid: 4715,
        non_circular: { seeds: 3, evaluated: 4500, seed_fos: seedFos, polyline_fos: polyFos },
      },
      warnings,
    },
    {
      method: 'morgenstern_price',
      fos: polyFos + 0.001,
      status: 'converged',
      iterations: 9,
      lambda: 0.231,
      interslice: { function: 'half_sine' },
      surface: { points: F3B_CRITICAL_POLYLINE.map((p): Point => [p[0], p[1]]) },
      slices,
      search: {
        evaluated: 8110,
        valid: 4702,
        non_circular: { seeds: 3, evaluated: 4480, seed_fos: seedFos + 0.002, polyline_fos: polyFos + 0.001 },
      },
      warnings,
    },
  ];
  const report: AnalysisReport = { engine: 'ogs-core 0.4.0', results };
  const input: ReportInput = {
    generatedAt: '2026-11-27T10:00:00Z',
    engineName: report.engine,
    model,
    modelSha256: '3'.repeat(64),
    results,
    warnings: [],
    checks: [],
    disclaimer: '',
  };
  return { model, report, input };
}

/** Búsqueda no circular donde gana el círculo (`SurfaceOut::Circle`, `polyline_fos > seed_fos` o ausente, F6.10 punto 8). */
export function nonCircularCircleWinsFixture(omitPolylineFos = false): { model: ModelDoc; report: AnalysisReport; input: ReportInput } {
  const model = loadCaseDoc('V047a');
  model.version = '0.6';
  model.analysis = {
    ...model.analysis,
    methods: ['spencer'],
    search: {
      ...(model.analysis.search ?? { type: 'circular_entry_exit' }),
      non_circular: {},
    },
  };
  const slices = f3bSlices([0, 0, 0, 0, 0, 0]);
  const results: MethodReport[] = [
    {
      method: 'spencer',
      fos: 0.402,
      status: 'converged',
      iterations: 7,
      lambda: 0.142,
      surface: { xc: 29.51, yc: 53.74, r: 28.74 },
      slices,
      search: {
        evaluated: 8139,
        valid: 4200,
        non_circular: {
          seeds: 3,
          evaluated: 4502,
          seed_fos: 0.402,
          ...(omitPolylineFos ? {} : { polyline_fos: 0.412 }),
        },
      },
      warnings: [],
    },
  ];
  const report: AnalysisReport = { engine: 'ogs-core 0.4.0', results };
  const input: ReportInput = {
    generatedAt: '2026-11-27T10:00:00Z',
    engineName: report.engine,
    model,
    modelSha256: '4'.repeat(64),
    results,
    warnings: [],
    checks: [],
    disclaimer: '',
  };
  return { model, report, input };
}

/** Informe simulado de Hoek-Brown sin convergencia (`NotConverged` + `hoek_brown_not_converged`, F6.7, F6.8). */
export function hoekBrownNotConvergedFixture(): { model: ModelDoc; report: AnalysisReport; input: ReportInput } {
  const base = hoekBrownFixture();
  const results: MethodReport[] = [
    {
      ...base.report.results[0]!,
      fos: null,
      status: 'not_converged',
      warnings: ['hoek_brown_not_converged'],
      strength: { passes: 50, slices: base.report.results[0]!.strength!.slices },
    },
  ];
  const report: AnalysisReport = { engine: 'ogs-core 0.4.0', results };
  return { model: base.model, report, input: { ...base.input, results } };
}
