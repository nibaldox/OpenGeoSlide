import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { describeWarning, describeWarnings, ENGINE_WARNING_CODES, warningPath } from './warnings';

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
      text: 'Normal efectiva negativa en una parte importante de la base (tracción o subpresión): revise la presión de poros y considere grietas de tracción.',
    });
    expect(describeWarning('air_gap_thrust')).toEqual({
      code: 'air_gap_thrust',
      severity: 'aviso',
      text: 'La superficie transmite empuje a través de un tramo sin suelo; revise la geometría.',
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

  it('negative_lambda es una nota con el texto de E12e', () => {
    expect(describeWarning('negative_lambda')).toEqual({
      code: 'negative_lambda',
      severity: 'nota',
      text: 'Spencer seleccionó una raíz de equilibrio con λ negativo; revise el resultado.',
    });
  });

  it('interslice_shear_exceeds_strength es un aviso con el texto de E13k y apunta a la superficie', () => {
    expect(describeWarning('interslice_shear_exceeds_strength')).toEqual({
      code: 'interslice_shear_exceeds_strength',
      severity: 'aviso',
      text: 'Las fuerzas de corte entre dovelas superan la resistencia de las caras verticales (Chen y Morgenstern, 1983): este FS puede no ser físico. Compárelo con Janbu o revise la forma de la superficie.',
    });
    expect(warningPath('interslice_shear_exceeds_strength')).toBe('/analysis/surface');
  });

  it('un código desconocido se muestra tal cual, como aviso', () => {
    expect(describeWarning('codigo_nuevo')).toEqual({ code: 'codigo_nuevo', severity: 'aviso', text: 'codigo_nuevo' });
  });

  it('no confunde propiedades del objeto con códigos (toString, __proto__)', () => {
    expect(describeWarning('toString').text).toBe('toString');
    expect(describeWarning('__proto__').text).toBe('__proto__');
  });
});

describe('mensajes accionables y sin nombres internos (R7-19, R7-20)', () => {
  const INTERNAL = /min_m_alpha|n_entry|n_exit|n_radius|ogs-core|deny_unknown_fields|performance\.now|v0\.1|\bwasm\b/i;

  it('water_above_ground ya no menciona v0.1 y explica que el agua libre (embalse) no se considera', () => {
    const { text } = describeWarning('water_above_ground');
    expect(text).not.toMatch(/v0\.1|no soportado/);
    expect(text).toBe(
      'La línea piezométrica queda sobre el terreno dentro de la masa deslizante. El agua sobre el terreno se ignora: el agua libre (por ejemplo, un embalse) no se considera en esta versión; revise la línea piezométrica.',
    );
  });

  it.each([
    ['m_alpha', /m_α mínimo.*sentido de deslizamiento.*rangos de entrada y salida/],
    ['pole', /punto singular.*otra superficie/],
    ['no_driving', /fuerzas que provocan el deslizamiento.*sentido de deslizamiento/],
    ['no_admissible_root', /ninguna cumple.*Revise/],
    ['non_finite', /pesos unitarios.*geometría/],
    ['no_lambda_root', /pruebe otra superficie o compare con Bishop/],
    ['max_iterations', /aumente las iteraciones máximas en «Análisis»/],
    ['no_slices', /Revise su centro y su radio/],
  ])('%s sugiere qué revisar', (code, pattern) => {
    expect(describeWarning(code).text).toMatch(pattern);
  });

  it('m_alpha nombra el campo como en la interfaz y no como en el JSON', () => {
    const { text } = describeWarning('m_alpha');
    expect(text).toContain('m_α mínimo');
    expect(text).not.toContain('min_m_alpha');
  });

  it('ningún texto del catálogo contiene nombres internos ni queda sin punto final', () => {
    const codes = [...ENGINE_WARNING_CODES, 'mock_engine', 'mock_search'];
    for (const code of codes) {
      const { text } = describeWarning(code);
      expect(text, code).not.toMatch(INTERNAL);
      expect(text.endsWith('.'), `${code}: «${text}» no termina en punto`).toBe(true);
    }
  });

  it('warningPath asocia los avisos a la parte del modelo que conviene revisar', () => {
    expect(warningPath('water_above_ground')).toBe('/water/piezometric_line');
    expect(warningPath('load_outside_mass')).toBe('/loads');
    expect(warningPath('m_alpha')).toBe('/analysis/search');
    expect(warningPath('max_iterations')).toBe('/analysis/max_iterations');
    expect(warningPath('negative_effective_normal')).toBeNull();
    expect(warningPath('codigo_nuevo')).toBeNull();
    expect(warningPath('toString')).toBeNull();
  });
});

describe('describeWarnings', () => {
  it('elimina duplicados conservando el orden de aparición', () => {
    const out = describeWarnings(['water_above_ground', 'negative_effective_normal', 'water_above_ground']);
    expect(out.map((w) => w.code)).toEqual(['water_above_ground', 'negative_effective_normal']);
  });
});
