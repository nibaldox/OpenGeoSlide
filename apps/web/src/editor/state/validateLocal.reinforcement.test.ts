// Validación local de los refuerzos (v0.4, F4.2, E14m-3): un código `editor.reinforcement_*` y el puntero JSON por regla.
import { describe, expect, it } from 'vitest';
import type { Reinforcement } from '../../engine/types';
import type { Issue, ModelDoc } from '../types';
import { FIVE, anchor, pile, sheet } from './reinforcementFixtures';
import { baseDoc } from './testFixtures';
import { validateLocal } from './validateLocal';

const withR = (list: unknown[], version: ModelDoc['version'] = '0.4'): ModelDoc => ({ ...baseDoc(), version, reinforcements: list as Reinforcement[] });
const issues = (list: unknown[], version?: ModelDoc['version']): Issue[] => validateLocal(withR(list, version)).filter((i) => i.severity === 'error' && i.code.startsWith('editor.reinforcement_'));
const one = (r: unknown): Issue[] => issues([r]);
const codePath = (list: Issue[]): string[] => list.map((i) => `${i.code} ${i.path ?? ''}`);

describe('refuerzos válidos', () => {
  it('los cinco tipos del formato, la lista vacía y la ausencia de lista no dan incidencias', () => {
    expect(issues(FIVE)).toEqual([]);
    expect(issues([])).toEqual([]);
    expect(validateLocal(baseDoc()).filter((i) => i.code.startsWith('editor.reinforcement_'))).toEqual([]);
  });

  it('los límites que sí se admiten', () => {
    const ok = [
      anchor({ tensile_capacity: 0 }),
      anchor({ id: 'b', pullout: { model: 'bond', strength: 0 } }),
      anchor({ id: 'c', pullout: { model: 'bond', strength: 1, bonded_length: Math.hypot(14, 4) } }),
      anchor({ id: 'd', pullout: { model: 'interface', adhesion: 0, friction_angle: 0, coverage: 1 } }),
      anchor({ id: 'e', pullout: { model: 'development', length1: 0, length2: 0 } }),
      pile({ id: 'f', angle: 89.99 }),
      pile({ id: 'g', angle: -89.99 }),
      pile({ id: 'h', direction: 'tangent', angle: undefined }),
      pile({ id: 'i', force: 0, spacing: undefined }),
      sheet({ id: 'j', direction: 'angle', angle: -20 }),
    ];
    expect(issues(ok)).toEqual([]);
  });
});

describe('ids', () => {
  it('id vacío', () => {
    const e = one(anchor({ id: '' }));
    expect(codePath(e)).toEqual(['editor.reinforcement_empty_id /reinforcements/0/id']);
    expect(e[0]?.text).toContain('Refuerzo 1');
  });

  it('id repetido: señala el segundo, con el número del primero', () => {
    const e = issues([anchor(), pile({ id: 'a1' })]);
    expect(codePath(e)).toEqual(['editor.reinforcement_duplicate_id /reinforcements/1/id']);
    expect(e[0]?.text).toContain('Refuerzo 2');
    expect(e[0]?.text).toContain('«a1»');
  });

  it('tres con el mismo id dan dos incidencias', () => {
    expect(issues([anchor(), anchor(), anchor()])).toHaveLength(2);
  });
});

describe('números finitos y longitud', () => {
  it('coordenadas y campos no finitos', () => {
    for (const key of ['x1', 'y1', 'x2', 'y2'] as const) {
      expect(codePath(one(anchor({ [key]: Number.NaN }))), key).toEqual([`editor.reinforcement_non_finite /reinforcements/0/${key}`]);
    }
    expect(codePath(one(anchor({ tensile_capacity: Number.POSITIVE_INFINITY })))).toEqual(['editor.reinforcement_non_finite /reinforcements/0/tensile_capacity']);
    expect(codePath(one(pile({ force: Number.NaN })))).toEqual(['editor.reinforcement_non_finite /reinforcements/0/force']);
    expect(codePath(one(anchor({ spacing: Number.NaN })))).toEqual(['editor.reinforcement_non_finite /reinforcements/0/spacing']);
    expect(codePath(one(anchor({ pullout: { model: 'bond', strength: Number.NaN } })))).toEqual(['editor.reinforcement_non_finite /reinforcements/0/pullout/strength']);
  });

  it('un valor no finito no genera además un error de rango del mismo campo', () => {
    expect(one(anchor({ tensile_capacity: Number.NaN }))).toHaveLength(1);
  });

  it('longitud cero en el refuerzo mismo', () => {
    expect(codePath(one(anchor({ x2: 44, y2: 12 })))).toEqual(['editor.reinforcement_zero_length /reinforcements/0']);
    expect(codePath(one(pile({ y2: 12 })))).toEqual(['editor.reinforcement_zero_length /reinforcements/0']);
  });

  it('con una coordenada no finita no se evalúa la longitud', () => {
    expect(one(anchor({ x1: Number.NaN, x2: 30 })).map((i) => i.code)).toEqual(['editor.reinforcement_non_finite']);
  });
});

