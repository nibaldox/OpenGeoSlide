// Tabla de fuerzas de la vista Casos y del editor con el pilote de Ito-Matsui (E15i-7): columnas nuevas, alineación numérica y las notas.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ITO_MATSUI_NOTE, ITO_MATSUI_STRUCTURAL_LIMIT_TEXT, STRUCTURAL_LIMIT_TEXT } from '../report/reinforcementReport';
import { GIVEN_PILE, SHEET, syntheticItoMatsuiInput, syntheticReinforcedInput } from '../report/reinforcementFixtures';
import { ReinforcementForces } from './ReinforcementForces';

const html = (input = syntheticItoMatsuiInput(), reinforcements = input.model.reinforcements, units: string = 'SI'): string =>
  renderToStaticMarkup(createElement(ReinforcementForces, { report: { engine: input.engineName, results: input.results }, reinforcements, units }));
const th = (h: string): string[] => [...h.matchAll(/<th scope="col">(.*?)<\/th>/g)].map((m) => m[1] ?? '');

describe('ReinforcementForces con Ito-Matsui', () => {
  it('trae «Fuerza del suelo», «Gobierna» y «Brazo» tras «Disponible»', () => {
    const h = html();
    const cols = th(h.slice(0, h.indexOf('</thead>')));
    expect(cols.slice(0, 8)).toEqual(['Id', 'Tipo', 'Cruce', 'Estación (m)', 'Disponible (kN/m)', 'Fuerza del suelo (kN/m)', 'Gobierna', 'Brazo (m)']);
    expect(cols[cols.length - 1]).toBe('Estado');
  });

  it('el pilote muestra Corte y los demás un guion; las celdas numéricas llevan la clase num', () => {
    const h = html();
    expect(h).toContain('>Corte</td>');
    expect(h).toMatch(/<td class="num">117,800<\/td><td>Corte<\/td><td class="num">1,224<\/td>/);
    expect(h).toMatch(/<td class="num">—<\/td><td>—<\/td><td class="num">—<\/td>/);
  });

  it('sin Ito-Matsui la tabla es la de siempre (9 columnas)', () => {
    const plain = syntheticReinforcedInput();
    expect(th(html(plain).slice(0, html(plain).indexOf('</thead>')))).toHaveLength(9);
  });

  it('dice la nota de Ito-Matsui y el límite que sí calcula el empuje del suelo', () => {
    const h = html();
    expect(h).toContain('data-testid="ito-matsui-note"');
    expect(h).toContain(ITO_MATSUI_NOTE);
    expect(h).toContain(ITO_MATSUI_STRUCTURAL_LIMIT_TEXT);
    expect(h).not.toContain(STRUCTURAL_LIMIT_TEXT);
  });

  it('con fuerza dada y tablestaca conserva el límite de siempre y no dice la nota de Ito-Matsui', () => {
    const h = html(syntheticReinforcedInput({ reinforcements: [GIVEN_PILE, SHEET] }));
    expect(h).toContain(STRUCTURAL_LIMIT_TEXT);
    expect(h).not.toContain('ito-matsui-note');
  });

  it('en imperial las unidades son lbf/ft y ft', () => {
    const h = html(syntheticItoMatsuiInput(), undefined, 'imperial');
    expect(h).toContain('>Fuerza del suelo (lbf/ft)</th>');
    expect(h).toContain('>Brazo (ft)</th>');
  });
});
