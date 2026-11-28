// CM-C1W · F7.5: la Ayuda explica la búsqueda global (cuándo usarla, su costo y la guarda de tracción).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GLOSSARY, LIMITATIONS, SHORTCUTS_CAPTION, glossaryTerms } from './helpContent';

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

  it('dice el costo (hasta unas 5700 evaluaciones más por método, con el desglose del motor) y los rangos', () => {
    expect(entry.definition).toContain('5700 evaluaciones más por método');
    expect(entry.definition).not.toContain('8000');
    expect(entry.definition).toContain('de 50 a 2000');
    expect(entry.definition).toContain('2^53 − 1');
    expect(entry.definition).toContain('Cancelar cálculo');
  });

  it('RCM-B-08: describe el descarte sucesivo 4 → 3 → 1 (60, 150 y 1500 evaluaciones) y el pulido, no «los tres mejores»', () => {
    for (const needle of ['4 → 3 → 1', '60 evaluaciones', '150', '1500 evaluaciones', 'pulido', '3000 evaluaciones', '4 × 60 + 3 × 150 = 690']) {
      expect(entry.definition, needle).toContain(needle);
    }
    expect(entry.definition).not.toContain('tres mejores');
    expect(entry.definition).not.toContain('3 × 1500');
  });

  it('E17e §6: «Rechazados por tracción» cuenta solo la generación y el aviso cubre toda la etapa', () => {
    expect(entry.definition).toContain('Rechazados por tracción» cuenta solo los candidatos de la generación');
    expect(entry.definition).toContain('generación, refinamiento o pulido');
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
    for (const needle of ['5700 evaluaciones', 'un solo hilo', 'non_circular_global_tension_rejected', 'Bishop']) expect(lim, needle).toContain(needle);
  });

  it('sin voseo', () => {
    expect(entry.definition).not.toMatch(VOSEO);
    expect(LIMITATIONS.find((l) => l.startsWith('Búsqueda global'))).not.toMatch(VOSEO);
  });
});

describe('RCM-B-15: la leyenda de atajos de la Ayuda', () => {
  it('dice que Ctrl+Intro, Ctrl+S y Ctrl+O también funcionan dentro de los campos de texto', () => {
    expect(SHORTCUTS_CAPTION).toContain('Ctrl+Intro, Ctrl+S y Ctrl+O también funcionan con el foco dentro de un campo de texto');
    expect(SHORTCUTS_CAPTION).not.toContain('fuera de los campos de texto;');
  });

  it('la tabla de la Ayuda usa esa leyenda', () => {
    const src = readFileSync(new URL('../ui/HelpDialog.tsx', import.meta.url), 'utf8');
    expect(src).toContain('caption={SHORTCUTS_CAPTION}');
  });
});
