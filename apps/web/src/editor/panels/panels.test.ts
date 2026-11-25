// Pruebas de los paneles sin DOM: se renderizan a HTML estático con un store falso (entorno `node`).
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Material } from '../../engine/types';
import type { EditorStore, Issue, ModelDoc } from '../types';
import { AnalysisPanel, DiagnosticsPanel, LoadsPanel, MaterialsPanel, SearchPanel, SeismicPanel, SurfacePanel, WaterPanel } from './index';
import { applyCommands } from './dispatch';
import { LabeledField } from './Fields';
import { createFakeStore } from './fakeStore';
import { defaultSearch, surfaceModeCommands } from './forms';

const soil: Material = {
  id: 'soil', name: 'Suelo', model: 'mohr_coulomb', unit_weight: 20, unit_weight_sat: null, cohesion: 3, friction_angle: 19.6, ru: null,
};

function makeDoc(overrides: Partial<ModelDoc> = {}): ModelDoc {
  return {
    format: 'opengeoslide',
    version: '0.2',
    meta: {},
    units: 'SI',
    materials: [soil, { ...soil, id: 'rock', name: 'Roca', unit_weight: 24 }],
    regions: [{ material: 'soil', polygon: [[20, 20], [20, 25], [30, 25], [50, 35], [70, 35], [70, 20]] }],
    water: { unit_weight: 9.807, piezometric_line: [[0, 12], [40, 6], [55, 6]] },
    loads: [
      { type: 'udl', id: 'u1', x1: 50, x2: 70, q: 20.5 },
      { type: 'line', id: 'l1', x: 40, p: 20, angle: -10 },
    ],
    slope: { direction: 'auto' },
    analysis: {
      methods: ['bishop', 'spencer'],
      slices: 50,
      search: { ...defaultSearch(), entry: [49.9, 55.2], exit: [26.9, 30.2] },
      seismic: { kh: 0.1, kv: 0 },
    },
    ...overrides,
  };
}

function html(panel: ComponentType<{ store: EditorStore }>, doc: ModelDoc, patch = {}): string {
  return renderToStaticMarkup(createElement(panel, { store: createFakeStore(doc, patch) }));
}

