import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Point, SearchSpec, VerificationCase } from '../../engine/types';
import { issueTarget } from '../app/issueNav';
import type { Issue, ModelDoc } from '../types';
import { baseDoc, mat, singleRegionDoc, square, twoRegionDoc } from './testFixtures';
import { RULE_TEXT, validateLocal, validateLocalCached } from './validateLocal';

const GEOTECH_CODES = new Set(['editor.gamma_sat_lt_gamma', 'editor.ru_over_piezo', 'editor.piezo_extrapolated']);
const codes = (issues: Issue[]): string[] => issues.map((i) => i.code);

describe('validateLocal: modelo válido', () => {
  it('el documento base (aristas compartidas, piezométrica, superficie) no tiene incidencias', () => {
    expect(validateLocal(baseDoc())).toEqual([]);
  });
  it('las incidencias son locales, de error y con puntero JSON', () => {
    const doc = baseDoc();
    doc.regions[0] = { material: 'nope', polygon: doc.regions[0]?.polygon ?? [] };
    const [issue] = validateLocal(doc);
    expect(issue).toEqual({
      source: 'local',
      severity: 'error',
      code: 'editor.missing_material',
      text: 'Región 1: usa el material «nope», que no existe. Asígnele uno de los materiales definidos o cree ese material en el panel «Materiales».',
      path: '/regions/0/material',
    });
  });
  it('validateLocalCached devuelve el mismo resultado por referencia de documento', () => {
    const doc = baseDoc();
    expect(validateLocalCached(doc)).toBe(validateLocalCached(doc));
    expect(validateLocalCached(baseDoc())).toEqual(validateLocal(baseDoc()));
  });
});

describe('validateLocal: vértices', () => {
  it('menos de 3 vértices', () => {
    const issues = validateLocal(singleRegionDoc([[0, 0], [1, 1]]));
    expect(codes(issues)).toEqual(['editor.too_few_vertices']);
    expect(issues[0]?.path).toBe('/regions/0/polygon');
  });
  it('vértices consecutivos repetidos, incluido el cierre', () => {
    const issues = validateLocal(singleRegionDoc([[0, 0], [10, 0], [10, 0], [10, 10], [0, 10], [0, 0]]));
    expect(codes(issues)).toEqual(['editor.duplicate_vertex', 'editor.duplicate_vertex']);
    // E12j: el motor acepta el repetido, así que es un aviso y no un error.
    expect(issues.map((i) => i.severity)).toEqual(['aviso', 'aviso']);
    expect(issues.map((i) => i.path)).toEqual(['/regions/0/polygon/2', '/regions/0/polygon/5']);
  });
  it('repetidos que dejan menos de 3 vértices distintos', () => {
    const issues = validateLocal(singleRegionDoc([[0, 0], [0, 0], [5, 5]]));
    // Área nula: el motor la rechaza como degenerada (E12j); el repetido ya no se informa.
    expect(codes(issues)).toEqual(['editor.degenerate_region']);
  });
  it('coordenadas no finitas', () => {
    const issues = validateLocal(singleRegionDoc([[0, 0], [10, Number.NaN], [10, 10]]));
    expect(codes(issues)).toEqual(['editor.out_of_range']);
    expect(issues[0]?.path).toBe('/regions/0/polygon/1');
  });
  it('sin regiones', () => {
    const doc: ModelDoc = { ...baseDoc(), regions: [] };
    expect(validateLocal(doc).map((i) => i.path)).toEqual(['/regions']);
  });
});

describe('validateLocal: auto-intersección (E12c)', () => {
  it('lazo «8»', () => {
    const issues = validateLocal(singleRegionDoc([[0, 0], [10, 10], [10, 0], [0, 10]]));
    expect(codes(issues)).toEqual(['editor.self_intersection']);
    expect(issues[0]?.text).toContain('aristas 1 y 3');
  });
  it('espiga: dos aristas adyacentes colineales que se superponen', () => {
    const issues = validateLocal(singleRegionDoc([[0, 0], [10, 0], [10, 10], [10, 6], [0, 6]]));
    expect(codes(issues)).toEqual(['editor.self_intersection']);
    expect(issues[0]?.text).toContain('se superponen');
  });
  it('espiga en el vértice de cierre que sobresale y vuelve sobre su propio tramo', () => {
    const issues = validateLocal(singleRegionDoc([[0, 0], [10, 0], [10, 10], [0, 10], [0, -5]]));
    expect(codes(issues)).toEqual(['editor.self_intersection']);
    expect(issues[0]?.text).toContain('se superponen');
  });
  it('un vértice colineal en el cierre (sin retroceso) es válido', () => {
    expect(validateLocal(singleRegionDoc([[0, 0], [10, 0], [10, 10], [0, 10], [0, 4]]))).toEqual([]);
  });
  it('dos aristas no adyacentes que se tocan en un vértice', () => {
    // un «reloj de arena» cuyo cuello toca un vértice con otra arista
    const issues = validateLocal(singleRegionDoc([[0, 0], [10, 0], [10, 10], [5, 0], [0, 10]]));
    expect(codes(issues)).toContain('editor.self_intersection');
  });
  it('un vértice colineal entre dos aristas (sin retroceso) es válido', () => {
    expect(validateLocal(singleRegionDoc([[0, 0], [5, 0], [10, 0], [10, 10], [0, 10]]))).toEqual([]);
  });
  it('polígonos cóncavos simples y ambos sentidos de giro son válidos', () => {
    const l: Point[] = [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]];
    expect(validateLocal(singleRegionDoc(l))).toEqual([]);
    expect(validateLocal(singleRegionDoc([...l].reverse()))).toEqual([]);
  });
  it('un polígono degenerado (todos los puntos colineales) se informa como región degenerada (E12j)', () => {
    expect(codes(validateLocal(singleRegionDoc([[0, 0], [5, 0], [10, 0]])))).toEqual(['editor.degenerate_region']);
  });
  it('un ocho simétrico (área neta cero, no colineal) sigue siendo una auto-intersección', () => {
    expect(codes(validateLocal(singleRegionDoc([[0, 0], [10, 10], [10, 0], [0, 10]])))).toEqual(['editor.self_intersection']);
  });
});

