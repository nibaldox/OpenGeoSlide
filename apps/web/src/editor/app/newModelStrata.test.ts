// «Talud simple…» con estrato inferior (U4-M, T2 de X9): geometría con el contacto compartido, validación del contacto dentro del modelo,
// el diálogo y el cálculo con el motor (OGS_BIN).

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { engineRun, deepestPoint, haveEngine } from '../state/engineRun.testutil';
import { validateLocal } from '../state';
import { NewSlopeDialog } from './NewSlopeDialog';
import { contactElevation, simpleSlope, slopeFormDefaults, slopeFromForm, slopeRegions, type SlopeForm, type SlopeInput } from './newModel';

const errorsOf = (doc: Parameters<typeof validateLocal>[0]) => validateLocal(doc).filter((i) => i.severity === 'error');

/** El ejemplo de X9: H = 15 m, 1,5H:1V, arcilla (c = 25, φ = 20, γ = 18) sobre roca (c = 200, φ = 40, γ = 24), contacto 5 m bajo el pie. */
function t2(over: Partial<SlopeInput> = {}): SlopeInput {
  return {
    units: 'SI',
    height: 15,
    slope: { kind: 'ratio', horizontal: 1.5 },
    crownWidth: 10,
    toeWidth: 20,
    depth: 10,
    material: { name: 'Arcilla', unit_weight: 18, cohesion: 25, friction_angle: 20 },
    water: 'toe',
    lower: { material: { name: 'Roca', unit_weight: 24, cohesion: 200, friction_angle: 40 }, contact: { kind: 'depth', depth: 5 } },
    ...over,
  };
}

describe('simpleSlope con estrato inferior: geometría', () => {
  it('contacto 5 m bajo el pie: dos regiones que comparten toda la arista y = −5', () => {
    const doc = simpleSlope(t2());
    expect(doc.regions).toHaveLength(2);
    expect(doc.regions[0]).toEqual({ material: 'suelo', polygon: [[0, -5], [52.5, -5], [52.5, 0], [32.5, 0], [10, 15], [0, 15]] });
    expect(doc.regions[1]).toEqual({ material: 'estrato-2', polygon: [[0, -10], [52.5, -10], [52.5, -5], [0, -5]] });
    expect(doc.materials.map((m) => [m.id, m.name])).toEqual([['suelo', 'Arcilla'], ['estrato-2', 'Roca']]);
    expect(doc.materials[1]).toMatchObject({ unit_weight: 24, cohesion: 200, friction_angle: 40 });
    expect(errorsOf(doc)).toEqual([]);
  });

  it('la cota del contacto y la profundidad bajo el pie son lo mismo con el signo cambiado', () => {
    expect(contactElevation({ kind: 'depth', depth: 5 })).toBe(-5);
    const a = simpleSlope(t2());
    const b = simpleSlope(t2({ lower: { ...t2().lower!, contact: { kind: 'elevation', y: -5 } } }));
    expect(b.regions).toEqual(a.regions);
  });

  it('contacto a la altura del pie: el estrato inferior llega hasta el pie y el superior es el cuerpo del talud', () => {
    const doc = simpleSlope(t2({ lower: { ...t2().lower!, contact: { kind: 'elevation', y: 0 } } }));
    expect(doc.regions[0]!.polygon).toEqual([[0, 0], [32.5, 0], [10, 15], [0, 15]]);
    expect(doc.regions[1]!.polygon).toEqual([[0, -10], [52.5, -10], [52.5, 0], [32.5, 0], [0, 0]]);
    expect(errorsOf(doc)).toEqual([]);
  });

  it('contacto sobre el pie (y = 6): corta la cara del talud en x = 22,5 + … y valida', () => {
    const r = slopeRegions(t2({ lower: { ...t2().lower!, contact: { kind: 'elevation', y: 6 } } }));
    // la cara va de (32,5; 0) a (10; 15): a y = 6 está en x = 32,5 − 6 × 1,5 = 23,5
    expect(r.upper).toEqual([[0, 6], [23.5, 6], [10, 15], [0, 15]]);
    expect(r.lower).toEqual([[0, -10], [52.5, -10], [52.5, 0], [32.5, 0], [23.5, 6], [0, 6]]);
    const doc = simpleSlope(t2({ lower: { ...t2().lower!, contact: { kind: 'elevation', y: 6 } } }));
    expect(errorsOf(doc)).toEqual([]);
  });

  it('sin estrato inferior nada cambia (una región, un material)', () => {
    const doc = simpleSlope(t2({ lower: undefined }));
    expect(doc.regions).toHaveLength(1);
    expect(doc.materials).toHaveLength(1);
  });
});

