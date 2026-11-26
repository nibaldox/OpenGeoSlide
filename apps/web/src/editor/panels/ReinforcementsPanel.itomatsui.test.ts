// Panel «Refuerzos» con el pilote de Ito-Matsui (v0.5, E15i-1 y E15i-8): selector de la fuerza, diámetro, ubicación, capacidad, S/D y el
// aviso de rango. Nombres accesibles estables y únicos («Refuerzo N: Campo (unidad)»).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../types';
import { FIVE, itoPile, pile } from '../state/reinforcementFixtures';
import { createFakeStore } from './fakeStore';
import { ReinforcementsPanel } from './index';

const doc = (reinforcements: ModelDoc['reinforcements'], over: Partial<ModelDoc> = {}): ModelDoc => ({
  format: 'opengeoslide',
  version: '0.5',
  meta: {},
  units: 'SI',
  materials: [{ id: 'soil', name: 'Suelo', model: 'mohr_coulomb', unit_weight: 20, cohesion: 3, friction_angle: 19.6 }],
  regions: [{ material: 'soil', polygon: [[0, 0], [0, 15], [10, 15], [32.5, 0]] }],
  water: null,
  reinforcements,
  slope: { direction: 'auto' },
  analysis: { methods: ['bishop'], slices: 50, surface: { type: 'circle', xc: 10, yc: 20, r: 12 } },
  ...over,
});
const html = (d: ModelDoc): string => renderToStaticMarkup(createElement(ReinforcementsPanel, { store: createFakeStore(d) }));
const text = (h: string): string => h.replace(/<[^>]*>/g, '').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
/** Nombre accesible de cada `<input>`, `<select>` y botón con `aria-label`, en orden de aparición. */
function names(markup: string): string[] {
  const out: string[] = [];
  for (const m of markup.matchAll(/<(?:input|select|button)\b[^>]*>/g)) {
    const tag = m[0];
    const aria = /aria-label="([^"]*)"/.exec(tag)?.[1];
    const id = /\sid="([^"]*)"/.exec(tag)?.[1];
    const label = id ? new RegExp(`<label for="${id}">(.*?)</label>`).exec(markup)?.[1] : undefined;
    if (aria !== undefined || label !== undefined) out.push(text(aria ?? label ?? ''));
  }
  return out;
}
const dup = (list: readonly string[]): string[] => list.filter((n, i) => list.indexOf(n) !== i);

describe('pilote con fuerza dada', () => {
  const out = html(doc([pile()]));

  it('lleva el selector «Origen de la fuerza» con las dos opciones y «Fuerza dada» elegida', () => {
    expect(names(out)).toContain('Refuerzo 1: Origen de la fuerza');
    expect(out).toMatch(/<option value="force" selected="">Fuerza dada<\/option>/);
    expect(out).toContain('>Presión del suelo (Ito-Matsui)</option>');
  });

  it('conserva «Fuerza de corte (kN)» y no muestra el diámetro ni la capacidad', () => {
    const n = names(out);
    expect(n).toContain('Refuerzo 1: Fuerza de corte (kN)');
    expect(n.some((x) => /Diámetro|Capacidad/.test(x))).toBe(false);
  });

  it('la tablestaca y los elementos de tracción no tienen el selector', () => {
    const all = names(html(doc(FIVE)));
    expect(all.filter((x) => x.includes('Origen de la fuerza'))).toEqual(['Refuerzo 4: Origen de la fuerza']);
  });
});

