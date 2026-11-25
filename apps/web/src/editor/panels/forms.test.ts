import { describe, expect, it } from 'vitest';
import type { Load, Material } from '../../engine/types';
import { RULE_TEXT, validateLocal } from '../state/validateLocal';
import type { Issue, ModelDoc } from '../types';
import {
  DEFAULT_WATER_UNIT_WEIGHT,
  analysisCommands,
  analysisFromForm,
  analysisToForm,
  appendPiezoPoint,
  circleFromForm,
  defaultCircle,
  defaultLoad,
  defaultPiezo,
  defaultSearch,
  defaultWaterUnitWeight,
  diagnosticsStatusLabel,
  formatCount,
  formatNumber,
  hasIgnoredSurface,
  issueSummary,
  loadFromForm,
  loadToForm,
  loadUpsertCommand,
  materialFromForm,
  materialRemoveCommand,
  materialToForm,
  materialUsage,
  materialsEqual,
  modelXRange,
  newMaterialForm,
  nextLoadId,
  parseNumber,
  piezoFromForm,
  piezoToForm,
  removePiezoPoint,
  searchFromForm,
  searchToForm,
  searchesEqual,
  seismicFromForm,
  seismicToForm,
  selectionForPath,
  sortIssues,
  surfaceMode,
  surfaceModeCommands,
  toggleMethod,
  unitLabels,
  waterUnitWeightFromForm,
  waterUnitWeightHint,
  type AnalysisForm,
  type MaterialForm,
  type SearchForm,
} from './forms';

const soil: Material = {
  id: 'soil',
  name: 'Suelo',
  model: 'mohr_coulomb',
  unit_weight: 20,
  unit_weight_sat: null,
  cohesion: 3,
  friction_angle: 19.6,
  ru: null,
};

function makeDoc(overrides: Partial<ModelDoc> = {}): ModelDoc {
  return {
    format: 'opengeoslide',
    version: '0.2',
    meta: {},
    units: 'SI',
    materials: [soil, { ...soil, id: 'rock', name: 'Roca' }],
    regions: [
      { material: 'soil', polygon: [[20, 20], [20, 25], [30, 25], [50, 35], [70, 35], [70, 20]] },
    ],
    water: null,
    loads: [],
    slope: { direction: 'auto' },
    analysis: { methods: ['bishop'], slices: 50 },
    ...overrides,
  };
}

function errorsOf<V>(r: { ok: boolean; errors?: Record<string, string>; value?: V }): Record<string, string> {
  if (r.ok) throw new Error('se esperaba un error');
  return r.errors ?? {};
}

describe('parseNumber / formatNumber', () => {
  it('acepta coma o punto decimal', () => {
    expect(parseNumber('9,81')).toEqual({ kind: 'ok', value: 9.81 });
    expect(parseNumber('9.81')).toEqual({ kind: 'ok', value: 9.81 });
    expect(parseNumber('  -0,5 ')).toEqual({ kind: 'ok', value: -0.5 });
    expect(parseNumber(',5')).toEqual({ kind: 'ok', value: 0.5 });
    expect(parseNumber('5,')).toEqual({ kind: 'ok', value: 5 });
    expect(parseNumber('+3')).toEqual({ kind: 'ok', value: 3 });
  });

  it('acepta exponente y el signo menos tipográfico', () => {
    expect(parseNumber('1e-5')).toEqual({ kind: 'ok', value: 1e-5 });
    expect(parseNumber('1,5E3')).toEqual({ kind: 'ok', value: 1500 });
    expect(parseNumber('\u22122,5')).toEqual({ kind: 'ok', value: -2.5 });
  });

  it('distingue vacío de inválido', () => {
    expect(parseNumber('')).toEqual({ kind: 'empty' });
    expect(parseNumber('   ')).toEqual({ kind: 'empty' });
    for (const bad of ['abc', '1,2,3', '1.234,5', '1,234.5', '--1', '1e', '.', ',', 'NaN', 'Infinity', '0x10', '1e999', '1 2']) {
      expect(parseNumber(bad), bad).toEqual({ kind: 'invalid' });
    }
  });

  it('formatea con coma decimal y sin ruido de coma flotante', () => {
    expect(formatNumber(9.81)).toBe('9,81');
    expect(formatNumber(30)).toBe('30');
    expect(formatNumber(0.1 + 0.2)).toBe('0,3');
    expect(formatNumber(1e-5)).toBe('0,00001');
    expect(formatNumber(null)).toBe('');
    expect(formatNumber(undefined)).toBe('');
    expect(formatNumber(Number.NaN)).toBe('');
  });

  it('ida y vuelta: parseNumber(formatNumber(v)) = v', () => {
    for (const v of [0, 1, -3.25, 19.6, 1e-5, 0.01, 123456.789, 1e-7]) {
      expect(parseNumber(formatNumber(v))).toEqual({ kind: 'ok', value: v });
    }
  });
});

describe('formatCount', () => {
  it('agrupa miles con espacio fino', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(999)).toBe('999');
    expect(formatCount(8000)).toBe('8\u202f000');
    expect(formatCount(2_000_000)).toBe('2\u202f000\u202f000');
  });
});

describe('unitLabels', () => {
  it('SI por defecto e imperial', () => {
    expect(unitLabels('SI').stress).toBe('kPa');
    expect(unitLabels(undefined).unitWeight).toBe('kN/m³');
    expect(unitLabels('imperial')).toEqual({ length: 'ft', unitWeight: 'pcf', stress: 'psf', lineLoad: 'lbf/ft' });
  });
});

