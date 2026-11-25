import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { describeWarning, describeWarnings, ENGINE_WARNING_CODES } from './warnings';

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

  it('todos los códigos de la lista E6 tienen texto en español sin voseo', () => {
    for (const code of ENGINE_WARNING_CODES) {
      const info = describeWarning(code);
      expect(info.text, code).not.toBe(code);
      expect(info.text.length, code).toBeGreaterThan(10);
      // Voseo: formas verbales de segunda persona del plural o singular habituales.
      expect(info.text, code).not.toMatch(/\b(usted|vos|podés|tenés|sabés|querés|considerá|indicá)\b/i);
    }
  });

  it('negative_effective_normal_major y air_gap_thrust son avisos con el texto acordado', () => {
    expect(describeWarning('negative_effective_normal_major')).toEqual({
      code: 'negative_effective_normal_major',
      severity: 'aviso',
      text: 'Normal efectiva negativa en una parte importante de la base (tracción o subpresión): revise la presión de poros y considere grietas de tracción',
    });
    expect(describeWarning('air_gap_thrust')).toEqual({
      code: 'air_gap_thrust',
      severity: 'aviso',
      text: 'La superficie transmite empuje a través de un tramo sin suelo; revise la geometría',
    });
  });

  it('la lista de códigos coincide con la lista E6 de briefs/00_CONTRATOS.md', () => {
    const contract = readFileSync(fileURLToPath(new URL('../../../../briefs/00_CONTRATOS.md', import.meta.url)), 'utf8');
    // The contract wraps this sentence over two lines, so whitespace is matched loosely.
    const block = /Los códigos de aviso \(([\s\S]*?)\)\s+son\s+identificadores\s+estables/.exec(contract);
    expect(block, 'no se encuentra la lista E6 en el contrato').not.toBeNull();
    const fromContract = [...block![1].matchAll(/`([a-z_]+)`/g)].map((m) => m[1]);
    expect(fromContract.length).toBeGreaterThan(0);
    expect([...ENGINE_WARNING_CODES].sort()).toEqual([...fromContract].sort());
  });

  it('truncated_mass es una nota con el texto acordado (E10a)', () => {
    expect(describeWarning('truncated_mass')).toEqual({
      code: 'truncated_mass',
      severity: 'nota',
      text: 'Se analizó solo el bloque principal de la superficie; las demás masas separadas por tramos aéreos se eliminaron.',
    });
  });

  it('negative_lambda es una nota con el texto acordado (R4-05, E11a′)', () => {
    expect(describeWarning('negative_lambda')).toEqual({
      code: 'negative_lambda',
      severity: 'nota',
      text: 'Spencer seleccionó la raíz admisible de menor |λ|, que es negativa; revise el resultado',
    });
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
