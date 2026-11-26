// Ayuda de Ito-Matsui (E15i-8): el término del glosario con sus límites y supuestos, y las limitaciones que ya no dicen «no se modela».
import { describe, expect, it } from 'vitest';
import { ITO_MATSUI_STRUCTURAL_LIMIT_TEXT, STRUCTURAL_LIMIT_TEXT } from '../report/reinforcementReport';
import { GLOSSARY, LIMITATIONS, glossaryTerms } from './helpContent';

const entry = (id: string) => GLOSSARY.find((g) => g.id === id);
const VOSEO = /\b(vos|podés|tenés|sabés|querés|considerá|indicá|revisá|elegí|usá|escribí)\b/i;

describe('glosario: Ito-Matsui', () => {
  const def = entry('ito-matsui')?.definition ?? '';

  it('tiene su término, con id único', () => {
    expect(glossaryTerms()).toEqual(expect.arrayContaining(['Ito-Matsui (presión del suelo sobre un pilote)']));
    expect(new Set(GLOSSARY.map((g) => g.id)).size).toBe(GLOSSARY.length);
  });

  it('cita la fuente y la fórmula, y dice qué se ingresa: diámetro, espaciamiento, ubicación y capacidad', () => {
    for (const t of ['Ito y Matsui (1975)', 'Soils and Foundations', 'p(z) = c·A1 + σ′v·A2', 'diámetro', 'espaciamiento', 'centroide', 'superficie de falla', 'corte', 'momento', 'formato 0.5']) {
      expect(def, t).toContain(t);
    }
  });

  it('declara el límite S/D de 2 a 8, el sentido del error y el aviso', () => {
    for (const t of ['S/D', 'de 2 a 8', 'sobrestima', 'subestima', 'Ukritchon y Keawsawasvong (2017)', 'ito_matsui_spacing_range']) expect(def, t).toContain(t);
  });

  it('declara los supuestos: pilotes rígidos, deformación plana y dos superficies plásticas', () => {
    for (const t of ['pilotes rígidos', 'deformación plana', 'dos superficies plásticas']) expect(def, t).toContain(t);
  });

  it('explica las columnas de la tabla (fuerza del suelo, gobierna, brazo) y el piso de φ = 0', () => {
    for (const t of ['Fuerza del suelo', 'Gobierna', 'Brazo', 'φ = 0']) expect(def, t).toContain(t);
  });

  it('dice que las cargas de superficie no entran en σ′v y que la web no calcula empotramiento ni deflexión', () => {
    expect(def).toContain('cargas de superficie');
    expect(def).toContain('empotramiento');
    expect(def).toContain('deflexión');
  });

  it('español neutro, sin voseo', () => {
    expect(def).not.toMatch(VOSEO);
  });
});

describe('glosario de refuerzos con Ito-Matsui', () => {
  it('el pilote puede llevar una fuerza que usted fija o la presión del suelo', () => {
    const def = entry('reinforcements')?.definition ?? '';
    expect(def).toContain('Ito-Matsui');
    expect(def).toContain('fuerza de corte');
  });

  it('la tabla de fuerzas explica las tres columnas nuevas en «Estado de un cruce»', () => {
    const def = entry('reinforcement-status')?.definition ?? '';
    expect(def).toContain('Fuerza del suelo');
    expect(def).toContain('Gobierna');
  });
});

describe('limitaciones con Ito-Matsui', () => {
  const text = LIMITATIONS.join('\n');

  it('el límite de F4.8 sigue completo y el de Ito-Matsui también', () => {
    expect(LIMITATIONS.some((l) => l.includes(STRUCTURAL_LIMIT_TEXT))).toBe(true);
    expect(LIMITATIONS.some((l) => l.includes(ITO_MATSUI_STRUCTURAL_LIMIT_TEXT))).toBe(true);
  });

  it('ya no dice que Ito-Matsui «no se modela todavía», pero sí lo que sigue pendiente', () => {
    expect(text).not.toContain('que no se modelan todavía: la fuerza de pilote por el empuje del suelo (Ito-Matsui)');
    expect(text).toContain('pretensado');
    expect(text).toContain('clavos lanzados');
  });

  it('declara el rango S/D, los supuestos y que el piso de φ = 0 no viene del artículo', () => {
    const line = LIMITATIONS.find((l) => l.startsWith('Ito-Matsui:'));
    expect(line, 'falta la limitación «Ito-Matsui:»').toBeDefined();
    for (const t of ['S/D', 'de 2 a 8', 'pilotes rígidos', 'deformación plana', 'dos superficies plásticas', 'cSlope', 'XSLOPE', 'Poulos']) expect(line, t).toContain(t);
    expect(line).not.toMatch(VOSEO);
  });
});
