// F3B-W2: entradas de Ayuda (`onboarding/helpContent.ts`) para Hoek-Brown, SHANSEP y Búsqueda no circular (F6.8, F6.9, F6.10, F6.13).
import { describe, expect, it } from 'vitest';
import { GLOSSARY, HOEK_BROWN_D_TABLE, LIMITATIONS, glossaryTerms } from './helpContent';

const entry = (id: string) => GLOSSARY.find((g) => g.id === id);
const VOSEO = /\b(vos|pod[eé]s|ten[eé]s|hac[eé]s|sab[eé]s|quer[eé]s|considerá|indicá|revisá|elegí|pulsá|usá|hacé|fijate|mirá|ponés|escribí)\b/i;

describe('Ayuda F3B: glosario y limitaciones', () => {
  it('incluye las tres entradas nuevas con ids únicos: «Hoek-Brown», «SHANSEP» y «Búsqueda no circular»', () => {
    expect(glossaryTerms()).toEqual(expect.arrayContaining(['Hoek-Brown', 'SHANSEP', 'Búsqueda no circular']));
    expect(new Set(GLOSSARY.map((g) => g.id)).size).toBe(GLOSSARY.length);
  });

  it('«Hoek-Brown» explica GSI, mi, D con la Tabla 1, σci en kPa, la regla de bajo confinamiento (0 % a −2,9 %) y Hoek (1994)', () => {
    const hb = entry('hoek-brown');
    expect(hb).toBeDefined();
    const def = hb!.definition;
    for (const needle of [
      'GSI',
      'mi',
      'factor de perturbación',
      'sin valor por defecto',
      'Tabla 1',
      'σci',
      'kPa',
      'MPa',
      'mb',
      'envolvente completa',
      'hoek_brown_low_confinement',
      '0 % a −2,9 %',
      'cSlope',
      'Hoek (1994',
      'cota superior',
    ]) {
      expect(def, needle).toContain(needle);
    }
    expect(hb!.table).toBe(HOEK_BROWN_D_TABLE);
    expect(HOEK_BROWN_D_TABLE.rows.map((r) => r[0])).toEqual(['0', '0,5', '0,7', '0,8', '1,0']);
  });

  it('«SHANSEP» explica S, m (0,8 por defecto), las tres fuentes de OCR, por qué no hay OCR por defecto y el círculo profundo', () => {
    const def = entry('shansep')?.definition ?? '';
    for (const needle of [
      'Su = S · σ′v · OCR^m',
      '0,8 por defecto',
      'ocr',
      'pop',
      'ocr_by_elevation',
      'No hay OCR por defecto',
      'círculo muy ancho y poco profundo',
      '257 m',
      'shansep_nonpositive_stress',
    ]) {
      expect(def, needle).toContain(needle);
    }
  });

  it('«Búsqueda no circular» explica semillas, niveles 9 → 17 → 33, por qué no se ofrece Bishop, el mínimo círculo/polilínea y el 15 %', () => {
    const def = entry('non-circular-search')?.definition ?? '';
    for (const needle of [
      'seeds',
      '9 → 17 → 33',
      'max_vertices',
      'Por qué no se ofrece Bishop',
      'Spencer, Morgenstern-Price o Janbu',
      'menor FS entre el mejor círculo',
      'ganando el círculo en caso de empate',
      '15 %',
      'non_circular_large_change',
    ]) {
      expect(def, needle).toContain(needle);
    }
  });

  it('las limitaciones actualizan los modelos y la búsqueda, y todo el texto nuevo está en español neutro sin voseo', () => {
    const limText = LIMITATIONS.join('\n');
    expect(limText).toContain('Hoek-Brown');
    expect(limText).toContain('SHANSEP');
    expect(limText).toContain('círculos muy anchos y poco profundos');
    expect(limText).not.toContain('círculos muy anchos y profundos');
    expect(limText).toContain('Búsqueda no circular');
    expect(limText).not.toContain('La búsqueda de la superficie crítica solo encuentra círculos');

    const allNew = [
      entry('hoek-brown')?.definition,
      HOEK_BROWN_D_TABLE.caption,
      ...HOEK_BROWN_D_TABLE.rows.flat(),
      entry('shansep')?.definition,
      entry('non-circular-search')?.definition,
      ...LIMITATIONS,
    ].join(' ');
    expect(allNew).not.toMatch(VOSEO);
  });
});
