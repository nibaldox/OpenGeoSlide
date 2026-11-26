// Panel «Refuerzos» (v0.4, F4.11): rótulos, nombres accesibles estables y únicos, unidades, alta por tipo y herramienta de dibujo.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../types';
import { createEditorStore } from '../state/store';
import { FIVE, anchor, pile, sheet } from '../state/reinforcementFixtures';
import { validateLocal } from '../state/validateLocal';
import { createFakeStore } from './fakeStore';
import { ReinforcementsPanel } from './index';
import { REINFORCEMENT_TYPES, reinforcementAddCommand } from './reinforcementForm';

const doc = (over: Partial<ModelDoc> = {}): ModelDoc => ({
  format: 'opengeoslide',
  version: '0.4',
  meta: {},
  units: 'SI',
  materials: [{ id: 'soil', name: 'Suelo', model: 'mohr_coulomb', unit_weight: 20, cohesion: 3, friction_angle: 19.6 }],
  regions: [{ material: 'soil', polygon: [[0, 0], [0, 15], [10, 15], [32.5, 0]] }],
  water: null,
  reinforcements: FIVE,
  slope: { direction: 'auto' },
  analysis: { methods: ['bishop'], slices: 50, surface: { type: 'circle', xc: 10, yc: 20, r: 12 } },
  ...over,
});

const html = (d: ModelDoc, patch = {}): string => renderToStaticMarkup(createElement(ReinforcementsPanel, { store: createFakeStore(d, patch) }));
const text = (h: string): string => h.replace(/<[^>]*>/g, '').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
/** Nombre accesible de cada `<input>` (aria-label, o el texto del `<label for>`), en orden de aparición. */
function accessibleNames(markup: string): string[] {
  const names: string[] = [];
  for (const m of markup.matchAll(/<input\b[^>]*>/g)) {
    const tag = m[0];
    const aria = /aria-label="([^"]*)"/.exec(tag)?.[1];
    const id = /\sid="([^"]*)"/.exec(tag)?.[1];
    const label = id ? new RegExp(`<label for="${id}">(.*?)</label>`).exec(markup)?.[1] : undefined;
    names.push(text(aria ?? label ?? ''));
  }
  return names;
}
const duplicates = (names: readonly string[]): string[] => names.filter((n, i) => names.indexOf(n) !== i);

describe('ReinforcementsPanel: lista y rótulos', () => {
  it('sin refuerzos dice «Sin refuerzos.» y ofrece las cinco altas', () => {
    const out = html(doc({ reinforcements: undefined }));
    expect(out).toContain('Sin refuerzos.');
    for (const label of ['Agregar anclaje', 'Agregar clavo', 'Agregar geosintético', 'Agregar pilote', 'Agregar tablestaca']) expect(out).toContain(`>${label}<`);
  });

  it('cada tarjeta lleva «Refuerzo N: Tipo» con los rótulos en español', () => {
    const out = html(doc());
    const legends = [...out.matchAll(/<legend>(.*?)<\/legend>/g)].map((m) => text(m[1] ?? ''));
    expect(legends).toEqual(['Refuerzo 1: Anclaje', 'Refuerzo 2: Clavo', 'Refuerzo 3: Geosintético', 'Refuerzo 4: Pilote', 'Refuerzo 5: Tablestaca']);
  });

  it('el botón de la herramienta refleja si está activa y las altas se deshabilitan sin geometría', () => {
    expect(html(doc())).toMatch(/<button[^>]*aria-pressed="false"[^>]*>Trazar en el lienzo</);
    const active = html(doc(), { ui: { tool: 'draw_reinforcement', selection: { kind: 'none' }, viewport: null, snap: { vertex: true, axis: true, gridStep: null, radiusPx: 8 }, tracePoints: 0 } });
    expect(active).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Trazar en el lienzo</);
    const empty = html(doc({ regions: [] }));
    expect(/<button[^>]*disabled[^>]*>Agregar anclaje</.test(empty)).toBe(true);
  });

  it('el texto de límite de F4.8 aparece solo con un pilote o una tablestaca', () => {
    expect(text(html(doc()))).toContain('No calcula el empuje sobre el elemento, el empotramiento, el momento flector, la deflexión');
    expect(text(html(doc({ reinforcements: [anchor()] })))).not.toContain('No calcula el empuje');
  });
});