describe('materiales', () => {
  const ctx = { otherIds: ['rock'], editing: soil };

  it('convierte un material a formulario y de vuelta, con coma decimal', () => {
    const form = materialToForm(soil);
    expect(form).toEqual({
      id: 'soil', name: 'Suelo', unit_weight: '20', unit_weight_sat: '', cohesion: '3', friction_angle: '19,6', ru: '',
    });
    const r = materialFromForm(form, ctx);
    expect(r).toEqual({ ok: true, value: soil });
  });

  it('vacíos opcionales dan null; con valor, número', () => {
    const form: MaterialForm = { ...materialToForm(soil), unit_weight_sat: '21,5', ru: '0,2' };
    const r = materialFromForm(form, ctx);
    expect(r.ok && r.value.unit_weight_sat).toBe(21.5);
    expect(r.ok && r.value.ru).toBe(0.2);
  });

  it('aplica los rangos del motor con sus mismos mensajes', () => {
    const base = materialToForm(soil);
    expect(errorsOf(materialFromForm({ ...base, unit_weight: '0' }, ctx)).unit_weight).toBe(RULE_TEXT.unitWeight);
    expect(errorsOf(materialFromForm({ ...base, unit_weight: '' }, ctx)).unit_weight).toBe(RULE_TEXT.unitWeight);
    expect(errorsOf(materialFromForm({ ...base, unit_weight_sat: '-1' }, ctx)).unit_weight_sat).toBe(RULE_TEXT.unitWeightSat);
    expect(errorsOf(materialFromForm({ ...base, cohesion: '-0,1' }, ctx)).cohesion).toBe(RULE_TEXT.cohesion);
    expect(errorsOf(materialFromForm({ ...base, friction_angle: '90' }, ctx)).friction_angle).toBe(RULE_TEXT.frictionAngle);
    expect(errorsOf(materialFromForm({ ...base, friction_angle: '-1' }, ctx)).friction_angle).toContain('desde 0° hasta menos de 90°');
    expect(errorsOf(materialFromForm({ ...base, ru: '1' }, ctx)).ru).toBe(RULE_TEXT.ru);
    expect(errorsOf(materialFromForm({ ...base, ru: '-0,1' }, ctx)).ru).toContain('desde 0 hasta menos de 1');
  });

  it('acepta los extremos válidos: c = 0, φ = 0, φ = 89,99, ru = 0', () => {
    const base = materialToForm(soil);
    expect(materialFromForm({ ...base, cohesion: '0', friction_angle: '0', ru: '0' }, ctx).ok).toBe(true);
    expect(materialFromForm({ ...base, friction_angle: '89,99' }, ctx).ok).toBe(true);
  });

  it('rechaza texto no numérico y reporta todos los campos a la vez', () => {
    const r = materialFromForm({ ...materialToForm(soil), unit_weight: 'x', cohesion: 'y' }, ctx);
    const errors = errorsOf(r);
    expect(Object.keys(errors).sort()).toEqual(['cohesion', 'unit_weight']);
    expect(errors.cohesion).toBe('Cohesión c: escriba un número (admite coma o punto decimal)');
    expect(errors.unit_weight).toBe('Peso unitario γ: escriba un número (admite coma o punto decimal)');
  });

  it('exige id no vacío y único', () => {
    const base = materialToForm(soil);
    expect(errorsOf(materialFromForm({ ...base, id: '  ' }, ctx)).id).toContain('no puede estar vacío');
    expect(errorsOf(materialFromForm({ ...base, id: 'rock' }, ctx)).id).toBe('Identificador del material: «rock» ya lo usa otro material; use uno distinto');
    expect(materialFromForm({ ...base, id: 'nuevo' }, { otherIds: ['rock', 'soil'], editing: null }).ok).toBe(true);
  });

  it('un nombre vacío cae al id y se recortan espacios', () => {
    const r = materialFromForm({ ...materialToForm(soil), id: ' soil ', name: '  ' }, ctx);
    expect(r.ok && r.value.id).toBe('soil');
    expect(r.ok && r.value.name).toBe('soil');
  });

  it('un material nuevo sugiere un id libre y es válido por defecto', () => {
    const form = newMaterialForm(['m1', 'soil', 'm3']);
    expect(form.id).toBe('m2');
    expect(materialFromForm(form, { otherIds: ['m1', 'soil', 'm3'], editing: null }).ok).toBe(true);
  });

  it('newMaterialForm: valores por defecto en SI e imperiales, ambos válidos (R7-22)', () => {
    const si = newMaterialForm(['m1']);
    expect(si).toMatchObject({ unit_weight: '18', cohesion: '5', friction_angle: '30' });
    expect(newMaterialForm(['m1'], 'SI')).toEqual(si);
    const imp = newMaterialForm(['m1'], 'imperial');
    expect(imp).toMatchObject({ id: 'm2', unit_weight: '115', cohesion: '100', friction_angle: '30' });
    expect(materialFromForm(imp, { otherIds: ['m1'], editing: null }).ok).toBe(true);
  });

  it('materialsEqual trata null y undefined como iguales', () => {
    expect(materialsEqual(soil, { ...soil, unit_weight_sat: undefined, ru: undefined })).toBe(true);
    expect(materialsEqual(soil, { ...soil, ru: 0.1 })).toBe(false);
  });

  it('uso y borrado: no se quita un material en uso', () => {
    const doc = makeDoc();
    expect(materialUsage(doc, 'soil')).toEqual([0]);
    expect(materialRemoveCommand(doc, 'soil')).toBeNull();
    expect(materialRemoveCommand(doc, 'rock')).toEqual({ type: 'material/remove', materialId: 'rock' });
  });
});

