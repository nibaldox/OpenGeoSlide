// R15B-03, R15B-04 y E16x en la Ayuda: rama de tracción, Hoek-Brown sin FS y la nota sin refinamiento.
import { describe, expect, it } from 'vitest';
import { GLOSSARY, LIMITATIONS } from './helpContent';

const entry = (id: string) => GLOSSARY.find((g) => g.id === id)?.definition ?? '';
const VOSEO = /\b(vos|pod[eé]s|ten[eé]s|hac[eé]s|sab[eé]s|quer[eé]s|considerá|indicá|revisá|elegí|pulsá|usá|hacé|fijate|mirá|ponés|escribí)\b/i;

describe('Ayuda R15', () => {
  it('«Búsqueda no circular» explica la rama de tracción, Janbu, λ, N′ y la nota sin refinamiento', () => {
    const def = entry('non-circular-search');
    for (const needle of [
      'Riesgo de rama de tracción',
      'negative_lambda y negative_effective_normal_major',
      'compare el FS con Janbu (Bishop no se ofrece en esta búsqueda)',
      'λ y la normal efectiva N′',
      'non_circular_not_refined',
      'evaluated = 0',
    ]) {
      expect(def, needle).toContain(needle);
    }
  });

  it('las limitaciones de Spencer y de la búsqueda no circular no mandan comparar con Bishop donde no aplica', () => {
    const spencer = LIMITATIONS.find((l) => l.startsWith('Spencer barre'))!;
    expect(spencer).toContain('Janbu en polilíneas');
    expect(spencer).toContain('Bishop no se ofrece');
    expect(spencer).not.toMatch(/por debajo de Bishop;/);
    const nc = LIMITATIONS.find((l) => l.startsWith('Búsqueda no circular'))!;
    expect(nc).toContain('compárelo con Janbu');
    expect(nc).toContain('non_circular_not_refined');
  });

  it('Hoek-Brown orienta hacia la presión de poros alta o la tracción cuando un método no da FS', () => {
    const def = entry('hoek-brown');
    expect(def).toContain('m_alpha, no_admissible_root o hoek_brown_not_converged');
    expect(def).toContain('presión de poros alta');
    expect(def).toContain('solo después los rangos de búsqueda');
    expect(LIMITATIONS.find((l) => l.startsWith('Hoek-Brown'))).toContain('revise primero una presión de poros alta o la tracción en la base');
  });

  it('el texto nuevo está en español neutro sin voseo', () => {
    expect([entry('hoek-brown'), entry('non-circular-search'), ...LIMITATIONS].join(' ')).not.toMatch(VOSEO);
  });
});
