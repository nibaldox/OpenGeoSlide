// Ayuda de los refuerzos (F4.8, F4.11, E14m): glosario y limitaciones del formato v0.4.
import { describe, expect, it } from 'vitest';
import { STRUCTURAL_LIMIT_TEXT } from '../report/reinforcementReport';
import { GLOSSARY, LIMITATIONS, glossaryTerms } from './helpContent';

const entry = (id: string) => GLOSSARY.find((g) => g.id === id);

describe('glosario de los refuerzos (v0.4)', () => {
  it('tiene las cuatro entradas nuevas, con ids únicos', () => {
    for (const id of ['reinforcements', 'pullout', 'active-passive', 'reinforcement-status']) expect(entry(id), id).toBeDefined();
    expect(new Set(GLOSSARY.map((g) => g.id)).size).toBe(GLOSSARY.length);
    expect(glossaryTerms()).toEqual(expect.arrayContaining(['Refuerzos', 'Arrancamiento (pullout)', 'Refuerzo activo y pasivo', 'Estado de un cruce']));
  });

  it('los refuerzos nombran los cinco tipos con sus rótulos y la tablestaca anclada', () => {
    const def = entry('reinforcements')?.definition ?? '';
    for (const label of ['Anclaje', 'Clavo', 'Geosintético', 'Pilote', 'Tablestaca']) expect(def).toContain(label);
    expect(def).toContain('tablestaca anclada');
    expect(def).toContain('cruce');
  });

  it('el arrancamiento nombra los tres modelos del panel y el tramo libre sin placa', () => {
    const def = entry('pullout')?.definition ?? '';
    for (const label of ['Adherencia', 'Interfaz suelo-geosintético', 'Desarrollo lineal de la capacidad']) expect(def).toContain(label);
    expect(def).toContain('tramo libre');
    expect(def).toContain('placa de cabeza');
  });

  it('activo y pasivo: no se divide por F / se divide por F, y la regla de compresión', () => {
    const def = entry('active-passive')?.definition ?? '';
    expect(def).toContain('no se divide por F');
    expect(def).toContain('dividida por F');
    expect(def).toContain('2°');
    expect(def).toContain('siempre');
  });

  it('los cuatro estados del cruce, con no_capacity sin nota', () => {
    const def = entry('reinforcement-status')?.definition ?? '';
    for (const s of ['applied', 'outside_mass', 'compression_ignored', 'no_capacity']) expect(def).toContain(s);
    expect(def).toContain('no emite nota');
  });
});

describe('limitaciones de los refuerzos (v0.4)', () => {
  const text = LIMITATIONS.join('\n');

  it('el límite estructural de pilotes y tablestacas va completo', () => {
    expect(LIMITATIONS.some((l) => l.includes(STRUCTURAL_LIMIT_TEXT))).toBe(true);
    expect(text).toContain('structural_checks_not_covered');
    expect(text).toContain('dato');
  });

  it('dice qué se pospone, el sismo, el tramo libre y las discontinuidades de la búsqueda', () => {
    expect(text).toContain('Ito-Matsui');
    expect(text).toContain('pretensado');
    expect(text).toContain('El sismo no actúa sobre las fuerzas de los refuerzos');
    expect(text).toContain('no_capacity');
    expect(text).toContain('discontinuo');
  });

  it('no queda ninguna limitación que diga que no hay refuerzos', () => {
    expect(text).not.toMatch(/sin refuerzos|no hay refuerzos/i);
  });
});