describe('capacidades, espaciamiento y fuerza', () => {
  it('capacidades negativas', () => {
    expect(codePath(one(anchor({ tensile_capacity: -1 })))).toEqual(['editor.reinforcement_capacity /reinforcements/0/tensile_capacity']);
    expect(codePath(one(anchor({ end1_capacity: -0.5 })))).toEqual(['editor.reinforcement_capacity /reinforcements/0/end1_capacity']);
    expect(codePath(one(anchor({ end2_capacity: -0.5 })))).toEqual(['editor.reinforcement_capacity /reinforcements/0/end2_capacity']);
    expect(codePath(one(pile({ force: -1 })))).toEqual(['editor.reinforcement_capacity /reinforcements/0/force']);
    expect(codePath(one(sheet({ force: -1 })))).toEqual(['editor.reinforcement_capacity /reinforcements/0/force']);
  });

  it('espaciamiento cero o negativo', () => {
    expect(codePath(one(anchor({ spacing: 0 })))).toEqual(['editor.reinforcement_spacing /reinforcements/0/spacing']);
    expect(codePath(one(pile({ spacing: -1 })))).toEqual(['editor.reinforcement_spacing /reinforcements/0/spacing']);
  });

  it('el mensaje cita el valor actual y dice qué hacer', () => {
    const e = one(anchor({ tensile_capacity: -7 }))[0];
    expect(e?.text).toContain('Refuerzo 1');
    expect(e?.text).toContain('capacidad a tracción');
    expect(e?.text).toContain('Valor actual: -7');
    expect(e?.text).toMatch(/use un valor igual o mayor que 0/);
  });
});

describe('arrancamiento (pullout)', () => {
  const p = (pullout: unknown, over: Partial<Reinforcement> = {}): Issue[] => one(anchor({ ...over, pullout } as never));
  it('bond', () => {
    expect(codePath(p({ model: 'bond', strength: -1 }))).toEqual(['editor.reinforcement_pullout /reinforcements/0/pullout/strength']);
    expect(codePath(p({ model: 'bond', strength: 1, bonded_length: 0 }))).toEqual(['editor.reinforcement_pullout /reinforcements/0/pullout/bonded_length']);
    expect(codePath(p({ model: 'bond', strength: 1, bonded_length: -1 }))).toEqual(['editor.reinforcement_pullout /reinforcements/0/pullout/bonded_length']);
  });

  it('bonded_length mayor que la longitud L del elemento: código propio', () => {
    // L = hypot(14, 4) ≈ 14,56
    expect(codePath(p({ model: 'bond', strength: 1, bonded_length: 15 }))).toEqual(['editor.reinforcement_bonded_length /reinforcements/0/pullout/bonded_length']);
    expect(p({ model: 'bond', strength: 1, bonded_length: 15 })[0]?.text).toContain('14,56');
  });

  it('interface', () => {
    const base = { model: 'interface', adhesion: 10, friction_angle: 20, coverage: 0.8 };
    expect(codePath(p({ ...base, adhesion: -1 }))).toEqual(['editor.reinforcement_pullout /reinforcements/0/pullout/adhesion']);
    expect(codePath(p({ ...base, friction_angle: 90 }))).toEqual(['editor.reinforcement_pullout /reinforcements/0/pullout/friction_angle']);
    expect(codePath(p({ ...base, friction_angle: -0.1 }))).toEqual(['editor.reinforcement_pullout /reinforcements/0/pullout/friction_angle']);
    expect(codePath(p({ ...base, coverage: 0 }))).toEqual(['editor.reinforcement_pullout /reinforcements/0/pullout/coverage']);
    expect(codePath(p({ ...base, coverage: 1.0001 }))).toEqual(['editor.reinforcement_pullout /reinforcements/0/pullout/coverage']);
  });

  it('development', () => {
    expect(codePath(p({ model: 'development', length1: -1, length2: 4 }))).toEqual(['editor.reinforcement_pullout /reinforcements/0/pullout/length1']);
    expect(codePath(p({ model: 'development', length1: 1, length2: -4 }))).toEqual(['editor.reinforcement_pullout /reinforcements/0/pullout/length2']);
  });
});