describe('validateLocal: solape entre regiones (E12c)', () => {
  it('cruce propio de aristas', () => {
    const issues = validateLocal(twoRegionDoc(square(0, 0, 10, 10), square(5, 5, 15, 15)));
    expect(codes(issues)).toEqual(['editor.region_overlap']);
    expect(issues[0]?.text).toBe('Las regiones 1 y 2 se solapan. Ajuste sus vértices para que solo compartan bordes.');
    expect(issues[0]?.path).toBe('/regions/1');
  });
  it('contención: un vértice estrictamente dentro de la otra región', () => {
    expect(codes(validateLocal(twoRegionDoc(square(0, 0, 10, 10), square(2, 2, 4, 4))))).toEqual(['editor.region_overlap']);
    expect(codes(validateLocal(twoRegionDoc(square(2, 2, 4, 4), square(0, 0, 10, 10))))).toEqual(['editor.region_overlap']);
  });
  it('contención con un lado compartido', () => {
    expect(codes(validateLocal(twoRegionDoc(square(0, 0, 10, 10), square(0, 0, 5, 5))))).toEqual(['editor.region_overlap']);
  });
  it('contención sin vértices dentro: triángulo apoyado en tres esquinas', () => {
    const tri: Point[] = [[0, 0], [10, 0], [10, 10]];
    expect(codes(validateLocal(twoRegionDoc(square(0, 0, 10, 10), tri)))).toEqual(['editor.region_overlap']);
  });
  it('polígonos idénticos, con otro orden, otra orientación o un vértice colineal extra', () => {
    const a = square(0, 0, 10, 10);
    const rotated: Point[] = [a[2] as Point, a[3] as Point, a[0] as Point, a[1] as Point];
    expect(codes(validateLocal(twoRegionDoc(a, a.map((p): Point => [p[0], p[1]]))))).toEqual(['editor.region_overlap']);
    expect(codes(validateLocal(twoRegionDoc(a, rotated)))).toEqual(['editor.region_overlap']);
    expect(codes(validateLocal(twoRegionDoc(a, [...a].reverse())))).toEqual(['editor.region_overlap']);
    expect(codes(validateLocal(twoRegionDoc(a, [[0, 0], [5, 0], [10, 0], [10, 10], [0, 10]])))).toEqual(['editor.region_overlap']);
  });
  it('arista compartida completa: válida', () => {
    expect(validateLocal(twoRegionDoc(square(0, 0, 10, 10), square(10, 0, 20, 10)))).toEqual([]);
  });
  it('tramo colineal compartido parcial: válido', () => {
    expect(validateLocal(twoRegionDoc(square(0, 0, 10, 10), square(10, 3, 20, 7)))).toEqual([]);
    expect(validateLocal(twoRegionDoc(square(0, 0, 10, 10), square(7, 10, 17, 20)))).toEqual([]);
  });
  it('unión en T (un vértice sobre una arista de la otra): válida', () => {
    const tri: Point[] = [[5, 10], [10, 15], [0, 15]];
    expect(validateLocal(twoRegionDoc(square(0, 0, 10, 10), tri))).toEqual([]);
  });
  it('un contacto en un solo vértice es válido', () => {
    expect(validateLocal(twoRegionDoc(square(0, 0, 10, 10), square(10, 10, 20, 20)))).toEqual([]);
  });
  it('mismas regiones con coordenadas flotantes con ruido de 1e-12 (sobre la tolerancia relativa)', () => {
    const b = square(10 + 1e-12, 0, 20, 10);
    expect(validateLocal(twoRegionDoc(square(0, 0, 10, 10), b))).toEqual([]);
  });
  it('no informa solapes de una región que ya tiene auto-intersección', () => {
    const bowtie: Point[] = [[0, 0], [10, 10], [10, 0], [0, 10]];
    const issues = validateLocal(twoRegionDoc(bowtie, square(0, 0, 10, 10)));
    expect(codes(issues)).toEqual(['editor.self_intersection']);
  });
  it('tres regiones: informa solo la pareja que solapa', () => {
    const doc = twoRegionDoc(square(0, 0, 10, 10), square(10, 0, 20, 10));
    doc.regions.push({ material: 'm1', polygon: square(15, 2, 25, 8) });
    const issues = validateLocal(doc);
    expect(codes(issues)).toEqual(['editor.region_overlap']);
    expect(issues[0]?.text).toBe('Las regiones 2 y 3 se solapan. Ajuste sus vértices para que solo compartan bordes.');
  });
});

