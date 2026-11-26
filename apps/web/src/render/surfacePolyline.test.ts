// F3-W1f: la vista Casos dibuja la superficie del informe sea círculo o polilínea ajustada, con sus dovelas.
import { describe, expect, it } from 'vitest';
import type { MethodReport, Model, Point } from '../engine/types';
import { fitViewport, worldToScreen } from '../geometry/viewport';
import { legendItems } from '../ui/legendItems';
import { defaultSectionPalette, type SectionPalette } from '../theme/sectionPalette';
import { drawSection } from './drawSection';
import { buildScene } from './scene';

const model = {
  materials: [{ id: 'a', name: 'A' }],
  regions: [{ material: 'a', polygon: [[0, 0], [20, 0], [20, 6], [10, 6], [0, 12], [0, 6]] }],
  water: null,
} as unknown as Model;

const FITTED: Point[] = [[2, 6.5], [6, 4], [10, 3.2], [14, 4.5], [18, 6]];
// Dovelas que cubren toda la polilínea ajustada: el motor reparte las dovelas de extremo a extremo.
const slices = [
  { x_left: 2, x_right: 6, y_base_left: 6.5, y_base_right: 4, y_top_mid: 8 },
  { x_left: 6, x_right: 10, y_base_left: 4, y_base_right: 3.2, y_top_mid: 7 },
  { x_left: 10, x_right: 14, y_base_left: 3.2, y_base_right: 4.5, y_top_mid: 7 },
  { x_left: 14, x_right: 18, y_base_left: 4.5, y_base_right: 6, y_top_mid: 7 },
];
const polyMethod = (status = 'converged') => ({ method: 'morgenstern_price', status, fos: 1.2, surface: { points: FITTED }, slices }) as unknown as MethodReport;
const circleMethod = { method: 'bishop', status: 'converged', fos: 1.2, surface: { xc: 10, yc: 14, r: 12 }, slices } as unknown as MethodReport;