describe('ReinforcementsPanel: nombres accesibles', () => {
  it('estables y con el formato «Refuerzo N: Campo (unidad)»', () => {
    const names = accessibleNames(html(doc()));
    expect(names).toContain('Refuerzo 1: Capacidad a tracción (kN)');
    expect(names).toContain('Refuerzo 1: Identificador');
    expect(names).toContain('Refuerzo 1: Cabeza x1 (m)');
    expect(names).toContain('Refuerzo 1: Espaciamiento (m)');
    expect(names).toContain('Refuerzo 1: Resistencia de adherencia por metro (kN/m)');
    expect(names).toContain('Refuerzo 1: Longitud adherida (m)');
    expect(names).toContain('Refuerzo 2: Longitud de desarrollo en la cabeza (m)');
    expect(names).toContain('Refuerzo 3: Adhesión de la interfaz (kPa)');
    expect(names).toContain('Refuerzo 3: Fricción de la interfaz δ (°)');
    expect(names).toContain('Refuerzo 3: Cobertura Rc');
    expect(names).toContain('Refuerzo 4: Fuerza de corte (kN)');
    expect(names).toContain('Refuerzo 4: Ángulo (°)');
    expect(names).toContain('Refuerzo 5: Fuerza de corte (kN/m)');
    expect(names).toContain('Refuerzo 5: Posición x (vertical) (m)');
  });

  it('ningún control repite nombre accesible, con los cinco tipos en el panel', () => {
    const out = html(doc());
    expect(accessibleNames(out).length).toBeGreaterThan(30);
    expect(duplicates(accessibleNames(out))).toEqual([]);
    // Las listas desplegables también: etiqueta con prefijo propio.
    const labels = [...out.matchAll(/<label for="[^"]*"><span class="visually-hidden">([^<]*)<\/span>([^<]*)<\/label>/g)].map((m) => `${m[1]}${m[2]}`);
    expect(labels).toContain('Refuerzo 1: Aplicación');
    expect(labels).toContain('Refuerzo 1: Dirección de la fuerza');
    expect(labels).toContain('Refuerzo 1: Modelo de arrancamiento');
    expect(duplicates(labels)).toEqual([]);
  });

  it('en imperial, las unidades cambian', () => {
    const names = accessibleNames(html(doc({ units: 'imperial' })));
    expect(names).toContain('Refuerzo 1: Capacidad a tracción (lbf)');
    expect(names).toContain('Refuerzo 1: Cabeza x1 (ft)');
    expect(names).toContain('Refuerzo 5: Fuerza de corte (lbf/ft)');
    expect(names).toContain('Refuerzo 3: Adhesión de la interfaz (psf)');
  });

  it('el botón de quitar nombra el refuerzo', () => {
    expect(html(doc())).toContain('aria-label="Quitar el refuerzo 3"');
  });

  it('un refuerzo con un error lo muestra enlazado al campo', () => {
    const out = html(doc({ reinforcements: [anchor({ tensile_capacity: -5 })] }));
    expect(text(out)).toContain('Capacidad a tracción: use un valor igual o mayor que 0');
    expect(out).toMatch(/aria-invalid="true"/);
    expect(out).toContain('data-path="/reinforcements/0/tensile_capacity"');
  });

  it('el pilote con dirección distinta de «Ángulo» no muestra el campo de ángulo; la tablestaca no muestra la x de la punta ni el espaciamiento', () => {
    const names = accessibleNames(html(doc({ reinforcements: [pile({ direction: 'tangent', angle: undefined }), sheet()] })));
    expect(names).not.toContain('Refuerzo 1: Ángulo (°)');
    expect(names).not.toContain('Refuerzo 2: Punta x2 (m)');
    expect(names).not.toContain('Refuerzo 2: Espaciamiento (m)');
    expect(names).toContain('Refuerzo 1: Espaciamiento (m)');
  });

  it('solo el campo de tokens: el panel no pone colores propios', () => {
    expect(html(doc())).not.toMatch(/style="[^"]*#[0-9a-f]{3,6}/i);
  });
});

describe('alta por tipo con el almacén real', () => {
  it('cada tipo se agrega de una vez, queda válido y se deshace en un solo paso', () => {
    const store = createEditorStore(doc({ reinforcements: undefined, version: '0.2' }), null);
    const before = store.getState().doc;
    for (const type of REINFORCEMENT_TYPES) {
      const command = reinforcementAddCommand(type, store.getState().doc);
      expect(command, type).not.toBeNull();
      if (command) store.dispatch(command);
    }
    const added = store.getState().doc;
    expect(added.reinforcements?.map((r) => r.type)).toEqual([...REINFORCEMENT_TYPES]);
    expect(added.version).toBe('0.4');
    expect(validateLocal(added).filter((i) => i.severity === 'error')).toEqual([]);
    for (let i = 0; i < REINFORCEMENT_TYPES.length; i += 1) store.undo();
    expect(store.getState().doc).toBe(before);
  });

  it('sin regiones no hay alta', () => {
    expect(reinforcementAddCommand('anchor', doc({ regions: [] }))).toBeNull();
  });
});
