// Lógica pura de los paneles con la v0.3: material no drenado, métodos y función entre dovelas, superficie polilínea.
import { describe, expect, it } from 'vitest';
import type { Material, Point } from '../../engine/types';
import type { ModelDoc } from '../types';
import { applyCommand } from '../state/reducer';
import { validateLocal, RULE_TEXT } from '../state/validateLocal';
import { baseDoc, mat } from '../state/testFixtures';
import {
  BISHOP_POLYLINE_NOTE,
  DEFAULT_DATA_POINTS,
  INTERSLICE_OPTIONS,
  MATERIAL_MODEL_OPTIONS,
  METHOD_LABELS,
  METHOD_ORDER,
  analysisCommands,
  analysisFromForm,
  analysisToForm,
  dataPointsCommand,
  dataPointsFromForm,
  dataPointsToForm,
  initialPolyline,
  insertDataPoint,
  insertPolylinePoint,
  intersliceFunctionCommand,
  intersliceFunctionOf,
  isFixedPolyline,
  materialFromForm,
  materialToForm,
  materialsEqual,
  methodDisabledReason,
  newMaterialForm,
  polylineFromForm,
  polylineRowsSorted,
  polylineToForm,
  removeDataPoint,
  removePolylinePoint,
  setSuVariable,
  sortPolylineRows,
  surfaceShapeCommands,
  switchMaterialModel,
  unitLabels,
  type MaterialForm,
} from './forms';

const ctx = { otherIds: [] as string[], editing: null };
const errorsOf = <V,>(r: { ok: boolean; errors?: Record<string, string>; value?: V }): Record<string, string> => (r.ok ? {} : (r.errors ?? {}));

const su: Material = { id: 'arcilla', name: 'Arcilla', model: 'undrained', unit_weight: 18, undrained_strength: 25 };
const suLinear: Material = { ...su, strength_datum: 30, strength_gradient: 1.5, strength_limit: 60 };

describe('etiquetas y orden de los métodos (F3.9)', () => {
  it('los cinco métodos, en orden, con las etiquetas fijas', () => {
    expect(METHOD_ORDER).toEqual(['bishop', 'spencer', 'morgenstern_price', 'janbu_simplified', 'janbu_corrected']);
    expect(METHOD_ORDER.map((m) => METHOD_LABELS[m])).toEqual(['Bishop simplificado', 'Spencer', 'Morgenstern-Price', 'Janbu simplificado', 'Janbu corregido']);
  });
  it('funciones de interfaz y modelos con sus etiquetas', () => {
    expect(INTERSLICE_OPTIONS.map((o) => [o.value, o.label])).toEqual([
      ['constant', 'Constante'],
      ['half_sine', 'Medio seno'],
      ['clipped_sine', 'Seno recortado (mín. 0,35)'],
      ['trapezoidal', 'Trapezoidal (20 %-80 %)'],
      ['data_points', 'Definida por puntos'],
    ]);
    expect(MATERIAL_MODEL_OPTIONS.map((o) => [o.value, o.label])).toEqual([
      ['mohr_coulomb', 'Mohr-Coulomb'],
      ['undrained', 'No drenado (Su)'],
    ]);
  });
  it('unidades del gradiente de Su', () => {
    expect(unitLabels('SI').stressGradient).toBe('kPa/m');
    expect(unitLabels('imperial').stressGradient).toBe('psf/ft');
  });
});

