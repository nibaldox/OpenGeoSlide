// R11B-05 / E14o-16: los rótulos de refuerzos y de fuerzas del lienzo (editor y Casos) no se enciman. Con los casos reales V037 (5 refuerzos),
// V084a (7) y V014 (14), el motor real (OGS_BIN) y un lienzo de 800 × 600 px; las cajas de los rótulos son de ancho = caracteres × 6,6 px y 14 px de alto.
import { describe, expect, it } from 'vitest';
import type { ReinforcementForce } from '../../engine/types';
import { loadPublishedDoc } from '../../report/fixtures';
import { engineRun, haveEngine, OGS_BIN } from '../state/engineRun.testutil';
import { fitToDoc } from './viewportOps';
import { LABEL_CHAR_PX, LABEL_LINE_PX, forceShapes, placeReinforcementLabels, reinforcementShapes } from './reinforcements';

interface Box {
  kind: 'reinf' | 'force';
  text: string;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}
const boxOf = (kind: Box['kind'], l: { x: number; y: number; text: string }): Box => {
  const half = (l.text.length * LABEL_CHAR_PX) / 2;
  return { kind, text: l.text, x1: l.x - half, x2: l.x + half, y1: l.y - LABEL_LINE_PX, y2: l.y };
};
const hit = (a: Box, b: Box): boolean => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;

function overlaps(boxes: Box[]): { rr: number; ff: number; rf: number } {
  const out = { rr: 0, ff: 0, rf: 0 };
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      if (!hit(boxes[i]!, boxes[j]!)) continue;
      const a = boxes[i]!.kind;
      const b = boxes[j]!.kind;
      if (a === 'reinf' && b === 'reinf') out.rr += 1;
      else if (a === 'force' && b === 'force') out.ff += 1;
      else out.rf += 1;
    }
  }
  return out;
}

describe.skipIf(!haveEngine)(`rótulos sin solapes en casos reales (${OGS_BIN})`, () => {
  const scene = (id: string) => {
    const doc = loadPublishedDoc(id);
    const run = engineRun(doc);
    expect(run.code, run.out).toBe(0);
    const forces = (run.results.find((r) => (r.reinforcement_forces?.length ?? 0) > 0)?.reinforcement_forces ?? []) as ReinforcementForce[];
    const vp = fitToDoc(doc, 800, 600);
    const refs = reinforcementShapes(doc.reinforcements, vp, doc.units);
    const fs = forceShapes(forces, vp, doc.units);
    return { doc, vp, refs, fs, forces };
  };
  const measure = (refs: ReturnType<typeof reinforcementShapes>, fs: ReturnType<typeof forceShapes>) =>
    overlaps([...refs.map((s) => boxOf('reinf', s.label)), ...fs.map((f) => boxOf('force', f.label))]);

  it.each([
    ['V037', 5],
    ['V084a', 7],
    ['V014', 14],
  ])('%s (%i refuerzos): tras colocar los rótulos no hay ningún par encimado', (id, n) => {
    const s = scene(id);
    expect(s.refs).toHaveLength(n);
    expect(s.fs.length).toBeGreaterThan(0);
    const before = measure(s.refs, s.fs);
    const placed = placeReinforcementLabels(s.refs, s.fs, s.vp);
    const after = measure(placed.shapes, placed.forces);
    // Antes (reproducción del revisor): V037 rf=4; V084a rf=6; V014 rr=3, ff=3, rf=14.
    expect(before.rr + before.ff + before.rf, `${id} antes: ${JSON.stringify(before)}`).toBeGreaterThan(0);
    expect(after, `${id} después`).toEqual({ rr: 0, ff: 0, rf: 0 });
  });

  it('los rótulos quedan dentro del lienzo y conservan el texto', () => {
    const s = scene('V014');
    const placed = placeReinforcementLabels(s.refs, s.fs, s.vp);
    for (const l of [...placed.shapes.map((x) => x.label), ...placed.forces.map((x) => x.label)]) {
      const b = boxOf('reinf', l);
      expect(b.x1, l.text).toBeGreaterThanOrEqual(0);
      expect(b.x2, l.text).toBeLessThanOrEqual(s.vp.width);
      expect(b.y1, l.text).toBeGreaterThanOrEqual(0);
      expect(b.y2, l.text).toBeLessThanOrEqual(s.vp.height);
    }
    expect(placed.shapes.map((x) => x.label.text)).toEqual(s.refs.map((x) => x.label.text));
    expect(placed.forces.map((x) => x.label.text)).toEqual(s.fs.map((x) => x.label.text));
  });

  it('no muta las formas de entrada y no mueve nada si no había solapes', () => {
    const s = scene('V037');
    const copy = JSON.stringify([s.refs.map((x) => x.label), s.fs.map((x) => x.label)]);
    placeReinforcementLabels(s.refs, s.fs, s.vp);
    expect(JSON.stringify([s.refs.map((x) => x.label), s.fs.map((x) => x.label)])).toBe(copy);
    const one = placeReinforcementLabels(s.refs.slice(0, 1), [], s.vp);
    expect(one.shapes[0]!.label.text).toBe(s.refs[0]!.label.text);
  });
});
