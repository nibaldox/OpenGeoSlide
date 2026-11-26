// Paneles con la v0.3 (HTML estático con un store falso, entorno `node`): material no drenado, los cinco métodos con la función entre
// dovelas y la superficie polilínea. Los clics y la edición con teclado se prueban en Chrome (docs/fase3/w1e).
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Material, Point } from '../../engine/types';
import type { EditorStore, ModelDoc } from '../types';
import { createFakeStore } from './fakeStore';
import { AnalysisPanel, MaterialsPanel, SurfacePanel } from './index';
import { NewMaterial } from './MaterialsPanel';

const soil: Material = { id: 'soil', name: 'Suelo', model: 'mohr_coulomb', unit_weight: 20, unit_weight_sat: null, cohesion: 3, friction_angle: 19.6, ru: null };
const clay: Material = { id: 'clay', name: 'Arcilla', model: 'undrained', unit_weight: 18, undrained_strength: 25.5 };
const clayLinear: Material = { ...clay, id: 'deep', name: 'Arcilla profunda', strength_datum: 30, strength_gradient: 1.5, strength_limit: 60 };

function makeDoc(overrides: Partial<ModelDoc> = {}): ModelDoc {
  return {
    format: 'opengeoslide',
    version: '0.3',
    meta: {},
    units: 'SI',
    materials: [soil, clay, clayLinear],
    regions: [{ material: 'soil', polygon: [[0, 0], [0, 10], [20, 10], [40, 0]] }],
    water: null,
    slope: { direction: 'auto' },
    analysis: { methods: ['spencer'], slices: 50, surface: { type: 'circle', xc: 20, yc: 25, r: 20 } },
    ...overrides,
  };
}

/** Nombre accesible de cada `<input>` con `aria-label` o `<label for>`, en orden (las casillas con etiqueta envolvente no se cuentan). */
function accessibleNames(markup: string): string[] {
  const names: string[] = [];
  for (const m of markup.matchAll(/<input\b[^>]*>/g)) {
    const tag = m[0];
    const aria = /aria-label="([^"]*)"/.exec(tag)?.[1];
    const id = /\sid="([^"]*)"/.exec(tag)?.[1];
    const label = id ? new RegExp(`<label for="${id}">(.*?)</label>`).exec(markup)?.[1] : undefined;
    const name = text(aria ?? label ?? '');
    if (name !== '') names.push(name);
  }
  return names;
}

const html = (panel: ComponentType<{ store: EditorStore }>, doc: ModelDoc): string => renderToStaticMarkup(createElement(panel, { store: createFakeStore(doc) }));
const text = (h: string): string => h.replace(/<[^>]*>/g, '').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
const polyDoc = (points: Point[] = [[2, 3], [10, 1], [18, 4]], extra: Partial<ModelDoc['analysis']> = {}): ModelDoc =>
  makeDoc({ analysis: { methods: ['spencer'], slices: 50, surface: { type: 'polyline', points }, ...extra } });

