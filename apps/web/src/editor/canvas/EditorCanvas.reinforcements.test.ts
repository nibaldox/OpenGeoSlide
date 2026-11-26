import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ReinforcementForce } from '../../engine/types';
import { CANVAS_INSTRUCTIONS, EditorCanvas, type CanvasResult } from './EditorCanvas';
import { createFakeStore } from './fakeStore';
import { ALL_TYPES, ANCHOR, SHEET, docWith, force } from './reinforcementFixtures';

function render(doc = docWith(...ALL_TYPES), ui: Parameters<typeof createFakeStore>[1] = {}, props: Partial<Parameters<typeof EditorCanvas>[0]> = {}): string {
  return renderToStaticMarkup(createElement(EditorCanvas, { store: createFakeStore(doc, ui), ...props }));
}

const result = (forces: ReinforcementForce[]): CanvasResult => ({
  surface: { xc: 30, yc: 30, r: 25 },
  slices: [{ x_left: 10, x_right: 20, y_base_left: 11, y_base_right: 10, y_top_mid: 18, width: 10, weight: 1, alpha: 0, phi: 30, c: 5, u: 0, normal: 1, shear_strength: 1, shear_mobilized: 1, area: 1 } as never],
  reinforcementForces: forces,
});

describe('EditorCanvas con refuerzos: segmentos y tiradores', () => {
  it('dibuja un símbolo por refuerzo con su tipo y su aplicación, aria-hidden', () => {
    const html = render();
    expect(html).toContain('<g data-layer="reinforcements" aria-hidden="true" pointer-events="none">');
    for (const t of ['anchor', 'nail', 'geosynthetic', 'pile', 'sheet_pile']) expect(html).toContain(`data-reinforcement-type="${t}"`);
    expect(html).toContain('data-application="active"');
    expect((html.match(/data-reinforcement=/g) ?? []).length).toBe(5);
  });

  it('cada refuerzo tiene tres tiradores con nombre accesible estable', () => {
    const html = render(docWith(ANCHOR, SHEET));
    expect((html.match(/data-handle="reinforcement_end"/g) ?? []).length).toBe(4);
    expect((html.match(/data-handle="reinforcement_center"/g) ?? []).length).toBe(2);
    expect(html).toContain('aria-label="Refuerzo 1 (Anclaje), cabeza: x 30,0 m, y 15,0 m"');
    expect(html).toContain('aria-label="Refuerzo 1 (Anclaje), punta: x 15,0 m, y 12,0 m"');
    expect(html).toContain('aria-label="Refuerzo 1 (Anclaje), centro: x 22,5 m, y 13,5 m"');
    expect(html).toContain('aria-label="Refuerzo 2 (Tablestaca), punta: x 50,0 m, y 1,0 m"');
    expect(html).toContain('data-handle-key="r-1-c"');
  });

  it('en un modelo imperial las coordenadas llevan ft', () => {
    const doc = { ...docWith(ANCHOR), units: 'imperial' };
    expect(render(doc)).toContain('aria-label="Refuerzo 1 (Anclaje), cabeza: x 30,0 ft, y 15,0 ft"');
  });

  it('el refuerzo seleccionado se resalta y su tirador queda pulsado', () => {
    const html = render(docWith(ANCHOR, SHEET), { selection: { kind: 'reinforcement_end', index: 1, end: 2 } });
    expect((html.match(/data-reinforcement-selected/g) ?? []).length).toBe(1);
    expect(html).toContain('aria-label="Refuerzo 2 (Tablestaca), punta: x 50,0 m, y 1,0 m" aria-pressed="true"');
  });

  it('solo usa tokens var(--canvas-*) y var(--ui-*): ningún color literal', () => {
    const html = render(docWith(...ALL_TYPES), {}, { result: result([force()]) });
    const reinf = html.slice(html.indexOf('data-layer="reinforcements"'), html.indexOf('data-layer="loads"'));
    expect(reinf.length).toBeGreaterThan(500);
    expect(reinf).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
    expect(reinf).toContain('var(--canvas-reinforcement)');
  });

  it('las instrucciones del lienzo mencionan el refuerzo', () => {
    expect(CANVAS_INSTRUCTIONS).toContain('Dibujar refuerzo');
  });
});

describe('EditorCanvas: fuerzas del resultado', () => {
  it('una flecha por fuerza aplicada, con su rótulo', () => {
    const html = render(docWith(ANCHOR), {}, { result: result([force({ fx: -150, fy: -30 }), force({ id: 'clavo-1', crossing: 1, application: 'passive', fx: -20, fy: 5 })]) });
    expect(html).toContain('data-layer="reinforcement-forces"');
    expect((html.match(/data-force-arrow/g) ?? []).length).toBe(2);
    expect(html).toContain('anclaje-1: 152,97 kN/m (activa)');
    expect(html).toContain('>clavo-1: 20,62 kN/m (pasiva)<');
    expect(html).toContain('clavo-1: 20,62 kN/m (pasiva, dividida por F). Cruce 2');
    expect(html).toContain('marker-end="url(#');
  });

  it('los estados que no se aplicaron salen en gris con su rótulo y sin flecha', () => {
    const html = render(docWith(ANCHOR), {}, {
      result: result([
        force({ status: 'outside_mass' as never, fx: 0, fy: 0 }),
        force({ crossing: 1, status: 'compression_ignored' as never, fx: 0, fy: 0 }),
        force({ crossing: 2, status: 'no_capacity' as never, fx: 0, fy: 0 }),
      ]),
    });
    expect((html.match(/data-force-arrow/g) ?? []).length).toBe(0);
    expect((html.match(/data-force-inactive/g) ?? []).length).toBe(3);
    expect(html).toContain('anclaje-1: fuera de la masa');
    expect(html).toContain('anclaje-1: ignorada por compresión');
    expect(html).toContain('anclaje-1: sin capacidad');
    expect(html).toContain('data-force-applied="false"');
    expect(html).toContain('var(--canvas-axis-text)');
  });

  it('sin fuerzas no hay capa de fuerzas', () => {
    expect(render(docWith(ANCHOR), {}, { result: result([]) })).not.toContain('reinforcement-forces');
    expect(render(docWith(ANCHOR))).not.toContain('reinforcement-forces');
  });
});

describe('EditorCanvas: herramienta «Dibujar refuerzo»', () => {
  it('muestra la ayuda y el selector de tipo con nombres accesibles', () => {
    const html = render(docWith(), { tool: 'draw_reinforcement' });
    expect(html).toContain('data-testid="reinforce-hint"');
    expect(html).toContain('role="group" aria-label="Tipo de refuerzo"');
    for (const name of ['Anclaje', 'Clavo', 'Geosintético', 'Pilote', 'Tablestaca']) expect(html).toContain(`aria-label="Tipo a dibujar: ${name}"`);
    expect(html).toContain('aria-pressed="true" aria-label="Tipo a dibujar: Anclaje"');
    expect(html).toContain('marque la cabeza');
  });

  it('no aparece con otra herramienta', () => {
    expect(render(docWith(), { tool: 'select' })).not.toContain('reinforce-hint');
  });
});