describe('validateLocal: materiales', () => {
  it('región con material faltante', () => {
    const doc = baseDoc();
    doc.materials = [mat('m1')];
    const issues = validateLocal(doc);
    expect(codes(issues)).toEqual(['editor.missing_material']);
    expect(issues[0]?.path).toBe('/regions/1/material');
  });
  it('ids duplicados', () => {
    const doc = baseDoc();
    doc.materials = [mat('m1'), mat('m2'), mat('m1')];
    const issues = validateLocal(doc);
    expect(codes(issues)).toEqual(['editor.duplicate_material']);
    expect(issues[0]?.path).toBe('/materials/2/id');
  });
  it.each([
    ['unit_weight', { unit_weight: 0 }, RULE_TEXT.unitWeight],
    ['unit_weight', { unit_weight: Number.NaN }, RULE_TEXT.unitWeight],
    ['unit_weight_sat', { unit_weight_sat: -1 }, RULE_TEXT.unitWeightSat],
    ['cohesion', { cohesion: -0.1 }, RULE_TEXT.cohesion],
    ['friction_angle', { friction_angle: 90 }, RULE_TEXT.frictionAngle],
    ['friction_angle', { friction_angle: -1 }, RULE_TEXT.frictionAngle],
    ['ru', { ru: 1 }, RULE_TEXT.ru],
    ['ru', { ru: -0.1 }, RULE_TEXT.ru],
  ])('rango de material: %s', (field, patch, text) => {
    const doc = baseDoc();
    doc.materials[0] = mat('m1', patch);
    const issues = validateLocal(doc).filter((i) => i.severity === 'error');
    expect(codes(issues)).toEqual(['editor.out_of_range']);
    expect(issues[0]?.path).toBe(`/materials/0/${field}`);
    expect(issues[0]?.text.startsWith(`Material «m1», ${text.charAt(0).toLowerCase()}${text.slice(1)}. Valor actual: `)).toBe(true);
  });
  it('los límites válidos de material pasan: c = 0, φ = 0 y 89,9, ru = 0 y 0,99, γsat nulo', () => {
    const doc = baseDoc();
    doc.materials = [
      mat('m1', { cohesion: 0, friction_angle: 0, ru: 0, unit_weight_sat: null }),
      mat('m2', { friction_angle: 89.9, ru: 0.99, unit_weight_sat: 21 }),
    ];
    // Sin errores; solo los avisos geotécnicos (ru con piezométrica; γsat ≥ γ ya no avisa, E15k).
    expect(validateLocal(doc).filter((i) => i.severity === 'error')).toEqual([]);
    expect(codes(validateLocal(doc))).toEqual(['editor.ru_over_piezo']);
  });
});

describe('validateLocal: piezométrica', () => {
  const withPiezo = (points: Point[]): ModelDoc => ({ ...baseDoc(), water: { unit_weight: 9.81, piezometric_line: points } });
  it('desordenada', () => {
    const issues = validateLocal(withPiezo([[0, 5], [10, 6], [5, 5], [20, 5]]));
    expect(codes(issues)).toEqual(['editor.piezo_order']);
    expect(issues[0]?.path).toBe('/water/piezometric_line/2');
    expect(issues[0]?.text).toBe(
      'Línea piezométrica, punto 3: la coordenada x (5) debe ser mayor que la del punto anterior (10); ordene los puntos de izquierda a derecha.',
    );
  });
  it('x repetida', () => {
    expect(codes(validateLocal(withPiezo([[0, 5], [10, 6], [10, 7]])).filter((i) => i.severity === 'error'))).toEqual(['editor.piezo_order']);
  });
  it('invertida del todo informa un punto por cada retroceso', () => {
    expect(validateLocal(withPiezo([[20, 5], [10, 6], [0, 5]])).map((i) => i.path)).toEqual([
      '/water/piezometric_line/1',
      '/water/piezometric_line/2',
    ]);
  });
  it('menos de 2 puntos y puntos no finitos', () => {
    expect(codes(validateLocal(withPiezo([[0, 5]])))).toEqual(['editor.out_of_range']);
    expect(codes(validateLocal(withPiezo([[0, 5], [1, Number.NaN]])))).toEqual(['editor.out_of_range']);
  });
  it('ordenada, ausente o nula es válida', () => {
    expect(validateLocal(withPiezo([[0, 5], [20, 6]]))).toEqual([]);
    // Una piezométrica corta no es un error: el motor la prolonga, y solo se avisa (R9-05d).
    expect(codes(validateLocal(withPiezo([[0, 5], [10, 6]])))).toEqual(['editor.piezo_extrapolated']);
    expect(validateLocal({ ...baseDoc(), water: { piezometric_line: null } })).toEqual([]);
    expect(validateLocal({ ...baseDoc(), water: undefined })).toEqual([]);
  });
  it('peso unitario del agua', () => {
    const issues = validateLocal({ ...baseDoc(), water: { unit_weight: 0 } });
    expect(issues.map((i) => [i.code, i.path])).toEqual([['editor.out_of_range', '/water/unit_weight']]);
  });
});

describe('validateLocal: sismo (F1.1)', () => {
  const seismic = (kh: number, kv: number): ModelDoc => {
    const d = baseDoc();
    d.analysis.seismic = { kh, kv };
    return d;
  };
  it.each([
    [0, 0, []],
    [0.2, -0.3, []],
    [0.999, 0.999, []],
    [1, 0, ['/analysis/seismic/kh']],
    [-0.01, 0, ['/analysis/seismic/kh']],
    [Number.NaN, 0, ['/analysis/seismic/kh']],
    [0, 1, ['/analysis/seismic/kv']],
    [0, -1, ['/analysis/seismic/kv']],
    [1.5, -2, ['/analysis/seismic/kh', '/analysis/seismic/kv']],
  ])('kh = %s, kv = %s', (kh, kv, paths) => {
    const issues = validateLocal(seismic(kh, kv));
    expect(issues.map((i) => i.path)).toEqual(paths);
    expect(issues.every((i) => i.code === 'editor.out_of_range')).toBe(true);
  });
  it('kh ausente equivale a 0', () => {
    const d = baseDoc();
    d.analysis.seismic = { kv: 0.1 };
    expect(validateLocal(d)).toEqual([]);
  });
  it('sismo o cargas con version 0.1 se rechazan, igual que el motor', () => {
    const d = { ...seismic(0.1, 0), version: '0.1' as const };
    expect(validateLocal(d).map((i) => i.path)).toEqual(['/version']);
    const e = { ...baseDoc(), version: '0.1' as const, loads: [{ type: 'udl' as const, x1: 1, x2: 2, q: 1 }] };
    expect(validateLocal(e).map((i) => i.path)).toEqual(['/version']);
  });
});

