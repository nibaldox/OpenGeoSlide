// F5.7: la conversión de unidades con el motor real (OGS_BIN): el FS no cambia al pasar de SI a imperial y de vuelta (1e-9) con agua embalsada
// (piezométrica sobre el terreno, automática en todas las versiones) y con la grieta de tracción (v0.5).
//
// La grieta usa los stubs del motor hasta la integración del bloque F3G (M-grieta, `crates/ogs-core/src/crack.rs`): sus tests están
// marcados `skip` con el comentario de abajo y se activan en la integración (cambiar `itCrack` a `it`).
import { describe, expect, it } from 'vitest';
import type { TensionCrack } from '../../engine/types';
import { OGS_BIN, engineRun, haveEngine, type EngineMethodResult } from './engineRun.testutil';
import { convertDocUnits } from './units';
import type { ModelDoc } from '../types';

const METHODS = ['bishop', 'spencer', 'morgenstern_price', 'janbu_simplified'] as const;

/** Talud con un embalse al pie: el nivel 8 queda sobre el terreno (y = 5) entre x = 0 y x ≈ 36. */
const model = (crack?: TensionCrack): ModelDoc =>
  ({
    format: 'opengeoslide',
    version: crack ? '0.5' : '0.4',
    meta: { id: 'units-crack', title: 'Grieta y agua embalsada: unidades' },
    units: 'SI',
    materials: [{ id: 'clay', name: 'Arcilla', model: 'mohr_coulomb', unit_weight: 20, unit_weight_sat: null, cohesion: 12, friction_angle: 23, ru: null }],
    regions: [{ material: 'clay', polygon: [[0, 0], [0, 5], [30, 5], [50, 15], [80, 15], [80, 0]] }],
    water: { unit_weight: 9.807, piezometric_line: [[0, 8], [36, 8], [80, 8]] },
    slope: { direction: 'auto' },
    analysis: {
      methods: [...METHODS],
      slices: 50,
      tolerance: 1e-5,
      max_iterations: 500,
      min_m_alpha: 0.2,
      surface: { type: 'circle', xc: 35.4, yc: 25.467, r: 22.099 },
      ...(crack ? { tension_crack: crack } : {}),
    },
  }) as unknown as ModelDoc;

const memo = <T,>(f: () => T): (() => T) => {
  let v: T | undefined;
  return () => (v === undefined ? (v = f()) : v);
};

function suite(title: string, crack: TensionCrack | undefined, itCase: typeof it): void {
  describe.skipIf(!haveEngine)(`${title} (${OGS_BIN})`, () => {
    const run = (doc: ModelDoc): Map<string, EngineMethodResult> => {
      const r = engineRun(doc);
      expect(r.code, r.out).toBe(0);
      return new Map(r.results.map((x) => [x.method, x]));
    };
    const A = memo(() => run(model(crack)));
    const B = memo(() => run(convertDocUnits(model(crack), 'imperial')));
    const C = memo(() => run(convertDocUnits(convertDocUnits(model(crack), 'imperial'), 'SI')));

    itCase.each(METHODS)('%s: el FS es el mismo en SI y en imperial (1e-9)', (method) => {
      const x = A().get(method);
      const y = B().get(method);
      expect(x?.status).toBe('converged');
      expect(y?.status).toBe('converged');
      expect(Math.abs((x!.fos as number) - (y!.fos as number)), `${method}: SI ${x!.fos} vs imperial ${y!.fos}`).toBeLessThan(1e-9);
    });

    itCase.each(METHODS)('%s: SI → imperial → SI devuelve el mismo FS (1e-9)', (method) => {
      expect(Math.abs((A().get(method)!.fos as number) - (C().get(method)!.fos as number))).toBeLessThan(1e-9);
    });
  });
}

// Agua embalsada sin grieta: automática en todas las versiones (D1), así que corre con el motor de esta rama.
suite('agua embalsada: conversión de unidades con el motor real', undefined, it);

// Grieta de tracción: con los stubs de la base G0 el motor responde NotImplemented. Se activa en la integración de F3G (`itCrack = it`).
const itCrack = it.skip as unknown as typeof it;
suite('grieta de tracción fija: conversión de unidades con el motor real', { depth: 2, water_fill: 1 }, itCrack);
suite('grieta de tracción automática: conversión de unidades con el motor real', { depth: 'auto', water_fill: 0.5 }, itCrack);