describe('MaterialsPanel: modelo constitutivo (F3.2)', () => {
  it('cada tarjeta tiene un selector «Modelo» con las dos etiquetas y el prefijo accesible estable', () => {
    const out = html(MaterialsPanel, makeDoc());
    expect(accessibleNames(out)).toContain('Material soil: Nombre');
    expect(out).toContain('<span class="visually-hidden">Material soil: </span>Modelo');
    expect(out).toContain('<span class="visually-hidden">Material clay: </span>Modelo');
    expect(out).toMatch(/<option value="mohr_coulomb" selected="">Mohr-Coulomb<\/option>/);
    expect(out).toMatch(/<option value="undrained" selected="">No drenado \(Su\)<\/option>/);
  });

  it('Mohr-Coulomb muestra c y φ y no muestra Su; el no drenado muestra Su y no muestra c ni φ', () => {
    const out = html(MaterialsPanel, makeDoc({ materials: [soil], regions: [{ material: 'soil', polygon: [[0, 0], [1, 0], [0, 1]] }] }));
    expect(out).toContain('data-path="/materials/0/cohesion"');
    expect(out).not.toContain('data-path="/materials/0/undrained_strength"');
    const su = html(MaterialsPanel, makeDoc({ materials: [clay, soil], regions: [{ material: 'soil', polygon: [[0, 0], [1, 0], [0, 1]] }] }));
    expect(su).toContain('data-path="/materials/0/undrained_strength"');
    expect(su).toContain('value="25,5"');
    expect(su).not.toContain('data-path="/materials/0/cohesion"');
    expect(su).not.toContain('data-path="/materials/0/friction_angle"');
    // el material Mohr-Coulomb de la misma lista conserva los suyos
    expect(su).toContain('data-path="/materials/1/cohesion"');
  });

  it('nombres accesibles estables: «Material <id>: Su (kPa)» y, con perfil, cota, gradiente y límite con sus unidades', () => {
    const names = accessibleNames(html(MaterialsPanel, makeDoc()));
    expect(names).toContain('Material clay: Su (kPa)');
    expect(names).toContain('Material deep: Su (kPa)');
    expect(names).toContain('Material deep: Cota de referencia de Su (m)');
    expect(names).toContain('Material deep: Gradiente de Su (kPa/m)');
    expect(names).toContain('Material deep: Límite de Su (kPa)');
    // sin perfil no hay campos de perfil
    expect(names).not.toContain('Material clay: Gradiente de Su (kPa/m)');
    expect(new Set(names).size).toBe(names.length); // ningún nombre se repite entre tarjetas
  });

  it('la casilla «Su variable con la cota» refleja el perfil', () => {
    const out = html(MaterialsPanel, makeDoc());
    const boxes = [...out.matchAll(/<input type="checkbox"([^>]*)\/>(?:<span class="visually-hidden">([^<]*)<\/span>)?Su variable con la cota/g)];
    expect(boxes.map((m) => [m[2], /checked/.test(m[1] ?? '')])).toEqual([
      ['Material clay: ', false],
      ['Material deep: ', true],
    ]);
  });

  it('unidades imperiales en las etiquetas: psf, ft y psf/ft', () => {
    const names = accessibleNames(html(MaterialsPanel, makeDoc({ units: 'imperial' })));
    expect(names).toContain('Material deep: Su (psf)');
    expect(names).toContain('Material deep: Cota de referencia de Su (ft)');
    expect(names).toContain('Material deep: Gradiente de Su (psf/ft)');
  });

  it('el material nuevo tiene el mismo selector con el prefijo «Nuevo material»; sin cambiar el modelo es Mohr-Coulomb', () => {
    const store = createFakeStore(makeDoc());
    const form = renderToStaticMarkup(createElement(NewMaterial, { store, ids: ['soil'], units: 'SI', initiallyOpen: true }));
    expect(form).toContain('<span class="visually-hidden">Nuevo material: </span>Modelo');
    expect(accessibleNames(form)).toContain('Nuevo material: Cohesión c (kPa)');
    expect(accessibleNames(form)).not.toContain('Nuevo material: Su (kPa)');
  });

  it('un no drenado con ru sigue mostrando ru (se admite)', () => {
    const out = html(MaterialsPanel, makeDoc({ materials: [{ ...clay, ru: 0.2 }], regions: [{ material: 'clay', polygon: [[0, 0], [1, 0], [0, 1]] }] }));
    expect(out).toContain('data-path="/materials/0/ru"');
    expect(out).toContain('value="0,2"');
  });
});