describe('validateLocal: cargas (F1.1)', () => {
  const withLoads = (loads: NonNullable<ModelDoc['loads']>): ModelDoc => ({ ...baseDoc(), loads });
  it('cargas válidas, con los extremos del rango x del modelo incluidos', () => {
    expect(
      validateLocal(
        withLoads([
          { type: 'udl', id: 'u1', x1: 0, x2: 20, q: 0 },
          { type: 'line', id: 'l1', x: 20, p: 0, angle: -90 },
          { type: 'line', x: 5, p: 10, angle: 90 },
        ]),
      ),
    ).toEqual([]);
  });
  it('udl con x1 ≥ x2', () => {
    for (const [x1, x2] of [[5, 5], [8, 2]] as const) {
      const issues = validateLocal(withLoads([{ type: 'udl', x1, x2, q: 1 }]));
      expect(codes(issues)).toEqual(['editor.load_range']);
      expect(issues[0]?.path).toBe('/loads/0/x1');
      expect(issues[0]?.text).toBe(
        `Carga 1: carga distribuida: el inicio x1 debe ser menor que el fin x2; intercambie los valores. Valores actuales: x1 ${String(x1)}, x2 ${String(x2)}.`,
      );
    }
  });
  it('udl fuera del rango x del modelo y q negativa', () => {
    const issues = validateLocal(withLoads([{ type: 'udl', x1: -1, x2: 25, q: -5 }]));
    expect(issues.map((i) => i.path)).toEqual(['/loads/0/x1', '/loads/0/x2', '/loads/0/q']);
    expect(codes(issues).every((c) => c === 'editor.load_range')).toBe(true);
  });
  it('line con x fuera de rango, p negativa y ángulo fuera de [-90, 90]', () => {
    const issues = validateLocal(withLoads([{ type: 'line', x: 21, p: -1, angle: 91 }]));
    expect(issues.map((i) => i.path)).toEqual(['/loads/0/x', '/loads/0/p', '/loads/0/angle']);
    expect(validateLocal(withLoads([{ type: 'line', x: 5, p: 1, angle: -90.5 }])).map((i) => i.path)).toEqual(['/loads/0/angle']);
  });
  it('valores no finitos', () => {
    expect(codes(validateLocal(withLoads([{ type: 'udl', x1: Number.NaN, x2: 5, q: 1 }])))).toEqual(['editor.load_range']);
    expect(codes(validateLocal(withLoads([{ type: 'line', x: 5, p: Infinity, angle: 0 }])))).toEqual(['editor.load_range']);
  });
  it('id repetido', () => {
    const issues = validateLocal(
      withLoads([
        { type: 'udl', id: 'a', x1: 1, x2: 2, q: 1 },
        { type: 'line', id: 'a', x: 5, p: 1, angle: 0 },
        { type: 'line', id: null, x: 5, p: 1, angle: 0 },
        { type: 'line', id: null, x: 6, p: 1, angle: 0 },
      ]),
    );
    expect(issues.map((i) => i.path)).toEqual(['/loads/1/id']);
  });
  it('tipo desconocido', () => {
    const issues = validateLocal(withLoads([{ type: 'otra' } as never]));
    expect(issues.map((i) => i.path)).toEqual(['/loads/0/type']);
  });
});