describe('paneles: render con store falso', () => {
  it('MaterialsPanel: tabla con coma decimal, unidades y asignación por región', () => {
    const out = html(MaterialsPanel, makeDoc());
    expect(out).toContain('Materiales');
    expect(out).toContain('Peso unitario γ<span class="muted"> (kN/m³)</span>');
    expect(out).toContain('value="19,6"');
    expect(out).toContain('data-path="/materials/0/friction_angle"');
    expect(out).toContain('Ángulo de fricción φ<span class="muted"> (°)</span>');
    expect(out).toContain('Material por región');
    expect(out).toContain('Material de la región 1');
    expect(out).toContain('data-path="/regions/0/material"');
    expect(out).toContain('Roca (rock)');
  });

  it('MaterialsPanel: tarjetas apiladas con etiquetas visibles y sin tabla ancha (R7-13)', () => {
    const out = html(MaterialsPanel, makeDoc());
    expect(out).not.toContain('<table');
    expect(out).toContain('class="ep-card');
    expect(out).toMatch(/<label for="[^"]+">Nombre<\/label>/);
  });

  it('MaterialsPanel: el id es texto de solo lectura, no un campo (R7-23)', () => {
    const out = html(MaterialsPanel, makeDoc());
    expect(out).toContain('Identificador: <code>soil</code> (no se puede cambiar)');
    expect(out).not.toMatch(/<input[^>]*value="soil"/);
  });

  it('MaterialsPanel: «Quitar» deshabilitado si una región usa el material', () => {
    const out = html(MaterialsPanel, makeDoc());
    const soilBtn = /<button[^>]*aria-label="Quitar el material soil"[^>]*>/.exec(out)?.[0] ?? '';
    const rockBtn = /<button[^>]*aria-label="Quitar el material rock"[^>]*>/.exec(out)?.[0] ?? '';
    expect(soilBtn).toContain('disabled');
    expect(soilBtn).toContain('En uso por la región 1');
    expect(rockBtn).not.toContain('disabled');
  });

  it('MaterialsPanel: unidades imperiales', () => {
    const out = html(MaterialsPanel, makeDoc({ units: 'imperial' }));
    expect(out).toContain('(pcf)');
    expect(out).toContain('Cohesión c<span class="muted"> (psf)</span>');
  });

  it('WaterPanel: γw y tabla de la piezométrica', () => {
    const out = html(WaterPanel, makeDoc());
    expect(out).toContain('value="9,807"');
    expect(out).toContain('aria-label="Piezométrica, punto 2: x"');
    expect(out).toContain('Agregar punto');
    expect(out).toContain('Quitar piezométrica');
  });

  it('WaterPanel: sin piezométrica ofrece crearla; con 2 puntos no deja quitar', () => {
    expect(html(WaterPanel, makeDoc({ water: null }))).toContain('Crear piezométrica');
    expect(html(WaterPanel, makeDoc({ water: { piezometric_line: [[0, 1], [5, 1]] } }))).toContain('title="Mínimo 2 puntos"');
  });

  it('SurfacePanel: modo búsqueda; fija con campos del círculo; ambas guardadas avisa', () => {
    const search = html(SurfacePanel, makeDoc());
    expect(search).toMatch(/type="radio"[^>]*checked=""[^>]*\/>\s*Búsqueda/);
    expect(search).not.toContain('Centro xc');

    const fixed = html(SurfacePanel, makeDoc({ analysis: { surface: { type: 'circle', xc: 45.5, yc: 60, r: 30 } } }));
    expect(fixed).toContain('Centro xc');
    expect(fixed).toContain('value="45,5"');

    const both = html(SurfacePanel, makeDoc({ analysis: { surface: { type: 'circle', xc: 1, yc: 2, r: 3 }, search: defaultSearch() } }));
    expect(both).toContain('el motor lo ignora');

    expect(html(SurfacePanel, makeDoc({ analysis: {} }))).toContain('Sin superficie definida');
  });

  it('SearchPanel: campos con coma decimal; inactiva sin búsqueda', () => {
    const out = html(SearchPanel, makeDoc());
    expect(out).toContain('value="49,9"');
    expect(out).toContain('Puntos de entrada');
    expect(out).toContain('8\u202f000 candidatos');
    expect(html(SearchPanel, makeDoc({ analysis: {} }))).toContain('La búsqueda no está activa');
  });

  it('AnalysisPanel: métodos, valores por defecto y sentido', () => {
    const out = html(AnalysisPanel, makeDoc());
    expect(out).toContain('Bishop simplificado');
    expect(out).toContain('Spencer');
    expect(out).toContain('value="50"');
    expect(out).toContain('value="0,00001"');
    expect(out).toContain('Automático');
  });

  it('LoadsPanel: tarjetas con ambos tipos, ángulo con signo y botones de agregar', () => {
    const out = html(LoadsPanel, makeDoc());
    expect(out).not.toContain('<table');
    expect(out).toContain('Carga q<span class="muted"> (kPa)</span>');
    expect(out).toContain('data-path="/loads/0/q"');
    expect(out).toContain('value="20,5"');
    expect(out).toContain('Ángulo<span class="muted"> (°)</span>');
    expect(out).toContain('data-path="/loads/1/angle"');
    expect(out).toContain('value="-10"');
    expect(out).toContain('Agregar carga distribuida');
    expect(html(LoadsPanel, makeDoc({ loads: [] }))).toContain('Sin cargas.');
    expect(html(LoadsPanel, makeDoc({ regions: [] }))).toMatch(/<button[^>]*disabled[^>]*>Agregar carga lineal/);
  });

  it('SeismicPanel: kh/kv, ayuda con el sentido y «Quitar sismo»', () => {
    const out = html(SeismicPanel, makeDoc());
    expect(out).toContain('kh positivo actúa en el sentido del deslizamiento');
    expect(out).toContain('value="0,1"');
    expect(out).toMatch(/<button[^>]*>Quitar sismo/);
    expect(html(SeismicPanel, makeDoc({ analysis: {} }))).toMatch(/<button[^>]*disabled[^>]*>Quitar sismo/);
  });

  it('DiagnosticsPanel: orden por severidad, rutas clicables y estado desactualizado', () => {
    const issues: Issue[] = [
      { source: 'engine', severity: 'nota', code: 'negative_lambda', text: 'Texto de nota', path: null },
      { source: 'local', severity: 'error', code: 'editor.region_overlap', text: 'Texto de error', path: '/regions/0' },
      { source: 'engine', severity: 'aviso', code: 'pole', text: 'Texto de aviso', path: null },
    ];
    const out = html(DiagnosticsPanel, makeDoc(), { diagnostics: { status: 'stale', issues, revision: 0 } });
    expect(out.indexOf('Texto de error')).toBeLessThan(out.indexOf('Texto de aviso'));
    expect(out.indexOf('Texto de aviso')).toBeLessThan(out.indexOf('Texto de nota'));
    expect(out).toContain('1 error, 1 aviso, 1 nota');
    expect(out).toContain('Desactualizado');
    expect(out).toMatch(/<button[^>]*class="ep-issue"[^>]*>[^]*Texto de error/);
    expect(out).toContain('editor.region_overlap');
    expect(html(DiagnosticsPanel, makeDoc())).toContain('Sin incidencias.');
  });

  it('DiagnosticsPanel: un «ok» de otra revisión se marca como desactualizado', () => {
    const out = html(DiagnosticsPanel, makeDoc(), { revision: 3, diagnostics: { status: 'ok', issues: [], revision: 2 } });
    expect(out).toContain('Desactualizado');
  });

  it('DiagnosticsPanel: no duplica «Comprobar» (el botón es el de la barra, UX-18)', () => {
    const store = createFakeStore(makeDoc());
    expect(renderToStaticMarkup(createElement(DiagnosticsPanel, { store }))).not.toContain('Comprobar');
  });

  it('DiagnosticsPanel: solo es botón la incidencia con destino real; el detalle técnico va colapsado (R7-11)', () => {
    const issues: Issue[] = [
      { source: 'local', severity: 'error', code: 'editor.out_of_range', text: 'Texto con destino', path: '/analysis/seismic/kh' },
      { source: 'local', severity: 'error', code: 'editor.out_of_range', text: 'Texto sin destino', path: '/version' },
      { source: 'engine', severity: 'aviso', code: 'pole', text: 'Texto con detalle', path: null, detail: 'línea 3' },
    ];
    const out = html(DiagnosticsPanel, makeDoc(), { diagnostics: { status: 'ok', issues, revision: 0 } });
    const items = out.split('<li ').slice(1);
    const buttonItems = items.filter((li) => li.includes('<button type="button" class="ep-issue"'));
    expect(buttonItems).toHaveLength(1);
    expect(buttonItems[0]).toContain('Texto con destino');
    expect(out).toContain('<details class="ep-issue-detail">');
    expect(out).toContain('motor: pole · línea 3');
    expect(out).not.toContain('[local:');
  });
});

