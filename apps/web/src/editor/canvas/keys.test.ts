import { describe, expect, it } from 'vitest';
import { keyActions, type KeyInput } from './keys';
import { fitToDoc } from './viewportOps';
import { screenToWorld } from '../../geometry/viewport';
import { VP } from './fakeStore';
import { makeDoc, makeState } from './fakeStore';
import type { Selection } from '../types';

const key = (k: string, extra: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...extra,
});
const ctx = (selection: Selection, gridStep: number | null = null, doc = makeDoc()) =>
  makeState(doc, { selection, snap: { vertex: true, axis: true, gridStep, radiusPx: 10 } });

describe('teclado', () => {
  it('Ctrl+Z deshace; Ctrl+Mayús+Z y Ctrl+Y rehacen (también con Meta)', () => {
    const c = ctx({ kind: 'none' });
    expect(keyActions(c, key('z', { ctrlKey: true }))).toEqual({ handled: true, actions: [{ type: 'history/undo' }] });
    expect(keyActions(c, key('Z', { ctrlKey: true, shiftKey: true })).actions).toEqual([{ type: 'history/redo' }]);
    expect(keyActions(c, key('y', { ctrlKey: true })).actions).toEqual([{ type: 'history/redo' }]);
    expect(keyActions(c, key('z', { metaKey: true })).actions).toEqual([{ type: 'history/undo' }]);
  });

  it('Supr y Retroceso quitan el vértice seleccionado; con 3 vértices no hacen nada', () => {
    const sel: Selection = { kind: 'vertex', regionIndex: 1, vertexIndex: 4 };
    for (const k of ['Delete', 'Backspace']) {
      expect(keyActions(ctx(sel), key(k))).toEqual({
        handled: true,
        actions: [
          { type: 'vertex/remove', regionIndex: 1, vertexIndex: 4 },
          { type: 'ui/select', selection: { kind: 'vertex', regionIndex: 1, vertexIndex: 3 } },
        ],
        focus: { kind: 'vertex', regionIndex: 1, vertexIndex: 3 },
        announce: 'Vértice eliminado. Foco en el vértice 4 de la región 2: x 40,0 m, y 10,0 m',
      });
    }
    const tri = makeDoc();
    tri.regions[0].polygon = [[0, 0], [60, 0], [60, 5]];
    const refused = keyActions(ctx({ kind: 'vertex', regionIndex: 0, vertexIndex: 0 }, null, tri), key('Delete'));
    expect(refused).toMatchObject({ handled: true, actions: [], announce: 'No se puede eliminar: la región necesita al menos 3 vértices' });
  });

  it('Supr quita un punto de la piezométrica (mínimo 2) y se ignora sin selección', () => {
    expect(keyActions(ctx({ kind: 'piezo_point', index: 1 }), key('Delete')).actions).toEqual([
      { type: 'piezo/set', points: [[0, 8], [60, 6]] },
      { type: 'ui/select', selection: { kind: 'piezo_point', index: 0 } },
    ]);
    expect(keyActions(ctx({ kind: 'none' }), key('Delete')).handled).toBe(false);
  });

  it('las flechas mueven un paso de rejilla; Mayús = ×10; arriba es +y', () => {
    const sel: Selection = { kind: 'vertex', regionIndex: 1, vertexIndex: 4 }; // (20,20), sin vértices coincidentes
    expect(keyActions(ctx(sel, 0.5), key('ArrowRight')).actions).toEqual([
      { type: 'vertex/move', regionIndex: 1, vertexIndex: 4, to: [20.5, 20] },
    ]);
    expect(keyActions(ctx(sel, 0.5), key('ArrowUp', { shiftKey: true })).actions).toEqual([
      { type: 'vertex/move', regionIndex: 1, vertexIndex: 4, to: [20, 25] },
    ]);
    expect(keyActions(ctx(sel, 0.5), key('ArrowDown')).actions[0]).toMatchObject({ to: [20, 19.5] });
    // sin rejilla: 0,1 m, sin ruido de coma flotante
    expect(keyActions(ctx(sel, null), key('ArrowLeft')).actions[0]).toMatchObject({ to: [19.9, 20] });
  });

  it('un vértice compartido se mueve con sus coincidentes dentro de un solo gesto', () => {
    const r = keyActions(ctx({ kind: 'vertex', regionIndex: 0, vertexIndex: 3 }, 1), key('ArrowRight'));
    expect(r.actions).toEqual([
      { type: 'gesture/begin', label: 'Mover vértice' },
      { type: 'vertex/move', regionIndex: 0, vertexIndex: 3, to: [1, 5] },
      { type: 'vertex/move', regionIndex: 1, vertexIndex: 0, to: [1, 5] },
      { type: 'gesture/end' },
    ]);
  });

  it('flechas sobre un punto de la piezométrica y sobre el círculo', () => {
    expect(keyActions(ctx({ kind: 'piezo_point', index: 1 }, 1), key('ArrowUp')).actions).toEqual([
      { type: 'piezo/set', points: [[0, 8], [30, 9], [60, 6]] },
    ]);
    expect(keyActions(ctx({ kind: 'surface_circle' }, 1), key('ArrowLeft', { shiftKey: true })).actions).toEqual([
      { type: 'surface/set', surface: { type: 'circle', xc: 20, yc: 30, r: 25 } },
    ]);
  });

  it('sin selección las flechas desplazan la vista (ya no se consumen en vano); Escape deselecciona; en pleno gesto no se hace nada', () => {
    expect(keyActions(ctx({ kind: 'none' }), key('ArrowLeft')).handled).toBe(true);
    expect(keyActions(ctx({ kind: 'region', regionIndex: 0 }), key('Escape')).actions).toEqual([
      { type: 'ui/select', selection: { kind: 'none' } },
    ]);
    expect(keyActions(ctx({ kind: 'vertex', regionIndex: 0, vertexIndex: 0 }), key('ArrowLeft'), true)).toEqual({ handled: false, actions: [] });
    expect(keyActions(ctx({ kind: 'none' }), key('z', { ctrlKey: true }), true).handled).toBe(false);
  });
});