describe('validateLocal: análisis (§4.5)', () => {
  const analysis = (patch: ModelDoc['analysis']): ModelDoc => ({ ...baseDoc(), analysis: { surface: { type: 'circle', xc: 10, yc: 20, r: 12 }, ...patch } });
  it.each([
    ['slices', { slices: 2 }],
    ['slices', { slices: 2001 }],
    ['slices', { slices: 10.5 }],
    ['tolerance', { tolerance: 0 }],
    ['tolerance', { tolerance: 0.02 }],
    ['tolerance', { tolerance: Number.NaN }],
    ['max_iterations', { max_iterations: 0 }],
    ['max_iterations', { max_iterations: 100001 }],
    ['min_m_alpha', { min_m_alpha: 0 }],
    ['min_m_alpha', { min_m_alpha: 1.1 }],
    ['methods', { methods: [] }],
    ['methods', { methods: ['bishop', 'bishop'] }],
  ] as [string, ModelDoc['analysis']][])('rango fuera de lo permitido: %s %j', (field, patch) => {
    const issues = validateLocal(analysis(patch));
    expect(issues.map((i) => i.path)).toEqual([`/analysis/${field}`]);
    expect(codes(issues)).toEqual(['editor.out_of_range']);
  });
  it('los extremos válidos pasan', () => {
    expect(validateLocal(analysis({ slices: 3, tolerance: 0.01, max_iterations: 100000, min_m_alpha: 1, methods: ['bishop', 'spencer'] }))).toEqual([]);
    expect(validateLocal(analysis({ slices: 2000, tolerance: 1e-9, max_iterations: 1, min_m_alpha: 0.001 }))).toEqual([]);
  });
  it('superficie fija: radio ≤ 0 o centro no finito', () => {
    expect(validateLocal(analysis({ surface: { type: 'circle', xc: 0, yc: 0, r: 0 } })).map((i) => i.path)).toEqual(['/analysis/surface/r']);
    expect(validateLocal(analysis({ surface: { type: 'circle', xc: Number.NaN, yc: 0, r: 1 } })).map((i) => i.path)).toEqual(['/analysis/surface']);
  });
  it('búsqueda: contadores, producto, factor, ancho mínimo y rangos', () => {
    const search = (s: NonNullable<ModelDoc['analysis']['search']>): string[] =>
      validateLocal(analysis({ surface: null, search: s })).map((i) => i.path ?? '');
    expect(search({ type: 'circular_entry_exit', entry: [0, 10], exit: [10, 20], n_entry: 20, n_exit: 20, n_radius: 20 })).toEqual([]);
    expect(search({ type: 'circular_entry_exit', n_entry: 0 })).toEqual(['/analysis/search/n_entry']);
    expect(search({ type: 'circular_entry_exit', n_exit: 201 })).toEqual(['/analysis/search/n_exit']);
    expect(search({ type: 'circular_entry_exit', n_radius: 2.5 })).toEqual(['/analysis/search/n_radius']);
    expect(search({ type: 'circular_entry_exit', n_entry: 200, n_exit: 200, n_radius: 100 })).toEqual(['/analysis/search']);
    expect(search({ type: 'circular_entry_exit', n_entry: 200, n_exit: 100, n_radius: 100 })).toEqual([]); // 2e6 exacto
    expect(search({ type: 'circular_entry_exit', max_radius_factor: 0.51 })).toEqual(['/analysis/search/max_radius_factor']);
    expect(search({ type: 'circular_entry_exit', max_radius_factor: 0.52 })).toEqual([]);
    expect(search({ type: 'circular_entry_exit', min_width: -1 })).toEqual(['/analysis/search/min_width']);
    expect(search({ type: 'circular_entry_exit', min_width: null })).toEqual([]);
    expect(search({ type: 'circular_entry_exit', entry: [10, 5] })).toEqual(['/analysis/search/entry']);
    expect(search({ type: 'circular_entry_exit', exit: [-5, 5] })).toEqual(['/analysis/search/exit']);
    expect(search({ type: 'circular_entry_exit', entry: [5, 25] })).toEqual(['/analysis/search/entry']);
    expect(search({ type: 'circular_entry_exit', entry: null, exit: null })).toEqual([]);
  });
});

describe('validateLocal: neutralidad frente a los casos de verificación', () => {
  const casesDir = fileURLToPath(new URL('../../../../../verification/cases/', import.meta.url));
  const files = readdirSync(casesDir).filter((f) => /^V.+\.json$/.test(f)).sort();

  it('hay al menos los 21 casos de v0.1 y v0.2', () => {
    expect(files.length).toBeGreaterThanOrEqual(21);
  });

  it.each(files)('%s: 0 errores', (file) => {
    const data = JSON.parse(readFileSync(casesDir + file, 'utf8')) as VerificationCase;
    // E15l-20: los casos con grieta de profundidad fija y búsqueda traen la nota informativa `editor.crack_fixed_search`; no hay nada más.
    expect(validateLocal(data.model).filter((i) => i.code !== 'editor.crack_fixed_search')).toEqual([]);
  });

  it('el ejemplo ACADS 1(a) de src/examples tampoco da errores', () => {
    const data = JSON.parse(readFileSync(fileURLToPath(new URL('../../examples/acads1a.json', import.meta.url)), 'utf8')) as VerificationCase;
    expect(validateLocal(data.model)).toEqual([]);
  });

  it('añadir sismo y cargas válidos a un caso 0.3 tampoco introduce errores', () => {
    const data = JSON.parse(readFileSync(casesDir + 'V047a.json', 'utf8')) as VerificationCase;
    const doc: ModelDoc = {
      ...data.model,
      version: '0.3', // V047a trae campos de la 0.3 (R10B-08)
      loads: [{ type: 'udl', x1: 50, x2: 70, q: 20 }, { type: 'line', x: 40, p: 20, angle: 10 }],
      analysis: { ...data.model.analysis, seismic: { kh: 0.1, kv: 0 } },
    };
    expect(validateLocal(doc)).toEqual([]);
  });
});

