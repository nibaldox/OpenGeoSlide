// CM-W2: importar un DXF o un CSV de regiones con «Reemplazar» sobre el modelo de arranque sin cambios crea un modelo nuevo (título del
// archivo, solo sus materiales, búsqueda y análisis de un modelo nuevo, sin agua). Sobre un documento con cambios, «Reemplazar» sigue
// cambiando solo las regiones. Y el diálogo del DXF explica de dónde sale la cota de cierre de una polilínea abierta y el área que da.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parseCsv, csvToRegions } from '../../io/csv';
import { parseDxf } from '../../io/dxf';
import { saveOgsJson } from '../../io/ogsJson';
import { loadCaseDoc } from '../../report/fixtures';
import { createEditorStore, validateLocal } from '../state';
import type { ModelDoc } from '../types';
import { applyRegionImport } from './applyImport';
import { CsvImportDialog, DxfImportDialog, replaceModeLabel } from './ImportDialogs';
import {
  NEW_MATERIAL,
  areaText,
  closeWithBase,
  defaultImportMode,
  defaultMapping,
  defaultUnit,
  freshMapping,
  importDocTitle,
  importableLayers,
  isFreshImport,
  openBaseHelp,
  openClosureAreas,
  openMinY,
  openPolylines,
  planRegionImport,
  polygonArea,
  suggestBaseText,
  unitFactor,
  type ImportBase,
  type RegionImportPlan,
} from './importPlan';
import { emptyModel } from './newModel';

const OGS_BIN = process.env.OGS_BIN;
const haveEngine = OGS_BIN !== undefined && existsSync(OGS_BIN);

const fixture = (name: string): string => readFileSync(new URL(`../../io/dxf/fixtures/${name}`, import.meta.url), 'utf8');
const regionsCsv = readFileSync(new URL('../../../public/examples/regiones.csv', import.meta.url), 'utf8');
const errorsOf = (doc: ModelDoc) => validateLocal(doc).filter((i) => i.severity === 'error');

/** El plan que arma el diálogo con sus valores por defecto para `terraplen.dxf` sobre `doc`, con o sin modelo nuevo. */
function terraplenPlan(doc: ModelDoc, fresh: boolean): RegionImportPlan {
  const result = parseDxf(fixture('terraplen.dxf'), { materials: doc.materials.map((m) => ({ id: m.id, name: m.name })) });
  const layers = importableLayers(result);
  const open = openPolylines(result);
  const unit = defaultUnit(result.unitsFromHeader, doc.units);
  const baseY = Number(suggestBaseText(open, unit, doc.units).replace(',', '.'));
  const mapping = defaultMapping(layers);
  return planRegionImport(
    { materials: fresh ? [] : [...doc.materials], units: doc.units },
    { regions: result.regions, open: open.map((e) => ({ layer: e.layer, points: e.points })), mapping: fresh ? freshMapping(mapping) : mapping, factor: unitFactor(unit, doc.units), openMode: 'close', baseY },
  );
}

describe('reglas puras de la importación sobre el arranque', () => {
  const base = (over: Partial<ImportBase> = {}): ImportBase => ({ regionCount: 2, title: 'ACADS 1(a)', pristineStart: false, ...over });

  it('isFreshImport: solo «Reemplazar» con el modelo de arranque sin cambios', () => {
    expect(isFreshImport('replace', base({ pristineStart: true }))).toBe(true);
    expect(isFreshImport('add', base({ pristineStart: true }))).toBe(false);
    expect(isFreshImport('replace', base())).toBe(false);
    // Un modelo sin regiones (con cambios) también tiene «Reemplazar» por defecto, pero no es un modelo nuevo: conserva lo suyo.
    expect(defaultImportMode(base({ regionCount: 0 }))).toBe('replace');
    expect(isFreshImport('replace', base({ regionCount: 0 }))).toBe(false);
    expect(isFreshImport('replace', undefined)).toBe(false);
  });

  it('importDocTitle: el nombre del archivo sin la extensión', () => {
    expect(importDocTitle('terraplen.dxf')).toBe('terraplen');
    expect(importDocTitle('Talud Norte v2.CSV')).toBe('Talud Norte v2');
    expect(importDocTitle('mi.talud.dxf')).toBe('mi.talud');
    expect(importDocTitle('C:\\obras\\corte 3.dxf')).toBe('corte 3');
    expect(importDocTitle('sin_extension')).toBe('sin_extension');
    expect(importDocTitle('.dxf')).toBe('Modelo importado');
    expect(importDocTitle('')).toBe('Modelo importado');
  });

  it('freshMapping: toda capa que no se omite crea su material', () => {
    expect(freshMapping({ A: 'soil', B: NEW_MATERIAL, C: '' })).toEqual({ A: NEW_MATERIAL, B: NEW_MATERIAL, C: '' });
  });

  it('el rótulo de «Reemplazar» dice qué pasa en cada caso', () => {
    expect(replaceModeLabel({ regionCount: 2, title: 'ACADS 1(a)', pristineStart: true })).toBe('Reemplazar: crea un modelo nuevo con este archivo');
    expect(replaceModeLabel({ regionCount: 2, title: 'ACADS 1(a)', pristineStart: false })).toBe('Reemplazar las regiones actuales (se conservan materiales, agua y análisis)');
    expect(replaceModeLabel(undefined)).toBe('Reemplazar las regiones actuales (se conservan materiales, agua y análisis)');
  });
});