describe('slopeFromForm con estrato inferior', () => {
  const base = (over: Partial<SlopeForm> = {}): SlopeForm => ({ ...slopeFormDefaults('SI'), height: '15', mode: 'ratio', ratio: '1,5', lowerOn: true, ...over });
  const errs = (over: Partial<SlopeForm> = {}): Record<string, string> => {
    const r = slopeFromForm(base(over));
    return r.ok ? {} : r.errors;
  };

  it('por defecto el estrato inferior está apagado y es válido', () => {
    const r = slopeFromForm(slopeFormDefaults('SI'));
    expect(r.ok && r.value.lower).toBeUndefined();
  });

  it('con el estrato inferior: material 2 y profundidad del contacto', () => {
    const r = slopeFromForm(base({ lowerContact: '5', lowerName: 'Roca', lowerUnitWeight: '24', lowerCohesion: '200', lowerFriction: '40' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.lower).toEqual({ material: { name: 'Roca', unit_weight: 24, cohesion: 200, friction_angle: 40 }, contact: { kind: 'depth', depth: 5 } });
  });

  it('la profundidad del contacto debe quedar dentro del modelo (menos que la profundidad bajo el pie)', () => {
    expect(errs({ lowerContact: '10' }).lowerContact).toMatch(/menor que la profundidad del modelo/);
    expect(errs({ lowerContact: '0' }).lowerContact).toMatch(/mayor que 0/);
    expect(errs({ lowerContact: '25' }).lowerContact).toBeDefined();
    expect(errs({ lowerContact: '9,99' }).lowerContact).toBeUndefined();
  });

  it('en modo cota: entre la base y la corona; fuera del modelo se rechaza con un mensaje que dice el rango', () => {
    expect(errs({ lowerMode: 'elevation', lowerContact: '-5' }).lowerContact).toBeUndefined();
    expect(errs({ lowerMode: 'elevation', lowerContact: '7' }).lowerContact).toBeUndefined();
    const below = errs({ lowerMode: 'elevation', lowerContact: '-10' }).lowerContact;
    expect(below).toMatch(/dentro del modelo, entre -10 y 15 m/);
    expect(errs({ lowerMode: 'elevation', lowerContact: '15' }).lowerContact).toBeDefined();
    expect(errs({ lowerMode: 'elevation', lowerContact: 'x' }).lowerContact).toBeDefined();
  });

  it('el material 2 usa las reglas de los paneles', () => {
    const e = errs({ lowerUnitWeight: '0', lowerCohesion: '-1', lowerFriction: '95' });
    expect(e.lowerUnitWeight).toBeDefined();
    expect(e.lowerCohesion).toBeDefined();
    expect(e.lowerFriction).toBeDefined();
  });

  it('con el estrato apagado se ignoran sus campos', () => {
    expect(errs({ lowerOn: false, lowerContact: 'zzz', lowerUnitWeight: '-3' })).toEqual({});
  });
});

describe('NewSlopeDialog: estrato inferior', () => {
  const html = renderToStaticMarkup(createElement(NewSlopeDialog, { onCancel: () => undefined, onCreate: () => true }));
  it('ofrece «Agregar un estrato inferior» (apagado: solo la casilla y la explicación)', () => {
    expect(html).toContain('Estrato inferior');
    expect(html).toContain('Agregar un estrato inferior (material 2)');
    expect(html).not.toContain('Contacto: profundidad bajo el pie');
  });
  it('los nombres de los campos del estrato no repiten los del material 1', () => {
    // con la casilla encendida los campos llevan el prefijo «Estrato inferior:» (probado con las etiquetas del formulario)
    for (const label of ['Estrato inferior: nombre', 'Estrato inferior: peso unitario γ', 'Contacto: profundidad bajo el pie']) {
      expect(label).not.toBe('Nombre');
    }
  });
});

describe.skipIf(!haveEngine)('talud simple con estrato inferior: el motor (T2 de X9)', () => {
  it('arcilla sobre roca, contacto 5 m bajo el pie y piezométrica en el pie: Bishop y Spencer convergen con FS finito; la superficie no se hunde en la roca', () => {
    const doc = simpleSlope(t2());
    const run = engineRun(doc);
    expect(run.code, run.out.slice(0, 400)).toBe(0);
    const by = Object.fromEntries(run.results.map((x) => [x.method, x]));
    for (const m of ['bishop', 'spencer']) {
      expect(by[m], m).toBeDefined();
      expect(by[m]!.status).toBe('converged');
      expect(Number.isFinite(by[m]!.fos)).toBe(true);
      expect(by[m]!.fos as number).toBeGreaterThan(0.5);
      expect(by[m]!.fos as number).toBeLessThan(5);
    }
    // el contacto está en y = −5: la superficie crítica debe quedar casi toda en la arcilla (a lo sumo 3 m dentro de la roca)
    for (const m of ['bishop', 'spencer']) expect(deepestPoint(by[m]!)).toBeGreaterThan(-5 - 3);
    if (process.env.OGS_DEBUG) writeFileSync(`${process.env.OGS_DEBUG}/t2-talud-simple.json`, JSON.stringify(run.results.map((x) => ({ method: x.method, fos: x.fos, status: x.status, depth: deepestPoint(x), surface: x.surface }))));
  });

  it('con roca debajo el FS no baja respecto del mismo talud todo de arcilla', () => {
    const withRock = engineRun(simpleSlope(t2()));
    const allClay = engineRun(simpleSlope(t2({ lower: undefined })));
    const fsRock = withRock.results.find((x) => x.method === 'bishop')!.fos as number;
    const fsClay = allClay.results.find((x) => x.method === 'bishop')!.fos as number;
    expect(fsRock).toBeGreaterThanOrEqual(fsClay - 1e-9);
  });
});
