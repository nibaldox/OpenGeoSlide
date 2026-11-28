// CM-C1W · F7.5: la Ayuda explica la búsqueda global (cuándo usarla, su costo y la guarda de tracción).
import { describe, expect, it } from 'vitest';
import { GLOSSARY, LIMITATIONS, glossaryTerms } from './helpContent';

const VOSEO = /\b(vos|podés|tenés|sabés|querés|considerá|indicá|revisá|comparé)\b/i;

describe('Ayuda: búsqueda global (formato 0.7)', () => {
  const entry = GLOSSARY.find((g) => g.id === 'global-search')!;

  it('hay una entrada de glosario con id único y término «Búsqueda global»', () => {
    expect(entry).toBeDefined();
    expect(entry.term).toBe('Búsqueda global');
    expect(glossaryTerms()).toContain('Búsqueda global');
    expect(new Set(GLOSSARY.map((g) => g.id)).size).toBe(GLOSSARY.length);
  });

  it('dice cuándo usarla: capas o contactos débiles y mecanismos de bloque', () => {
    expect(entry.definition).toContain('capas o contactos débiles');
    expect(entry.definition).toContain('bloque');
    expect(entry.definition).toContain('Bloque sobre capas débiles');
    expect(entry.definition).toContain('Recocido');
    expect(entry.definition).toContain('Automático');
  });

  it('dice el costo (hasta unas 8000 evaluaciones más por método) y los rangos', () => {
    expect(entry.definition).toContain('8000 evaluaciones más por método');
    expect(entry.definition).toContain('de 50 a 2000');
    expect(entry.definition).toContain('2^53 − 1');
    expect(entry.definition).toContain('Cancelar cálculo');
  });

  it('explica la guarda de tracción, los dos códigos y que nunca empeora el resultado', () => {
    for (const needle of ['λ negativo', 'normal efectiva negativa', 'non_circular_global_tension_rejected', 'non_circular_global_no_candidates', 'N′', 'búsqueda circular', 'nunca empeora']) {
      expect(entry.definition, needle).toContain(needle);
    }
  });

  it('«Búsqueda no circular» remite a la nueva entrada y la limitación del pulido lo aclara', () => {
    const nc = GLOSSARY.find((g) => g.id === 'non-circular-search')!;
    expect(nc.definition).toContain('«Búsqueda global»');
    const lim = LIMITATIONS.find((l) => l.startsWith('Búsqueda no circular'))!;
    expect(lim).toContain('sin pulido adicional salvo en la búsqueda global');
  });

  it('hay una limitación propia con el costo, la guarda y la comparación', () => {
    const lim = LIMITATIONS.find((l) => l.startsWith('Búsqueda global'))!;
    expect(lim).toBeDefined();
    for (const needle of ['8000 evaluaciones', 'un solo hilo', 'non_circular_global_tension_rejected', 'Bishop']) expect(lim, needle).toContain(needle);
  });

  it('sin voseo', () => {
    expect(entry.definition).not.toMatch(VOSEO);
    expect(LIMITATIONS.find((l) => l.startsWith('Búsqueda global'))).not.toMatch(VOSEO);
  });
});
