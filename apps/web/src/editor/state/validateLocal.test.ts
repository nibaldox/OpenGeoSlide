import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Point, VerificationCase } from '../../engine/types';
import type { Issue, ModelDoc } from '../types';
import { baseDoc, mat, singleRegionDoc, square, twoRegionDoc } from './testFixtures';
import { RULE_TEXT, validateLocal, validateLocalCached } from './validateLocal';

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
      text: "Región 1: usa el material 'nope', que no existe.",
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
    expect(issues[0]?.text).toBe('Las regiones 1 y 2 se solapan.');
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
    expect(issues[0]?.text).toBe('Las regiones 2 y 3 se solapan.');
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
    const issues = validateLocal(doc);
    expect(codes(issues)).toEqual(['editor.out_of_range']);
    expect(issues[0]?.path).toBe(`/materials/0/${field}`);
    expect(issues[0]?.text).toBe(`Material 'm1': ${text}.`);
  });
  it('los límites válidos de material pasan: c = 0, φ = 0 y 89,9, ru = 0 y 0,99, γsat nulo', () => {
    const doc = baseDoc();
    doc.materials = [
      mat('m1', { cohesion: 0, friction_angle: 0, ru: 0, unit_weight_sat: null }),
      mat('m2', { friction_angle: 89.9, ru: 0.99, unit_weight_sat: 21 }),
    ];
    expect(validateLocal(doc)).toEqual([]);
  });
});

describe('validateLocal: piezométrica', () => {
  const withPiezo = (points: Point[]): ModelDoc => ({ ...baseDoc(), water: { unit_weight: 9.81, piezometric_line: points } });
  it('desordenada', () => {
    const issues = validateLocal(withPiezo([[0, 5], [10, 6], [5, 5], [20, 5]]));
    expect(codes(issues)).toEqual(['editor.piezo_order']);
    expect(issues[0]?.path).toBe('/water/piezometric_line/2');
    expect(issues[0]?.text).toContain('x estrictamente creciente');
  });
  it('x repetida', () => {
    expect(codes(validateLocal(withPiezo([[0, 5], [10, 6], [10, 7]])))).toEqual(['editor.piezo_order']);
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
    expect(validateLocal(withPiezo([[0, 5], [10, 6]]))).toEqual([]);
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
      expect(issues[0]?.text).toBe(`Carga 1: ${RULE_TEXT.udlOrder}.`);
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
    expect(validateLocal(data.model)).toEqual([]);
  });

  it('el ejemplo ACADS 1(a) de src/examples tampoco da errores', () => {
    const data = JSON.parse(readFileSync(fileURLToPath(new URL('../../examples/acads1a.json', import.meta.url)), 'utf8')) as VerificationCase;
    expect(validateLocal(data.model)).toEqual([]);
  });

  it('cambiar a v0.2 con sismo y cargas válidos tampoco introduce errores', () => {
    const data = JSON.parse(readFileSync(casesDir + 'V047a.json', 'utf8')) as VerificationCase;
    const doc: ModelDoc = {
      ...data.model,
      version: '0.2',
      loads: [{ type: 'udl', x1: 50, x2: 70, q: 20 }, { type: 'line', x: 40, p: 20, angle: 10 }],
      analysis: { ...data.model.analysis, seismic: { kh: 0.1, kv: 0 } },
    };
    expect(validateLocal(doc)).toEqual([]);
  });
});