const sel = (selection: Selection, gridStep: number | null = null, doc = makeDoc()) => ctx(selection, gridStep, doc);

describe('R7-04 · UX-02: insertar vértices con el teclado', () => {
  it('Insert inserta en el punto medio de la arista siguiente y selecciona el nuevo vértice', () => {
    const r = keyActions(sel({ kind: 'vertex', regionIndex: 1, vertexIndex: 4 }), key('Insert'));
    expect(r.handled).toBe(true);
    expect(r.actions).toEqual([
      { type: 'vertex/insert', regionIndex: 1, afterIndex: 4, at: [10, 20] },
      { type: 'ui/select', selection: { kind: 'vertex', regionIndex: 1, vertexIndex: 5 } },
    ]);
    expect(r.focus).toEqual({ kind: 'vertex', regionIndex: 1, vertexIndex: 5 });
    expect(r.announce).toBe('Vértice insertado. Vértice 6 de la región 2: x 10,0 m, y 20,0 m');
  });

  it('el último vértice usa la arista de cierre (vuelve al primero)', () => {
    const r = keyActions(sel({ kind: 'vertex', regionIndex: 1, vertexIndex: 5 }), key('Insert'));
    expect(r.actions[0]).toEqual({ type: 'vertex/insert', regionIndex: 1, afterIndex: 5, at: [0, 12.5] });
    expect(r.focus).toEqual({ kind: 'vertex', regionIndex: 1, vertexIndex: 6 });
  });

  it('«i» es equivalente a Insert (portátiles sin tecla Insert); sin vértice seleccionado no se consume', () => {
    expect(keyActions(sel({ kind: 'vertex', regionIndex: 0, vertexIndex: 0 }), key('i')).actions[0]).toMatchObject({ type: 'vertex/insert' });
    expect(keyActions(sel({ kind: 'none' }), key('Insert')).handled).toBe(false);
    expect(keyActions(sel({ kind: 'piezo_point', index: 0 }), key('Insert')).handled).toBe(false);
  });

  it('el vértice insertado en unidades imperiales se anuncia en ft', () => {
    const r = keyActions(sel({ kind: 'vertex', regionIndex: 1, vertexIndex: 4 }), key('Insert'), false, { units: 'imperial' });
    expect(r.announce).toBe('Vértice insertado. Vértice 6 de la región 2: x 10,0 ft, y 20,0 ft');
  });
});

describe('R7-04: tras eliminar, el foco pasa al vecino', () => {
  it('eliminar el primer vértice deja el foco en el último del polígono resultante', () => {
    const r = keyActions(sel({ kind: 'vertex', regionIndex: 1, vertexIndex: 0 }), key('Delete'));
    expect(r.actions).toEqual([
      { type: 'vertex/remove', regionIndex: 1, vertexIndex: 0 },
      { type: 'ui/select', selection: { kind: 'vertex', regionIndex: 1, vertexIndex: 4 } },
    ]);
    expect(r.focus).toEqual({ kind: 'vertex', regionIndex: 1, vertexIndex: 4 });
  });

  it('eliminar un punto de la piezométrica deja el foco en el anterior; el primero, en el nuevo primero', () => {
    expect(keyActions(sel({ kind: 'piezo_point', index: 2 }), key('Delete')).focus).toEqual({ kind: 'piezo_point', index: 1 });
    expect(keyActions(sel({ kind: 'piezo_point', index: 0 }), key('Backspace')).focus).toEqual({ kind: 'piezo_point', index: 0 });
  });

  it('con solo 2 puntos en la piezométrica no elimina y lo anuncia', () => {
    const doc = makeDoc();
    doc.water = { unit_weight: 9.81, piezometric_line: [[0, 8], [60, 6]] };
    const r = keyActions(sel({ kind: 'piezo_point', index: 0 }, null, doc), key('Delete'));
    expect(r.actions).toEqual([]);
    expect(r.announce).toBe('No se puede eliminar: la piezométrica necesita al menos 2 puntos');
  });
});

