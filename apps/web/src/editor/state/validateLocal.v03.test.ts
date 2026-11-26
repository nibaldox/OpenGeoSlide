// validateLocal con la v0.3: las mismas reglas que el motor (F3.2, F3.3, F3.4, F3.6), un test por regla. Cada mensaje nombra el campo con las
// etiquetas de la interfaz y el puntero JSON viaja aparte; el de Bishop con polilínea es el texto del motor.
import { describe, expect, it } from 'vitest';
import type { AnalysisSettings, Material } from '../../engine/types';
import type { Issue, ModelDoc } from '../types';
import { baseDoc as baseDoc02, mat } from './testFixtures';
import { RULE_TEXT, validateLocal } from './validateLocal';

/** El documento de base en la versión 0.3: estas pruebas usan campos de la 0.3 (R10B-08: con una versión menor `validateLocal` lo señala). */
const baseDoc = (): ModelDoc => ({ ...baseDoc02(), version: '0.3' });

const GEOTECH = new Set(['editor.gamma_sat_unverified', 'editor.gamma_sat_lt_gamma', 'editor.ru_over_piezo', 'editor.piezo_extrapolated', 'editor.undrained_ru']);
const errors = (doc: ModelDoc): Issue[] => validateLocal(doc).filter((i) => !GEOTECH.has(i.code));
const texts = (doc: ModelDoc): string[] => errors(doc).map((i) => i.text);
const paths = (doc: ModelDoc): (string | null)[] => errors(doc).map((i) => i.path);

const su = (extra: Partial<Material> = {}): Material => ({ id: 'm1', name: 'm1', model: 'undrained', unit_weight: 18, undrained_strength: 25, ...extra });
const withMaterial = (m: Material): ModelDoc => ({ ...baseDoc(), materials: [m, mat('m2', { unit_weight: 20 })] });
const withAnalysis = (a: Partial<AnalysisSettings>): ModelDoc => {
  const doc = baseDoc();
  return { ...doc, analysis: { ...doc.analysis, ...a } };
};
const polyline = (points: [number, number][], extra: Partial<AnalysisSettings> = {}): ModelDoc =>
  withAnalysis({ methods: ['spencer'], surface: { type: 'polyline', points }, ...extra });

const GOOD_POLYLINE: [number, number][] = [[2, 3], [10, 1], [18, 4]];

