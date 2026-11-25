import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeMock } from '../../engine/mockEngine';
import { saveOgsJson } from '../../io/ogsJson';
import { validateLocal } from '../state';
import type { ModelDoc } from '../types';
import {
  emptyModel,
  simpleSlope,
  slopeFormDefaults,
  slopeFromForm,
  slopeTitle,
  type SlopeForm,
  type SlopeInput,
} from './newModel';

const OGS_BIN = process.env.OGS_BIN;
const haveEngine = OGS_BIN !== undefined && existsSync(OGS_BIN);

const errorsOf = (doc: ModelDoc) => validateLocal(doc).filter((i) => i.severity === 'error');

function input(over: Partial<SlopeInput> = {}): SlopeInput {
  return {
    units: 'SI',
    height: 10,
    slope: { kind: 'angle', degrees: 45 },
    crownWidth: 10,
    toeWidth: 20,
    depth: 10,
    material: { name: 'Suelo', unit_weight: 20, cohesion: 10, friction_angle: 30 },
    water: 'none',
    ...over,
  };
}

describe('emptyModel («Modelo vacío»)', () => {
  it('no tiene regiones, trae un material por defecto y es v0.2', () => {
    const doc = emptyModel();
    expect(doc.version).toBe('0.2');
    expect(doc.regions).toEqual([]);
    expect(doc.materials).toHaveLength(1);
    expect(doc.materials[0]).toMatchObject({ id: 'suelo', model: 'mohr_coulomb', unit_weight: 18, cohesion: 5, friction_angle: 30 });
  });
  it('la única incidencia local es que falta dibujar una región (ya trae una búsqueda)', () => {
    const issues = validateLocal(emptyModel());
    expect(issues.map((i) => i.path)).toEqual(['/regions']);
    expect(issues[0]?.text).toMatch(/Dibujar región/);
    expect(emptyModel().analysis.search).toBeTruthy();
  });
  it('en unidades imperiales usa pcf y psf', () => {
    const doc = emptyModel('imperial');
    expect(doc.units).toBe('imperial');
    expect(doc.materials[0]).toMatchObject({ unit_weight: 115, cohesion: 100 });
  });
  it('cada llamada devuelve un documento independiente', () => {
    const a = emptyModel();
    a.materials[0]!.name = 'otro';
    expect(emptyModel().materials[0]!.name).toBe('Suelo');
  });
});

describe('simpleSlope: geometría', () => {
  it('H = 10, β = 45°, corona 10, pie 20, profundidad 10', () => {
    const doc = simpleSlope(input());
    expect(doc.regions).toHaveLength(1);
    expect(doc.regions[0]).toEqual({ material: 'suelo', polygon: [[0, -10], [40, -10], [40, 0], [20, 0], [10, 10], [0, 10]] });
    expect(doc.slope).toEqual({ direction: 'left_to_right' });
    expect(doc.version).toBe('0.2');
    expect(errorsOf(doc)).toEqual([]);
  });
  it('trae una búsqueda por defecto y Bishop con Spencer', () => {
    const doc = simpleSlope(input());
    expect(doc.analysis.methods).toEqual(['bishop', 'spencer']);
    expect(doc.analysis.search).toMatchObject({ type: 'circular_entry_exit', entry: null, exit: null });
    expect(doc.analysis.surface ?? null).toBeNull();
  });
  it('la pendiente H:V equivale al ángulo: 2H:1V → la base del talud mide 2 H', () => {
    const doc = simpleSlope(input({ slope: { kind: 'ratio', horizontal: 2 }, crownWidth: 5, toeWidth: 5 }));
    expect(doc.regions[0]?.polygon).toEqual([[0, -10], [30, -10], [30, 0], [25, 0], [5, 10], [0, 10]]);
  });
  it('un ángulo no exacto se redondea a 6 decimales (sin ruido de coma flotante)', () => {
    const poly = simpleSlope(input({ slope: { kind: 'angle', degrees: 30 } })).regions[0]!.polygon;
    expect(poly[3]![0]).toBeCloseTo(10 + 10 / Math.tan((30 * Math.PI) / 180), 6);
    for (const [x, y] of poly) {
      expect(Number(x.toFixed(6))).toBe(x);
      expect(Number(y.toFixed(6))).toBe(y);
    }
  });
  it('sin ancho de pie ni de corona no deja vértices repetidos', () => {
    const doc = simpleSlope(input({ crownWidth: 0, toeWidth: 0 }));
    expect(doc.regions[0]?.polygon).toEqual([[0, -10], [10, -10], [10, 0], [0, 10]]);
    expect(validateLocal(doc).filter((i) => i.code === 'editor.duplicate_vertex')).toEqual([]);
    expect(errorsOf(doc)).toEqual([]);
  });
  it('el material y el título describen el talud', () => {
    const doc = simpleSlope(input({ material: { name: 'Arcilla', unit_weight: 19, cohesion: 25, friction_angle: 20 } }));
    expect(doc.materials).toEqual([
      { id: 'suelo', name: 'Arcilla', model: 'mohr_coulomb', unit_weight: 19, unit_weight_sat: null, cohesion: 25, friction_angle: 20, ru: null },
    ]);
    expect(doc.meta.title).toBe('Talud simple H = 10 m, β = 45°');
    expect(slopeTitle(input({ slope: { kind: 'ratio', horizontal: 1.5 }, height: 8 }))).toBe('Talud simple H = 8 m, 1,5H:1V');
    expect(slopeTitle(input({ units: 'imperial', height: 30 }))).toContain('30 ft');
  });
});