describe('ángulo del pilote y de la tablestaca', () => {
  it('obligatorio con direction angle', () => {
    expect(codePath(one(pile({ angle: undefined })))).toEqual(['editor.reinforcement_angle /reinforcements/0/angle']);
    expect(codePath(one({ ...pile(), angle: null }))).toEqual(['editor.reinforcement_angle /reinforcements/0/angle']);
    expect(codePath(one(sheet({ direction: 'angle' })))).toEqual(['editor.reinforcement_angle /reinforcements/0/angle']);
  });

  it('prohibido con tangent y perpendicular', () => {
    expect(codePath(one(pile({ direction: 'tangent', angle: 10 })))).toEqual(['editor.reinforcement_angle /reinforcements/0/angle']);
    expect(codePath(one(pile({ direction: 'perpendicular', angle: 10 })))).toEqual(['editor.reinforcement_angle /reinforcements/0/angle']);
    expect(codePath(one(sheet({ direction: 'tangent', angle: 10 })))).toEqual(['editor.reinforcement_angle /reinforcements/0/angle']);
  });

  it('en el intervalo abierto (−90, 90)', () => {
    for (const a of [90, -90, 95, -91]) expect(codePath(one(pile({ angle: a }))), String(a)).toEqual(['editor.reinforcement_angle /reinforcements/0/angle']);
    expect(codePath(one(sheet({ direction: 'angle', angle: 90 })))).toEqual(['editor.reinforcement_angle /reinforcements/0/angle']);
  });
});

describe('tablestaca vertical', () => {
  it('x1 distinto de x2, aunque sea por 1e-9, se señala en x2', () => {
    expect(codePath(one(sheet({ x2: 41 })))).toEqual(['editor.reinforcement_sheet_pile_vertical /reinforcements/0/x2']);
    expect(codePath(one(sheet({ x2: 40.000000001 })))).toEqual(['editor.reinforcement_sheet_pile_vertical /reinforcements/0/x2']);
  });

  it('el pilote sí puede ser inclinado', () => {
    expect(one(pile({ x2: 41 }))).toEqual([]);
  });
});

describe('versión (F4.1)', () => {
  it('con refuerzos y un formato menor que 0.4 es un error en /version, con el texto del motor en palabras de la interfaz', () => {
    for (const v of ['0.1', '0.2', '0.3'] as const) {
      const e = validateLocal(withR([anchor()], v)).filter((i) => i.code === 'editor.reinforcement_version');
      expect(e, v).toHaveLength(1);
      expect(e[0]?.path).toBe('/version');
      expect(e[0]?.severity).toBe('error');
      expect(e[0]?.text).toContain('0.4');
      expect(e[0]?.text).toContain(`declara el ${v}`);
    }
  });

  it('con 0.4, con la lista vacía o con una versión menor y la lista vacía, no hay incidencia', () => {
    expect(validateLocal(withR([anchor()], '0.4')).some((i) => i.code === 'editor.reinforcement_version')).toBe(false);
    expect(validateLocal(withR([], '0.2')).some((i) => i.code === 'editor.reinforcement_version')).toBe(false);
  });

  it('un campo de la 0.3 en un documento 0.4 no pide la 0.3', () => {
    const doc: ModelDoc = { ...withR([anchor()]), analysis: { ...baseDoc().analysis, methods: ['morgenstern_price'] } };
    expect(validateLocal(doc).filter((i) => i.path === '/version')).toEqual([]);
  });
});

describe('orden y textos', () => {
  it('las incidencias van después de las de cargas y antes de las del análisis, ordenadas por refuerzo', () => {
    const doc: ModelDoc = {
      ...withR([anchor({ tensile_capacity: -1 }), pile({ force: -1 })]),
      loads: [{ type: 'udl', id: 'u', x1: 5, x2: 1, q: 1 }],
      analysis: { methods: [], surface: { type: 'circle', xc: 10, yc: 20, r: 12 } },
    };
    const paths = validateLocal(doc).filter((i) => i.severity === 'error').map((i) => i.path);
    const iLoad = paths.indexOf('/loads/0/x1');
    const iR0 = paths.indexOf('/reinforcements/0/tensile_capacity');
    const iR1 = paths.indexOf('/reinforcements/1/force');
    const iMethods = paths.indexOf('/analysis/methods');
    expect([iLoad, iR0, iR1, iMethods].every((x) => x >= 0)).toBe(true);
    expect(iLoad).toBeLessThan(iR0);
    expect(iR0).toBeLessThan(iR1);
    expect(iR1).toBeLessThan(iMethods);
  });

  it('los textos no nombran campos internos del JSON', () => {
    const all = issues([
      anchor({ id: '', tensile_capacity: -1, spacing: 0, end1_capacity: -1, pullout: { model: 'bond', strength: 1, bonded_length: 99 } }),
      pile({ force: -1, angle: 99 }),
      sheet({ x2: 41, direction: 'tangent', angle: 3 }),
    ]);
    expect(all.length).toBeGreaterThan(6);
    for (const i of all) {
      expect(i.text).not.toMatch(/tensile_capacity|end1_capacity|bonded_length|friction_angle|sheet_pile|reinforcements/);
      expect(i.text).toMatch(/^Refuerzo \d/);
    }
  });
});