describe('material no drenado (F3.2)', () => {
  it('un no drenado con Su constante, o con perfil lineal y límite, es válido', () => {
    expect(errors(withMaterial(su()))).toEqual([]);
    expect(errors(withMaterial(su({ strength_datum: 30, strength_gradient: 1.5, strength_limit: 60 })))).toEqual([]);
    expect(errors(withMaterial(su({ strength_datum: 30, strength_gradient: -1 })))).toEqual([]);
    expect(errors(withMaterial(su({ undrained_strength: 0 })))).toEqual([]);
    // un null cuenta como ausente (serde Option)
    expect(errors(withMaterial(su({ strength_limit: null, cohesion: null, friction_angle: null })))).toEqual([]);
  });

  it('Su es obligatoria, finita y ≥ 0', () => {
    const { undrained_strength: _s, ...sinSu } = su();
    void _s;
    const missing = errors(withMaterial(sinSu as Material));
    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({ code: 'editor.out_of_range', path: '/materials/0/undrained_strength' });
    expect(missing[0]?.text).toContain('resistencia no drenada Su');
    expect(missing[0]?.text).toContain('Valor actual: vacío');
    expect(paths(withMaterial(su({ undrained_strength: -1 })))).toEqual(['/materials/0/undrained_strength']);
    expect(paths(withMaterial(su({ undrained_strength: Number.NaN })))).toEqual(['/materials/0/undrained_strength']);
  });

  it('no admite cohesión ni ángulo de fricción', () => {
    expect(paths(withMaterial(su({ cohesion: 5 })))).toEqual(['/materials/0/cohesion']);
    expect(paths(withMaterial(su({ friction_angle: 30 })))).toEqual(['/materials/0/friction_angle']);
    expect(texts(withMaterial(su({ cohesion: 5 })))[0]).toContain('No drenado (Su)» no admite cohesión ni ángulo de fricción');
  });

  it('la cota de referencia y el gradiente van juntos o no van', () => {
    expect(paths(withMaterial(su({ strength_datum: 30 })))).toEqual(['/materials/0/strength_gradient']);
    expect(paths(withMaterial(su({ strength_gradient: 1 })))).toEqual(['/materials/0/strength_datum']);
    expect(texts(withMaterial(su({ strength_gradient: 1 })))[0]).toContain('van juntos');
  });

  it('el límite solo se admite con gradiente y debe ser ≥ 0', () => {
    expect(paths(withMaterial(su({ strength_limit: 50 })))).toEqual(['/materials/0/strength_limit']);
    expect(texts(withMaterial(su({ strength_limit: 50 })))[0]).toContain('solo se admite junto con el gradiente');
    expect(paths(withMaterial(su({ strength_datum: 30, strength_gradient: 1, strength_limit: -5 })))).toEqual(['/materials/0/strength_limit']);
  });

  it('cota, gradiente y límite deben ser finitos', () => {
    expect(paths(withMaterial(su({ strength_datum: Number.POSITIVE_INFINITY, strength_gradient: 1 })))).toEqual(['/materials/0/strength_datum']);
    expect(paths(withMaterial(su({ strength_datum: 1, strength_gradient: Number.NaN })))).toEqual(['/materials/0/strength_gradient']);
  });

  it('Mohr-Coulomb no admite ninguno de los campos del no drenado', () => {
    for (const key of ['undrained_strength', 'strength_datum', 'strength_gradient', 'strength_limit'] as const) {
      const doc = withMaterial(mat('m1', { [key]: 5 }));
      expect(paths(doc), key).toEqual([`/materials/0/${key}`]);
      expect(texts(doc)[0], key).toContain('«Mohr-Coulomb» no admite');
    }
  });

  it('Mohr-Coulomb sigue exigiendo cohesión y fricción; γ, γsat y ru se validan igual en el no drenado', () => {
    const { cohesion: _c, ...sinC } = mat('m1');
    void _c;
    expect(paths(withMaterial(sinC as Material))).toEqual(['/materials/0/cohesion']);
    expect(paths(withMaterial(su({ unit_weight: 0 })))).toEqual(['/materials/0/unit_weight']);
    expect(paths(withMaterial(su({ unit_weight_sat: -1 })))).toEqual(['/materials/0/unit_weight_sat']);
    expect(paths(withMaterial(su({ ru: 1 })))).toEqual(['/materials/0/ru']);
  });

  it('un no drenado con ru avisa de que ru no cambia la resistencia (φ = 0), sin bloquear', () => {
    const issues = validateLocal(withMaterial(su({ ru: 0.2 })));
    const note = issues.find((i) => i.code === 'editor.undrained_ru');
    expect(note).toMatchObject({ severity: 'aviso', path: '/materials/0/ru' });
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });
});

describe('superficie polilínea (F3.3)', () => {
  it('una polilínea de formato correcto con Spencer no tiene errores locales', () => {
    expect(errors(polyline(GOOD_POLYLINE))).toEqual([]);
    expect(errors(polyline([[2, 3], [18, 4]]))).toEqual([]);
  });

  it('necesita al menos 2 puntos', () => {
    const e = errors(polyline([[2, 3]]));
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ code: 'editor.out_of_range', path: '/analysis/surface/points' });
    expect(e[0]?.text).toContain('al menos 2 puntos');
    expect(texts(polyline([]))[0]).toContain('al menos 2 puntos');
  });

  it('las coordenadas deben ser finitas', () => {
    const e = errors(polyline([[2, 3], [Number.NaN, 1], [18, 4]]));
    expect(e).toHaveLength(1);
    expect(e[0]?.path).toBe('/analysis/surface/points/1');
    expect(e[0]?.text).toContain('punto 2');
  });

  it('la x debe ser estrictamente creciente (con la separación mínima de 1e-9 por el ancho)', () => {
    const e = errors(polyline([[2, 3], [10, 1], [10, 2], [18, 4]]));
    expect(e).toHaveLength(1);
    expect(e[0]?.path).toBe('/analysis/surface/points/2');
    expect(e[0]?.text).toContain('estrictamente creciente');
    expect(e[0]?.text).toContain('puntos 2 y 3');
    expect(paths(polyline([[2, 3], [1, 1]]))).toEqual(['/analysis/surface/points/1']);
    // ancho del modelo = 20 → separación mínima 2e-8
    expect(paths(polyline([[2, 3], [2 + 1e-9, 1]]))).toEqual(['/analysis/surface/points/1']);
    expect(errors(polyline([[2, 3], [2 + 1e-6, 1]]))).toEqual([]);
  });

  it('con búsqueda la polilínea guardada se valida igual (el motor valida el formato aunque la ignore)', () => {
    const doc = polyline([[2, 3], [1, 1]], { search: { type: 'circular_entry_exit' } });
    expect(paths(doc)).toEqual(['/analysis/surface/points/1']);
  });
});

