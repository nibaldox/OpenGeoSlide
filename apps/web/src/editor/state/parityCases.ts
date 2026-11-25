// Tabla de paridad entre la validación local del editor y el motor (E12j, R5-10).
//
// Cada caso lleva el veredicto esperado del motor `ogs-core` (`ogs analyze`): `reject` si el documento no pasa su
// validación (`InvalidModel` o `NoSurface`), `accept` si la pasa (que después el análisis converja o no es otro
// asunto). El editor debe dar el mismo veredicto: `reject` ⇔ hay al menos una incidencia local de severidad `error`.
// Los avisos no cuentan. `codes` son los códigos de error que el editor debe emitir en los casos `reject`.
// El test de paridad (parity.test.ts) comprueba la tabla contra el editor siempre y contra el binario real cuando
// `OGS_BIN` apunta a un `ogs` compilado. Solo para tests; no se importa desde código de producción.

import type { Point } from '../../engine/types';
import type { ModelDoc } from '../types';
import { mat, square } from './testFixtures';

export interface ParityCase {
  name: string;
  /** Origen del caso: R5-10 (los cuatro del informe), E12j (umbrales nuevos) o E12c (los existentes). */
  from: 'R5-10' | 'E12c' | 'E12j';
  doc: ModelDoc;
  verdict: 'accept' | 'reject';
  /** Códigos de error del editor esperados (solo si `reject`). */
  codes?: string[];
  /** El motor solo da este veredicto desde G1 (`material.id` vacío); el binario de G3 aún no lo rechaza. */
  engineSince?: 'G1';
}

const surface = { type: 'circle' as const, xc: 50, yc: 120, r: 100 };

/** Documento mínimo: un solo material, superficie fija (el análisis puede no converger; eso no es un rechazo). */
function doc(polygons: Point[][], extra: Partial<ModelDoc> = {}): ModelDoc {
  return {
    format: 'opengeoslide',
    version: '0.2',
    meta: {},
    materials: [mat('m1')],
    regions: polygons.map((polygon) => ({ material: 'm1', polygon })),
    slope: { direction: 'left_to_right' },
    analysis: { methods: ['bishop'], slices: 20, surface },
    ...extra,
  };
}

const big = square(0, 0, 100, 100);

