// F3B-W2: lienzo de Casos (`render/scene.ts`, `render/drawSection.ts`) y leyenda de materiales con Hoek-Brown, SHANSEP y búsqueda no circular.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Model } from '../engine/types';
import { fitViewport, worldToScreen } from '../geometry/viewport';
import { defaultSectionPalette, type SectionPalette } from '../theme/sectionPalette';
import { Legend } from '../ui/Legend';
import {
  F3B_CRITICAL_POLYLINE,
  hoekBrownFixture,
  hoekBrownNotConvergedFixture,
  nonCircularCircleWinsFixture,
  nonCircularPolylineWinsFixture,
  shansepFixture,
} from '../report/f3bFixtures';
import { drawSection } from './drawSection';
import { MATERIAL_MODEL_LABEL, buildScene, materialModelLabel } from './scene';

function canvasRecorder() {
  const fills: string[] = [];
  const strokes: string[] = [];
  const arcs: { x: number; y: number; r: number; fill: string }[] = [];
  const paths: { stroke: string; dash: number[]; pts: [number, number][] }[] = [];
  let curPts: [number, number][] = [];
  let pendingArc: { x: number; y: number; r: number } | null = null;
  let fillStyle = '';
  let strokeStyle = '';
  let dash: number[] = [];
  const noop = (): void => undefined;
  const ctx = new Proxy(
    {},
    {
      get: (_t, k) => {
        if (k === 'beginPath')
          return () => {
            curPts = [];
            pendingArc = null;
          };
        if (k === 'moveTo' || k === 'lineTo') return (x: number, y: number) => void curPts.push([x, y]);
        if (k === 'arc') return (x: number, y: number, r: number) => void (pendingArc = { x, y, r });
        if (k === 'fill')
          return () => {
            fills.push(fillStyle);
            if (pendingArc) arcs.push({ ...pendingArc, fill: fillStyle });
          };
        if (k === 'stroke')
          return () => {
            strokes.push(strokeStyle);
            paths.push({ stroke: strokeStyle, dash: [...dash], pts: [...curPts] });
          };
        if (k === 'setLineDash') return (d: number[]) => void (dash = [...d]);
        if (k === 'measureText') return () => ({ width: 10 });
        return noop;
      },
      set: (_t, k, v) => {
        if (k === 'fillStyle') fillStyle = String(v);
        if (k === 'strokeStyle') strokeStyle = String(v);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, fills, strokes, arcs, paths };
}

const PAL: SectionPalette = {
  ...defaultSectionPalette(),
  surface: 'SURF',
  surfaceUnconverged: 'UNCONV',
  halo: 'HALO',
  sliceFill: 'SLICE_FILL',
  sliceEdge: 'SLICE_EDGE',
};

describe('F3B-W2: polilínea crítica no circular y vértices marcados en drawSection', () => {
  it('dibuja la polilínea crítica no circular igual que una polilínea fija y marca cada uno de sus vértices con halo', () => {
    const { model, report } = nonCircularPolylineWinsFixture();
    const scene = buildScene(model as unknown as Model, report.results[0]!);
    expect(scene.surface?.polyline).toEqual(F3B_CRITICAL_POLYLINE);
    expect(scene.surface?.circle).toBeNull();
    expect(scene.surface?.search).toBe(true);
    expect(scene.surface?.converged).toBe(true);

    const rec = canvasRecorder();
    drawSection(rec.ctx, 800, 500, 1, scene, PAL);
    const vp = fitViewport(scene.bounds, 800, 500, 56);
    const expectedPts = F3B_CRITICAL_POLYLINE.map(([x, y]) => worldToScreen(vp, x, y));

    const surfPaths = rec.paths.filter((p) => p.stroke === 'SURF');
    expect(surfPaths).toHaveLength(1);
    expect(surfPaths[0]!.pts).toEqual(expectedPts);
    expect(surfPaths[0]!.dash).toEqual([]);

    const vertexDots = rec.arcs.filter((a) => a.fill === 'SURF');
    const vertexHalos = rec.arcs.filter((a) => a.fill === 'HALO');
    expect(vertexDots).toHaveLength(F3B_CRITICAL_POLYLINE.length);
    expect(vertexHalos).toHaveLength(F3B_CRITICAL_POLYLINE.length);
    expectedPts.forEach(([sx, sy], i) => {
      expect(vertexDots[i]!.x).toBeCloseTo(sx, 6);
      expect(vertexDots[i]!.y).toBeCloseTo(sy, 6);
      expect(vertexHalos[i]!.r).toBeGreaterThan(vertexDots[i]!.r);
    });
  });

  it('cuando en la búsqueda no circular gana el círculo, traza el arco circular sin discos de vértice', () => {
    const { model, report } = nonCircularCircleWinsFixture();
    const scene = buildScene(model as unknown as Model, report.results[0]!);
    expect(scene.surface?.circle).toEqual({ xc: 29.51, yc: 53.74, r: 28.74 });
    expect(scene.surface?.polyline).toBeNull();
    expect(scene.surface?.search).toBe(true);

    const rec = canvasRecorder();
    drawSection(rec.ctx, 800, 500, 1, scene, PAL);
    expect(rec.arcs.filter((a) => a.fill === 'SURF')).toHaveLength(0);
    expect(rec.paths.find((p) => p.stroke === 'SURF')!.pts.length).toBeGreaterThan(100);
  });

  it('sin convergencia (hoek_brown_not_converged), la superficie se dibuja discontinua con UNCONV', () => {
    const { model, report } = hoekBrownNotConvergedFixture();
    const scene = buildScene(model as unknown as Model, report.results[0]!);
    expect(scene.surface?.converged).toBe(false);
    const rec = canvasRecorder();
    drawSection(rec.ctx, 800, 500, 1, scene, PAL);
    expect(rec.strokes).toContain('UNCONV');
    expect(rec.strokes).not.toContain('SURF');
  });
});

describe('F3B-W2: color uniforme de dovelas y leyenda de materiales por modelo', () => {
  it('el color de relleno y borde de las dovelas no cambia entre Mohr-Coulomb, Hoek-Brown y SHANSEP', () => {
    const hb = hoekBrownFixture();
    const sh = shansepFixture();
    const recHb = canvasRecorder();
    const recSh = canvasRecorder();
    drawSection(recHb.ctx, 800, 500, 1, buildScene(hb.model as unknown as Model, hb.report.results[0]!), PAL);
    drawSection(recSh.ctx, 800, 500, 1, buildScene(sh.model as unknown as Model, sh.report.results[0]!), PAL);

    expect(recHb.fills.filter((f) => f === 'SLICE_FILL')).toHaveLength(hb.report.results[0]!.slices.length);
    expect(recSh.fills.filter((f) => f === 'SLICE_FILL')).toHaveLength(sh.report.results[0]!.slices.length);
    expect(recHb.paths.filter((p) => p.stroke === 'SLICE_EDGE')).toHaveLength(hb.report.results[0]!.slices.length);
    expect(recSh.paths.filter((p) => p.stroke === 'SLICE_EDGE')).toHaveLength(sh.report.results[0]!.slices.length);
  });

  it('la leyenda de materiales distingue Mohr-Coulomb, No drenado (Su), Hoek-Brown y SHANSEP', () => {
    expect(MATERIAL_MODEL_LABEL).toEqual({
      mohr_coulomb: 'Mohr-Coulomb',
      undrained: 'No drenado (Su)',
      hoek_brown: 'Hoek-Brown',
      shansep: 'SHANSEP',
    });
    expect(materialModelLabel(undefined)).toBe('Mohr-Coulomb');

    const model = {
      materials: [
        { id: 'mc', name: 'Arena', model: 'mohr_coulomb' },
        { id: 'su', name: 'Limo blando', model: 'undrained' },
        { id: 'hb', name: 'Granito', model: 'hoek_brown' },
        { id: 'sh', name: 'Arcilla marina', model: 'shansep' },
      ],
      regions: [{ material: 'mc', polygon: [[0, 0], [10, 0], [10, 5]] }],
      water: null,
    } as unknown as Model;

    const scene = buildScene(model, null);
    expect(scene.materials.map((m) => [m.id, m.model, m.modelLabel])).toEqual([
      ['mc', 'mohr_coulomb', 'Mohr-Coulomb'],
      ['su', 'undrained', 'No drenado (Su)'],
      ['hb', 'hoek_brown', 'Hoek-Brown'],
      ['sh', 'shansep', 'SHANSEP'],
    ]);

    const html = renderToStaticMarkup(createElement(Legend, { scene }));
    expect(html).toContain('Arena · Mohr-Coulomb');
    expect(html).toContain('Limo blando · No drenado (Su)');
    expect(html).toContain('Granito · Hoek-Brown');
    expect(html).toContain('Arcilla marina · SHANSEP');
  });
});