describe('simpleSlope: piezométrica', () => {
  it('sin agua no define piezométrica', () => {
    expect(simpleSlope(input()).water ?? null).toBeNull();
  });
  it('en el pie: aflora en el pie y llega a la mitad de la altura atrás', () => {
    const doc = simpleSlope(input({ water: 'toe' }));
    expect(doc.water?.piezometric_line).toEqual([[0, 5], [20, 0], [40, 0]]);
    expect(doc.water?.unit_weight).toBe(9.81);
    expect(errorsOf(doc)).toEqual([]);
  });
  it('en la corona: aflora en el pie y llega a la cota de la corona atrás', () => {
    const doc = simpleSlope(input({ water: 'crown' }));
    expect(doc.water?.piezometric_line).toEqual([[0, 10], [20, 0], [40, 0]]);
    expect(errorsOf(doc)).toEqual([]);
  });
  it('sin ancho de pie la piezométrica termina en el pie', () => {
    const doc = simpleSlope(input({ water: 'crown', toeWidth: 0 }));
    expect(doc.water?.piezometric_line).toEqual([[0, 10], [20, 0]]);
    expect(errorsOf(doc)).toEqual([]);
  });
  it('en imperial escribe γw = 62,4 pcf (el motor no convierte)', () => {
    const doc = simpleSlope(input({ units: 'imperial', water: 'toe' }));
    expect(doc.water?.unit_weight).toBe(62.4);
    expect(errorsOf(doc)).toEqual([]);
  });
});

describe('slopeFromForm: validación en línea', () => {
  const ok = (over: Partial<SlopeForm> = {}) => slopeFromForm({ ...slopeFormDefaults('SI'), ...over });
  const errs = (over: Partial<SlopeForm> = {}): Record<string, string> => {
    const r = ok(over);
    return r.ok ? {} : r.errors;
  };

  it('los valores por defecto son válidos y son los del ejemplo H = 10, β = 45°, c = 10, φ = 30, γ = 20', () => {
    const r = ok();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toMatchObject({ height: 10, slope: { kind: 'angle', degrees: 45 }, water: 'none' });
      expect(r.value.material).toMatchObject({ unit_weight: 20, cohesion: 10, friction_angle: 30 });
    }
  });
  it('acepta coma decimal', () => {
    const r = ok({ height: '12,5', angle: '33,5' });
    expect(r.ok && r.value.height).toBe(12.5);
    expect(r.ok && r.value.slope).toEqual({ kind: 'angle', degrees: 33.5 });
  });
  it('la altura debe ser mayor que 0', () => {
    expect(errs({ height: '0' }).height).toMatch(/Altura H/);
    expect(errs({ height: '' }).height).toMatch(/Altura H/);
    expect(errs({ height: 'abc' }).height).toMatch(/Altura H/);
  });
  it('el ángulo debe estar entre 1° y 89°', () => {
    expect(errs({ angle: '0' }).angle).toMatch(/Ángulo β/);
    expect(errs({ angle: '90' }).angle).toMatch(/Ángulo β/);
    expect(errs({ angle: '' }).angle).toMatch(/Ángulo β/);
    expect(errs({ angle: '1' }).angle).toBeUndefined();
  });
  it('en modo pendiente se valida H:V y no el ángulo', () => {
    const e = errs({ mode: 'ratio', angle: '999', ratio: '0' });
    expect(e.ratio).toMatch(/Pendiente/);
    expect(e.angle).toBeUndefined();
    const r = ok({ mode: 'ratio', ratio: '1,5' });
    expect(r.ok && r.value.slope).toEqual({ kind: 'ratio', horizontal: 1.5 });
  });
  it('corona y pie no pueden ser negativos; la profundidad debe ser mayor que 0', () => {
    expect(errs({ crown: '-1' }).crown).toMatch(/Ancho de corona/);
    expect(errs({ toe: '-1' }).toe).toMatch(/Ancho de pie/);
    expect(errs({ depth: '0' }).depth).toMatch(/Profundidad/);
    expect(errs({ crown: '0', toe: '0' })).toEqual({});
  });
  it('el material usa las reglas de los paneles', () => {
    const e = errs({ unit_weight: '0', cohesion: '-5', friction_angle: '95' });
    expect(e.unit_weight).toMatch(/Peso unitario γ/);
    expect(e.cohesion).toMatch(/Cohesión c/);
    expect(e.friction_angle).toMatch(/Ángulo de fricción φ/);
  });
  it('los valores por defecto imperiales usan pies, pcf y psf', () => {
    const f = slopeFormDefaults('imperial');
    expect(Number(f.unit_weight.replace(',', '.'))).toBeGreaterThan(100);
    const r = slopeFromForm(f);
    expect(r.ok && r.value.units).toBe('imperial');
  });
});

