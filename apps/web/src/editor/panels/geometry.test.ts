import { describe, expect, it } from 'vitest';
import type { Point } from '../../engine/types';
import { makeDoc } from '../canvas/fakeStore';
import { applyCommand, createEditorStore } from '../state';
import { createConfirmQueue, type ConfirmOptions } from '../../ui/confirmQueue';
import type { ModelDoc } from '../types';
import {
  GRID_CHOICES,
  PAGE_SIZE,
  PAGE_THRESHOLD,
  coordText,
  nextVertexIndex,
  pageCount,
  pageOf,
  pageRange,
  polygonArea,
  regionIssues,
  regionRemoveCommand,
  regionRemoveConfirm,
  removeRegionConfirmed,
  regionSummary,
  vertexCoordEdit,
  vertexInsertCommand,
  vertexRemoveCommand,
} from './geometry';

const doc = (): ModelDoc => makeDoc();

describe('regionSummary', () => {
  it('describe cada región con su material, vértices y área', () => {
    const s = regionSummary(doc());
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ index: 0, materialId: 'm2', materialName: 'Roca', vertexCount: 4 });
    expect(s[0]?.area).toBeCloseTo(300, 9); // 60 × 5
    expect(s[1]).toMatchObject({ index: 1, materialId: 'm1', materialName: 'Arcilla', vertexCount: 6 });
  });
  it('un material que no existe se nombra por su id', () => {
    const d = doc();
    d.regions[0] = { material: 'fantasma', polygon: d.regions[0]!.polygon };
    expect(regionSummary(d)[0]).toMatchObject({ materialId: 'fantasma', materialName: 'fantasma', known: false });
  });
});

describe('polygonArea', () => {
  it('es positiva sin importar el sentido del contorno', () => {
    const sq: Point[] = [[0, 0], [4, 0], [4, 3], [0, 3]];
    expect(polygonArea(sq)).toBe(12);
    expect(polygonArea([...sq].reverse())).toBe(12);
  });
});

describe('coordText', () => {
  it('usa coma decimal y sin ruido de coma flotante', () => {
    expect(coordText(12.5)).toBe('12,5');
    expect(coordText(0.1 + 0.2)).toBe('0,3');
    expect(coordText(-4)).toBe('-4');
  });
});

describe('edición de una coordenada (tabla de vértices)', () => {
  it('un número válido genera un vertex/move con la otra coordenada intacta', () => {
    const r = vertexCoordEdit(doc(), { regionIndex: 1, vertexIndex: 4 }, 'x', '25,5');
    expect(r).toEqual({ ok: true, commands: [{ type: 'vertex/move', regionIndex: 1, vertexIndex: 4, to: [25.5, 20] }] });
  });
  it('sin cambio no genera comandos', () => {
    expect(vertexCoordEdit(doc(), { regionIndex: 1, vertexIndex: 4 }, 'y', '20')).toEqual({ ok: true, commands: [] });
  });
  it('un texto que no es número se rechaza con un mensaje que nombra el vértice', () => {
    const r = vertexCoordEdit(doc(), { regionIndex: 1, vertexIndex: 4 }, 'x', 'abc');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('Región 2, vértice 5: la coordenada x debe ser un número. Corrija el valor (ej. 12,5).');
  });
  it('vacío también es un error', () => {
    const r = vertexCoordEdit(doc(), { regionIndex: 0, vertexIndex: 0 }, 'y', '  ');
    expect(r.ok).toBe(false);
  });
  it('un vértice compartido con otra región se mueve junto con él (como en el lienzo)', () => {
    // (0,5) es vértice de la región 0 (índice 3) y de la región 1 (índice 0)
    const r = vertexCoordEdit(doc(), { regionIndex: 0, vertexIndex: 3 }, 'y', '6');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.commands).toEqual([
        { type: 'vertex/move', regionIndex: 0, vertexIndex: 3, to: [0, 6] },
        { type: 'vertex/move', regionIndex: 1, vertexIndex: 0, to: [0, 6] },
      ]);
    }
  });
  it('un vértice que no existe no genera nada', () => {
    const r = vertexCoordEdit(doc(), { regionIndex: 9, vertexIndex: 0 }, 'x', '1');
    expect(r.ok).toBe(false);
  });
});