describe('material no drenado: formulario', () => {
  it('un no drenado constante se lee y se escribe sin cohesión ni fricción ni campos vacíos', () => {
    const form = materialToForm(su);
    expect(form).toMatchObject({ model: 'undrained', undrained_strength: '25', variable: false });
    const r = materialFromForm(form, ctx);
    expect(r.ok && r.value).toEqual({ id: 'arcilla', name: 'Arcilla', model: 'undrained', unit_weight: 18, unit_weight_sat: null, ru: null, undrained_strength: 25 });
    expect(r.ok && Object.keys(r.value)).not.toContain('cohesion');
  });

  it('con «Su variable con la cota» exige cota y gradiente; el límite es opcional', () => {
    const form = materialToForm(suLinear);
    expect(form).toMatchObject({ variable: true, strength_datum: '30', strength_gradient: '1,5', strength_limit: '60' });
    const r = materialFromForm(form, ctx);
    expect(r.ok && r.value).toMatchObject({ strength_datum: 30, strength_gradient: 1.5, strength_limit: 60 });
    const sinLimite = materialFromForm({ ...form, strength_limit: '' }, ctx);
    expect(sinLimite.ok && 'strength_limit' in sinLimite.value).toBe(false);
    const e = errorsOf(materialFromForm({ ...form, strength_datum: '', strength_gradient: 'x' }, ctx));
    expect(e.strength_datum).toBe(RULE_TEXT.strengthDatum);
    expect(e.strength_gradient).toContain('escriba un número');
  });

  it('con «Su variable» apagada no escribe cota, gradiente ni límite aunque el formulario los conserve', () => {
    const r = materialFromForm({ ...materialToForm(suLinear), variable: false }, ctx);
    expect(r.ok && r.value).toEqual({ id: 'arcilla', name: 'Arcilla', model: 'undrained', unit_weight: 18, unit_weight_sat: null, ru: null, undrained_strength: 25 });
  });

  it('rangos: Su ≥ 0 finita, límite ≥ 0, el gradiente puede ser negativo', () => {
    const base = materialToForm(suLinear);
    expect(errorsOf(materialFromForm({ ...base, undrained_strength: '-1' }, ctx)).undrained_strength).toBe(RULE_TEXT.undrainedStrength);
    expect(errorsOf(materialFromForm({ ...base, undrained_strength: '' }, ctx)).undrained_strength).toBe(RULE_TEXT.undrainedStrength);
    expect(errorsOf(materialFromForm({ ...base, strength_limit: '-5' }, ctx)).strength_limit).toBe(RULE_TEXT.strengthLimit);
    expect(materialFromForm({ ...base, strength_gradient: '-1,5' }, ctx).ok).toBe(true);
    expect(materialFromForm({ ...base, undrained_strength: '0' }, ctx).ok).toBe(true);
  });

  it('un no drenado ya no pide cohesión ni φ; Mohr-Coulomb los sigue pidiendo y no escribe campos de Su', () => {
    expect(materialFromForm({ ...materialToForm(su), cohesion: '', friction_angle: 'abc' }, ctx).ok).toBe(true);
    const mc = materialToForm(mat('s'));
    expect(errorsOf(materialFromForm({ ...mc, cohesion: '' }, ctx)).cohesion).toBe(RULE_TEXT.cohesion);
    const ok = materialFromForm({ ...mc, undrained_strength: '99', variable: true, strength_datum: '5' }, ctx);
    expect(ok.ok && ok.value).toEqual({ id: 's', name: 's', model: 'mohr_coulomb', unit_weight: 18, unit_weight_sat: null, cohesion: 10, friction_angle: 25, ru: null });
  });

  it('el formulario de un material nuevo es Mohr-Coulomb y trae un Su de partida con las unidades del modelo', () => {
    expect(newMaterialForm([], 'SI')).toMatchObject({ model: 'mohr_coulomb', undrained_strength: '25' });
    expect(newMaterialForm([], 'imperial').undrained_strength).toBe('500');
  });

  it('un material nuevo no drenado construido desde el formulario pasa la validación local', () => {
    const form: MaterialForm = { ...newMaterialForm(['m1'], 'SI'), model: 'undrained' };
    const r = materialFromForm(form, ctx);
    expect(r.ok).toBe(true);
    const doc = applyCommand({ ...baseDoc(), materials: [mat('m1'), mat('m2')] }, { type: 'material/upsert', material: r.ok ? r.value : (null as never) });
    expect(validateLocal(doc as ModelDoc).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('materialsEqual distingue los campos de Su', () => {
    expect(materialsEqual(su, { ...su })).toBe(true);
    expect(materialsEqual(su, { ...su, undrained_strength: 26 })).toBe(false);
    expect(materialsEqual(suLinear, { ...suLinear, strength_gradient: 2 })).toBe(false);
    expect(materialsEqual(su, { ...su, strength_limit: null })).toBe(true);
  });
});

describe('cambio de modelo y Su variable', () => {
  it('Mohr-Coulomb → no drenado: Su parte de la cohesión; sin cohesión, de un valor típico; se pierden c y φ; γ y ru se conservan', () => {
    const mc = mat('s', { cohesion: 40, unit_weight_sat: 20, ru: 0.1 });
    expect(switchMaterialModel(mc, 'undrained')).toEqual({ id: 's', name: 's', model: 'undrained', unit_weight: 18, unit_weight_sat: 20, ru: 0.1, undrained_strength: 40 });
    expect(switchMaterialModel(mat('s', { cohesion: 0 }), 'undrained').undrained_strength).toBe(25);
    expect(switchMaterialModel(mat('s', { cohesion: 0 }), 'undrained', 'imperial').undrained_strength).toBe(500);
  });
  it('no drenado → Mohr-Coulomb: c = Su y φ = 0, sin campos de Su', () => {
    expect(switchMaterialModel(suLinear, 'mohr_coulomb')).toEqual({ id: 'arcilla', name: 'Arcilla', model: 'mohr_coulomb', unit_weight: 18, unit_weight_sat: null, ru: null, cohesion: 25, friction_angle: 0 });
  });
  it('el mismo modelo devuelve el mismo material', () => {
    expect(switchMaterialModel(su, 'undrained')).toBe(su);
  });
  it('el material convertido pasa la validación local en los dos sentidos', () => {
    const doc = baseDoc();
    for (const m of [switchMaterialModel(doc.materials[0] as Material, 'undrained'), switchMaterialModel(suLinear, 'mohr_coulomb')]) {
      const next = applyCommand({ ...doc, materials: [{ ...m, id: 'm1' }, doc.materials[1] as Material] }, { type: 'material/upsert', material: { ...m, id: 'm1' } });
      expect(validateLocal(next as ModelDoc).filter((i) => i.severity === 'error')).toEqual([]);
    }
  });

  it('«Su variable con la cota»: al activarla toma la cota más alta del material y un gradiente de partida; al apagarla los quita', () => {
    const doc = { ...baseDoc(), regions: [{ material: 'arcilla', polygon: [[0, 0], [10, 0], [10, 12.345], [0, 12.345]] as Point[] }], materials: [su] };
    const on = setSuVariable(su, true, doc);
    expect(on).toMatchObject({ strength_datum: 12.35, strength_gradient: 1.5 });
    expect(setSuVariable(on, false, doc)).toEqual(su);
    expect(setSuVariable(su, true, { ...doc, units: 'imperial' }).strength_gradient).toBe(10);
    // un material Mohr-Coulomb no cambia
    const mc = mat('s');
    expect(setSuVariable(mc, true, doc)).toBe(mc);
  });
});

describe('Bishop con una polilínea fija (F3.6)', () => {
  const polyDoc = (extra = {}): ModelDoc => ({ ...baseDoc(), analysis: { ...baseDoc().analysis, surface: { type: 'polyline', points: [[2, 3], [10, 1], [18, 4]] }, ...extra } });

  it('isFixedPolyline: polilínea sin búsqueda; con búsqueda o con círculo no', () => {
    expect(isFixedPolyline(polyDoc().analysis)).toBe(true);
    expect(isFixedPolyline(polyDoc({ search: { type: 'circular_entry_exit' } }).analysis)).toBe(false);
    expect(isFixedPolyline(baseDoc().analysis)).toBe(false);
  });
  it('solo Bishop se deshabilita, con la explicación', () => {
    const a = polyDoc().analysis;
    expect(methodDisabledReason('bishop', a)).toBe(BISHOP_POLYLINE_NOTE);
    expect(BISHOP_POLYLINE_NOTE).toContain('Bishop simplificado no se ofrece en superficies no circulares');
    for (const m of ['spencer', 'morgenstern_price', 'janbu_simplified', 'janbu_corrected'] as const) expect(methodDisabledReason(m, a)).toBeNull();
    expect(methodDisabledReason('bishop', baseDoc().analysis)).toBeNull();
  });
});

describe('análisis: métodos nuevos y función entre dovelas', () => {
  const mpDoc = (interslice?: ModelDoc['analysis']['interslice']): ModelDoc => ({ ...baseDoc(), analysis: { ...baseDoc().analysis, methods: ['morgenstern_price'], interslice } });

  it('el formulario ordena los cinco métodos y admite desmarcar todos menos uno', () => {
    const doc = { ...baseDoc(), analysis: { ...baseDoc().analysis, methods: ['janbu_corrected', 'bishop', 'morgenstern_price'] as const } } as unknown as ModelDoc;
    expect(analysisToForm(doc).methods).toEqual(['bishop', 'morgenstern_price', 'janbu_corrected']);
  });

  it('la función vigente es la del documento, o medio seno sin ella', () => {
    expect(intersliceFunctionOf(mpDoc().analysis)).toBe('half_sine');
    expect(intersliceFunctionOf(mpDoc({ function: 'trapezoidal' }).analysis)).toBe('trapezoidal');
  });

  it('cambiar la función: las demás no llevan puntos; data_points conserva su tabla o toma la de partida', () => {
    const doc = mpDoc();
    expect(intersliceFunctionCommand(doc, 'clipped_sine')).toEqual({ type: 'analysis/patch', patch: { interslice: { function: 'clipped_sine' } } });
    expect(intersliceFunctionCommand(doc, 'data_points')).toEqual({ type: 'analysis/patch', patch: { interslice: { function: 'data_points', points: DEFAULT_DATA_POINTS } } });
    const own = mpDoc({ function: 'data_points', points: [[0, 1], [1, 2]] });
    expect(intersliceFunctionCommand(own, 'data_points')).toEqual({ type: 'analysis/patch', patch: { interslice: { function: 'data_points', points: [[0, 1], [1, 2]] } } });
    const next = applyCommand(doc, intersliceFunctionCommand(doc, 'data_points'));
    expect(validateLocal(next as ModelDoc).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('desmarcar Morgenstern-Price quita la función en el mismo comando; con ella marcada no la toca', () => {
    const doc = mpDoc({ function: 'half_sine' });
    const off = analysisFromForm({ ...analysisToForm(doc), methods: ['spencer'] });
    expect(off.ok).toBe(true);
    const cmds = analysisCommands(doc, (off as { ok: true; value: Parameters<typeof analysisCommands>[1] }).value);
    expect(cmds).toHaveLength(1);
    const next = applyCommand(doc, cmds[0] as never) as ModelDoc;
    expect('interslice' in next.analysis).toBe(false);
    expect(next.analysis.methods).toEqual(['spencer']);
    expect(validateLocal(next).filter((i) => i.severity === 'error')).toEqual([]);
    const same = analysisFromForm(analysisToForm(doc));
    expect(analysisCommands(doc, (same as { ok: true; value: Parameters<typeof analysisCommands>[1] }).value)).toEqual([]);
  });

  describe('tabla de «Definida por puntos»', () => {
    const rows = (pts: Point[]) => dataPointsToForm(pts);

    it('ida y vuelta con coma decimal', () => {
      const form = rows([[0, 0], [0.25, 0.5], [1, 0]]);
      expect(form).toEqual([{ xi: '0', f: '0' }, { xi: '0,25', f: '0,5' }, { xi: '1', f: '0' }]);
      const r = dataPointsFromForm(form);
      expect(r.ok && r.value).toEqual([[0, 0], [0.25, 0.5], [1, 0]]);
    });

    it('ξ de 0 a 1 y creciente; f ≥ 0; algún f > 0; al menos 2 puntos (mismos textos que validateLocal)', () => {
      expect(errorsOf(dataPointsFromForm(rows([[0.1, 1], [1, 1]])))['0.xi']).toBe(RULE_TEXT.intersliceStart);
      expect(errorsOf(dataPointsFromForm(rows([[0, 1], [0.9, 1]])))['1.xi']).toBe(RULE_TEXT.intersliceEnd);
      expect(errorsOf(dataPointsFromForm(rows([[0, 1], [0.5, 1], [0.5, 2], [1, 1]])))['2.xi']).toBe(RULE_TEXT.intersliceOrder);
      expect(errorsOf(dataPointsFromForm(rows([[0, 1], [0.5, -1], [1, 1]])))['1.f']).toBe(RULE_TEXT.intersliceNegative);
      expect(errorsOf(dataPointsFromForm(rows([[0, 0], [1, 0]]))).table).toBe(RULE_TEXT.intersliceAllZero);
      expect(errorsOf(dataPointsFromForm(rows([[0, 1]]))).table).toBe(RULE_TEXT.intersliceMinPoints);
      expect(errorsOf(dataPointsFromForm([{ xi: '0', f: 'x' }, { xi: '1', f: '1' }]))['0.f']).toContain('escriba un número');
    });

    it('agregar entre dos puntos no cambia la forma y quitar exige 2 puntos como mínimo', () => {
      expect(insertDataPoint([[0, 0], [1, 1]], 0)).toEqual([[0, 0], [0.5, 0.5], [1, 1]]);
      expect(removeDataPoint([[0, 0], [0.5, 1], [1, 0]], 1)).toEqual([[0, 0], [1, 0]]);
      expect(removeDataPoint([[0, 0], [1, 0]], 0)).toBeNull();
    });

    it('el comando fija la función y la tabla (copia)', () => {
      const pts: Point[] = [[0, 0], [1, 1]];
      const cmd = dataPointsCommand(pts);
      expect(cmd).toEqual({ type: 'analysis/patch', patch: { interslice: { function: 'data_points', points: [[0, 0], [1, 1]] } } });
      expect((cmd as { patch: { interslice: { points: Point[] } } }).patch.interslice.points).not.toBe(pts);
    });
  });
});

describe('superficie polilínea: tabla de puntos', () => {
  const ctxX = { xRange: [0, 20] as [number, number] };

  it('ida y vuelta de la tabla', () => {
    const rows = polylineToForm([[2, 3], [10.5, 1], [18, 4]]);
    expect(rows).toEqual([{ x: '2', y: '3' }, { x: '10,5', y: '1' }, { x: '18', y: '4' }]);
    const r = polylineFromForm(rows, ctxX);
    expect(r.ok && r.value).toEqual([[2, 3], [10.5, 1], [18, 4]]);
  });

  it('al menos 2 puntos, números finitos y x estrictamente creciente', () => {
    expect(errorsOf(polylineFromForm([{ x: '1', y: '1' }], ctxX)).table).toContain('al menos 2 puntos');
    expect(errorsOf(polylineFromForm([{ x: '1', y: '1' }, { x: 'a', y: '1' }], ctxX))['1.x']).toContain('escriba un número');
    const order = errorsOf(polylineFromForm([{ x: '1', y: '1' }, { x: '1', y: '2' }, { x: '5', y: '1' }], ctxX));
    expect(order['1.x']).toContain('mayor que la del punto anterior');
    expect(order.table).toBe(RULE_TEXT.polylineOrder);
    expect(errorsOf(polylineFromForm([{ x: '5', y: '1' }, { x: '2', y: '1' }], ctxX))['1.x']).toBeDefined();
    // separación mínima: 1e-9 · 20 = 2e-8
    expect(polylineFromForm([{ x: '1', y: '1' }, { x: '1,000000001', y: '2' }], ctxX).ok).toBe(false);
    expect(polylineFromForm([{ x: '1', y: '1' }, { x: '1,000001', y: '2' }], ctxX).ok).toBe(true);
  });

  it('agregar es un punto a medio camino (la forma no cambia), quitar exige 2 puntos y ordenar por x reordena las filas', () => {
    expect(insertPolylinePoint([[2, 3], [10, 1], [18, 4]], 0)).toEqual([[2, 3], [6, 2], [10, 1], [18, 4]]);
    expect(insertPolylinePoint([[2, 3], [10, 1]], 1, [0, 20])).toEqual([[2, 3], [10, 1], [12, 1]]);
    expect(removePolylinePoint([[2, 3], [10, 1], [18, 4]], 1)).toEqual([[2, 3], [18, 4]]);
    expect(removePolylinePoint([[2, 3], [18, 4]], 0)).toBeNull();
    const rows = [{ x: '10', y: '1' }, { x: '2', y: '3' }, { x: 'z', y: '0' }, { x: '5', y: '9' }];
    expect(polylineRowsSorted(rows)).toBe(false);
    expect(sortPolylineRows(rows).map((r) => r.x)).toEqual(['2', '5', '10', 'z']);
    expect(polylineRowsSorted(sortPolylineRows(rows))).toBe(true);
  });
});

describe('polilínea inicial y paso entre círculo y polilínea', () => {
  /** Talud 2:1: corona a y = 10 hasta x = 20, pie en x = 40, base plana. */
  const slopeDoc = (extra: Partial<ModelDoc['analysis']> = {}): ModelDoc => ({
    ...baseDoc(),
    regions: [{ material: 'm1', polygon: [[0, 0], [60, 0], [60, 10], [20, 10], [0, 10]].map((p): Point => [p[0] as number, p[1] as number]) }],
    analysis: { methods: ['bishop'], slices: 50, surface: { type: 'circle', xc: 30, yc: 25, r: 22 }, ...extra },
  });
  const ground = (x: number): number => 10 - Math.max(0, Math.min(1, (x - 20) / 20)) * 0; // la región es un rectángulo: terreno plano a y = 10

  it('la cuerda de 5 puntos del círculo actual: x creciente, puntos interiores bajo el terreno y en el círculo', () => {
    const doc = slopeDoc();
    const pts = initialPolyline(doc);
    expect(pts).toHaveLength(5);
    for (let i = 1; i < pts.length; i += 1) expect(pts[i]![0]).toBeGreaterThan(pts[i - 1]![0]);
    for (const [x, y] of pts) {
      expect(y).toBeLessThan(ground(x) + 1e-9);
      // sobre el arco inferior del círculo, con el redondeo a 3 decimales
      const yArc = 25 - Math.sqrt(22 ** 2 - (x - 30) ** 2);
      expect(Math.abs(y - yArc)).toBeLessThan(2e-3);
    }
    // el círculo corta el terreno plano (y = 10) en x = 30 ± sqrt(22² − 15²) ≈ 30 ± 16,09
    expect(pts[0]![0]).toBeCloseTo(30 - Math.sqrt(22 ** 2 - 15 ** 2), 1);
    expect(pts[4]![0]).toBeCloseTo(30 + Math.sqrt(22 ** 2 - 15 ** 2), 1);
    // los extremos quedan bajo el terreno o sobre él, nunca por encima
    expect(pts[0]![1]).toBeLessThanOrEqual(10);
  });

  it('sin círculo fijo usa el círculo de partida; si no hay cruces, una recta de dos puntos', () => {
    const none = initialPolyline(slopeDoc({ surface: null, search: undefined }));
    expect(none.length).toBeGreaterThanOrEqual(2);
    const away = initialPolyline(slopeDoc({ surface: { type: 'circle', xc: 500, yc: 500, r: 5 } }));
    expect(away).toHaveLength(2);
    expect(away[1]![0]).toBeGreaterThan(away[0]![0]);
  });

  it('con modelo vacío devuelve una polilínea válida de dos puntos', () => {
    expect(initialPolyline({ ...baseDoc(), regions: [] })).toEqual([[0, 0], [1, 0]]);
  });

  it('círculo → polilínea: la polilínea reemplaza al círculo y Bishop se quita en un solo paso; sin otros métodos queda Spencer', () => {
    const doc = slopeDoc({ methods: ['bishop', 'janbu_corrected'] });
    const cmds = surfaceShapeCommands(doc, 'polyline');
    expect(cmds.map((c) => c.type)).toEqual(['surface/set', 'analysis/patch']);
    let next = doc;
    for (const c of cmds) next = applyCommand(next, c) as ModelDoc;
    expect(next.analysis.surface?.type).toBe('polyline');
    expect(next.analysis.methods).toEqual(['janbu_corrected']);
    expect(validateLocal(next).filter((i) => i.severity === 'error')).toEqual([]);

    const only = surfaceShapeCommands(slopeDoc({ methods: ['bishop'] }), 'polyline');
    expect(only[1]).toEqual({ type: 'analysis/patch', patch: { methods: ['spencer'] } });
    // sin Bishop no hay segundo comando
    expect(surfaceShapeCommands(slopeDoc({ methods: ['spencer'] }), 'polyline')).toHaveLength(1);
  });

  it('polilínea → círculo y el mismo tipo no hace nada', () => {
    const poly = { ...slopeDoc(), analysis: { ...slopeDoc().analysis, surface: { type: 'polyline' as const, points: [[2, 3], [10, 1]] as Point[] } } };
    const cmds = surfaceShapeCommands(poly, 'circle');
    expect(cmds).toHaveLength(1);
    expect((applyCommand(poly, cmds[0] as never) as ModelDoc).analysis.surface?.type).toBe('circle');
    expect(surfaceShapeCommands(poly, 'polyline')).toEqual([]);
    expect(surfaceShapeCommands(slopeDoc(), 'circle')).toEqual([]);
  });
});