describe('simpleSlope con el motor', () => {
  const dryDoc = simpleSlope(input());

  it('motor simulado: un talud simple calcula con Bishop y Spencer', () => {
    const report = analyzeMock(saveOgsJson(dryDoc));
    expect(report.results.map((r) => r.method)).toEqual(['bishop', 'spencer']);
  });

  function engineRun(doc: ModelDoc): { code: number | null; out: string; results: { method: string; fos: number | null; status: string }[] } {
    const dir = mkdtempSync(join(tmpdir(), 'ogs-newmodel-'));
    try {
      const file = join(dir, 'm.ogs.json');
      writeFileSync(file, saveOgsJson(doc));
      const r = spawnSync(OGS_BIN as string, ['analyze', file], { encoding: 'utf8', maxBuffer: 1 << 28 });
      const out = `${r.stderr}${r.stdout}`;
      const parsed = r.status === 0 ? (JSON.parse(r.stdout) as { results: { method: string; fos: number | null; status: string }[] }) : { results: [] };
      return { code: r.status, out, results: parsed.results };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it.skipIf(!haveEngine)('H = 10, β = 45°, c = 10, φ = 30, γ = 20, sin agua: FS finito con Bishop y Spencer', () => {
    const r = engineRun(dryDoc);
    expect(r.code, r.out.slice(0, 300)).toBe(0);
    const by = Object.fromEntries(r.results.map((x) => [x.method, x]));
    for (const method of ['bishop', 'spencer']) {
      const x = by[method];
      expect(x, method).toBeDefined();
      expect(x!.status).toBe('converged');
      expect(Number.isFinite(x!.fos)).toBe(true);
      expect(x!.fos as number).toBeGreaterThan(0.5);
      expect(x!.fos as number).toBeLessThan(3);
    }
  });

  it.skipIf(!haveEngine)('la dirección «de izquierda a derecha» es la correcta: da lo mismo que «auto» y la contraria no encuentra superficie', () => {
    const left = engineRun(dryDoc);
    const auto = engineRun({ ...dryDoc, slope: { direction: 'auto' } });
    const right = engineRun({ ...dryDoc, slope: { direction: 'right_to_left' } });
    expect(left.results.map((x) => x.fos)).toEqual(auto.results.map((x) => x.fos));
    expect(right.code).not.toBe(0);
    expect(right.out).toMatch(/NoValidSurface/);
  });

  it.skipIf(!haveEngine)('con piezométrica (pie y corona) calcula y un nivel más alto baja el FS', () => {
    const dry = engineRun(dryDoc).results.find((x) => x.method === 'bishop')!.fos as number;
    const toe = engineRun(simpleSlope(input({ water: 'toe' })));
    const crown = engineRun(simpleSlope(input({ water: 'crown' })));
    expect(toe.code, toe.out.slice(0, 300)).toBe(0);
    expect(crown.code, crown.out.slice(0, 300)).toBe(0);
    const fsToe = toe.results.find((x) => x.method === 'bishop')!.fos as number;
    const fsCrown = crown.results.find((x) => x.method === 'bishop')!.fos as number;
    expect(fsToe).toBeLessThanOrEqual(dry + 1e-9);
    expect(fsCrown).toBeLessThan(fsToe);
    expect(Number.isFinite(fsCrown)).toBe(true);
  });

  it.skipIf(!haveEngine)('la pendiente H:V y el imperial también calculan', () => {
    const ratio = engineRun(simpleSlope(input({ slope: { kind: 'ratio', horizontal: 2 } })));
    expect(ratio.code, ratio.out.slice(0, 300)).toBe(0);
    const imperial = engineRun(
      simpleSlope(input({ units: 'imperial', height: 30, crownWidth: 30, toeWidth: 60, depth: 30, material: { name: 'Suelo', unit_weight: 125, cohesion: 200, friction_angle: 30 }, water: 'crown' })),
    );
    expect(imperial.code, imperial.out.slice(0, 300)).toBe(0);
    expect(Number.isFinite(imperial.results[0]!.fos as number)).toBe(true);
  });

  it.skipIf(!haveEngine)('el modelo vacío no calcula (sin regiones): el motor lo rechaza como modelo no válido', () => {
    const r = engineRun(emptyModel());
    expect(r.code).not.toBe(0);
  });
});
