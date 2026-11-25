// Documentos de prueba compartidos por los tests de src/editor/state (no se importa desde código de producción).

import type { Material, Point } from '../../engine/types';
import type { ModelDoc } from '../types';

export const mat = (id: string, extra: Partial<Material> = {}): Material => ({
  id,
  name: id,
  model: 'mohr_coulomb',
  unit_weight: 18,
  cohesion: 10,
  friction_angle: 25,
  ...extra,
});

export const square = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

/** Dos regiones contiguas que comparten la arista x = 10; piezométrica, búsqueda y un solo material en cada una. */
export function baseDoc(): ModelDoc {
  return {
    format: 'opengeoslide',
    version: '0.2',
    meta: { title: 'Base' },
    units: 'SI',
    materials: [mat('m1'), mat('m2', { unit_weight: 20 })],
    regions: [
      { material: 'm1', polygon: square(0, 0, 10, 10) },
      { material: 'm2', polygon: square(10, 0, 20, 10) },
    ],
    water: {
      unit_weight: 9.81,
      piezometric_line: [
        [0, 5],
        [10, 6],
        [20, 5],
      ],
    },
    slope: { direction: 'auto' },
    analysis: {
      methods: ['bishop'],
      slices: 50,
      surface: { type: 'circle', xc: 10, yc: 20, r: 12 },
    },
  };
}

/** Modelo con un solo polígono y un solo material, para tests de geometría. */
export function singleRegionDoc(polygon: Point[]): ModelDoc {
  return {
    format: 'opengeoslide',
    version: '0.2',
    meta: {},
    materials: [mat('m1')],
    regions: [{ material: 'm1', polygon }],
    analysis: { surface: { type: 'circle', xc: 10, yc: 20, r: 12 } },
  };
}

export function twoRegionDoc(a: Point[], b: Point[]): ModelDoc {
  return {
    format: 'opengeoslide',
    version: '0.2',
    meta: {},
    materials: [mat('m1')],
    regions: [
      { material: 'm1', polygon: a },
      { material: 'm1', polygon: b },
    ],
    analysis: { surface: { type: 'circle', xc: 10, yc: 20, r: 12 } },
  };
}