describe('agregar y eliminar vértices', () => {
  it('«Agregar después» inserta en el punto medio de la arista siguiente', () => {
    const c = vertexInsertCommand(doc(), 0, 1);
    expect(c).toEqual({ type: 'vertex/insert', regionIndex: 0, afterIndex: 1, at: [60, 2.5] });
  });
  it('tras el último vértice usa la arista de cierre', () => {
    const c = vertexInsertCommand(doc(), 0, 3);
    expect(c).toEqual({ type: 'vertex/insert', regionIndex: 0, afterIndex: 3, at: [0, 2.5] });
  });
  it('no hay inserción en una región o vértice inexistente', () => {
    expect(vertexInsertCommand(doc(), 5, 0)).toBeNull();
    expect(vertexInsertCommand(doc(), 0, 9)).toBeNull();
  });
  it('eliminar respeta el mínimo de 3 vértices', () => {
    const d = doc();
    d.regions[0] = { material: 'm2', polygon: [[0, 0], [10, 0], [10, 10]] };
    expect(vertexRemoveCommand(d, 0, 1)).toBeNull();
    expect(vertexRemoveCommand(doc(), 0, 1)).toEqual({ type: 'vertex/remove', regionIndex: 0, vertexIndex: 1 });
  });
  it('tras eliminar, el foco pasa al vértice anterior (o al último si se quitó el primero)', () => {
    expect(nextVertexIndex(4, 3)).toBe(2);
    expect(nextVertexIndex(4, 0)).toBe(2);
    expect(nextVertexIndex(6, 5)).toBe(4);
  });
  it('los comandos son aplicables por el reductor', () => {
    const c = vertexInsertCommand(doc(), 0, 1)!;
    expect(applyCommand(doc(), c)?.regions[0]?.polygon).toHaveLength(5);
  });
});

describe('eliminar una región', () => {
  it('genera region/remove si existe', () => {
    expect(regionRemoveCommand(doc(), 1)).toEqual({ type: 'region/remove', regionIndex: 1 });
    expect(regionRemoveCommand(doc(), 2)).toBeNull();
  });
});

describe('validación en línea de la región', () => {
  it('una región válida no tiene incidencias', () => {
    expect(regionIssues(doc(), 0)).toEqual([]);
  });
  it('un contorno que se cruza se informa con el mensaje de validateLocal', () => {
    const d = doc();
    d.regions[1] = { material: 'm1', polygon: [[0, 5], [60, 5], [0, 20], [60, 20]] };
    const issues = regionIssues(d, 1);
    expect(issues.some((i) => i.code === 'editor.self_intersection')).toBe(true);
    expect(issues[0]?.text).toMatch(/se cruza/);
  });
  it('no mezcla incidencias de otras regiones', () => {
    const d = doc();
    d.regions[1] = { material: 'm1', polygon: [[0, 5], [60, 5], [0, 20], [60, 20]] };
    expect(regionIssues(d, 0)).toEqual([]);
  });
});

describe('paginación de la tabla (cientos de vértices)', () => {
  it('hasta 200 filas no se pagina', () => {
    expect(PAGE_THRESHOLD).toBe(200);
    expect(pageCount(200)).toBe(1);
    expect(pageRange(200, 0)).toEqual({ start: 0, end: 200, page: 0, pages: 1 });
  });
  it('desde 201 filas se pagina de a PAGE_SIZE', () => {
    expect(pageCount(201)).toBe(Math.ceil(201 / PAGE_SIZE));
    expect(pageRange(350, 1)).toEqual({ start: PAGE_SIZE, end: 2 * PAGE_SIZE, page: 1, pages: 4 });
    expect(pageRange(350, 3)).toEqual({ start: 3 * PAGE_SIZE, end: 350, page: 3, pages: 4 });
  });
  it('una página fuera de rango se acota', () => {
    expect(pageRange(350, 99).page).toBe(3);
    expect(pageRange(350, -2).page).toBe(0);
  });
  it('el vértice seleccionado en el lienzo lleva a su página', () => {
    expect(pageOf(350, 0)).toBe(0);
    expect(pageOf(350, 250)).toBe(Math.floor(250 / PAGE_SIZE));
    expect(pageOf(100, 99)).toBe(0);
  });
});

describe('rejilla de ajuste', () => {
  it('ofrece «Sin rejilla» y pasos en metros', () => {
    expect(GRID_CHOICES[0]).toBe(null);
    expect(GRID_CHOICES).toContain(1);
  });
});

