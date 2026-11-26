import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReinforcementForces } from '../ui/ReinforcementForces';
import { legendItems } from '../ui/legendItems';
import { STRUCTURAL_LIMIT_TEXT } from '../report/reinforcementReport';
import { SHEET, ANCHOR, NAIL, syntheticReinforcedInput } from '../report/reinforcementFixtures';
import { defaultSectionPalette, type SectionPalette } from '../theme/sectionPalette';
import { LIMITATIONS } from '../onboarding/helpContent';
import { drawSection } from './drawSection';
import { buildScene } from './scene';

// Vista Casos (Canvas 2D y tablas) con refuerzos: informes sintéticos con `reinforcement_forces`.

const palette: SectionPalette = {
  ...defaultSectionPalette(),
  bg: 'BG', halo: 'HALO', surface: 'SURF', axisText: 'GRAY', reinforcement: 'REINF',
};

function recorder() {
  const strokes: string[] = [];
  const fills: string[] = [];
  const texts: string[] = [];
  const widths: number[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'fillText' ? (t: string) => void texts.push(String(t)) : () => undefined),
      set: (_t, k, v) => {
        if (k === 'strokeStyle') strokes.push(String(v));
        if (k === 'fillStyle') fills.push(String(v));
        if (k === 'lineWidth') widths.push(Number(v));
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, strokes, fills, texts, widths };
}

describe('escena con refuerzos', () => {
  const input = syntheticReinforcedInput();
  const scene = buildScene(input.model, input.results[0]!);

  it('lleva los refuerzos y las fuerzas del método mostrado; el encuadre incluye los extremos', () => {
    expect(scene.reinforcements).toHaveLength(4);
    expect(scene.reinforcementForces).toHaveLength(4);
    expect(scene.bounds.maxX).toBeGreaterThan(66);
    expect(scene.bounds.maxY).toBeGreaterThan(35);
  });

  it('sin refuerzos la escena no cambia: ni claves nuevas', () => {
    const plain = buildScene({ ...input.model, reinforcements: undefined }, input.results[0]!);
    expect('reinforcements' in plain).toBe(false);
    expect('reinforcementForces' in plain).toBe(false);
  });

  it('sin método dibujado solo hay refuerzos, sin fuerzas', () => {
    const s = buildScene(input.model, null);
    expect(s.reinforcements).toHaveLength(4);
    expect(s.reinforcementForces).toEqual([]);
  });
});

describe('drawSection con refuerzos', () => {
  const input = syntheticReinforcedInput();
  const scene = buildScene(input.model, input.results[0]!);

  it('dibuja los símbolos con el color de los refuerzos y halo, los rótulos y las flechas de fuerza', () => {
    const r = recorder();
    drawSection(r.ctx, 900, 500, 1, scene, palette);
    expect(r.strokes).toContain('REINF');
    expect(r.strokes).toContain('HALO');
    expect(r.fills).toContain('REINF'); // cabeza del clavo y puntas de flecha
    expect(r.texts).toEqual(expect.arrayContaining(['Tablestaca 1', 'Anclaje 2', 'Clavo 3', 'Geosintético 4']));
    expect(r.texts).toContain('tablestaca-1: 120,0 kN/m (pasiva)');
    expect(r.texts).toContain('anclaje-1: 60,0 kN/m (activa)');
  });

  it('los cruces que no se aplicaron salen en gris con su estado', () => {
    const r = recorder();
    drawSection(r.ctx, 900, 500, 1, scene, palette);
    expect(r.strokes).toContain('GRAY');
    expect(r.texts).toContain('clavo-1: ignorada por compresión');
    expect(r.texts).toContain('geosintetico-1: fuera de la masa');
  });

  it('sin refuerzos no usa el color de los refuerzos', () => {
    const plain = buildScene({ ...input.model, reinforcements: undefined }, input.results[0]!);
    const r = recorder();
    drawSection(r.ctx, 900, 500, 1, plain, palette);
    expect(r.strokes).not.toContain('REINF');
    expect(r.texts.some((t) => t.includes('kN/m'))).toBe(false);
  });

  it('la paleta clara por defecto trae el color de los refuerzos (sin DOM)', () => {
    expect(defaultSectionPalette().reinforcement).toBe('#0f5132');
  });
});

