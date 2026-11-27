// E15l-18 (R12 B-09): textos del agua que contradecían al motor. ru y piezométrica; «el análisis es seco» con agua en la grieta; «sin agua» en App.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { describeAnalysis } from '../../App';
import type { Model } from '../../engine/types';
import { geotechAdvisories } from '../state/geotech';
import { baseDoc, mat } from '../state/testFixtures';
import type { ModelDoc } from '../types';
import { createFakeStore } from './fakeStore';
import { WaterPanel } from './index';

const plain = (s: string): string => s.replace(/<[^>]*>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');

const noWater = (extra: Partial<ModelDoc['analysis']> = {}): ModelDoc => {
  const { water: _w, ...rest } = baseDoc();
  return { ...rest, analysis: { ...baseDoc().analysis, ...extra } } as ModelDoc;
};

describe('E15l-18: editor.ru_over_piezo', () => {
  it('dice que en ese material la presión de poros sale de ru, y que la piezométrica sigue aportando γsat y el agua embalsada', () => {
    const doc: ModelDoc = { ...baseDoc(), water: { unit_weight: 9.81, piezometric_line: [[0, 5], [20, 5]] } };
    doc.materials[1] = mat('m2', { ru: 0.2 });
    const t = geotechAdvisories(doc).find((x) => x.code === 'editor.ru_over_piezo')?.text ?? '';
    expect(t).toContain('ru tiene precedencia');
    expect(t).toContain('la presión de poros sale de ru');
    expect(t).toContain('agua embalsada');
    expect(t).toContain('peso y su empuje');
    expect(t).toContain('γsat');
    expect(t).not.toContain('no usa la piezométrica');
    expect(t).not.toContain('Quite ru para que actúe la piezométrica');
  });
});

describe('E15l-18: WaterPanel y App cuentan el agua de la grieta', () => {
  const panel = (d: ModelDoc): string => plain(renderToStaticMarkup(createElement(WaterPanel, { store: createFakeStore(d) })));

  it('WaterPanel sin piezométrica y sin grieta con agua sigue diciendo que el análisis es seco', () => {
    expect(panel(noWater())).toContain('el análisis es seco');
  });
  it('WaterPanel con la grieta con agua no dice «seco» y cita el agua de la grieta', () => {
    const t = panel(noWater({ tension_crack: { depth: 2, water_fill: 1 } }));
    expect(t).not.toContain('el análisis es seco');
    expect(t).toContain('agua de la grieta');
    expect(t).toContain('γw');
  });
  it('WaterPanel con la grieta seca (water_fill = 0) sigue siendo seco', () => {
    expect(panel(noWater({ tension_crack: { depth: 2, water_fill: 0 } }))).toContain('el análisis es seco');
  });

  const model = (water: Model['water'], crack?: { depth: number | 'auto'; water_fill: number }): Model =>
    ({ materials: [{}], regions: [{}], water, analysis: { surface: { type: 'circle', xc: 0, yc: 0, r: 1 }, ...(crack ? { tension_crack: crack } : {}) } }) as unknown as Model;
  it('App.describeAnalysis: «sin agua» solo sin ningún uso del agua', () => {
    expect(describeAnalysis(model(undefined))).toContain('sin agua');
    expect(describeAnalysis(model(undefined, { depth: 2, water_fill: 0 }))).toContain('sin agua');
    expect(describeAnalysis(model(undefined, { depth: 2, water_fill: 0.5 }))).toContain('agua en la grieta');
    expect(describeAnalysis(model(undefined, { depth: 2, water_fill: 0.5 }))).not.toContain('sin agua');
    expect(describeAnalysis(model({ piezometric_line: [[0, 1], [1, 1]] }))).toContain('con piezométrica');
    expect(describeAnalysis(model({ piezometric_line: [[0, 1], [1, 1]] }, { depth: 2, water_fill: 1 }))).toMatch(/piezométrica.*agua en la grieta/);
  });
});