/** Contexto que registra las rutas trazadas: [color del trazo, puntos de pantalla]. */
function pathRecorder() {
  const paths: { stroke: string; width: number; dash: number[]; pts: [number, number][] }[] = [];
  let cur: [number, number][] = [];
  let strokeStyle = '';
  let lineWidth = 0;
  let dash: number[] = [];
  const noop = (): void => undefined;
  const ctx = new Proxy(
    {},
    {
      get: (_t, k) => {
        if (k === 'beginPath') return () => void (cur = []);
        if (k === 'moveTo' || k === 'lineTo') return (x: number, y: number) => void cur.push([x, y]);
        if (k === 'setLineDash') return (d: number[]) => void (dash = [...d]);
        if (k === 'stroke') return () => void paths.push({ stroke: strokeStyle, width: lineWidth, dash, pts: [...cur] });
        if (k === 'measureText') return () => ({ width: 10 });
        return noop;
      },
      set: (_t, k, v) => {
        if (k === 'strokeStyle') strokeStyle = String(v);
        if (k === 'lineWidth') lineWidth = Number(v);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, paths };
}

const pal: SectionPalette = { ...defaultSectionPalette(), surface: 'SURF', surfaceUnconverged: 'UNCONV', halo: 'HALO' };

describe('buildScene con superficie del informe', () => {
  it('círculo: conserva circle y no trae polyline', () => {
    const s = buildScene(model, circleMethod);
    expect(s.surface?.circle).toEqual({ xc: 10, yc: 14, r: 12 });
    expect(s.surface?.polyline ?? null).toBeNull();
  });
  it('polilínea: trae los puntos ajustados del informe, copiados, y las dovelas', () => {
    const s = buildScene(model, polyMethod());
    expect(s.surface?.polyline).toEqual(FITTED);
    expect(s.surface?.polyline).not.toBe(FITTED);
    expect(s.surface?.circle ?? null).toBeNull();
    expect(s.surface?.slices).toHaveLength(4);
    expect(s.surface?.converged).toBe(true);
  });
  it('R10B-05: con la masa truncada (ATT3_FIXED) la vista Casos dibuja solo el rango de las dovelas analizadas', () => {
    const att3: Point[] = [[5, 15], [12, 6], [35, 6], [42, 3]];
    const block = [{ x_left: 5, x_right: 10 }, { x_left: 10, x_right: 15 }].map((s) => ({ ...s, y_base_left: 6, y_base_right: 6, y_top_mid: 8 }));
    const m = { ...polyMethod(), surface: { points: att3 }, slices: block } as unknown as MethodReport;
    expect(buildScene(model, m).surface?.polyline).toEqual([[5, 15], [12, 6], [15, 6]]);
  });
  it('los límites incluyen la polilínea (sus extremos pueden salir del rango de las dovelas)', () => {
    const wideSlices = [{ x_left: -3, x_right: 10, y_base_left: 20, y_base_right: -4, y_top_mid: 8 }, { x_left: 10, x_right: 25, y_base_left: -4, y_base_right: 6, y_top_mid: 8 }];
    const wide = { ...polyMethod(), surface: { points: [[-3, 20], [10, -4], [25, 6]] }, slices: wideSlices } as unknown as MethodReport;
    const b = buildScene(model, wide).bounds;
    expect(b.minX).toBeLessThan(-3);
    expect(b.maxX).toBeGreaterThan(25);
    expect(b.minY).toBeLessThan(-4);
    expect(b.maxY).toBeGreaterThan(20);
  });
  it('sin dovelas no hay superficie dibujada (igual que con el círculo)', () => {
    expect(buildScene(model, { ...polyMethod(), slices: [] } as MethodReport).surface).toBeNull();
  });
});

describe('drawSection con polilínea', () => {
  it('traza exactamente los puntos del informe (en pantalla) con halo y color de la superficie', () => {
    const scene = buildScene(model, polyMethod());
    const r = pathRecorder();
    drawSection(r.ctx, 600, 400, 1, scene, pal);
    const vp = fitViewport(scene.bounds, 600, 400, 56);
    const expected = FITTED.map((p) => worldToScreen(vp, p[0], p[1]));
    const surf = r.paths.filter((p) => p.stroke === 'SURF');
    expect(surf).toHaveLength(1);
    expect(surf[0]!.pts).toEqual(expected);
    expect(surf[0]!.dash).toEqual([]);
    const halo = r.paths.filter((p) => p.stroke === 'HALO' && p.pts.length === FITTED.length);
    expect(halo.length).toBeGreaterThanOrEqual(1);
    expect(halo[0]!.width).toBeGreaterThan(surf[0]!.width);
  });
  it('sin convergencia: discontinua y con el color de superficie no convergida', () => {
    const r = pathRecorder();
    drawSection(r.ctx, 600, 400, 1, buildScene(model, polyMethod('not_converged')), pal);
    const p = r.paths.find((x) => x.stroke === 'UNCONV' && x.pts.length === FITTED.length);
    expect(p?.dash).toEqual([10, 6]);
  });
  it('el círculo sigue trazando su arco muestreado (sin cambios)', () => {
    const r = pathRecorder();
    drawSection(r.ctx, 600, 400, 1, buildScene(model, circleMethod), pal);
    const arc = r.paths.find((x) => x.stroke === 'SURF');
    expect(arc!.pts.length).toBeGreaterThan(100);
  });
});

describe('leyenda con polilínea', () => {
  it('con la polilínea del informe se rotula «Superficie fija (polilínea)»', () => {
    const items = legendItems(buildScene(model, polyMethod()));
    expect(items[0]).toMatchObject({ key: 'surface', label: 'Superficie fija (polilínea)', swatch: 'line-red' });
  });
  it('sin convergencia mantiene el rótulo de superficie evaluada', () => {
    expect(legendItems(buildScene(model, polyMethod('not_converged')), { unconverged: true })[0]).toMatchObject({ label: 'Superficie evaluada (sin convergencia)' });
  });
  it('el círculo sigue siendo «Superficie crítica»', () => {
    expect(legendItems(buildScene(model, circleMethod))[0]).toMatchObject({ label: 'Superficie crítica' });
  });
  it('R10B-07: un círculo fijo se rotula «Superficie fija (círculo)», no «crítica»; el de búsqueda sigue siendo «crítica»', () => {
    const scene = buildScene(model, circleMethod);
    expect(legendItems(scene, { fixedCircle: true })[0]).toMatchObject({ key: 'surface', label: 'Superficie fija (círculo)', swatch: 'line-red' });
    expect(legendItems(scene, { fixedCircle: false })[0]).toMatchObject({ label: 'Superficie crítica' });
    // la polilínea fija conserva su rótulo aunque se pida fixedCircle
    expect(legendItems(buildScene(model, polyMethod()), { fixedCircle: true })[0]).toMatchObject({ label: 'Superficie fija (polilínea)' });
  });
  it('R10B-07: sin convergencia o no válida, el rótulo no dice «crítica» ni «fija»', () => {
    const scene = buildScene(model, circleMethod);
    expect(legendItems(scene, { unconverged: true, fixedCircle: true })[0]).toMatchObject({ label: 'Superficie evaluada (sin convergencia)', swatch: 'line-unconverged' });
    expect(legendItems(scene, { unconverged: true, invalid: true, fixedCircle: true })[0]).toMatchObject({ label: 'Superficie evaluada (no válida)', swatch: 'line-unconverged' });
  });
  it('editor: polilínea fija sin resultado → elemento discontinuo aparte; con resultado, uno solo', () => {
    const none = { piezo: null };
    expect(legendItems(none, { surface: false, slices: false, fixedPolyline: true })).toEqual([
      { key: 'surface-fixed', label: 'Superficie fija (polilínea)', swatch: 'line-polyline-dashed' },
    ]);
    const drawn = legendItems(none, { fixedPolyline: true });
    expect(drawn.filter((i) => i.label === 'Superficie fija (polilínea)')).toHaveLength(1);
    expect(drawn[0]).toMatchObject({ key: 'surface', swatch: 'line-red' });
  });
});