describe('agua', () => {
  it('unit_weight vacío = omitir; coma o punto; > 0', () => {
    expect(waterUnitWeightFromForm('')).toEqual({ ok: true, value: undefined });
    expect(waterUnitWeightFromForm('9,807')).toEqual({ ok: true, value: 9.807 });
    expect(waterUnitWeightFromForm('62.4')).toEqual({ ok: true, value: 62.4 });
    expect(errorsOf(waterUnitWeightFromForm('0')).unit_weight).toBe(RULE_TEXT.waterUnitWeight);
    expect(errorsOf(waterUnitWeightFromForm('-1')).unit_weight).toBe(RULE_TEXT.waterUnitWeight);
    expect(errorsOf(waterUnitWeightFromForm('abc')).unit_weight).toContain('escriba un número');
  });

  it('tabla piezométrica: puntos válidos con coma decimal', () => {
    const r = piezoFromForm([{ x: '0', y: '12' }, { x: '40,5', y: '6' }, { x: '55', y: '6,25' }]);
    expect(r).toEqual({ ok: true, value: [[0, 12], [40.5, 6], [55, 6.25]] });
    expect(piezoFromForm([])).toEqual({ ok: true, value: null });
  });

  it('exige al menos 2 puntos', () => {
    expect(errorsOf(piezoFromForm([{ x: '0', y: '1' }])).table).toBe('Línea piezométrica: indique al menos 2 puntos, o quítela si no hay nivel freático');
  });

  it('exige x estrictamente creciente', () => {
    const e = errorsOf(piezoFromForm([{ x: '0', y: '1' }, { x: '5', y: '1' }, { x: '5', y: '2' }]));
    expect(e['2.x']).toBe(
      'Línea piezométrica, punto 3: la coordenada x debe ser mayor que la del punto anterior; ordene los puntos de izquierda a derecha',
    );
    expect(e.table).toBe(RULE_TEXT.piezoOrder);
    const e2 = errorsOf(piezoFromForm([{ x: '3', y: '1' }, { x: '1', y: '1' }]));
    expect(e2['1.x']).toContain('ordene los puntos de izquierda a derecha');
  });

  it('celdas vacías o no numéricas señalan la celda', () => {
    const e = errorsOf(piezoFromForm([{ x: '0', y: '' }, { x: 'a', y: '1' }]));
    expect(e['0.y']).toBe('Línea piezométrica, punto 1: falta la coordenada y');
    expect(e['1.x']).toBe('Línea piezométrica, punto 2, coordenada x: escriba un número (admite coma o punto decimal)');
  });

  it('piezoToForm usa coma decimal', () => {
    expect(piezoToForm([[0, 12.5], [40, 6]])).toEqual([{ x: '0', y: '12,5' }, { x: '40', y: '6' }]);
    expect(piezoToForm(null)).toEqual([]);
  });

  it('crear, añadir y quitar puntos', () => {
    const doc = makeDoc();
    expect(defaultPiezo(doc)).toEqual([[20, 27.5], [70, 27.5]]);
    expect(defaultPiezo(makeDoc({ regions: [] }))).toBeNull();
    const more = appendPiezoPoint([[20, 27.5], [70, 27.5]], doc);
    expect(more).toEqual([[20, 27.5], [70, 27.5], [75, 27.5]]);
    expect(piezoFromForm(piezoToForm(more)).ok).toBe(true);
    expect(removePiezoPoint(more, 1)).toEqual([[20, 27.5], [75, 27.5]]);
    expect(removePiezoPoint([[0, 0], [1, 1]], 0)).toBeNull();
    expect(removePiezoPoint(more, 9)).toBeNull();
  });
});

