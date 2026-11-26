import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { MethodReport } from './types';
import { compareSuggestion, describeResultWarnings, describeWarning, describeWarnings, ENGINE_WARNING_CODES, warningContext, warningPath } from './warnings';

describe('describeWarning', () => {
  it('negative_effective_normal es una nota con el texto acordado (E5)', () => {
    const info = describeWarning('negative_effective_normal');
    expect(info.severity).toBe('nota');
    expect(info.text).toBe(
      'Normal efectiva negativa en algunas dovelas (zona de tracción; considere una grieta de tracción).',
    );
  });

  it('con una grieta de tracción en el análisis, la nota no sugiere una grieta: pide revisar su profundidad', () => {
    const withCrack = describeWarning('negative_effective_normal', { tensionCrack: true });
    expect(withCrack.severity).toBe('nota');
    expect(withCrack.text).toBe(
      'Normal efectiva negativa en algunas dovelas (zona de tracción) a pesar de la grieta de tracción del análisis; revise su profundidad.',
    );
    expect(withCrack.text).not.toMatch(/considere/);
    const major = describeWarning('negative_effective_normal_major', { tensionCrack: true });
    expect(major.severity).toBe('aviso');
    expect(major.text).not.toMatch(/considere/);
    expect(major.text).toMatch(/profundidad de la grieta/);
    // sin grieta (o con el contexto sin ella) el texto acordado no cambia
    expect(describeWarning('negative_effective_normal', { tensionCrack: false }).text).toMatch(/considere una grieta de tracción/);
    expect(describeWarning('negative_effective_normal_major').text).toMatch(/considere grietas de tracción/);
  });

  it('el contexto de un resultado trae tensionCrack solo si el resultado trae tension_crack', () => {
    const base = { method: 'bishop' as const, surface: { xc: 1, yc: 2, r: 3 }, warnings: ['negative_effective_normal'] };
    expect(warningContext(base)).toEqual({ method: 'bishop', surface: 'circle' });
    expect(warningContext({ ...base, tension_crack: undefined }).tensionCrack).toBeUndefined();
    const ctx = warningContext({ ...base, tension_crack: { x: 47, depth: 0.43, water_force: 0.09 } });
    expect(ctx).toEqual({ method: 'bishop', surface: 'circle', tensionCrack: true });
    expect(describeResultWarnings({ ...base, tension_crack: { x: 47, depth: 0.43, water_force: 0.09 } })[0]?.text).toMatch(/a pesar de la grieta de tracción del análisis/);
    expect(describeResultWarnings(base)[0]?.text).toMatch(/considere una grieta de tracción/);
  });

  it('water_above_ground es una nota (agua embalsada, F5.3) y max_iterations un aviso', () => {
    expect(describeWarning('water_above_ground')).toMatchObject({ severity: 'nota' });
    expect(describeWarning('water_above_ground').text).toMatch(/agua embalsada se incluye/);
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
    // G3 (E15i-8): `ito_matsui_spacing_range` entra en la lista de E6 con la rama de M-ito. Hasta la integración el contrato de esta rama no lo trae:
    // se exige que el resto coincida, y cuando el contrato ya lo trae, la coincidencia es exacta.
    const awaitingIntegration = ['ito_matsui_spacing_range'].filter((c) => !fromContract.includes(c));
    const web = [...ENGINE_WARNING_CODES].filter((c) => !awaitingIntegration.includes(c));
    expect(web.sort()).toEqual([...fromContract].sort());
  });

  it('reinforcement_active_compression es una nota con el texto exacto de E14o-8 y lleva a /reinforcements', () => {
    expect(describeWarning('reinforcement_active_compression')).toEqual({
      code: 'reinforcement_active_compression',
      severity: 'nota',
      text: 'Un refuerzo activo se aplica con su fuerza aunque el deslizamiento lo comprimiría; en suelos con fricción esa fuerza puede aumentar el FS. Verifique la orientación y la carga de bloqueo.',
    });
    expect(ENGINE_WARNING_CODES).toContain('reinforcement_active_compression');
    expect(warningPath('reinforcement_active_compression')).toBe('/reinforcements');
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
      text: 'El método seleccionó una raíz de equilibrio con λ negativo; revise el resultado o compare con otro método (Bishop simplificado en círculos, Janbu en polilíneas).',
    });
    expect(describeWarning('negative_lambda', { surface: 'circle' }).text).toBe(
      'El método seleccionó una raíz de equilibrio con λ negativo; revise el resultado o compare con Bishop simplificado.',
    );
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

  it('water_above_ground dice que el agua embalsada se incluye con su peso y su empuje horizontal, sin sismo (F5.3)', () => {
    const { text } = describeWarning('water_above_ground');
    expect(text).not.toMatch(/v0\.1|no soportado|se ignora|no se considera/);
    expect(text).toBe('La piezométrica queda sobre el terreno: el agua embalsada se incluye con su peso y su empuje horizontal (sin sismo).');
  });

  it.each([
    ['m_alpha', /m_α mínimo.*sentido de deslizamiento.*rangos de entrada y salida/],
    ['pole', /punto singular.*otra superficie/],
    ['no_driving', /fuerzas que provocan el deslizamiento.*sentido de deslizamiento/],
    ['no_admissible_root', /ninguna cumple.*Revise/],
    ['non_finite', /pesos unitarios.*geometría/],
    ['no_lambda_root', /pruebe otra superficie o compare con otro método/],
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

describe('avisos agnósticos al método con sugerencia según la superficie (R10B-03)', () => {
  const FIVE = ['pole', 'no_lambda_root', 'no_admissible_root', 'negative_lambda', 'multiple_admissible_roots'] as const;
  const rep = (method: MethodReport['method'], surface: MethodReport['surface']): Pick<MethodReport, 'method' | 'surface' | 'warnings'> => ({
    method,
    surface,
    warnings: [...FIVE],
  });
  const circle = { xc: 1, yc: 2, r: 3 };
  const polyline = { points: [[0, 0], [1, -1], [2, 0]] as [number, number][] };

  it('ningún texto de los cinco nombra a Spencer, con o sin contexto', () => {
    for (const code of FIVE) {
      for (const ctx of [undefined, { surface: 'circle' as const }, { surface: 'polyline' as const, method: 'morgenstern_price' as const }]) {
        expect(describeWarning(code, ctx).text, `${code}`).not.toMatch(/Spencer(?! o Morgenstern)/);
      }
    }
  });

  it('círculos: sugieren Bishop simplificado; polilíneas: Janbu, y nunca Bishop (que no existe en polilíneas)', () => {
    for (const code of FIVE) {
      expect(describeWarning(code, { surface: 'circle' }).text, code).toMatch(/Bishop simplificado/);
      const onPoly = describeWarning(code, { surface: 'polyline', method: 'morgenstern_price' }).text;
      expect(onPoly, code).toMatch(/compare con Janbu/);
      expect(onPoly, code).not.toMatch(/Bishop/);
    }
  });

  it('un resultado de Janbu sobre una polilínea no se remite a Janbu', () => {
    for (const code of FIVE) {
      const t = describeWarning(code, { surface: 'polyline', method: 'janbu_corrected' }).text;
      expect(t, code).not.toMatch(/Janbu|Bishop/);
      expect(t, code).toMatch(/Spencer o Morgenstern-Price/);
    }
  });

  it('describeResultWarnings toma el contexto del resultado: M-P sobre una polilínea (D1-B) dice Janbu, no Spencer ni Bishop', () => {
    const texts = describeResultWarnings(rep('morgenstern_price', polyline)).map((w) => w.text);
    expect(texts.join('\n')).not.toMatch(/Spencer|Bishop/);
    expect(texts.join('\n')).toMatch(/compare con Janbu/);
    const onCircle = describeResultWarnings(rep('spencer', circle)).map((w) => w.text).join('\n');
    expect(onCircle).toMatch(/Bishop simplificado/);
    expect(warningContext(rep('janbu_simplified', polyline))).toEqual({ method: 'janbu_simplified', surface: 'polyline' });
  });

  it('la severidad de los cinco no cambia con el contexto', () => {
    expect(FIVE.map((c) => describeWarning(c, { surface: 'polyline' }).severity)).toEqual(['aviso', 'aviso', 'aviso', 'nota', 'nota']);
  });

  it('compareSuggestion', () => {
    expect(compareSuggestion({ surface: 'circle', method: 'spencer' })).toBe('compare con Bishop simplificado');
    expect(compareSuggestion({ surface: 'polyline', method: 'spencer' })).toBe('compare con Janbu');
  });
});

describe('códigos nuevos de E13l-1', () => {
  it('janbu_correction_extrapolated es una nota con el texto acordado y apunta a los métodos', () => {
    expect(describeWarning('janbu_correction_extrapolated')).toEqual({
      code: 'janbu_correction_extrapolated',
      severity: 'nota',
      text: 'La superficie es más profunda que el rango del gráfico de Janbu (1973) (d/L mayor que su límite); el factor de corrección f₀ es una extrapolación.',
    });
    expect(warningPath('janbu_correction_extrapolated')).toBe('/analysis/methods');
  });
  it('non_positive_fos es un aviso con el texto acordado y apunta a los métodos', () => {
    expect(describeWarning('non_positive_fos')).toEqual({
      code: 'non_positive_fos',
      severity: 'aviso',
      text: 'El método llegó a un factor de seguridad no positivo o no finito; no se informa ningún FS. Revise la superficie.',
    });
    expect(warningPath('non_positive_fos')).toBe('/analysis/methods');
  });
  it('están en la lista de códigos del motor', () => {
    expect(ENGINE_WARNING_CODES).toContain('janbu_correction_extrapolated');
    expect(ENGINE_WARNING_CODES).toContain('non_positive_fos');
  });
});
