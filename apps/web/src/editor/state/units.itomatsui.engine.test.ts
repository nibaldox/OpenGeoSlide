// E15i-1 y E15i-4: la conversión de unidades de un pilote con presión del suelo y capacidad, con el motor real (OGS_BIN): el FS no cambia
// de SI a imperial y de vuelta (≤ 1e-9) y lo que gobierna es lo mismo. SKIP hasta la integración: el motor de la rama de W-ito todavía no
// tiene Ito-Matsui (lo agrega M-ito en `ogs-core`); el sondeo de abajo lo activa solo cuando `ogs analyze` acepta `lateral_pressure`.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { saveOgsJson } from '../../io/ogsJson';
import type { ReinforcementForce } from '../../engine/types';
import type { ModelDoc } from '../types';
import { OGS_BIN, engineRun, haveEngine } from './engineRun.testutil';
import { convertDocUnits } from './units';

const METHODS = ['bishop', 'spencer', 'morgenstern_price', 'janbu_simplified', 'janbu_corrected'] as const;

/** V013c (X22): talud de 10 m, pilote vertical en x = 17,5 con S = 2,4 m y D = 0,8 m, círculo fijo. */
const model = (capacity: { shear?: number; moment?: number } | undefined, location: 'centroid' | 'slip_surface' = 'centroid'): ModelDoc =>
  ({
    format: 'opengeoslide',
    version: '0.5',
    meta: { id: 'units-ito-matsui', title: 'Ito-Matsui: unidades' },
    units: 'SI',
    materials: [{ id: 'soil', name: 'Suelo', model: 'mohr_coulomb', unit_weight: 20, unit_weight_sat: null, cohesion: 10, friction_angle: 20, ru: null }],
    regions: [{ material: 'soil', polygon: [[0, -10], [0, 0], [10, 0], [25, 10], [35, 10], [35, -10]] }],
    slope: { direction: 'right_to_left' },
    analysis: {
      methods: [...METHODS],
      slices: 50,
      tolerance: 1e-5,
      max_iterations: 500,
      min_m_alpha: 0.2,
      interslice: { function: 'constant' },
      surface: { type: 'circle', xc: 7.4728309668902995, yc: 26.312711798202947, r: 26.430944193312815 },
    },
    reinforcements: [
      {
        type: 'pile',
        id: 'P1',
        x1: 17.5,
        y1: 5,
        x2: 17.5,
        y2: -10,
        spacing: 2.4,
        direction: 'angle',
        angle: 0,
        application: 'passive',
        lateral_pressure: { model: 'ito_matsui', diameter: 0.8, location },
        ...(capacity ? { capacity } : {}),
      },
    ],
  }) as unknown as ModelDoc;

/** ¿El motor de OGS_BIN conoce `lateral_pressure`? Si no, los tests de abajo se saltan (SKIP hasta la integración con M-ito). */
function engineHasItoMatsui(): boolean {
  if (!haveEngine) return false;
  const dir = mkdtempSync(join(tmpdir(), 'ogs-ito-probe-'));
  try {
    const file = join(dir, 'm.ogs.json');
    writeFileSync(file, saveOgsJson(model({ shear: 150 })));
    const r = spawnSync(OGS_BIN as string, ['analyze', file], { encoding: 'utf8', maxBuffer: 1 << 28 });
    return r.status === 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const haveIto = engineHasItoMatsui();

type Forces = (ReinforcementForce & { soil_force?: number; governs?: string; arm?: number })[];

describe.skipIf(!haveIto)(`conversión de unidades de Ito-Matsui con el motor real (${OGS_BIN})`, () => {
  const run = (doc: ModelDoc) => {
    const r = engineRun(doc);
    expect(r.code, r.out).toBe(0);
    return new Map(r.results.map((x) => [x.method, x]));
  };
  const cases = [
    { name: 'tope al corte (shear 150 kN gobierna)', capacity: { shear: 150, moment: 5000 }, governs: 'shear' },
    { name: 'tope al momento (moment 250 kN·m gobierna)', capacity: { shear: 5000, moment: 250 }, governs: 'bending' },
    { name: 'sin tope (gobierna el suelo)', capacity: undefined, governs: 'soil' },
  ] as const;

  // Perezosos: el cuerpo de `describe.skipIf` se ejecuta aunque se salte, y el motor solo se llama dentro de `it`.
  const memo = <T,>(f: () => T): (() => T) => {
    let v: T | undefined;
    return () => (v === undefined ? (v = f()) : v);
  };

  for (const c of cases) {
    describe(c.name, () => {
      const si = memo(() => run(model(c.capacity)));
      const imp = memo(() => run(convertDocUnits(model(c.capacity), 'imperial')));
      const back = memo(() => run(convertDocUnits(convertDocUnits(model(c.capacity), 'imperial'), 'SI')));

      it.each(METHODS)('%s: el FS es el mismo en SI, en imperial y de vuelta (1e-9)', (method) => {
        const x = si().get(method)!;
        expect(x.status).toBe('converged');
        for (const other of [imp().get(method)!, back().get(method)!]) {
          expect(other.status).toBe('converged');
          expect(Math.abs((x.fos as number) - (other.fos as number)), `${method}: ${x.fos} vs ${other.fos}`).toBeLessThan(1e-9);
        }
      });

      it('lo que gobierna es lo mismo, y el brazo y la fuerza del suelo se escalan', () => {
        const fa = (si().get('bishop')!.reinforcement_forces ?? []) as Forces;
        const fb = (imp().get('bishop')!.reinforcement_forces ?? []) as Forces;
        expect(fa).toHaveLength(1);
        expect(fa[0]!.governs).toBe(c.governs);
        expect(fb[0]!.governs).toBe(c.governs);
        const length = 1 / 0.3048;
        const lineForce = 1000 / 4.4482216152605 / length;
        expect(fb[0]!.arm! / (fa[0]!.arm! * length)).toBeCloseTo(1, 6);
        expect(fb[0]!.soil_force! / (fa[0]!.soil_force! * lineForce)).toBeCloseTo(1, 6);
      });
    });
  }
});

describe('el sondeo del motor', () => {
  it('informa si Ito-Matsui está activo (skip hasta la integración si no)', () => {
    // Siempre pasa: deja constancia en el informe de la suite de si los tests con el motor corrieron.
    expect(typeof haveIto).toBe('boolean');
  });
});