describe('superficie', () => {
  it('el modo sale de lo guardado; la búsqueda manda', () => {
    expect(surfaceMode({})).toBe('none');
    expect(surfaceMode({ surface: { type: 'circle', xc: 1, yc: 2, r: 3 } })).toBe('fixed');
    expect(surfaceMode({ search: defaultSearch() })).toBe('search');
    const both = { surface: { type: 'circle' as const, xc: 1, yc: 2, r: 3 }, search: defaultSearch() };
    expect(surfaceMode(both)).toBe('search');
    expect(hasIgnoredSurface(both)).toBe(true);
    expect(hasIgnoredSurface({ search: defaultSearch() })).toBe(false);
  });

  it('pasar a «Búsqueda» deja surface en null y crea una búsqueda si no había', () => {
    const doc = makeDoc({ analysis: { surface: { type: 'circle', xc: 45, yc: 60, r: 30 } } });
    expect(surfaceModeCommands(doc, 'search')).toEqual([
      { type: 'search/set', search: defaultSearch() },
      { type: 'surface/set', surface: null },
    ]);
  });

  it('pasar a «Fija» deja search en null y crea un círculo si no había', () => {
    const doc = makeDoc({ analysis: { search: defaultSearch() } });
    const commands = surfaceModeCommands(doc, 'fixed');
    expect(commands).toEqual([{ type: 'surface/set', surface: defaultCircle(doc) }, { type: 'search/set', search: null }]);
  });

  it('conserva la especificación del modo elegido y no emite nada si ya está', () => {
    const circle = { type: 'circle' as const, xc: 45, yc: 60, r: 30 };
    expect(surfaceModeCommands(makeDoc({ analysis: { surface: circle } }), 'fixed')).toEqual([]);
    expect(surfaceModeCommands(makeDoc({ analysis: { search: defaultSearch() } }), 'search')).toEqual([]);
    // Con ambas guardadas, «Fija» conserva el círculo y quita la búsqueda; «Búsqueda» conserva la búsqueda.
    const both = makeDoc({ analysis: { surface: circle, search: defaultSearch() } });
    expect(surfaceModeCommands(both, 'fixed')).toEqual([{ type: 'search/set', search: null }]);
    expect(surfaceModeCommands(both, 'search')).toEqual([{ type: 'surface/set', surface: null }]);
  });

  it('el resultado de cualquier cambio de modo nunca deja las dos guardadas', () => {
    const circle = { type: 'circle' as const, xc: 45, yc: 60, r: 30 };
    const starts = [{}, { surface: circle }, { search: defaultSearch() }, { surface: circle, search: defaultSearch() }];
    for (const analysis of starts) {
      for (const mode of ['search', 'fixed'] as const) {
        const doc = makeDoc({ analysis });
        let surface = analysis.surface ?? null;
        let search = analysis.search ?? null;
        for (const c of surfaceModeCommands(doc, mode)) {
          if (c.type === 'surface/set') surface = c.surface;
          if (c.type === 'search/set') search = c.search;
        }
        expect(surface !== null && search !== null).toBe(false);
        expect(mode === 'search' ? search !== null : surface !== null).toBe(true);
      }
    }
  });

  it('círculo por defecto: sobre el modelo y válido', () => {
    const c = defaultCircle(makeDoc());
    expect(c).toEqual({ type: 'circle', xc: 45, yc: 38.75, r: 25 });
    expect(circleFromForm({ xc: '45', yc: '38,75', r: '25' })).toEqual({ ok: true, value: c });
    expect(defaultCircle(makeDoc({ regions: [] })).r).toBeGreaterThan(0);
  });

  it('círculo: r > 0 y valores finitos', () => {
    const msg = 'Radio r del círculo de falla: use un valor mayor que 0 (ej. 25)';
    expect(errorsOf(circleFromForm({ xc: '1', yc: '2', r: '0' })).r).toBe(msg);
    expect(errorsOf(circleFromForm({ xc: '1', yc: '2', r: '-3' })).r).toBe(msg);
    expect(errorsOf(circleFromForm({ xc: 'a', yc: '2', r: '3' })).xc).toBe('Centro xc del círculo de falla: escriba un número (admite coma o punto decimal)');
    expect(errorsOf(circleFromForm({ xc: '', yc: '2', r: '3' })).xc).toBe('Centro xc del círculo de falla: escriba un número (ej. 45,5)');
    expect(errorsOf(circleFromForm({ xc: '1', yc: '', r: '3' })).yc).toBe('Centro yc del círculo de falla: escriba un número (ej. 38,75)');
    // Ningún nombre interno del JSON en los mensajes del círculo.
    expect(Object.values(errorsOf(circleFromForm({ xc: '', yc: '', r: '' }))).join(' ')).not.toMatch(/analysis\.surface/);
  });
});

describe('búsqueda', () => {
  const full: SearchForm = {
    entry: { lo: '49,9', hi: '55,2' },
    exit: { lo: '26,9', hi: '30,2' },
    n_entry: '20',
    n_exit: '20',
    n_radius: '20',
    max_radius_factor: '5',
    min_width: '',
    refine: true,
  };
  const ctx = { xRange: [20, 70] as [number, number] };

  it('formulario → SearchSpec completo y de vuelta', () => {
    const r = searchFromForm(full, ctx);
    expect(r).toEqual({
      ok: true,
      value: {
        type: 'circular_entry_exit',
        entry: [49.9, 55.2],
        exit: [26.9, 30.2],
        n_entry: 20,
        n_exit: 20,
        n_radius: 20,
        max_radius_factor: 5,
        min_width: null,
        refine: true,
      },
    });
    if (r.ok) expect(searchToForm(r.value)).toEqual(full);
  });

  it('rangos vacíos = null (toda la extensión); uno solo vacío es error', () => {
    const r = searchFromForm({ ...full, entry: { lo: '', hi: '' }, exit: { lo: ' ', hi: '' } }, ctx);
    expect(r.ok && r.value.entry).toBeNull();
    expect(r.ok && r.value.exit).toBeNull();
    const e = errorsOf(searchFromForm({ ...full, entry: { lo: '50', hi: '' } }, ctx));
    expect(e['entry.hi']).toBe('Entrada (coronamiento): indique el mínimo y el máximo, o deje ambos vacíos para usar todo el ancho del terreno');
    expect(Object.values(e).join(' ')).not.toMatch(/search\./);
  });

  it('mín ≤ máx y dentro de la extensión del modelo', () => {
    expect(errorsOf(searchFromForm({ ...full, entry: { lo: '60', hi: '50' } }, ctx))['entry.lo']).toBe(
      'Entrada (coronamiento): el mínimo no puede ser mayor que el máximo (mínimo 60, máximo 50); intercambie los valores',
    );
    expect(errorsOf(searchFromForm({ ...full, exit: { lo: '10', hi: '30' } }, ctx))['exit.lo']).toBe(
      'Salida (pie): el rango debe quedar dentro del ancho del modelo (de 20 a 70); ajuste el mínimo y el máximo',
    );
    expect(searchFromForm({ ...full, exit: { lo: '10', hi: '30' } }, { xRange: null }).ok).toBe(true);
    expect(searchFromForm({ ...full, entry: { lo: '50', hi: '50' } }, ctx).ok).toBe(true);
  });

  it('n_* enteros en 1–200', () => {
    expect(errorsOf(searchFromForm({ ...full, n_entry: '0' }, ctx)).n_entry).toBe('Puntos de entrada: use un número entero entre 1 y 200 (ej. 20)');
    expect(errorsOf(searchFromForm({ ...full, n_exit: '201' }, ctx)).n_exit).toBe('Puntos de salida: use un número entero entre 1 y 200 (ej. 20)');
    expect(errorsOf(searchFromForm({ ...full, n_radius: '2,5' }, ctx)).n_radius).toBe('Radios por par: use un número entero, sin decimales');
    expect(errorsOf(searchFromForm({ ...full, n_radius: '' }, ctx)).n_radius).toBe('Radios por par: use un número entero entre 1 y 200 (ej. 20)');
    expect(searchFromForm({ ...full, n_entry: '1', n_exit: '200', n_radius: '200' }, ctx).ok).toBe(true);
  });

  it('el producto n_entry·n_exit·n_radius no pasa de 2·10⁶', () => {
    // 200·200·50 = 2 000 000: permitido; 200·200·51 = 2 040 000: no.
    expect(searchFromForm({ ...full, n_entry: '200', n_exit: '200', n_radius: '50' }, ctx).ok).toBe(true);
    const e = errorsOf(searchFromForm({ ...full, n_entry: '200', n_exit: '200', n_radius: '51' }, ctx));
    expect(e.n_radius).toBe(`${RULE_TEXT.searchProduct} (ahora son 2\u202f040\u202f000)`);
  });

  it('max_radius_factor > 0,51 y min_width ≥ 0 o vacío', () => {
    expect(errorsOf(searchFromForm({ ...full, max_radius_factor: '0,51' }, ctx)).max_radius_factor).toBe(RULE_TEXT.maxRadiusFactor);
    expect(searchFromForm({ ...full, max_radius_factor: '0,52' }, ctx).ok).toBe(true);
    expect(errorsOf(searchFromForm({ ...full, min_width: '-1' }, ctx)).min_width).toBe(RULE_TEXT.minWidth);
    const r = searchFromForm({ ...full, min_width: '0' }, ctx);
    expect(r.ok && r.value.min_width).toBe(0);
    const r2 = searchFromForm({ ...full, min_width: '0,5', refine: false }, ctx);
    expect(r2.ok && r2.value.min_width).toBe(0.5);
    expect(r2.ok && r2.value.refine).toBe(false);
  });

  it('searchToForm rellena los defaults del motor cuando faltan campos', () => {
    const form = searchToForm({ type: 'circular_entry_exit' });
    expect(form).toMatchObject({ n_entry: '20', n_exit: '20', n_radius: '20', max_radius_factor: '5', refine: true });
    expect(form.entry).toEqual({ lo: '', hi: '' });
  });

  it('searchesEqual ignora la diferencia entre ausente/null y defaults explícitos', () => {
    expect(searchesEqual({ type: 'circular_entry_exit' }, defaultSearch())).toBe(true);
    expect(searchesEqual(defaultSearch(), { ...defaultSearch(), n_radius: 21 })).toBe(false);
    expect(searchesEqual({ ...defaultSearch(), entry: [1, 2] }, { ...defaultSearch(), entry: [1, 3] })).toBe(false);
  });
});