describe('validateLocal: mensajes en lenguaje geotécnico (R7-19, UX-13)', () => {
  // Los tests de unidades imperiales usan el agua de `baseDoc` (γw = 9,81): se deja fuera su aviso de γw, que se prueba aparte.
  const textsOf = (doc: ModelDoc): string[] =>
    validateLocal(doc)
      .filter((i) => i.code !== 'editor.water_unit_weight' && !GEOTECH_CODES.has(i.code)) // los avisos geotécnicos (γsat, ru, piezométrica corta) se prueban en geotech.test.ts
      .map((i) => i.text);
  const withAnalysis = (analysis: ModelDoc['analysis']): ModelDoc => ({ ...baseDoc(), analysis });
  const INTERNAL = /min_m_alpha|n_entry|n_exit|n_radius|analysis\.|search\.|deny_unknown_fields|performance\.now|1e-12|escala²|\budl\b|\bkh debe|\bru debe/;

  it('kh fuera de rango: etiqueta de la interfaz, rango llano, ejemplo y valor actual', () => {
    const issues = validateLocal(withAnalysis({ surface: { type: 'circle', xc: 10, yc: 20, r: 12 }, seismic: { kh: 1.2, kv: 0 } }));
    expect(issues).toEqual([
      {
        source: 'local',
        severity: 'error',
        code: 'editor.out_of_range',
        text: 'Coeficiente sísmico horizontal kh: use un valor entre 0 y 0,99 (ej. 0,15). Valor actual: 1,2.',
        path: '/analysis/seismic/kh',
      },
    ]);
  });

  it('kv fuera de rango', () => {
    const [i] = validateLocal(withAnalysis({ surface: { type: 'circle', xc: 10, yc: 20, r: 12 }, seismic: { kh: 0, kv: -1 } }));
    expect(i?.text).toBe('Coeficiente sísmico vertical kv: use un valor entre −0,99 y 0,99 (ej. 0 o 0,05). Valor actual: -1.');
  });

  it('parámetros de análisis: etiquetas de la interfaz y valor actual', () => {
    const surface = { type: 'circle', xc: 10, yc: 20, r: 12 } as const;
    expect(textsOf(withAnalysis({ surface, min_m_alpha: 0 }))).toEqual(['m_α mínimo: use un valor mayor que 0 y hasta 1 (ej. 0,2). Valor actual: 0.']);
    expect(textsOf(withAnalysis({ surface, slices: 2 }))).toEqual(['Dovelas: use un número entero entre 3 y 2000 (ej. 50). Valor actual: 2.']);
    expect(textsOf(withAnalysis({ surface, tolerance: 0.5 }))).toEqual([
      'Tolerancia: use un valor mayor que 0 y hasta 0,01 (ej. 0,00001). Valor actual: 0,5.',
    ]);
    expect(textsOf(withAnalysis({ surface, max_iterations: 0 }))).toEqual([
      'Iteraciones máximas: use un número entero entre 1 y 100000 (ej. 500). Valor actual: 0.',
    ]);
    expect(textsOf(withAnalysis({ surface, methods: [] }))).toEqual(['Métodos de análisis: marque al menos uno.']);
    expect(textsOf(withAnalysis({ surface, methods: ['bishop', 'bishop'] }))).toEqual([
      'Métodos de análisis: hay un método repetido; marque cada uno una sola vez.',
    ]);
  });

  it('búsqueda: puntos de entrada y salida, radios por par, producto, factor y ancho mínimo', () => {
    const search = (q: Partial<Omit<SearchSpec, 'type'>>): string[] => textsOf(withAnalysis({ search: { type: 'circular_entry_exit', ...q } }));
    expect(search({ n_entry: 0 })).toEqual(['Puntos de entrada: use un número entero entre 1 y 200 (ej. 20). Valor actual: 0.']);
    expect(search({ n_exit: 201 })).toEqual(['Puntos de salida: use un número entero entre 1 y 200 (ej. 20). Valor actual: 201.']);
    expect(search({ n_radius: 2.5 })).toEqual(['Radios por par: use un número entero entre 1 y 200 (ej. 20). Valor actual: 2,5.']);
    expect(search({ n_entry: 200, n_exit: 200, n_radius: 200 })).toEqual([
      'Búsqueda: puntos de entrada × puntos de salida × radios por par no puede superar 2 000 000 de candidatos; reduzca alguno de los tres (ahora son 8\u202f000\u202f000).',
    ]);
    expect(search({ max_radius_factor: 0.5 })).toEqual(['Factor de radio máximo: use un valor mayor que 0,51 (ej. 5). Valor actual: 0,5.']);
    expect(search({ min_width: -1 })).toEqual(['Ancho mínimo: use un valor igual o mayor que 0, o déjelo vacío. Valor actual: -1.']);
  });

  it('rangos de entrada y salida: orden y extensión, con el límite del modelo y su unidad', () => {
    const search = (q: Partial<Omit<SearchSpec, 'type'>>, units?: string): string[] =>
      textsOf({ ...withAnalysis({ search: { type: 'circular_entry_exit', ...q } }), units });
    expect(search({ entry: [15, 5] })).toEqual([
      'Entrada (coronamiento): el mínimo no puede ser mayor que el máximo (mínimo 15, máximo 5); intercambie los valores.',
    ]);
    expect(search({ exit: [5, 50] })).toEqual([
      'Salida (pie): el rango debe quedar dentro del ancho del modelo (de 0 a 20 m); ajuste el mínimo y el máximo. Valor actual: 5 a 50.',
    ]);
    expect(search({ exit: [5, 50] }, 'imperial')[0]).toContain('(de 0 a 20 ft)');
  });

  it('círculo fijo: centro y radio con ejemplos', () => {
    expect(textsOf(withAnalysis({ surface: { type: 'circle', xc: Number.NaN, yc: 3, r: 5 } }))).toEqual([
      'Centro (xc, yc) del círculo de falla: escriba dos números (ej. 45,5 y 38,75). Valores actuales: xc no es un número, yc 3.',
    ]);
    expect(textsOf(withAnalysis({ surface: { type: 'circle', xc: 1, yc: 3, r: 0 } }))).toEqual([
      'Radio r del círculo de falla: use un valor mayor que 0 (ej. 25). Valor actual: 0.',
    ]);
  });

  it('sin superficie: explica cómo elegirla en el panel', () => {
    expect(textsOf(withAnalysis({}))).toEqual([
      'Superficie de falla: no hay ninguna definida; en el panel «Superficie de falla» elija «Búsqueda» (superficie crítica automática) o «Fija» (círculo con centro y radio).',
    ]);
  });

  it('materiales: identificador repetido o vacío', () => {
    const doc = baseDoc();
    doc.materials = [mat('m1', {}), mat('m1', {})];
    expect(textsOf(doc)).toContain('Material «m1»: el identificador está repetido; cada material necesita uno distinto.');
    const empty = baseDoc();
    empty.materials = [mat('', {})];
    expect(textsOf(empty)).toContain('Material 1: identificador del material: no puede estar vacío; escriba un nombre corto (ej. arcilla).');
  });

  it('material: etiquetas con símbolo (γ, c, φ, ru) y ejemplos en SI e imperial', () => {
    const doc = baseDoc();
    doc.materials[0] = mat('m1', { unit_weight: 0, cohesion: -1, friction_angle: 95, ru: 1.5 });
    expect(textsOf(doc)).toEqual([
      'Material «m1», peso unitario γ: use un valor mayor que 0 (ej. 18 kN/m³ o 115 pcf). Valor actual: 0.',
      'Material «m1», cohesión c: use un valor igual o mayor que 0 (ej. 5 kPa o 100 psf). Valor actual: -1.',
      'Material «m1», ángulo de fricción φ: use un valor desde 0° hasta menos de 90° (ej. 30). Valor actual: 95.',
      'Material «m1», coeficiente de presión de poros ru: use un valor desde 0 hasta menos de 1 (ej. 0,2), o déjelo vacío. Valor actual: 1,5.',
    ]);
  });

  it('regiones: acción a tomar en cada caso, sin «1e-12 · escala²»', () => {
    expect(textsOf({ ...baseDoc(), regions: [] })).toEqual([
      'El modelo no tiene regiones: dibuje una con la herramienta «Dibujar región» (tecla R), cree un «Talud simple…» desde Archivo ▸ Nuevo, importe un DXF o abra un ejemplo.',
    ]);
    expect(textsOf(singleRegionDoc([[0, 0], [1, 1]]))).toEqual([
      'Región 1: tiene 2 vértices y necesita al menos 3. Agregue vértices o elimine la región.',
    ]);
    expect(textsOf(singleRegionDoc([[0, 0], [10, Number.NaN], [10, 10]]))).toEqual([
      'Región 1, vértice 2: las coordenadas x e y deben ser números. Corrija el valor (ej. 12,5).',
    ]);
    expect(textsOf(singleRegionDoc([[0, 0], [5, 0], [10, 0]]))).toEqual([
      'Región 1: no encierra superficie (los vértices están alineados o casi coinciden). Mueva algún vértice para que el contorno tenga área.',
    ]);
    expect(textsOf(singleRegionDoc([[0, 0], [10, 0], [10, 0], [10, 10], [0, 10]]))).toEqual([
      'Región 1, vértice 3: repite al vértice anterior. No afecta al cálculo, pero puede eliminarlo.',
    ]);
    expect(textsOf(singleRegionDoc([[0, 0], [10, 10], [10, 0], [0, 10]]))[0]).toBe(
      'Región 1: el contorno se cruza consigo mismo (aristas 1 y 3; dos aristas se tocan o se cruzan). Mueva los vértices para que el contorno no se cruce.',
    );
  });

  it('piezométrica y agua: etiquetas y acción a tomar', () => {
    const w = (water: NonNullable<ModelDoc['water']>): string[] => textsOf({ ...baseDoc(), water });
    expect(w({ unit_weight: 0 })).toEqual(['Peso unitario del agua γw: use un valor mayor que 0 (ej. 9,81 kN/m³ o 62,4 pcf). Valor actual: 0.']);
    expect(w({ piezometric_line: [[0, 5]] })).toEqual(['Línea piezométrica: indique al menos 2 puntos, o quítela si no hay nivel freático.']);
    expect(w({ piezometric_line: [[0, 5], [10, Number.NaN]] })).toEqual([
      'Línea piezométrica, punto 2: las coordenadas x e y deben ser números. Corrija el valor (ej. 12,5).',
    ]);
  });

  it('versión 0.1 con cargas o sismo: nombra el formato, no los campos', () => {
    const doc: ModelDoc = { ...baseDoc(), version: '0.1', loads: [{ type: 'udl', x1: 0, x2: 10, q: 5 }] };
    expect(textsOf(doc)).toEqual([
      'Formato del archivo: las cargas y el sismo requieren el formato 0.2, pero este modelo declara el 0.1; cambie la versión del archivo a 0.2.',
    ]);
  });

  it('cargas: etiquetas de la tabla, rango del modelo con unidad y ejemplos', () => {
    const withLoads = (loads: NonNullable<ModelDoc['loads']>, units?: string): string[] => textsOf({ ...baseDoc(), loads, units });
    expect(withLoads([{ type: 'udl', id: 'a', x1: 0, x2: 5, q: 1 }, { type: 'line', id: 'a', x: 5, p: 1, angle: 0 }])).toEqual([
      'Carga 2: el identificador «a» ya lo usa otra carga; use uno distinto.',
    ]);
    expect(withLoads([{ type: 'udl', x1: -1, x2: 5, q: -5 }])).toEqual([
      'Carga 1, inicio x1 de la carga distribuida: la posición debe estar dentro del ancho del modelo (de 0 a 20 m). Valor actual: -1.',
      'Carga 1: carga distribuida q: use un valor igual o mayor que 0 (ej. 20 kPa o 400 psf). Valor actual: -5.',
    ]);
    expect(withLoads([{ type: 'line', x: 99, p: -1, angle: 100 }], 'imperial')).toEqual([
      'Carga 1, posición x de la carga lineal: la posición debe estar dentro del ancho del modelo (de 0 a 20 ft). Valor actual: 99.',
      'Carga 1: carga lineal p: use un valor igual o mayor que 0 (ej. 50 kN/m o 3400 lbf/ft). Valor actual: -1.',
      'Carga 1: ángulo de la carga lineal: use un valor entre −90° y 90° desde la vertical (ej. 0 = vertical hacia abajo). Valor actual: 100.',
    ]);
    expect(withLoads([{ type: 'udl', x1: 8, x2: 8, q: 1 }])).toEqual([
      'Carga 1: carga distribuida: el inicio x1 debe ser menor que el fin x2; intercambie los valores. Valores actuales: x1 8, x2 8.',
    ]);
  });

  it('γw en modelos imperiales: con piezométrica y sin γw (o con 9,81) es un ERROR que bloquea, con la acción para corregirlo (R8)', () => {
    const water: ModelDoc['water'] = { piezometric_line: [[0, 5], [20, 5]] };
    const imperial = validateLocal({ ...baseDoc(), units: 'imperial', water });
    expect(imperial).toHaveLength(1);
    expect(imperial[0]).toMatchObject({ source: 'local', severity: 'error', code: 'editor.water_unit_weight', path: '/water/unit_weight' });
    expect(imperial[0]!.text).toContain('Escriba 62,4 pcf');
    expect(imperial[0]!.text).toContain('pestaña «Agua»');
    expect(imperial[0]!.text).toMatch(/menor que 20 pcf/);
    // Con 9,81 explícito en pcf tampoco es creíble.
    const explicit = validateLocal({ ...baseDoc(), units: 'imperial', water: { ...water, unit_weight: 9.81 } });
    expect(codes(explicit)).toEqual(['editor.water_unit_weight']);
    expect(explicit[0]!.severity).toBe('error');
    // Con 62,4 (o el 62,45 de la conversión) o en SI no hay incidencia.
    expect(validateLocal({ ...baseDoc(), units: 'imperial', water: { ...water, unit_weight: 62.4 } })).toEqual([]);
    expect(validateLocal({ ...baseDoc(), units: 'imperial', water: { ...water, unit_weight: 62.4501 } })).toEqual([]);
    expect(validateLocal({ ...baseDoc(), units: 'SI', water })).toEqual([]);
    // Sin piezométrica, γw no interviene.
    expect(validateLocal({ ...baseDoc(), units: 'imperial', water: {} })).toEqual([]);
  });

  it('la incidencia de γw lleva a la pestaña «Agua» y al campo γw (botón «ir a Agua» de Diagnósticos)', () => {
    const doc: ModelDoc = { ...baseDoc(), units: 'imperial', water: { piezometric_line: [[0, 5], [20, 5]] } };
    const issue = validateLocal(doc).find((i) => i.code === 'editor.water_unit_weight')!;
    expect(issueTarget(issue.path, doc)).toMatchObject({ tab: 'water', fieldPath: '/water/unit_weight' });
  });

  it('ningún mensaje local contiene nombres internos del JSON o del motor', () => {
    const docs: ModelDoc[] = [
      { ...baseDoc(), regions: [] },
      singleRegionDoc([[0, 0], [5, 0], [10, 0]]),
      withAnalysis({ search: { type: 'circular_entry_exit', n_entry: 0, n_exit: 999, n_radius: 0, entry: [9, 1] }, min_m_alpha: 5, seismic: { kh: 3 } }),
      { ...baseDoc(), version: '0.1', loads: [{ type: 'udl', x1: 3, x2: 1, q: 1 }] },
      withAnalysis({ surface: { type: 'circle', xc: Number.NaN, yc: 0, r: -1 } }),
    ];
    const all = docs.flatMap(textsOf);
    expect(all.length).toBeGreaterThan(8);
    for (const t of all) expect(t, t).not.toMatch(INTERNAL);
  });
});