describe('pilote con presión del suelo (Ito-Matsui)', () => {
  const out = html(doc([itoPile({ capacity: { shear: 150, moment: 250 } })]));

  it('«Presión del suelo (Ito-Matsui)» está elegida y no hay «Fuerza de corte»', () => {
    expect(out).toMatch(/<option value="ito_matsui" selected="">Presión del suelo \(Ito-Matsui\)<\/option>/);
    expect(names(out).some((x) => x.includes('Fuerza de corte'))).toBe(false);
  });

  it('muestra diámetro, ubicación y las dos capacidades con su unidad y nombres «Refuerzo 1: …»', () => {
    const n = names(out);
    for (const name of ['Refuerzo 1: Diámetro (m)', 'Refuerzo 1: Ubicación de la fuerza', 'Refuerzo 1: Capacidad al corte (kN)', 'Refuerzo 1: Capacidad a momento (kN·m)']) expect(n, name).toContain(name);
    expect(out).toContain('value="0,8"');
    expect(out).toContain('value="150"');
    expect(out).toContain('value="250"');
  });

  it('la ubicación ofrece el centroide (por defecto) y la superficie de falla', () => {
    expect(out).toMatch(/<option value="centroid" selected="">En el centroide de la resultante \(por defecto\)<\/option>/);
    expect(out).toContain('>En la superficie de falla</option>');
  });

  it('el pilote es vertical: no hay campo x2 y la x se rotula «Posición x (vertical)»', () => {
    const n = names(out);
    expect(n).toContain('Refuerzo 1: Posición x (vertical) (m)');
    expect(n.some((x) => x.includes('Punta x2'))).toBe(false);
  });

  it('la capacidad dice «Vacío: sin tope»', () => {
    expect(text(out)).toContain('Vacío: sin tope');
  });

  it('en imperial las unidades son ft, lbf y lbf·ft', () => {
    const imp = names(html(doc([itoPile({ capacity: { shear: 1, moment: 1 } })], { units: 'imperial' })));
    for (const name of ['Refuerzo 1: Diámetro (ft)', 'Refuerzo 1: Capacidad al corte (lbf)', 'Refuerzo 1: Capacidad a momento (lbf·ft)']) expect(imp, name).toContain(name);
  });

  it('los nombres accesibles son únicos con dos pilotes y los demás refuerzos', () => {
    const many = names(html(doc([...FIVE, itoPile({ id: 'p9', capacity: { shear: 1 } }), itoPile({ id: 'p10', x1: 20, x2: 20 })])));
    expect(dup(many)).toEqual([]);
    expect(many).toContain('Refuerzo 6: Diámetro (m)');
    expect(many).toContain('Refuerzo 7: Diámetro (m)');
  });
});

describe('S/D y aviso de rango (E15i-8)', () => {
  it('con S/D = 3 informa la relación y no avisa', () => {
    const t = text(html(doc([itoPile()])));
    expect(t).toContain('S/D = 3');
    expect(t).not.toContain('fuera de 2 a 8');
  });

  it.each([
    ['pequeño', 1.2, '1,5'],
    ['grande', 9.6, '12'],
  ])('con S/D %s (%s) muestra el aviso con el valor y el texto del motor', (_n, spacing, shown) => {
    const t = text(html(doc([itoPile({ spacing })])));
    expect(t).toContain(`S/D = ${shown}`);
    expect(t).toContain('fuera de 2 a 8: la fórmula pierde validez');
    expect(t).toContain('Ukritchon y Keawsawasvong 2017');
    expect(t).toContain('Revise el espaciamiento');
  });

  it('los límites 2 y 8 no avisan', () => {
    expect(text(html(doc([itoPile({ spacing: 1.6 })])))).not.toContain('fuera de 2 a 8');
    expect(text(html(doc([itoPile({ spacing: 6.4 })])))).not.toContain('fuera de 2 a 8');
  });

  it('un pilote con fuerza dada no muestra S/D', () => {
    expect(text(html(doc([pile()])))).not.toContain('S/D');
  });
});

describe('texto del límite del cálculo', () => {
  it('con fuerza dada sigue diciendo que no calcula el empuje sobre el elemento', () => {
    expect(text(html(doc([pile()])))).toContain('No calcula el empuje sobre el elemento');
  });

  it('con Ito-Matsui dice que sí calcula el empuje del suelo y qué sigue sin calcular', () => {
    const t = text(html(doc([itoPile()])));
    expect(t).not.toContain('No calcula el empuje sobre el elemento');
    expect(t).toContain('empuje del suelo');
    expect(t).toContain('Ito-Matsui');
    expect(t).toContain('No calcula el empotramiento');
  });

  it('explica el origen de la dirección: angle 0 es horizontal', () => {
    expect(text(html(doc([itoPile()])))).toContain('horizontal');
  });
});

describe('pilote inclinado que trae un archivo con presión del suelo', () => {
  const out = html(doc([itoPile({ x2: 42 })]));

  it('enseña x2, el error y un botón «Alinear» con nombre único', () => {
    const n = names(out);
    expect(n).toContain('Refuerzo 1: Punta x2 (m)');
    expect(n).toContain('Alinear verticalmente el pilote del refuerzo 1 (x2 = x1)');
    expect(text(out)).toContain('un pilote con presión del suelo es vertical');
  });
});