describe('análisis', () => {
  const base = (): AnalysisForm => analysisToForm(makeDoc());

  it('muestra los defaults del motor cuando el documento no los trae', () => {
    expect(analysisToForm(makeDoc({ analysis: {}, slope: undefined }))).toEqual({
      methods: ['bishop'],
      slices: '50',
      tolerance: '0,00001',
      max_iterations: '500',
      min_m_alpha: '0,2',
      direction: 'auto',
    });
  });

  it('valida los rangos del motor', () => {
    expect(errorsOf(analysisFromForm({ ...base(), methods: [] })).methods).toBe(RULE_TEXT.methodsEmpty);
    expect(errorsOf(analysisFromForm({ ...base(), slices: '2' })).slices).toBe(RULE_TEXT.slices);
    expect(errorsOf(analysisFromForm({ ...base(), slices: '2001' })).slices).toContain('entre 3 y 2000');
    expect(errorsOf(analysisFromForm({ ...base(), slices: '50,5' })).slices).toBe('Dovelas: use un número entero, sin decimales');
    expect(analysisFromForm({ ...base(), slices: '3' }).ok).toBe(true);
    expect(analysisFromForm({ ...base(), slices: '2000' }).ok).toBe(true);
    expect(errorsOf(analysisFromForm({ ...base(), tolerance: '0' })).tolerance).toBe(RULE_TEXT.tolerance);
    expect(errorsOf(analysisFromForm({ ...base(), tolerance: '0,011' })).tolerance).toContain('mayor que 0 y hasta 0,01');
    expect(analysisFromForm({ ...base(), tolerance: '0,01' }).ok).toBe(true);
    expect(analysisFromForm({ ...base(), tolerance: '1e-6' }).ok).toBe(true);
    expect(errorsOf(analysisFromForm({ ...base(), max_iterations: '0' })).max_iterations).toBe(RULE_TEXT.maxIterations);
    expect(errorsOf(analysisFromForm({ ...base(), max_iterations: '100001' })).max_iterations).toContain('entre 1 y 100000');
    expect(analysisFromForm({ ...base(), max_iterations: '100000' }).ok).toBe(true);
    expect(errorsOf(analysisFromForm({ ...base(), min_m_alpha: '0' })).min_m_alpha).toBe(RULE_TEXT.minMAlpha);
    expect(errorsOf(analysisFromForm({ ...base(), min_m_alpha: '1,1' })).min_m_alpha).toContain('mayor que 0 y hasta 1');
    expect(analysisFromForm({ ...base(), min_m_alpha: '1' }).ok).toBe(true);
  });

  it('los campos vacíos son error (no hay valor que omitir)', () => {
    const e = errorsOf(analysisFromForm({ ...base(), slices: '', tolerance: '', max_iterations: '', min_m_alpha: '' }));
    expect(Object.keys(e).sort()).toEqual(['max_iterations', 'min_m_alpha', 'slices', 'tolerance']);
  });

  it('los métodos salen en orden canónico', () => {
    expect(toggleMethod(['bishop'], 'spencer', true)).toEqual(['bishop', 'spencer']);
    expect(toggleMethod(['spencer'], 'bishop', true)).toEqual(['bishop', 'spencer']);
    expect(toggleMethod(['bishop', 'spencer'], 'bishop', false)).toEqual(['spencer']);
    expect(toggleMethod(['bishop'], 'bishop', false)).toEqual([]);
  });

  it('solo emite comandos de lo que cambia', () => {
    const doc = makeDoc();
    const same = analysisFromForm(base());
    expect(same.ok && analysisCommands(doc, same.value)).toEqual([]);

    const changed = analysisFromForm({ ...base(), methods: ['bishop', 'spencer'], slices: '80', tolerance: '1e-6', direction: 'right_to_left' });
    expect(changed.ok && analysisCommands(doc, changed.value)).toEqual([
      { type: 'analysis/patch', patch: { methods: ['bishop', 'spencer'], slices: 80, tolerance: 1e-6 } },
      { type: 'slope/setDirection', direction: 'right_to_left' },
    ]);

    const onlyDir = analysisFromForm({ ...base(), direction: 'left_to_right' });
    expect(onlyDir.ok && analysisCommands(doc, onlyDir.value)).toEqual([{ type: 'slope/setDirection', direction: 'left_to_right' }]);
  });

  it('un valor igual al default pero ausente en el documento no genera comandos', () => {
    const doc = makeDoc({ analysis: {} });
    const r = analysisFromForm(analysisToForm(doc));
    expect(r.ok && analysisCommands(doc, r.value)).toEqual([]);
  });
});