describe('terraplen.dxf sobre el modelo de arranque (modelo nuevo)', () => {
  const start = loadCaseDoc('V047a');
  const store = createEditorStore(start);
  const before = store.getState();
  const plan = terraplenPlan(start, true);
  applyRegionImport(store, plan, 'replace', { fileName: 'terraplen.dxf' });
  const doc = store.getState().doc;

  it('el ejemplo de arranque tiene lo que el modelo nuevo no debe heredar (otro material «Soil», otra dirección y otra malla de búsqueda)', () => {
    expect(before.docEpoch).toBe(0);
    expect(before.revision).toBe(0);
    expect(start.materials.map((m) => m.id)).toEqual(['soil']);
    expect(start.slope?.direction).toBe('right_to_left');
    expect(start.analysis.search).toMatchObject({ n_entry: 20, n_exit: 20, n_radius: 20 });
    expect(doc.slope?.direction).toBe('auto');
  });

  it('título del archivo, sin extensión', () => {
    expect(doc.meta.title).toBe('terraplen');
  });

  it('solo los materiales de la importación: uno por capa y ninguno del ejemplo', () => {
    expect(doc.materials.map((m) => m.name).sort()).toEqual(['SUELO_1', 'TERRENO', 'arcilla']);
    for (const old of start.materials) expect(doc.materials.map((m) => m.id)).not.toContain(old.id);
    // Todo material lo usa una región (el ejemplo de T3 dejaba un «Soil» sin uso).
    const used = new Set(doc.regions.map((r) => r.material));
    expect(doc.materials.every((m) => used.has(m.id))).toBe(true);
    expect(doc.regions).toHaveLength(3);
  });

  it('sin agua, y búsqueda y análisis de un modelo nuevo (ventanas sin fijar: las del motor, todo el ancho)', () => {
    expect(doc.water ?? null).toBeNull();
    expect(doc.loads).toEqual([]);
    const fresh = emptyModel();
    expect(doc.analysis).toEqual(fresh.analysis);
    expect(doc.analysis.search).toMatchObject({ type: 'circular_entry_exit', entry: null, exit: null, n_entry: 15, n_exit: 15, n_radius: 10 });
    expect(doc.slope).toEqual(fresh.slope);
    expect(doc.analysis).not.toEqual(start.analysis);
  });

  it('el documento es válido y calculable, no queda archivo ni «sin cambios»', () => {
    expect(errorsOf(doc)).toEqual([]);
    const s = store.getState();
    expect(s.file.name).toBeNull();
    expect(s.revision).toBeGreaterThan(s.file.savedRevision);
    expect(s.docEpoch).toBe(1);
  });

  it('un solo Ctrl+Z devuelve el ejemplo de arranque', () => {
    const other = createEditorStore(start);
    applyRegionImport(other, plan, 'replace', { fileName: 'terraplen.dxf' });
    expect(other.getState().history.past).toHaveLength(1);
    other.undo();
    expect(other.getState().doc).toEqual(start);
  });

  it.skipIf(!haveEngine)('el motor calcula el modelo nuevo: FS finito con Bishop y Spencer', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ogs-importfresh-'));
    try {
      const file = join(dir, 'm.ogs.json');
      writeFileSync(file, saveOgsJson(doc));
      const r = spawnSync(OGS_BIN as string, ['analyze', file], { encoding: 'utf8', maxBuffer: 1 << 28 });
      expect(r.status, `${r.stderr}`.slice(0, 300)).toBe(0);
      const results = (JSON.parse(r.stdout) as { results: { method: string; fos: number | null; status: string }[] }).results;
      expect(results.map((x) => x.method)).toEqual(['bishop', 'spencer']);
      for (const x of results) {
        expect(x.status).toBe('converged');
        expect(x.fos as number).toBeGreaterThan(0.5);
        expect(x.fos as number).toBeLessThan(5);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('lo que un modelo de arranque con agua, cargas y ventanas fijas no deja pasar', () => {
  it('ni la piezométrica, ni las cargas, ni las ventanas de entrada y salida', () => {
    const base = loadCaseDoc('V047a');
    const start: ModelDoc = {
      ...base,
      water: { unit_weight: 9.81, piezometric_line: [[0, 5], [60, 8]] },
      loads: [{ type: 'udl', x1: 0, x2: 5, q: 10 }],
      analysis: { ...base.analysis, search: { type: 'circular_entry_exit', entry: [0, 20], exit: [40, 60], n_entry: 15, n_exit: 15, n_radius: 10, max_radius_factor: 5, min_width: null, refine: true } },
    };
    const store = createEditorStore(start);
    applyRegionImport(store, terraplenPlan(start, true), 'replace', { fileName: 'terraplen.dxf' });
    const doc = store.getState().doc;
    expect(doc.water ?? null).toBeNull();
    expect(doc.loads).toEqual([]);
    expect(doc.analysis.search).toMatchObject({ entry: null, exit: null });
  });
});

describe('terraplen.dxf sobre un documento con cambios («Reemplazar» sin cambio de comportamiento)', () => {
  const start = loadCaseDoc('V047a');
  const edited: ModelDoc = { ...start, meta: { ...start.meta, title: 'Mi talud' } };
  const store = createEditorStore(edited);
  const plan = terraplenPlan(edited, false);
  applyRegionImport(store, plan, 'replace');
  const doc = store.getState().doc;

  it('cambia solo las regiones: se conservan título, materiales, agua y análisis', () => {
    expect(doc.meta.title).toBe('Mi talud');
    expect(doc.water).toEqual(edited.water);
    expect(doc.analysis).toEqual(edited.analysis);
    expect(doc.slope).toEqual(edited.slope);
    expect(doc.materials.slice(0, edited.materials.length)).toEqual(edited.materials);
    expect(doc.materials.length).toBe(edited.materials.length + plan.newMaterials.length);
    expect(doc.regions).toEqual(plan.regions);
  });

  it('con `fresh` ausente es idéntico a `applyPlanToDoc(…, replace)` de siempre', () => {
    const viaPlan = { ...edited, materials: [...edited.materials, ...plan.newMaterials], regions: plan.regions };
    expect(doc).toEqual(viaPlan);
  });
});

describe('CSV de regiones sobre el modelo de arranque', () => {
  const start = loadCaseDoc('V047a');
  const { regions } = csvToRegions(parseCsv(regionsCsv));

  it('«Reemplazar» crea un modelo nuevo titulado como el archivo, con las capas como materiales', () => {
    const plan = planRegionImport(
      { materials: [], units: start.units },
      { regions, open: [], mapping: freshMapping(defaultMapping(regions.map((r) => ({ name: r.layer, suggestedMaterialId: null })))), factor: 1, openMode: 'discard', baseY: null },
    );
    const store = createEditorStore(start);
    applyRegionImport(store, plan, 'replace', { fileName: 'regiones.csv' });
    const doc = store.getState().doc;
    expect(doc.meta.title).toBe('regiones');
    expect(doc.materials.map((m) => m.name).sort()).toEqual(['SUELO_1', 'arcilla']);
    expect(doc.water ?? null).toBeNull();
    expect(doc.analysis).toEqual(emptyModel().analysis);
    expect(errorsOf(doc)).toEqual([]);
  });
});

describe('los diálogos con el modelo de arranque: el plan no usa los materiales del ejemplo', () => {
  const doc = loadCaseDoc('V047a');
  const pristine: ImportBase = { regionCount: doc.regions.length, title: 'ACADS 1(a)', pristineStart: true };
  const edited: ImportBase = { ...pristine, pristineStart: false };
  const dxfHtml = (base?: ImportBase, text = fixture('terraplen.dxf'), fileName = 'terraplen.dxf'): string =>
    renderToStaticMarkup(
      createElement(DxfImportDialog, {
        fileName,
        result: parseDxf(text, { materials: doc.materials.map((m) => ({ id: m.id, name: m.name })) }),
        materials: doc.materials,
        units: doc.units,
        base,
        onCancel: () => {},
        onApply: () => {},
      }),
    );
  const csvHtml = (base?: ImportBase): string =>
    renderToStaticMarkup(
      createElement(CsvImportDialog, {
        fileName: 'regiones.csv',
        result: parseCsv(regionsCsv),
        materials: doc.materials,
        units: doc.units,
        base,
        onCancel: () => {},
        onApplyRegions: () => {},
        onApplyPiezo: () => {},
      }),
    );

  it('DXF: con el arranque, «Reemplazar: crea un modelo nuevo con este archivo» y el título del modelo nuevo', () => {
    const html = dxfHtml(pristine);
    expect(html).toContain('Reemplazar: crea un modelo nuevo con este archivo');
    expect(html).not.toContain('Reemplazar las regiones actuales');
    expect(html).toContain('Se creará un modelo nuevo titulado «terraplen»');
    expect(html).toContain('Se importarán <strong>3</strong> región(es) y se crearán <strong>3</strong> material(es)');
  });

  it('DXF: con un documento con cambios, «Reemplazar las regiones actuales (se conservan materiales, agua y análisis)» y ningún modelo nuevo', () => {
    const html = dxfHtml(edited);
    expect(html).toContain('Reemplazar las regiones actuales (se conservan materiales, agua y análisis)');
    expect(html).not.toContain('crea un modelo nuevo');
    expect(html).not.toContain('Se creará un modelo nuevo');
  });

  it('CSV: la misma regla', () => {
    expect(csvHtml(pristine)).toContain('Reemplazar: crea un modelo nuevo con este archivo');
    expect(csvHtml(pristine)).toContain('Se creará un modelo nuevo titulado «regiones»');
    expect(csvHtml(edited)).toContain('Reemplazar las regiones actuales (se conservan materiales, agua y análisis)');
    expect(csvHtml(edited)).not.toContain('Se creará un modelo nuevo');
  });

  it('«Agregar» con el arranque (el usuario lo elige) no crea un modelo nuevo: se calcula con los materiales del ejemplo', () => {
    // Con `mode = add` no hay modelo nuevo aunque el arranque esté intacto.
    expect(isFreshImport('add', pristine)).toBe(false);
  });
});

describe('la base de una polilínea abierta se explica (CM-W2)', () => {
  const result = parseDxf(fixture('terraplen.dxf'), { materials: [] });
  const open = openPolylines(result).map((e) => ({ layer: e.layer, points: e.points }));

  it('terraplen.dxf: la cota mínima del dibujo, la base sugerida y el área de la región cerrada (TERRENO, 20 m²)', () => {
    const minY = openMinY(open, 'm', 'SI');
    expect(minY).toBe(25);
    expect(suggestBaseText(open, 'm', 'SI')).toBe('24');
    const areas = openClosureAreas(open, { TERRENO: NEW_MATERIAL }, 1, 24);
    expect(areas).toHaveLength(1);
    expect(areas[0]!.layer).toBe('TERRENO');
    expect(areas[0]!.area).toBeCloseTo(20, 9);
    expect(openBaseHelp({ minY, baseY: 24, areas, units: 'SI' })).toEqual([
      'La cota sugerida es la cota mínima del dibujo (25 m) menos 1 m, redondeada a 0,1: la base queda bajo el terreno.',
      'Cerradas con y = 24 m, cada polilínea abierta forma una región (TERRENO: 20 m²).',
    ]);
  });

  it('el área sale del mismo cierre que crea la región (closeWithBase)', () => {
    const pts = open[0]!.points;
    expect(polygonArea(closeWithBase(pts, 24)!)).toBeCloseTo(openClosureAreas(open, { TERRENO: NEW_MATERIAL }, 1, 24)[0]!.area, 9);
    expect(polygonArea([[0, 0], [4, 0], [4, 3], [0, 3]])).toBe(12);
    expect(polygonArea([[0, 0], [0, 3], [4, 3], [4, 0]])).toBe(12);
  });

  it('una capa omitida no da región; sin base válida se pide el valor; en pies, ft²', () => {
    expect(openClosureAreas(open, { TERRENO: '' }, 1, 24)).toEqual([]);
    expect(openBaseHelp({ minY: 25, baseY: null, areas: [], units: 'SI' })[1]).toBe('Escriba la cota y de la base para ver el área de las regiones que se crearán.');
    expect(openBaseHelp({ minY: 25, baseY: 24, areas: [], units: 'SI' })[1]).toMatch(/no se crea ninguna región/);
    expect(areaText(12.5, 'imperial')).toBe('12,5 ft²');
    expect(areaText(20, 'SI')).toBe('20 m²');
    expect(openMinY(open, 'cm', 'SI')).toBeCloseTo(0.25, 12);
  });

  it('el diálogo lo muestra junto a la cota y la describe con aria-describedby', () => {
    const doc = loadCaseDoc('V047a');
    const html = renderToStaticMarkup(
      createElement(DxfImportDialog, {
        fileName: 'terraplen.dxf',
        result: parseDxf(fixture('terraplen.dxf'), { materials: doc.materials.map((m) => ({ id: m.id, name: m.name })) }),
        materials: doc.materials,
        units: doc.units,
        base: { regionCount: 2, title: 'ACADS 1(a)', pristineStart: true },
        onCancel: () => {},
        onApply: () => {},
      }),
    );
    expect(html).toContain('data-testid="open-base-help"');
    expect(html).toContain('cota mínima del dibujo (25 m) menos 1 m');
    expect(html).toContain('TERRENO: 20 m²');
    const id = /<p id="([^"]+)" class="small muted" data-testid="open-base-help">/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`aria-describedby="${id}"`);
  });
});