describe('leyenda con refuerzos', () => {
  const input = syntheticReinforcedInput();
  const keys = (s: ReturnType<typeof buildScene>) => legendItems(s, {}).map((i) => i.key);

  it('con resultado: refuerzos, fuerza y cruce sin fuerza', () => {
    expect(keys(buildScene(input.model, input.results[0]!))).toEqual(expect.arrayContaining(['reinforcements', 'reinforcement-forces', 'reinforcement-inactive']));
  });

  it('sin resultado solo el símbolo; sin refuerzos nada', () => {
    const k = keys(buildScene(input.model, null));
    expect(k).toContain('reinforcements');
    expect(k).not.toContain('reinforcement-forces');
    expect(keys(buildScene({ ...input.model, reinforcements: undefined }, null))).not.toContain('reinforcements');
  });

  it('con todas las fuerzas aplicadas no hay marca gris', () => {
    const only = syntheticReinforcedInput({ reinforcements: [SHEET, ANCHOR] });
    expect(keys(buildScene(only.model, only.results[0]!))).not.toContain('reinforcement-inactive');
  });
});

describe('tabla de fuerzas en Casos y en el editor', () => {
  const input = syntheticReinforcedInput();
  const report = { engine: input.engineName, results: input.results };
  const html = (reinforcements = input.model.reinforcements) => renderToStaticMarkup(createElement(ReinforcementForces, { report, reinforcements, units: 'SI' }));

  it('una tabla por método con las columnas de F4.9 y el tipo del refuerzo', () => {
    const h = html();
    expect((h.match(/<table/g) ?? []).length).toBe(2);
    expect(h).toContain('Fuerzas de los refuerzos por cruce con la superficie final (Bishop simplificado; F = 0,985)');
    for (const col of ['Id', 'Tipo', 'Cruce', 'Estación (m)', 'Disponible (kN/m)', 'Aplicada fx; fy (kN/m)', 'Movilizada fx; fy (kN/m)', 'Aplicación', 'Estado']) expect(h).toContain(`>${col}</th>`);
    expect(h).toContain('>Tablestaca</td>');
    expect(h).toContain('Pasiva: se moviliza dividida por F');
    // E14o-14 (R11B-03): la aclaración del PDF también va en la vista web, y la tabla dice el F del método.
    expect(h).toContain('data-testid="force-table-note"');
    expect(h).toContain('antes de dividir por el factor de seguridad F de cada método');
    expect(h).toContain('F = 0,98');
    expect(h).toContain('Ignorada por compresión');
    expect(h).toContain('class="row-warn"');
  });

  it('con una tablestaca dice el límite de F4.8; sin pilotes ni tablestacas, no', () => {
    expect(html()).toContain(STRUCTURAL_LIMIT_TEXT);
    expect(html([ANCHOR, NAIL])).not.toContain('empotramiento');
  });

  it('sin fuerzas ni elementos estructurales no pinta nada', () => {
    expect(renderToStaticMarkup(createElement(ReinforcementForces, { report: { engine: 'x', results: [] }, reinforcements: [ANCHOR] }))).toBe('');
  });

  // E14o-16 (R11B-06): los refuerzos que no cruzan la superficie convergida se nombran.
  it('nombra los refuerzos sin cruce de cada método convergido', () => {
    const results = input.results.map((r) => ({ ...r, reinforcement_forces: (r.reinforcement_forces ?? []).filter((f) => f.id !== 'anclaje-1') }));
    const h = renderToStaticMarkup(createElement(ReinforcementForces, { report: { engine: input.engineName, results }, reinforcements: input.model.reinforcements, units: 'SI' }));
    expect(h).toContain('Sin cruce con la superficie final (Bishop simplificado): anclaje-1. No aportaron fuerza.');
    expect(h).toContain('Sin cruce con la superficie final (Spencer): anclaje-1. No aportaron fuerza.');
  });

  it('sin ningún cruce en los métodos convergidos, no hay tablas pero sí el aviso de los refuerzos sin cruce', () => {
    const results = input.results.map((r) => ({ ...r, reinforcement_forces: undefined }));
    const h = renderToStaticMarkup(createElement(ReinforcementForces, { report: { engine: input.engineName, results }, reinforcements: input.model.reinforcements, units: 'SI' }));
    expect(h).not.toContain('<table');
    expect(h).toContain('data-testid="uncrossed"');
    expect(h).toContain('tablestaca-1, anclaje-1, clavo-1, geosintetico-1');
    expect(h).not.toContain('force-table-note');
  });

  it('con elementos estructurales y sin fuerzas (motor sin cruces) sigue diciendo el límite', () => {
    const h = renderToStaticMarkup(createElement(ReinforcementForces, { report: { engine: 'x', results: [] }, reinforcements: [SHEET] }));
    expect(h).toContain('data-testid="structural-limit"');
    expect(h).not.toContain('<table');
  });
});

describe('Ayuda', () => {
  it('las limitaciones dicen el límite de pilotes y tablestacas (F4.8)', () => {
    expect(LIMITATIONS.some((l) => l.includes(STRUCTURAL_LIMIT_TEXT))).toBe(true);
  });
});