describe('cargas', () => {
  const ctx = { xRange: [20, 70] as [number, number], otherIds: ['u2'], index: 0 };
  const udl: Load = { type: 'udl', id: 'u1', x1: 50, x2: 70, q: 20 };
  const line: Load = { type: 'line', id: 'l1', x: 40, p: 20, angle: 10 };

  it('carga distribuida: formulario ↔ Load y comando', () => {
    const form = loadToForm(udl);
    expect(form).toEqual({ type: 'udl', id: 'u1', x1: '50', x2: '70', q: '20' });
    const r = loadFromForm(form, ctx);
    expect(r).toEqual({ ok: true, value: udl });
    expect(loadUpsertCommand(null, udl)).toEqual({ type: 'load/upsert', index: null, load: udl });
    expect(loadUpsertCommand(2, udl)).toEqual({ type: 'load/upsert', index: 2, load: udl });
  });

  it('carga lineal: formulario ↔ Load, con coma decimal y ángulo negativo', () => {
    expect(loadFromForm({ type: 'line', id: 'l1', x: '40,5', p: '20', angle: '-10,5' }, ctx)).toEqual({
      ok: true,
      value: { type: 'line', id: 'l1', x: 40.5, p: 20, angle: -10.5 },
    });
    expect(loadToForm(line)).toEqual({ type: 'line', id: 'l1', x: '40', p: '20', angle: '10' });
  });

  it('id vacío se omite; id repetido es error', () => {
    const r = loadFromForm({ type: 'udl', id: ' ', x1: '30', x2: '40', q: '5' }, ctx);
    expect(r.ok && 'id' in r.value).toBe(false);
    expect(errorsOf(loadFromForm({ ...loadToForm(udl), id: 'u2' }, ctx)).id).toBe('Identificador de carga: «u2» ya lo usa otra carga; use uno distinto');
  });

  it('udl: x1 < x2, dentro del modelo y q ≥ 0', () => {
    const f = loadToForm(udl) as ReturnType<typeof loadToForm> & { type: 'udl' };
    expect(errorsOf(loadFromForm({ ...f, x1: '70', x2: '70' }, ctx)).x1).toBe(RULE_TEXT.udlOrder);
    expect(errorsOf(loadFromForm({ ...f, x1: '60', x2: '50' }, ctx)).x1).toBe(RULE_TEXT.udlOrder);
    expect(errorsOf(loadFromForm({ ...f, x1: '10' }, ctx)).x1).toBe(
      'Inicio x1 de la carga distribuida: la posición debe estar dentro del ancho del modelo (de 20 a 70)',
    );
    expect(errorsOf(loadFromForm({ ...f, x2: '71' }, ctx)).x2).toBe(
      'Fin x2 de la carga distribuida: la posición debe estar dentro del ancho del modelo (de 20 a 70)',
    );
    expect(errorsOf(loadFromForm({ ...f, q: '-1' }, ctx)).q).toBe(RULE_TEXT.loadQ);
    expect(loadFromForm({ ...f, q: '0', x1: '20' }, ctx).ok).toBe(true);
  });

  it('line: x dentro, p ≥ 0 y ángulo en [−90, 90]', () => {
    const f = { type: 'line' as const, id: 'l1', x: '40', p: '20', angle: '10' };
    expect(errorsOf(loadFromForm({ ...f, x: '80' }, ctx)).x).toBe(
      'Posición x de la carga lineal: la posición debe estar dentro del ancho del modelo (de 20 a 70)',
    );
    expect(errorsOf(loadFromForm({ ...f, p: '-1' }, ctx)).p).toBe(RULE_TEXT.loadP);
    expect(errorsOf(loadFromForm({ ...f, angle: '91' }, ctx)).angle).toBe(RULE_TEXT.loadAngle);
    expect(errorsOf(loadFromForm({ ...f, angle: '-90,5' }, ctx)).angle).toContain('entre −90° y 90°');
    expect(loadFromForm({ ...f, angle: '90' }, ctx).ok).toBe(true);
    expect(loadFromForm({ ...f, angle: '-90' }, ctx).ok).toBe(true);
    expect(errorsOf(loadFromForm({ ...f, p: '' }, ctx)).p).toBe('Carga lineal p: falta el valor; use un número igual o mayor que 0');
  });

  it('sin rango del modelo no se comprueba la pertenencia', () => {
    expect(loadFromForm({ type: 'line', id: '', x: '999', p: '1', angle: '0' }, { ...ctx, xRange: null }).ok).toBe(true);
  });

  it('sin id, el mensaje de orden es el mismo', () => {
    const e = errorsOf(loadFromForm({ type: 'udl', id: '', x1: '60', x2: '50', q: '1' }, { ...ctx, index: 2 }));
    expect(e.x1).toBe(RULE_TEXT.udlOrder);
  });

  it('cargas por defecto: válidas, con id libre; null sin geometría', () => {
    const doc = makeDoc({ loads: [udl, line] });
    const a = defaultLoad('udl', doc);
    const b = defaultLoad('line', doc);
    expect(a).toEqual({ type: 'udl', id: 'u2', x1: 40, x2: 50, q: 10 });
    expect(b).toEqual({ type: 'line', id: 'l2', x: 45, p: 10, angle: 0 });
    for (const load of [a, b]) {
      expect(load).not.toBeNull();
      if (load) expect(loadFromForm(loadToForm(load), { xRange: modelXRange(doc), otherIds: [], index: null }).ok).toBe(true);
    }
    expect(defaultLoad('udl', makeDoc({ regions: [] }))).toBeNull();
    expect(nextLoadId([], 'line')).toBe('l1');
  });
});