describe('regionRemoveConfirm', () => {
  it('nombra la región, su material y sus vértices, avisa que se deshace y es de tono «danger»', () => {
    const c = regionRemoveConfirm({ index: 1, materialName: 'Arcilla', vertexCount: 6 });
    expect(c.title).toBe('Eliminar la región 2');
    expect(c.message).toContain('región 2');
    expect(c.message).toContain('Arcilla');
    expect(c.message).toContain('6 vértices');
    expect(c.message).toContain('Ctrl+Z');
    expect(c.tone).toBe('danger');
    expect(c.confirmLabel).toBe('Eliminar región');
    expect(c.cancelLabel).toBeTruthy();
  });
  it('singular de vértice', () => {
    expect(regionRemoveConfirm({ index: 0, materialName: 'm', vertexCount: 1 }).message).toContain('1 vértice)');
  });
});

describe('A-03: eliminar una región por identidad, no por índice', () => {
  const threeRegions = () => {
    const d = doc();
    d.regions = [
      { material: 'm1', polygon: [[0, 0], [10, 0], [10, 10], [0, 10]] },
      { material: 'm2', polygon: [[10, 0], [20, 0], [20, 10], [10, 10]] },
      { material: 'm1', polygon: [[20, 0], [30, 0], [30, 10], [20, 10]] },
    ];
    return d;
  };

  it('dos confirmaciones en cola borran exactamente las dos regiones pedidas', async () => {
    const store = createEditorStore(threeRegions(), null);
    const [first, second, third] = store.getState().doc.regions;
    const queue = createConfirmQueue();
    const confirm = (o: ConfirmOptions) => queue.request(o);
    // Dos solicitudes antes de responder a ninguna (doble clic): la 1.ª pide la región 1 y la 2.ª, la región 2.
    const p1 = removeRegionConfirmed(store, first!, confirm);
    const p2 = removeRegionConfirmed(store, second!, confirm);
    expect(queue.size()).toBe(2);
    queue.resolve(true); // se confirma la 1.ª: los índices del resto cambian
    await p1;
    queue.resolve(true);
    expect(await p1).toBe('removed');
    expect(await p2).toBe('removed');
    expect(store.getState().doc.regions).toEqual([third]);
  });

  it('el mismo clic repetido: la 2.ª solicitud de la misma región no borra otra (antes borraba la región vecina)', async () => {
    const store = createEditorStore(threeRegions(), null);
    const [first, second, third] = store.getState().doc.regions;
    const queue = createConfirmQueue();
    const confirm = (o: ConfirmOptions) => queue.request(o);
    const p1 = removeRegionConfirmed(store, first!, confirm);
    const p2 = removeRegionConfirmed(store, first!, confirm);
    queue.resolve(true);
    queue.resolve(true);
    expect(await p1).toBe('removed');
    expect(await p2).toBe('missing');
    expect(store.getState().doc.regions).toEqual([second, third]);
  });

  it('si la región desaparece mientras se confirma (deshacer, importar), no borra nada', async () => {
    const store = createEditorStore(threeRegions(), null);
    const [first] = store.getState().doc.regions;
    const queue = createConfirmQueue();
    const p = removeRegionConfirmed(store, first!, (o) => queue.request(o));
    store.dispatch({ type: 'region/remove', regionIndex: 0 });
    queue.resolve(true);
    expect(await p).toBe('missing');
    expect(store.getState().doc.regions).toHaveLength(2);
  });

  it('cancelar no borra y una región que ya no existe ni pregunta', async () => {
    const store = createEditorStore(threeRegions(), null);
    const [first] = store.getState().doc.regions;
    expect(await removeRegionConfirmed(store, first!, async () => false)).toBe('cancelled');
    expect(store.getState().doc.regions).toHaveLength(3);
    let asked = 0;
    const ghost = { material: 'm1', polygon: [[0, 0], [1, 0], [1, 1]] as [number, number][] };
    expect(await removeRegionConfirmed(store, ghost, async () => (asked += 1, true))).toBe('missing');
    expect(asked).toBe(0);
  });

  it('el diálogo nombra la región por su número y material en el momento de pedirla', async () => {
    const store = createEditorStore(threeRegions(), null);
    const asked: ConfirmOptions[] = [];
    await removeRegionConfirmed(store, store.getState().doc.regions[1]!, async (o) => (asked.push(o), false));
    expect(asked[0]?.title).toBe('Eliminar la región 2');
  });
});