describe('AnalysisPanel: los cinco métodos y la función entre dovelas (F3.9)', () => {
  it('ofrece los cinco métodos con las etiquetas completas', () => {
    const out = text(html(AnalysisPanel, makeDoc()));
    for (const label of ['Bishop simplificado', 'Spencer', 'Morgenstern-Price', 'Janbu simplificado', 'Janbu corregido']) expect(out).toContain(label);
    // Cinco métodos y, desde la v0.5, la casilla de la grieta de tracción (F5.7).
    expect(html(AnalysisPanel, makeDoc()).match(/type="checkbox"/g)).toHaveLength(6);
  });

  it('sin Morgenstern-Price marcado no hay selector de función; con él sí, con el medio seno por defecto', () => {
    expect(html(AnalysisPanel, makeDoc())).not.toContain('Función de fuerzas entre dovelas');
    const mp = html(AnalysisPanel, makeDoc({ analysis: { methods: ['morgenstern_price'], slices: 50, surface: { type: 'circle', xc: 20, yc: 25, r: 20 } } }));
    expect(mp).toContain('Función de fuerzas entre dovelas f(ξ)');
    expect(mp).toMatch(/<option value="half_sine" selected="">Medio seno<\/option>/);
    for (const label of ['Constante', 'Seno recortado (mín. 0,35)', 'Trapezoidal (20 %-80 %)', 'Definida por puntos']) expect(mp).toContain(`>${label}</option>`);
    expect(mp).not.toContain('Puntos de la función entre dovelas');
  });

  it('con «Definida por puntos» muestra la tabla editable con nombres accesibles y quitar deshabilitado con 2 puntos', () => {
    const doc = makeDoc({
      analysis: { methods: ['morgenstern_price'], slices: 50, surface: { type: 'circle', xc: 20, yc: 25, r: 20 }, interslice: { function: 'data_points', points: [[0, 0], [0.5, 1], [1, 0]] } },
    });
    const out = html(AnalysisPanel, doc);
    expect(out).toContain('aria-label="Puntos de la función entre dovelas"');
    expect(accessibleNames(out)).toEqual(expect.arrayContaining(['Función entre dovelas, punto 2: ξ', 'Función entre dovelas, punto 2: f', 'Función entre dovelas, punto 3: f']));
    expect(out).toContain('value="0,5"');
    expect(out).toContain('aria-label="Quitar el punto 2 de la función entre dovelas"');
    expect(/<button[^>]*aria-label="Quitar el punto 2 de la función entre dovelas"[^>]*>/.exec(out)?.[0]).not.toContain('disabled');
    const two = html(AnalysisPanel, makeDoc({ analysis: { methods: ['morgenstern_price'], interslice: { function: 'data_points', points: [[0, 1], [1, 1]] } } }));
    expect(/<button[^>]*aria-label="Quitar el punto 1 de la función entre dovelas"[^>]*>/.exec(two)?.[0]).toContain('disabled');
  });

  it('una tabla inválida del documento muestra el error del campo (ξ no creciente)', () => {
    const out = html(
      AnalysisPanel,
      makeDoc({ analysis: { methods: ['morgenstern_price'], interslice: { function: 'data_points', points: [[0, 1], [0.5, 1], [0.5, 2], [1, 1]] } } }),
    );
    expect(out).toContain('ξ debe ser estrictamente creciente');
    expect(out).toMatch(/aria-label="Función entre dovelas, punto 3: ξ"[^>]*aria-invalid="true"|aria-invalid="true"[^>]*aria-label="Función entre dovelas, punto 3: ξ"/);
  });

  it('Bishop: con círculo está habilitado; con polilínea fija se deshabilita y se explica por qué, a la vista', () => {
    const circle = html(AnalysisPanel, makeDoc());
    expect(/<input[^>]*type="checkbox"[^>]*>(?=Bishop simplificado)/.exec(circle)?.[0]).not.toContain('disabled');
    expect(text(circle)).not.toContain('no se ofrece en superficies no circulares');

    const poly = html(AnalysisPanel, polyDoc());
    const bishop = /<input[^>]*type="checkbox"[^>]*>(?=Bishop simplificado)/.exec(poly)?.[0] ?? '';
    expect(bishop).toContain('disabled');
    expect(bishop).toContain('aria-describedby');
    expect(text(poly)).toContain('Bishop simplificado no se ofrece en superficies no circulares');
    // los demás métodos siguen habilitados
    for (const label of ['Spencer', 'Morgenstern-Price', 'Janbu simplificado', 'Janbu corregido']) {
      expect(/<input[^>]*type="checkbox"[^>]*>(?=\s*)/.test(poly)).toBe(true);
      const tag = new RegExp(`<input[^>]*type="checkbox"[^>]*>(?=${label})`).exec(poly)?.[0] ?? '';
      expect(tag, label).not.toContain('disabled');
    }
  });

  it('con polilínea y búsqueda activa la superficie fija se ignora: Bishop sigue habilitado y sin explicación', () => {
    const out = html(AnalysisPanel, polyDoc(undefined, { search: { type: 'circular_entry_exit' } }));
    expect(/<input[^>]*type="checkbox"[^>]*>(?=Bishop simplificado)/.exec(out)?.[0]).not.toContain('disabled');
    expect(text(out)).not.toContain('no se ofrece en superficies no circulares');
  });

  it('un archivo con polilínea y Bishop marcado: sigue habilitado para poder desmarcarlo y el aviso lo dice', () => {
    const out = html(AnalysisPanel, polyDoc(undefined, { methods: ['bishop', 'spencer'] }));
    expect(/<input[^>]*type="checkbox"[^>]*>(?=Bishop simplificado)/.exec(out)?.[0]).not.toContain('disabled');
    expect(text(out)).toContain('Desmarque Bishop para poder comprobar el modelo.');
  });
});