describe('R9-03b: γw imperial por debajo de 20 pcf y detección de unidades sin distinguir mayúsculas', () => {
  const imp = (units: string | undefined, unit_weight?: number): ModelDoc => ({
    ...baseDoc(),
    units,
    water: { ...(unit_weight === undefined ? {} : { unit_weight }), piezometric_line: [[0, 5], [20, 5]] },
  });
  const gwErrors = (doc: ModelDoc): Issue[] => validateLocal(doc).filter((i) => i.code === 'editor.water_unit_weight');

  it.each([9.8, 9.80665, 9.81, 10, 19.99])('γw = %s pcf bloquea', (gw) => {
    const issues = gwErrors(imp('imperial', gw));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'error', path: '/water/unit_weight' });
  });
  it.each(['Imperial', 'IMPERIAL', ' imperial ', 'imp'])('units %j se trata como imperial', (units) => {
    expect(gwErrors(imp(units, 9.8))).toHaveLength(1);
    expect(gwErrors(imp(units, undefined))).toHaveLength(1);
  });
  it.each([20, 62.4, 62.45, 64.0])('γw = %s pcf pasa', (gw) => {
    expect(gwErrors(imp('imperial', gw))).toEqual([]);
    expect(gwErrors(imp('Imperial', gw))).toEqual([]);
  });
  it('en SI cualquier γw positivo pasa, y sin piezométrica γw no interviene', () => {
    expect(gwErrors(imp('SI', 9.8))).toEqual([]);
    expect(gwErrors(imp(undefined, undefined))).toEqual([]);
    expect(gwErrors({ ...imp('imperial', 9.8), water: { unit_weight: 9.8 } })).toEqual([]);
  });
  it('γw ≤ 0 sigue siendo un solo error (el del rango), no dos', () => {
    expect(validateLocal(imp('imperial', 0)).filter((i) => i.severity === 'error')).toHaveLength(1);
  });
});