describe('sismo', () => {
  it('kh en [0, 1) y kv en (−1, 1)', () => {
    expect(seismicFromForm({ kh: '0,1', kv: '0' })).toEqual({ ok: true, value: { kh: 0.1, kv: 0 } });
    expect(seismicFromForm({ kh: '0', kv: '-0,5' })).toEqual({ ok: true, value: { kh: 0, kv: -0.5 } });
    expect(errorsOf(seismicFromForm({ kh: '1', kv: '0' })).kh).toBe(RULE_TEXT.kh);
    expect(errorsOf(seismicFromForm({ kh: '1', kv: '0' })).kh).toBe('Coeficiente sísmico horizontal kh: use un valor entre 0 y 0,99 (ej. 0,15)');
    expect(errorsOf(seismicFromForm({ kh: '0', kv: '1' })).kv).toBe(RULE_TEXT.kv);
    expect(errorsOf(seismicFromForm({ kh: '0', kv: '-1' })).kv).toBe('Coeficiente sísmico vertical kv: use un valor entre −0,99 y 0,99 (ej. 0 o 0,05)');
    expect(seismicFromForm({ kh: '0,999', kv: '0,999' }).ok).toBe(true);
    expect(errorsOf(seismicFromForm({ kh: 'x', kv: '' })).kh).toBe('Coeficiente sísmico horizontal kh: escriba un número (admite coma o punto decimal)');
  });

  it('ambos vacíos = sin sismo; uno vacío vale 0', () => {
    expect(seismicFromForm({ kh: '', kv: ' ' })).toEqual({ ok: true, value: null });
    expect(seismicFromForm({ kh: '0,2', kv: '' })).toEqual({ ok: true, value: { kh: 0.2, kv: 0 } });
    expect(seismicFromForm({ kh: '', kv: '0,05' })).toEqual({ ok: true, value: { kh: 0, kv: 0.05 } });
  });

  it('seismicToForm: ausente = campos vacíos; presente, coma decimal', () => {
    expect(seismicToForm(makeDoc())).toEqual({ kh: '', kv: '' });
    expect(seismicToForm(makeDoc({ analysis: { seismic: { kh: 0.15 } } }))).toEqual({ kh: '0,15', kv: '0' });
    expect(seismicToForm(makeDoc({ analysis: { seismic: null } }))).toEqual({ kh: '', kv: '' });
  });
});

describe('diagnósticos', () => {
  const doc = makeDoc({
    water: { piezometric_line: [[0, 1], [5, 2]] },
    loads: [{ type: 'udl', id: 'u1', x1: 30, x2: 40, q: 1 }],
    analysis: { search: defaultSearch() },
  });

  it('puntero JSON → selección', () => {
    expect(selectionForPath('/regions/0/polygon/2', doc)).toEqual({ kind: 'vertex', regionIndex: 0, vertexIndex: 2 });
    expect(selectionForPath('/regions/0', doc)).toEqual({ kind: 'region', regionIndex: 0 });
    expect(selectionForPath('/regions/0/material', doc)).toEqual({ kind: 'region', regionIndex: 0 });
    expect(selectionForPath('/materials/1', doc)).toEqual({ kind: 'material', materialId: 'rock' });
    expect(selectionForPath('/water/piezometric_line/1', doc)).toEqual({ kind: 'piezo_point', index: 1 });
    expect(selectionForPath('/analysis/surface', doc)).toEqual({ kind: 'surface_circle' });
    expect(selectionForPath('/analysis/surface/r', doc)).toEqual({ kind: 'surface_circle' });
    expect(selectionForPath('/analysis/search/entry', doc)).toEqual({ kind: 'search_range', which: 'entry' });
    expect(selectionForPath('/analysis/search/exit', doc)).toEqual({ kind: 'search_range', which: 'exit' });
    expect(selectionForPath('/loads/0', doc)).toEqual({ kind: 'load', index: 0 });
  });

  it('rutas nulas, desconocidas o fuera de rango no seleccionan nada', () => {
    for (const path of [null, '', '/analysis/slices', '/regions/9', '/regions/x', '/materials/7', '/water/piezometric_line/2', '/loads/1', '/meta', 'regions/0']) {
      expect(selectionForPath(path, doc), String(path)).toEqual({ kind: 'none' });
    }
    // Un vértice fuera de rango cae a la región.
    expect(selectionForPath('/regions/0/polygon/40', doc)).toEqual({ kind: 'region', regionIndex: 0 });
  });

  const issue = (severity: Issue['severity'], text: string): Issue => ({ source: 'local', severity, code: 'x', text, path: null });

  it('ordena errores, avisos y notas de forma estable', () => {
    const sorted = sortIssues([issue('nota', 'n1'), issue('error', 'e1'), issue('aviso', 'a1'), issue('error', 'e2'), issue('nota', 'n2')]);
    expect(sorted.map((i) => i.text)).toEqual(['e1', 'e2', 'a1', 'n1', 'n2']);
  });

  it('resume con plurales en español', () => {
    expect(issueSummary([])).toBe('0 errores, 0 avisos, 0 notas');
    expect(issueSummary([issue('error', 'a'), issue('aviso', 'b'), issue('aviso', 'c'), issue('nota', 'd')])).toBe('1 error, 2 avisos, 1 nota');
  });

  it('etiquetas de estado', () => {
    expect(diagnosticsStatusLabel('stale')).toContain('Desactualizado');
    expect(diagnosticsStatusLabel('checking')).toContain('Comprobando');
  });
});