describe('Bishop con polilínea (F3.6)', () => {
  const ENGINE = "el método 'bishop' solo admite superficies circulares; use spencer, morgenstern_price o janbu";

  it('se bloquea con el mensaje del motor', () => {
    const e = errors(polyline(GOOD_POLYLINE, { methods: ['bishop', 'spencer'] }));
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ code: 'editor.out_of_range', path: '/analysis/methods' });
    expect(e[0]?.text).toContain(ENGINE);
    expect(RULE_TEXT.bishopPolyline).toContain(ENGINE);
  });

  it('con búsqueda activa la superficie fija se ignora y no se bloquea', () => {
    const doc = polyline(GOOD_POLYLINE, { methods: ['bishop'], search: { type: 'circular_entry_exit' } });
    expect(errors(doc)).toEqual([]);
  });

  it('con círculo y Bishop no hay error, y con polilínea sin Bishop tampoco', () => {
    expect(errors(withAnalysis({ methods: ['bishop'] }))).toEqual([]);
    expect(errors(polyline(GOOD_POLYLINE, { methods: ['janbu_corrected', 'morgenstern_price'] }))).toEqual([]);
  });
});

describe('función entre dovelas (F3.4)', () => {
  const mp = (interslice: AnalysisSettings['interslice'], methods: AnalysisSettings['methods'] = ['morgenstern_price']): ModelDoc => withAnalysis({ methods, interslice });
  const pts = (points: [number, number][]): ModelDoc => mp({ function: 'data_points', points });

  it('con morgenstern_price y cualquiera de las cinco funciones es válida', () => {
    for (const f of ['constant', 'half_sine', 'clipped_sine', 'trapezoidal'] as const) expect(errors(mp({ function: f })), f).toEqual([]);
    expect(errors(pts([[0, 0], [0.5, 1], [1, 0]]))).toEqual([]);
    expect(errors(pts([[0, 1], [1, 1]]))).toEqual([]);
  });

  it('exige morgenstern_price entre los métodos', () => {
    const e = errors(mp({ function: 'half_sine' }, ['spencer']));
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ path: '/analysis/interslice' });
    expect(e[0]?.text).toContain('Morgenstern-Price');
  });

  it('data_points exige points, y points solo se admite con data_points', () => {
    expect(texts(mp({ function: 'data_points' }))[0]).toContain('requiere una tabla de puntos');
    expect(paths(mp({ function: 'data_points' }))).toEqual(['/analysis/interslice/points']);
    expect(texts(mp({ function: 'constant', points: [[0, 0], [1, 1]] }))[0]).toContain('solo se admite con la función «Definida por puntos»');
  });

  it('al menos 2 puntos, todos finitos', () => {
    expect(texts(pts([[0, 1]]))[0]).toContain('al menos 2 puntos');
    expect(texts(pts([[0, 1], [Number.NaN, 1]]))[0]).toContain('finitos');
  });

  it('ξ empieza en 0, termina en 1 y es estrictamente creciente', () => {
    expect(texts(pts([[0.1, 1], [1, 1]]))[0]).toContain('empezar en ξ = 0');
    expect(texts(pts([[0, 1], [0.9, 1]]))[0]).toContain('terminar en ξ = 1');
    expect(texts(pts([[0, 1], [0.5, 1], [0.5, 2], [1, 1]]))[0]).toContain('estrictamente creciente');
  });

  it('f ≥ 0 y algún f > 0', () => {
    expect(texts(pts([[0, 1], [0.5, -0.1], [1, 1]]))[0]).toContain('f debe ser igual o mayor que 0');
    expect(paths(pts([[0, 1], [0.5, -0.1], [1, 1]]))).toEqual(['/analysis/interslice/points/1']);
    expect(texts(pts([[0, 0], [1, 0]]))[0]).toContain('algún f > 0');
  });
});

describe('neutralidad: los modelos sin campos de la v0.3 no cambian', () => {
  it('el documento base y la lista de métodos de la v0.2 no producen incidencias nuevas', () => {
    expect(validateLocal(baseDoc())).toEqual([]);
    expect(errors(withAnalysis({ methods: ['bishop', 'spencer'] }))).toEqual([]);
  });
});
