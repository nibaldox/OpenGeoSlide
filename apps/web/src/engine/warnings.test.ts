import { describe, expect, it } from 'vitest';
import { describeWarning, describeWarnings } from './warnings';

describe('describeWarning', () => {
  it('negative_effective_normal es una nota con el texto acordado (E5)', () => {
    const info = describeWarning('negative_effective_normal');
    expect(info.severity).toBe('nota');
    expect(info.text).toBe(
      'Normal efectiva negativa en algunas dovelas (zona de tracción; considere una grieta de tracción).',
    );
  });

  it('water_above_ground y max_iterations son avisos', () => {
    expect(describeWarning('water_above_ground')).toMatchObject({ severity: 'aviso' });
    expect(describeWarning('water_above_ground').text).toMatch(/agua sobre el terreno se ignora/);
    expect(describeWarning('max_iterations')).toMatchObject({ severity: 'aviso' });
  });

  it('todos los códigos de aviso del motor tienen texto en español sin voseo', () => {
    const codes = [
      'negative_effective_normal',
      'water_above_ground',
      'max_iterations',
      'm_alpha',
      'm_alpha_pole',
      'pole',
      'no_driving',
      'non_finite',
      'lambda_undefined',
      'fos_nonpositive',
      'no_slices',
    ];
    for (const code of codes) {
      const info = describeWarning(code);
      expect(info.text).not.toBe(code);
      expect(info.text.length).toBeGreaterThan(10);
      // Voseo: formas verbales de segunda persona del plural o singular habituales.
      expect(info.text).not.toMatch(/\b(usted|vos|podés|tenés|sabés|querés|considerá|indicá)\b/i);
    }
  });

  it('un código desconocido se muestra tal cual, como aviso', () => {
    expect(describeWarning('codigo_nuevo')).toEqual({ code: 'codigo_nuevo', severity: 'aviso', text: 'codigo_nuevo' });
  });

  it('no confunde propiedades del objeto con códigos (toString, __proto__)', () => {
    expect(describeWarning('toString').text).toBe('toString');
    expect(describeWarning('__proto__').text).toBe('__proto__');
  });
});

describe('describeWarnings', () => {
  it('elimina duplicados conservando el orden de aparición', () => {
    const out = describeWarnings(['water_above_ground', 'negative_effective_normal', 'water_above_ground']);
    expect(out.map((w) => w.code)).toEqual(['water_above_ground', 'negative_effective_normal']);
  });
});