describe('R7-04: el tirador del radio cambia el radio; el del centro lo mueve', () => {
  it('flechas derecha/arriba agrandan y izquierda/abajo reducen el radio (paso de rejilla; Mayús ×10)', () => {
    const c = sel({ kind: 'surface_circle' }, 1);
    const opt = { circlePart: 'radius' as const };
    expect(keyActions(c, key('ArrowRight'), false, opt).actions).toEqual([{ type: 'surface/set', surface: { type: 'circle', xc: 30, yc: 30, r: 26 } }]);
    expect(keyActions(c, key('ArrowUp'), false, opt).actions[0]).toMatchObject({ surface: { r: 26 } });
    expect(keyActions(c, key('ArrowLeft'), false, opt).actions[0]).toMatchObject({ surface: { r: 24 } });
    expect(keyActions(c, key('ArrowDown', { shiftKey: true }), false, opt).actions[0]).toMatchObject({ surface: { xc: 30, yc: 30, r: 15 } });
    expect(keyActions(c, key('ArrowRight'), false, opt).announce).toBe('Círculo de falla, radio: 26,0 m');
  });

  it('el radio nunca llega a cero ni es negativo', () => {
    const doc = makeDoc();
    doc.analysis.surface = { type: 'circle', xc: 30, yc: 30, r: 0.5 };
    const r = keyActions(sel({ kind: 'surface_circle' }, 1, doc), key('ArrowLeft'), false, { circlePart: 'radius' });
    const s = r.actions[0] as { surface: { r: number } };
    expect(s.surface.r).toBeGreaterThan(0);
  });

  it('con circlePart = center (o sin indicar) las flechas mueven el centro y el radio no cambia', () => {
    const c = sel({ kind: 'surface_circle' }, 1);
    for (const opt of [{ circlePart: 'center' as const }, {}]) {
      const r = keyActions(c, key('ArrowRight'), false, opt);
      expect(r.actions).toEqual([{ type: 'surface/set', surface: { type: 'circle', xc: 31, yc: 30, r: 25 } }]);
      expect(r.announce).toBe('Círculo de falla, centro: x 31,0 m, y 30,0 m');
    }
  });

  it('las flechas sobre un vértice anuncian la nueva posición con unidades', () => {
    const v: Selection = { kind: 'vertex', regionIndex: 1, vertexIndex: 4 };
    expect(keyActions(sel(v, 0.5), key('ArrowRight')).announce).toBe('Vértice 5 de la región 2: x 20,5 m, y 20,0 m');
    expect(keyActions(sel(v, 0.5), key('ArrowRight'), false, { units: 'imperial' }).announce).toBe('Vértice 5 de la región 2: x 20,5 ft, y 20,0 ft');
  });
});

