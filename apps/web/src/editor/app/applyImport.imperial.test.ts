// R9-09: crear o importar una piezométrica en un modelo imperial sin γw fija γw = 62,4 pcf en el mismo paso deshacible; defaultLoad escala
// a imperial. Sin esto el campo γw mostraba «62,4» como marcador, vacío en realidad, y «Comprobar» quedaba bloqueado (R8).
import { describe, expect, it } from 'vitest';
import { defaultPiezo, defaultLoad, piezoCreateCommands } from '../panels/forms';
import { baseDoc } from '../state/testFixtures';
import { createEditorStore } from '../state/store';
import { validateLocal } from '../state/validateLocal';
import type { ModelDoc } from '../types';
import { applyPiezoImport } from './applyImport';

const dry = (units: string): ModelDoc => ({ ...baseDoc(), units, water: undefined });
const gate = (doc: ModelDoc): string[] => validateLocal(doc).filter((i) => i.code === 'editor.water_unit_weight').map((i) => i.text);

describe('R9-09: γw al crear o importar una piezométrica', () => {
  it('importar en imperial sin γw: fija 62,4, no bloquea y un solo Ctrl+Z lo deshace todo', () => {
    const store = createEditorStore(dry('imperial'), null);
    applyPiezoImport(store, [[0, 5], [20, 6]]);
    const doc = store.getState().doc;
    expect(doc.water).toEqual({ piezometric_line: [[0, 5], [20, 6]], unit_weight: 62.4 });
    expect(gate(doc)).toEqual([]);
    expect(store.getState().history.past).toHaveLength(1);
    store.undo();
    expect(store.getState().doc.water).toBeUndefined();
  });
  it('`Imperial` con mayúscula también; un γw ya indicado no se toca; en SI no se escribe γw', () => {
    const a = createEditorStore(dry('Imperial'), null);
    applyPiezoImport(a, [[0, 5], [20, 6]]);
    expect(a.getState().doc.water?.unit_weight).toBe(62.4);
    const withGw: ModelDoc = { ...dry('imperial'), water: { unit_weight: 64 } };
    const b = createEditorStore(withGw, null);
    applyPiezoImport(b, [[0, 5], [20, 6]]);
    expect(b.getState().doc.water?.unit_weight).toBe(64);
    const c = createEditorStore(dry('SI'), null);
    applyPiezoImport(c, [[0, 5], [20, 6]]);
    expect(c.getState().doc.water).toEqual({ piezometric_line: [[0, 5], [20, 6]] });
  });
  it('«Crear piezométrica» (piezoCreateCommands): los mismos comandos con la piezométrica por defecto', () => {
    const doc = dry('imperial');
    const pts = defaultPiezo(doc)!;
    expect(pts).not.toBeNull();
    expect(piezoCreateCommands(doc, pts).map((c) => c.type)).toEqual(['piezo/set', 'water/setUnitWeight']);
    expect(piezoCreateCommands(dry('SI'), pts).map((c) => c.type)).toEqual(['piezo/set']);
  });
});

describe('R9-09: defaultLoad por sistema de unidades', () => {
  it('SI conserva 10 kPa y 10 kN/m', () => {
    expect(defaultLoad('udl', dry('SI'))).toMatchObject({ q: 10 });
    expect(defaultLoad('line', dry('SI'))).toMatchObject({ p: 10, angle: 0 });
  });
  it('imperial usa 200 psf y 700 lbf/ft (también con `Imperial`)', () => {
    for (const units of ['imperial', 'Imperial']) {
      expect(defaultLoad('udl', dry(units))).toMatchObject({ q: 200 });
      expect(defaultLoad('line', dry(units))).toMatchObject({ p: 700 });
    }
  });
});