describe('unificación de mensajes con validateLocal (RULE_TEXT)', () => {
  const baseDoc = (): ModelDoc => makeDoc();

  it('el texto que muestra el formulario está contenido en el de la validación local', () => {
    const doc = baseDoc();
    doc.analysis.slices = 2;
    doc.analysis.tolerance = 0.5;
    doc.analysis.seismic = { kh: 1, kv: 1 };
    doc.materials[0]!.friction_angle = 90;
    const texts = validateLocal(doc).map((i) => i.text);
    const form = (r: { ok: boolean; errors?: Record<string, string> }, key: string): string => (r.ok ? '' : (r.errors?.[key] ?? ''));
    const pairs: Array<[string, string]> = [
      [form(analysisFromForm({ ...analysisToForm(doc), slices: '2' }), 'slices'), RULE_TEXT.slices],
      [form(analysisFromForm({ ...analysisToForm(doc), tolerance: '0,5' }), 'tolerance'), RULE_TEXT.tolerance],
      [form(seismicFromForm({ kh: '1', kv: '1' }), 'kh'), RULE_TEXT.kh],
      [form(seismicFromForm({ kh: '1', kv: '1' }), 'kv'), RULE_TEXT.kv],
      [form(materialFromForm({ ...materialToForm(doc.materials[0]!), friction_angle: '90' }, { otherIds: [], editing: doc.materials[0] }), 'friction_angle'), RULE_TEXT.frictionAngle],
    ];
    for (const [fromForm, rule] of pairs) {
      expect(fromForm).toBe(rule);
      // Bajo un sujeto («Material «m1», …») la validación local baja la primera letra a minúscula.
      const lowered = rule.charAt(0).toLowerCase() + rule.slice(1);
      expect(texts.some((t) => t.includes(rule) || t.includes(lowered))).toBe(true);
    }
  });
});

describe('γw según las unidades del modelo (R7-22)', () => {
  it('el valor de referencia es 9,81 en SI y 62,4 en imperial; el motor no convierte', () => {
    expect(defaultWaterUnitWeight(undefined)).toBe(9.81);
    expect(defaultWaterUnitWeight('SI')).toBe(9.81);
    expect(defaultWaterUnitWeight('imperial')).toBe(62.4);
    expect(DEFAULT_WATER_UNIT_WEIGHT).toBe(9.81);
  });

  it('la ayuda avisa en imperial de que vacío usaría 9,81 (kN/m³)', () => {
    expect(waterUnitWeightHint('SI')).toBe('Vacío = se usa 9,81 kN/m³.');
    expect(waterUnitWeightHint('imperial')).toBe(
      'Escriba 62,4 pcf para agua dulce. Si lo deja vacío, el cálculo usa 9,81 (valor en kN/m³), que no corresponde a pcf.',
    );
  });

  it('un valor de γw inválido muestra la etiqueta del campo', () => {
    expect(errorsOf(waterUnitWeightFromForm('x')).unit_weight).toBe('Peso unitario del agua γw: escriba un número (admite coma o punto decimal)');
    expect(errorsOf(waterUnitWeightFromForm('0')).unit_weight).toBe(
      'Peso unitario del agua γw: use un valor mayor que 0 (ej. 9,81 kN/m³ o 62,4 pcf)',
    );
  });
});

describe('mensajes de formulario sin nombres internos (R7-19)', () => {
  it('ningún mensaje de campo contiene nombres internos del JSON', () => {
    const doc = makeDoc();
    const all: string[] = [];
    const add = (r: { ok: boolean; errors?: Record<string, string> }): void => {
      if (!r.ok) all.push(...Object.values(r.errors ?? {}));
    };
    add(analysisFromForm({ ...analysisToForm(doc), slices: 'x', tolerance: '5', max_iterations: '0', min_m_alpha: '2' }));
    add(searchFromForm({ ...searchToForm(defaultSearch()), n_entry: '0', n_exit: '300', n_radius: '', max_radius_factor: '0', min_width: '-1', entry: { lo: '1', hi: '' } }, { xRange: [0, 10] }));
    add(circleFromForm({ xc: '', yc: 'q', r: '-1' }));
    add(seismicFromForm({ kh: '5', kv: '-9' }));
    expect(all.length).toBeGreaterThan(10);
    for (const m of all) expect(m, m).not.toMatch(/min_m_alpha|n_entry|n_exit|n_radius|analysis\.|search\.|max_radius_factor|\budl\b|\bkh debe|\bru debe/);
  });
});