describe('applyCommands', () => {
  it('un comando se despacha solo; ninguno no hace nada', () => {
    const store = createFakeStore(makeDoc());
    applyCommands(store, 'x', []);
    applyCommands(store, 'x', [{ type: 'seismic/set', seismic: null }]);
    expect(store.log).toEqual([{ type: 'seismic/set', seismic: null }]);
  });

  it('varios comandos van dentro de un gesto (una sola entrada de historial)', () => {
    const store = createFakeStore(makeDoc({ analysis: { search: defaultSearch() } }));
    applyCommands(store, 'Cambiar el tipo de superficie', surfaceModeCommands(store.getState().doc, 'fixed'));
    expect(store.log[0]).toBe('begin:Cambiar el tipo de superficie');
    expect(store.log[store.log.length - 1]).toBe('end');
    expect(store.commands().map((c) => c.type)).toEqual(['surface/set', 'search/set']);
    const a = store.getState().doc.analysis;
    expect(a.surface).not.toBeNull();
    expect(a.search).toBeNull();
  });

  it('cierra el gesto aunque un comando falle', () => {
    const store = createFakeStore(makeDoc());
    const boom = (): void => {
      throw new Error('boom');
    };
    store.dispatch = boom;
    expect(() => applyCommands(store, 'x', [{ type: 'seismic/set', seismic: null }, { type: 'seismic/set', seismic: null }])).toThrow('boom');
    expect(store.log).toEqual(['begin:x', 'end']);
  });
});

describe('LabeledField (R7-23)', () => {
  const field = (props: Record<string, unknown>) =>
    renderToStaticMarkup(createElement(LabeledField, { label: 'kh', value: '0,1', onChange: () => undefined, ...props }));

  it('la ayuda se enlaza siempre con aria-describedby', () => {
    const out = field({ hint: 'De 0 a menos de 1' });
    const id = /aria-describedby="([^"]+)"/.exec(out)?.[1] ?? '';
    expect(id).toMatch(/-hint$/);
    expect(out).toContain(`id="${id}"`);
  });

  it('con error enlaza ayuda y error; el error no es role=alert hasta confirmar el campo', () => {
    const out = field({ hint: 'De 0 a menos de 1', error: 'Fuera de rango' });
    const ids = (/aria-describedby="([^"]+)"/.exec(out)?.[1] ?? '').split(' ');
    expect(ids).toHaveLength(2);
    expect(out).toMatch(/<span[^>]*class="ep-error"[^>]*>Fuera de rango/);
    expect(out).not.toContain('role="alert"');
    expect(out).toContain('aria-invalid="true"');
  });

  it('el nombre accesible viene del <label for>, sin aria-label duplicado', () => {
    const out = field({});
    expect(out).toMatch(/<label for="([^"]+)">kh<\/label>/);
    expect(out).not.toContain('aria-label');
  });
});
