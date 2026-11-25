// UX9-02 y UX9-03: ningún control de un panel comparte nombre accesible con otro (HTML estático, entorno `node`).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Material } from '../../engine/types';
import type { ModelDoc } from '../types';
import { createFakeStore } from './fakeStore';
import { LoadsPanel, MaterialsPanel } from './index';
import { loadPlacementHint } from './LoadsPanel';
import { terrainRanges } from './forms';
import { NewMaterial } from './MaterialsPanel';

const soil: Material = { id: 'soil', name: 'Suelo', model: 'mohr_coulomb', unit_weight: 20, unit_weight_sat: null, cohesion: 3, friction_angle: 19.6, ru: null };

function makeDoc(overrides: Partial<ModelDoc> = {}): ModelDoc {
  return {
    format: 'opengeoslide',
    version: '0.2',
    meta: {},
    units: 'SI',
    materials: [soil, { ...soil, id: 'rock', name: 'Roca', unit_weight: 24 }],
    regions: [{ material: 'soil', polygon: [[0, 0], [0, 15], [10, 15], [32.5, 0]] }],
    water: null,
    loads: [
      { type: 'udl', id: 'u1', x1: 1, x2: 4, q: 20 },
      { type: 'udl', id: 'u2', x1: 5, x2: 8, q: 10 },
      { type: 'line', id: 'l1', x: 3, p: 20, angle: 0 },
    ],
    slope: { direction: 'auto' },
    analysis: { methods: ['bishop'], slices: 50 },
    ...overrides,
  };
}

const text = (h: string): string => h.replace(/<[^>]*>/g, '').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();

/** Nombre accesible de cada `<input>` (aria-label, o el texto del `<label for>`), en orden de aparición. */
export function accessibleNames(html: string): string[] {
  const names: string[] = [];
  for (const m of html.matchAll(/<input\b[^>]*>/g)) {
    const tag = m[0];
    const aria = /aria-label="([^"]*)"/.exec(tag)?.[1];
    const id = /\sid="([^"]*)"/.exec(tag)?.[1];
    const label = id ? new RegExp(`<label for="${id}">(.*?)</label>`).exec(html)?.[1] : undefined;
    names.push(text(aria ?? label ?? ''));
  }
  return names;
}

function duplicates(names: readonly string[]): string[] {
  return names.filter((n, i) => names.indexOf(n) !== i);
}

describe('nombres accesibles únicos en el panel', () => {
  it('Materiales: dos tarjetas no repiten nombres', () => {
    const names = accessibleNames(renderToStaticMarkup(createElement(MaterialsPanel, { store: createFakeStore(makeDoc()) })));
    expect(names.length).toBeGreaterThan(10);
    expect(duplicates(names)).toEqual([]);
    expect(names).toContain('Material soil: Nombre');
  });

  it('Materiales con el formulario nuevo abierto: «Nuevo material: …» y sin duplicados', () => {
    const store = createFakeStore(makeDoc());
    const form = renderToStaticMarkup(createElement(NewMaterial, { store, ids: ['soil', 'rock'], units: 'SI', initiallyOpen: true }));
    expect(form).toContain('<legend>Nuevo material</legend>');
    const all = accessibleNames(renderToStaticMarkup(createElement(MaterialsPanel, { store })).replace('</section>', `${form}</section>`));
    expect(duplicates(all)).toEqual([]);
    const own = accessibleNames(form);
    expect(own).toContain('Nuevo material: Nombre');
    expect(own).toContain('Nuevo material: Identificador (id)');
    expect(own).toContain('Nuevo material: Peso unitario γ (kN/m³)');
    expect(own.every((n) => n.startsWith('Nuevo material: '))).toBe(true);
  });

  it('Cargas: tres tarjetas no repiten nombres', () => {
    const names = accessibleNames(renderToStaticMarkup(createElement(LoadsPanel, { store: createFakeStore(makeDoc()) })));
    expect(names.length).toBeGreaterThan(8);
    expect(duplicates(names)).toEqual([]);
    expect(names).toContain('Carga 2: Inicio x1 (m)');
  });
});

describe('UX9-03: ayuda para ubicar cargas en la corona', () => {
  const html = (doc: ModelDoc): string => renderToStaticMarkup(createElement(LoadsPanel, { store: createFakeStore(doc) }));

  it('cada carga muestra el rango del terreno y de la corona, con la unidad del modelo', () => {
    const out = html(makeDoc());
    expect(text(out)).toContain('Terreno: x de 0 a 32,5 m. Corona: x de 0 a 10 m.');
    expect(html(makeDoc({ units: 'imperial' }))).toContain('Corona: x de 0 a 10 ft.');
  });

  it('«Usar la corona» está en las cargas distribuidas y «Centrar en la corona» en la lineal', () => {
    const out = html(makeDoc());
    expect(out.match(/>Usar la corona</g)).toHaveLength(2);
    expect(out.match(/>Centrar en la corona</g)).toHaveLength(1);
    expect(out).toContain('aria-label="Usar la corona para la carga 2"');
  });

  it('sin corona el botón está deshabilitado y se explica por qué', () => {
    const doc = makeDoc({ regions: [{ material: 'soil', polygon: [[0, 0], [0, 5], [10, 12], [20, 5], [20, 0]] }] });
    const out = html(doc);
    expect(out).toContain('sin corona');
    expect(/<button[^>]*aria-label="Usar la corona para la carga 1"[^>]*>/.exec(out)?.[0]).toContain('disabled');
  });

  it('avisa si la carga queda sobre el talud (fuera de la corona), pero no si está sobre ella', () => {
    const ranges = terrainRanges(makeDoc())!;
    expect(loadPlacementHint({ type: 'udl', id: '', x1: '1', x2: '4', q: '1' }, ranges, 'm')).toBeNull();
    expect(loadPlacementHint({ type: 'udl', id: '', x1: '8', x2: '20', q: '1' }, ranges, 'm')).toContain('no queda sobre la corona (x de 0 a 10 m)');
    // fuera del terreno: lo rechaza el formulario, no el aviso
    expect(loadPlacementHint({ type: 'line', id: '', x: '40', p: '1', angle: '0' }, ranges, 'm')).toBeNull();
    expect(loadPlacementHint({ type: 'line', id: '', x: 'abc', p: '1', angle: '0' }, ranges, 'm')).toBeNull();
  });
});