describe('SurfacePanel: círculo o polilínea (F3.3)', () => {
  it('en modo fijo ofrece «Círculo» y «Polilínea» con la forma actual marcada; en búsqueda no', () => {
    const circle = html(SurfacePanel, makeDoc());
    expect(circle).toContain('Forma de la superficie fija');
    expect(circle).toMatch(/type="radio"[^>]*checked=""[^>]*\/>\s*Círculo/);
    expect(circle).toContain('Centro xc');
    expect(circle).not.toContain('Puntos de la polilínea de falla');
    const poly = html(SurfacePanel, polyDoc());
    expect(poly).toMatch(/type="radio"[^>]*checked=""[^>]*\/>\s*Polilínea/);
    expect(poly).not.toContain('Centro xc');
    const search = html(SurfacePanel, makeDoc({ analysis: { methods: ['spencer'], search: { type: 'circular_entry_exit' } } }));
    expect(search).not.toContain('Forma de la superficie fija');
  });

  it('la tabla de puntos: una fila por punto con x e y, coma decimal, unidad del modelo y nombres accesibles', () => {
    const out = html(SurfacePanel, polyDoc([[2, 3.5], [10, 1], [18, 4]]));
    expect(out).toContain('aria-label="Puntos de la polilínea de falla"');
    expect(accessibleNames(out)).toEqual(expect.arrayContaining(['Polilínea, punto 1: x', 'Polilínea, punto 1: y', 'Polilínea, punto 3: x', 'Polilínea, punto 3: y']));
    expect(out).toContain('value="3,5"');
    expect(out).toContain('data-path="/analysis/surface/points/1/0"');
    expect(out).toContain('x (m)');
    expect(html(SurfacePanel, makeDoc({ units: 'imperial', analysis: { methods: ['spencer'], surface: { type: 'polyline', points: [[2, 3], [10, 1]] } } }))).toContain('x (ft)');
    for (const label of ['Agregar un punto después del punto 2 de la polilínea', 'Quitar el punto 2 de la polilínea']) expect(out).toContain(`aria-label="${label}"`);
    expect(text(out)).toContain('Ordenar por x');
  });

  it('quitar se deshabilita con 2 puntos y «Ordenar por x» con los puntos ya ordenados', () => {
    const out = html(SurfacePanel, polyDoc([[2, 3], [18, 4]]));
    expect(/<button[^>]*aria-label="Quitar el punto 1 de la polilínea"[^>]*>/.exec(out)?.[0]).toContain('disabled');
    expect(/<button[^>]*>Ordenar por x<\/button>/.exec(out)?.[0]).toContain('disabled');
    const three = html(SurfacePanel, polyDoc());
    expect(/<button[^>]*aria-label="Quitar el punto 1 de la polilínea"[^>]*>/.exec(three)?.[0]).not.toContain('disabled');
  });

  it('una polilínea con la x no creciente (archivo ajeno) muestra el error de la tabla', () => {
    const out = html(SurfacePanel, polyDoc([[2, 3], [1, 1], [18, 4]]));
    expect(out).toContain('ordene los puntos de izquierda a derecha');
    expect(out).toContain('aria-invalid="true"');
  });

  it('explica que con una polilínea no se ofrece Bishop', () => {
    expect(text(html(SurfacePanel, polyDoc()))).toContain('no se ofrece Bishop simplificado');
  });

  it('polilínea guardada con búsqueda activa: avisa de que el motor la ignora, con la palabra «polilínea»', () => {
    const out = html(SurfacePanel, polyDoc(undefined, { search: { type: 'circular_entry_exit' } }));
    expect(out).toContain('una polilínea fija guardada');
    expect(out).toContain('Quitar la polilínea fija');
  });
});