describe('R7-04: recorrido de tiradores con [ ] y Tab dentro del lienzo', () => {
  const v00: Selection = { kind: 'vertex', regionIndex: 0, vertexIndex: 0 };
  it(']  y [ pasan al tirador siguiente y anterior (con vuelta) y piden mover el foco', () => {
    const next = keyActions(sel(v00), key(']'));
    expect(next.handled).toBe(true);
    expect(next.focus).toEqual({ kind: 'vertex', regionIndex: 0, vertexIndex: 1 });
    expect(next.actions).toContainEqual({ type: 'ui/select', selection: { kind: 'vertex', regionIndex: 0, vertexIndex: 1 } });
    const prev = keyActions(sel(v00), key('['));
    expect(prev.focus).toEqual({ kind: 'circle_radius' }); // vuelta al último
  });

  it('B-01: Tab y Mayús+Tab NO recorren los tiradores: entran y salen del lienzo (una sola parada de tabulación)', () => {
    const mid: Selection = { kind: 'vertex', regionIndex: 0, vertexIndex: 1 };
    for (const selection of [v00, mid, { kind: 'piezo_point', index: 0 } as Selection, { kind: 'surface_circle' } as Selection, { kind: 'none' } as Selection]) {
      for (const shiftKey of [false, true]) {
        const r = keyActions(sel(selection), key('Tab', { shiftKey }));
        expect(r.handled, `Tab con selección ${selection.kind}`).toBe(false);
        expect(r.actions).toEqual([]);
        expect(r.focus).toBeUndefined();
      }
    }
  });

  it('B-01: AvPág y RePág recorren los tiradores igual que ] y [ (con vuelta)', () => {
    const down = keyActions(sel(v00), key('PageDown'));
    expect(down.handled).toBe(true);
    expect(down.focus).toEqual({ kind: 'vertex', regionIndex: 0, vertexIndex: 1 });
    expect(down.actions).toContainEqual({ type: 'ui/select', selection: { kind: 'vertex', regionIndex: 0, vertexIndex: 1 } });
    expect(keyActions(sel(v00), key('PageUp')).focus).toEqual({ kind: 'circle_radius' }); // vuelta al último
    expect(keyActions(sel({ kind: 'surface_circle' }), key('PageDown'), false, { circlePart: 'radius' }).focus).toEqual({ kind: 'vertex', regionIndex: 0, vertexIndex: 0 });
    expect(keyActions(sel({ kind: 'none' }), key('PageDown')).focus).toEqual({ kind: 'vertex', regionIndex: 0, vertexIndex: 0 });
  });

  it('con una selección que no es tirador (región) ]/[ entran al primer/último tirador', () => {
    expect(keyActions(sel({ kind: 'region', regionIndex: 0 }), key(']')).focus).toEqual({ kind: 'vertex', regionIndex: 0, vertexIndex: 0 });
    expect(keyActions(sel({ kind: 'none' }), key('[')).focus).toEqual({ kind: 'circle_radius' });
  });

  it('el anuncio al saltar a otro tirador no se repite (el lector lo lee por el nombre del tirador)', () => {
    expect(keyActions(sel(v00), key(']')).announce).toBeUndefined();
  });
});

describe('R7-02: zoom y encuadre con + − 0', () => {
  it('+ y = acercan; − aleja; 0 encuadra el modelo; ninguna toca el documento', () => {
    const zin = keyActions(sel({ kind: 'none' }), key('+'));
    expect(zin.handled).toBe(true);
    expect(zin.actions).toHaveLength(1);
    const vp = (zin.actions[0] as { viewport: typeof VP }).viewport;
    expect(vp.scale).toBeCloseTo(VP.scale * 1.25, 9);
    // el centro del lienzo conserva su punto del mundo
    const w0 = screenToWorld(VP, 400, 300);
    const w1 = screenToWorld(vp, 400, 300);
    expect(w1[0]).toBeCloseTo(w0[0], 9);
    expect(keyActions(sel({ kind: 'none' }), key('=')).actions[0]).toMatchObject({ type: 'ui/viewport' });
    const out = (keyActions(sel({ kind: 'none' }), key('-')).actions[0] as { viewport: typeof VP }).viewport;
    expect(out.scale).toBeCloseTo(VP.scale / 1.25, 9);
    const fit = keyActions(sel({ kind: 'none' }), key('0'));
    expect(fit.actions).toEqual([{ type: 'ui/viewport', viewport: fitToDoc(makeDoc(), VP.width, VP.height) }]);
  });

  it('con un vértice seleccionado, + no inserta (insertar es Insert/i) y el zoom conserva ese vértice en pantalla', () => {
    const v: Selection = { kind: 'vertex', regionIndex: 0, vertexIndex: 1 }; // (60,0) → (620,300)
    const r = keyActions(sel(v), key('+'));
    expect(r.actions).toHaveLength(1);
    expect(r.actions[0]).toMatchObject({ type: 'ui/viewport' });
    const vp = (r.actions[0] as { viewport: typeof VP }).viewport;
    expect(vp.tx + vp.scale * 60).toBeCloseTo(620, 9);
    expect(vp.ty - vp.scale * 0).toBeCloseTo(300, 9);
  });

  it('con Ctrl/Meta no se consumen (el zoom del navegador sigue funcionando)', () => {
    expect(keyActions(sel({ kind: 'none' }), key('+', { ctrlKey: true })).handled).toBe(false);
    expect(keyActions(sel({ kind: 'none' }), key('0', { ctrlKey: true })).handled).toBe(false);
  });

  it('sin selección las flechas desplazan la vista 40 px (Mayús ×4)', () => {
    const r = keyActions(sel({ kind: 'none' }), key('ArrowRight'));
    expect((r.actions[0] as { viewport: typeof VP }).viewport.tx).toBeCloseTo(VP.tx - 40, 9);
    const up = keyActions(sel({ kind: 'none' }), key('ArrowUp', { shiftKey: true }));
    expect((up.actions[0] as { viewport: typeof VP }).viewport.ty).toBeCloseTo(VP.ty + 160, 9);
  });
});