export const PARITY_CASES: ParityCase[] = [
  // Los cuatro de R5-10.
  {
    name: 'R5-10 (1): vértice consecutivo repetido',
    from: 'R5-10',
    doc: doc([[[0, 0], [100, 0], [100, 0], [100, 100], [0, 100]]]),
    verdict: 'accept',
  },
  {
    name: 'R5-10 (2): triángulo diminuto no colineal (lado 1e-6) en un modelo de 100 m',
    from: 'R5-10',
    doc: doc([big, [[100, 0], [100.000001, 0], [100, 0.000001]]]),
    verdict: 'reject',
    codes: ['editor.degenerate_region'],
  },
  {
    name: 'R5-10 (3): sin surface ni search',
    from: 'R5-10',
    doc: doc([big], { analysis: { methods: ['bishop'], slices: 20 } }),
    verdict: 'reject',
    codes: ['editor.no_surface'],
  },
  {
    name: 'R5-10 (4): material.id vacío',
    from: 'R5-10',
    doc: { ...doc([big]), materials: [mat('')], regions: [{ material: '', polygon: big }] },
    verdict: 'reject',
    codes: ['editor.out_of_range'],
    engineSince: 'G1',
  },
  // Umbral de área de región degenerada (1e-12 · escala², escala ≈ 100 → 1e-8).
  {
    name: 'umbral: triángulo con área 1,5e-8 (> 1e-8) es válido',
    from: 'E12j',
    doc: doc([big, [[100, 0], [100.00017320508, 0], [100, 0.00017320508]]]),
    verdict: 'accept',
  },
  {
    name: 'umbral: triángulo con área 5e-9 (< 1e-8) es degenerado',
    from: 'E12j',
    doc: doc([big, [[100, 0], [100.0001, 0], [100, 0.0001]]]),
    verdict: 'reject',
    codes: ['editor.degenerate_region'],
  },
  {
    name: 'región colineal (tres puntos en una recta)',
    from: 'E12j',
    doc: doc([big, [[0, 200], [50, 200], [100, 200]]]),
    verdict: 'reject',
    codes: ['editor.degenerate_region'],
  },
  {
    name: 'repetidos que dejan 2 vértices distintos',
    from: 'E12j',
    doc: doc([big, [[0, 200], [0, 200], [50, 250]]]),
    verdict: 'reject',
    codes: ['editor.degenerate_region'],
  },
  {
    name: 'búsqueda sin superficie fija es válida',
    from: 'E12j',
    doc: doc([big], { analysis: { methods: ['bishop'], slices: 20, search: { type: 'circular_entry_exit' } } }),
    verdict: 'accept',
  },
  {
    name: 'cierre repetido (último vértice = primero)',
    from: 'E12j',
    doc: doc([[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]),
    verdict: 'accept',
  },
  // Existentes (E12c).
  {
    name: 'dos regiones que comparten una arista',
    from: 'E12c',
    doc: doc([square(0, 0, 50, 100), square(50, 0, 100, 100)]),
    verdict: 'accept',
  },
  {
    name: 'vértice colineal extra sobre una arista',
    from: 'E12c',
    doc: doc([[[0, 0], [50, 0], [100, 0], [100, 100], [0, 100]]]),
    verdict: 'accept',
  },
  {
    name: 'contacto en un solo punto entre dos regiones',
    from: 'E12c',
    doc: doc([square(0, 0, 50, 50), square(50, 50, 100, 100)]),
    verdict: 'accept',
  },
  {
    name: 'unión en T (un vértice sobre la arista de la otra región)',
    from: 'E12c',
    doc: doc([square(0, 0, 100, 50), [[25, 50], [75, 50], [50, 100]]]),
    verdict: 'accept',
  },
  {
    name: 'tramo colineal compartido parcial',
    from: 'E12c',
    doc: doc([square(0, 0, 100, 50), square(25, 50, 75, 100)]),
    verdict: 'accept',
  },
  {
    name: 'auto-intersección (lazo)',
    from: 'E12c',
    doc: doc([[[0, 0], [100, 100], [100, 0], [0, 100]]]),
    verdict: 'reject',
    codes: ['editor.self_intersection'],
  },
  {
    name: 'espiga (dos aristas consecutivas colineales superpuestas)',
    from: 'E12c',
    doc: doc([[[0, 0], [100, 0], [100, 100], [0, 100], [0, 50], [0, 80]]]),
    verdict: 'reject',
    codes: ['editor.self_intersection'],
  },
  {
    name: 'vértice que toca una arista no adyacente del mismo polígono',
    from: 'E12c',
    doc: doc([[[0, 0], [100, 0], [100, 100], [50, 0], [0, 100]]]),
    verdict: 'reject',
    codes: ['editor.self_intersection'],
  },
  {
    name: 'solape por cruce propio',
    from: 'E12c',
    doc: doc([square(0, 0, 60, 60), square(40, 40, 100, 100)]),
    verdict: 'reject',
    codes: ['editor.region_overlap'],
  },
  {
    name: 'regiones iguales con otro orden y orientación',
    from: 'E12c',
    doc: doc([big, [[100, 100], [100, 0], [0, 0], [0, 100]]]),
    verdict: 'reject',
    codes: ['editor.region_overlap'],
  },
  {
    name: 'región contenida dentro de otra',
    from: 'E12c',
    doc: doc([big, square(20, 20, 40, 40)]),
    verdict: 'reject',
    codes: ['editor.region_overlap'],
  },
  {
    name: 'menos de 3 vértices',
    from: 'E12c',
    doc: doc([big, [[0, 200], [50, 250]]]),
    verdict: 'reject',
    codes: ['editor.too_few_vertices'],
  },
  {
    name: 'material inexistente',
    from: 'E12c',
    doc: { ...doc([big]), regions: [{ material: 'nope', polygon: big }] },
    verdict: 'reject',
    codes: ['editor.missing_material'],
  },
  {
    name: 'sin regiones',
    from: 'E12c',
    doc: doc([]),
    verdict: 'reject',
    codes: ['editor.out_of_range'],
  },
  {
    name: 'piezométrica con x no creciente',
    from: 'E12c',
    doc: doc([big], { water: { unit_weight: 9.81, piezometric_line: [[0, 50], [50, 50], [50, 40], [100, 40]] } }),
    verdict: 'reject',
    codes: ['editor.piezo_order'],
  },
];
