// UA2-F1: encuadre que deja libre el HUD (lógica pura de hudFit.ts).
import { describe, expect, it } from 'vitest';
import { worldToScreen, type Viewport } from '../../../geometry/viewport';
import { labelCovered } from '../../canvas/EditorCanvas';
import { makeDoc } from '../../canvas/fakeStore';
import { docBounds, fitToDocInsets, insetsFeasible, paddedBounds } from '../../canvas/viewportOps';
import { boxOf, chooseHudFit, COMPACT_CARD_HEIGHT_PX, hudCandidates, HUD_GAP_PX, insetsEqual, isLastAutoFit, needsCompactHud, pickDocFor, sameViewport, type Box, type PickKey } from './hudFit';
import { FIT_INSETS_DESKTOP } from './layout';

const BASE = FIT_INSETS_DESKTOP;
const hudAt = (w: number, h: number): Box => ({ left: 16, top: 16, right: 16 + w, bottom: 16 + h });
const doc = makeDoc();

/** Rectángulo en pantalla que ocupan los límites del documento con espacio de dibujo, dado el encuadre `vp`. */
function modelRect(vp: Viewport) {
  const b = paddedBounds(docBounds(doc));
  const [x0, y0] = worldToScreen(vp, b.minX, b.maxY);
  const [x1, y1] = worldToScreen(vp, b.maxX, b.minY);
  return { left: x0, top: y0, right: x1, bottom: y1 };
}
const overlaps = (a: Box, b: Box): boolean => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

describe('candidatos del HUD', () => {
  it('A baja el margen superior bajo el HUD y B mueve el izquierdo a su derecha, con 12 px de aire', () => {
    const { below, beside } = hudCandidates(BASE, hudAt(330, 254));
    expect(below).toEqual({ ...BASE, top: 16 + 254 + HUD_GAP_PX });
    expect(beside).toEqual({ ...BASE, left: 16 + 330 + HUD_GAP_PX });
  });
  it('nunca baja de los márgenes fijos', () => {
    const { below, beside } = hudCandidates(BASE, { left: 0, top: 0, right: 4, bottom: 4 });
    expect(below.top).toBe(BASE.top);
    expect(beside.left).toBe(BASE.left);
  });
});

describe('chooseHudFit', () => {
  const sizes: Array<[string, number, number, number, number]> = [
    ['1440 × 900', 1052, 576, 330, 254],
    ['1280 × 800', 892, 476, 330, 254],
    ['1024 × 768', 676, 576, 280, 248],
    ['1100 × 700', 760, 500, 300, 254],
  ];
  for (const [name, w, h, hw, hh] of sizes) {
    it(`${name}: el modelo no toca la caja del HUD y la escala es la mayor de los dos candidatos`, () => {
      const hud = hudAt(hw, hh);
      const r = chooseHudFit({ doc, width: w, height: h, base: BASE, hud, collapsed: false });
      const vp = fitToDocInsets(doc, w, h, r.insets);
      expect(overlaps(modelRect(vp), hud)).toBe(false);
      const { below, beside } = hudCandidates(BASE, hud);
      const feasible = [below, beside].filter((i) => insetsFeasible(w, h, i));
      const best = Math.max(...feasible.map((i) => fitToDocInsets(doc, w, h, i).scale));
      expect(vp.scale).toBeCloseTo(best, 9);
      expect(['below', 'beside']).toContain(r.pick);
    });
  }
  it('un lienzo muy ancho y bajo prefiere B; uno estrecho y alto prefiere A', () => {
    expect(chooseHudFit({ doc, width: 1400, height: 400, base: BASE, hud: hudAt(300, 200), collapsed: false }).pick).toBe('beside');
    expect(chooseHudFit({ doc, width: 500, height: 1000, base: BASE, hud: hudAt(300, 200), collapsed: false }).pick).toBe('below');
  });
  it('un candidato cuyos márgenes no caben pierde frente al que sí cabe, aunque su escala parezca mayor', () => {
    // Alto 400: A pide top 282 + bottom 72 = 354 > 240 (60 %): se reduciría y el HUD tapa el modelo. B cabe.
    const hud = hudAt(330, 254);
    const { below } = hudCandidates(BASE, hud);
    expect(insetsFeasible(900, 400, below)).toBe(false);
    expect(chooseHudFit({ doc, width: 900, height: 400, base: BASE, hud, collapsed: false }).pick).toBe('beside');
  });
  it('plegado: solo cuenta el margen superior (A), también si B daría más escala', () => {
    const r = chooseHudFit({ doc, width: 1400, height: 400, base: BASE, hud: hudAt(157, 40), collapsed: true });
    expect(r.pick).toBe('below');
    expect(r.insets).toEqual({ ...BASE, top: 16 + 40 + HUD_GAP_PX });
  });
  it('sin HUD, sin regiones o con una caja vacía: los márgenes fijos', () => {
    expect(chooseHudFit({ doc, width: 900, height: 600, base: BASE, hud: null, collapsed: false })).toEqual({ insets: BASE, pick: 'base' });
    expect(chooseHudFit({ doc: { ...doc, regions: [] }, width: 900, height: 600, base: BASE, hud: hudAt(300, 200), collapsed: false }).pick).toBe('base');
    expect(chooseHudFit({ doc, width: 900, height: 600, base: BASE, hud: { left: 16, top: 16, right: 16, bottom: 16 }, collapsed: false }).pick).toBe('base');
  });
  it('histéresis: casi empatados, conserva el candidato anterior', () => {
    const args = { doc, width: 1000, height: 560, base: BASE, hud: hudAt(300, 200), collapsed: false } as const;
    const first = chooseHudFit(args).pick;
    const other = first === 'below' ? 'beside' : 'below';
    const { below, beside } = hudCandidates(BASE, args.hud);
    const sa = fitToDocInsets(doc, 1000, 560, below).scale;
    const sb = fitToDocInsets(doc, 1000, 560, beside).scale;
    // Con una diferencia menor de 5 % se queda donde estaba; con una mayor cambia.
    if (Math.max(sa, sb) / Math.min(sa, sb) < 1.05) expect(chooseHudFit({ ...args, prev: other }).pick).toBe(other);
    else expect(chooseHudFit({ ...args, prev: other }).pick).toBe(first);
  });
});

describe('regla del último encuadre automático', () => {
  const vp: Viewport = { scale: 12.5, tx: 100.25, ty: 400.5, width: 900, height: 600 };
  it('la vista igual al último encuadre automático se reencuadra', () => {
    expect(isLastAutoFit({ ...vp }, vp)).toBe(true);
  });
  it('si el usuario hizo zoom o movió la vista, no', () => {
    expect(isLastAutoFit({ ...vp, scale: vp.scale * 1.25 }, vp)).toBe(false);
    expect(isLastAutoFit({ ...vp, tx: vp.tx + 5 }, vp)).toBe(false);
    expect(isLastAutoFit({ ...vp, ty: vp.ty - 1 }, vp)).toBe(false);
  });
  it('un cambio de tamaño del lienzo cuenta como otra vista', () => {
    expect(sameViewport({ ...vp, width: 901 }, vp)).toBe(false);
  });
  it('sin vista o sin encuadre automático previo, no', () => {
    expect(isLastAutoFit(null, vp)).toBe(false);
    expect(isLastAutoFit(vp, null)).toBe(false);
  });
});

describe('utilidades', () => {
  it('boxOf mide relativo al origen de la tarjeta', () => {
    expect(boxOf({ left: 381, top: 263, right: 711, bottom: 517 }, { left: 365, top: 247 })).toEqual({ left: 16, top: 16, right: 346, bottom: 270 });
  });
  it('insetsEqual compara valores', () => {
    expect(insetsEqual({ ...BASE }, BASE)).toBe(true);
    expect(insetsEqual({ ...BASE, top: 25 }, BASE)).toBe(false);
    expect(insetsEqual(undefined, BASE)).toBe(false);
  });
});

describe('rótulos del eje y bajo el HUD', () => {
  const hud = hudAt(330, 254);
  it('un rótulo dentro de la franja vertical del HUD no se dibuja; fuera de ella, sí', () => {
    expect(labelCovered('50', 100, [hud])).toBe(true);
    expect(labelCovered('50', 400, [hud])).toBe(false);
  });
  it('sin cajas se dibujan todos', () => {
    expect(labelCovered('50', 100, undefined)).toBe(false);
    expect(labelCovered('50', 100, [])).toBe(false);
  });
});

describe('pickDocFor: editar no cambia el candidato (UA3 A-08)', () => {
  const key: PickKey = { epoch: 1, refit: 0, width: 1052, height: 576, desktop: true };
  const first = pickDocFor(null, key, doc);
  const edited = { ...doc, regions: doc.regions.map((r, i) => (i === 0 ? { ...r, polygon: r.polygon.map(([x, y], k) => (k === 0 ? [x, y + 20] : [x, y])) } : r)) } as typeof doc;
  it('el primer documento se toma tal cual', () => expect(first.doc).toBe(doc));
  it('con la misma clave, un documento editado no renueva el documento del candidato', () => {
    expect(pickDocFor(first, key, edited)).toBe(first);
    expect(pickDocFor(first, key, edited).doc).toBe(doc);
  });
  it('otro documento, «Encuadrar» o la tecla 0 y otro tamaño de tarjeta sí lo renuevan', () => {
    expect(pickDocFor(first, { ...key, epoch: 2 }, edited).doc).toBe(edited);
    expect(pickDocFor(first, { ...key, refit: 1 }, edited).doc).toBe(edited);
    expect(pickDocFor(first, { ...key, width: 1000 }, edited).doc).toBe(edited);
    expect(pickDocFor(first, { ...key, height: 500 }, edited).doc).toBe(edited);
  });
  it('un documento previo sin regiones se renueva en cuanto hay regiones', () => {
    const empty = pickDocFor(null, key, { ...doc, regions: [] });
    expect(pickDocFor(empty, key, doc).doc).toBe(doc);
  });
  it('una edición que por sí sola cambiaría el candidato no lo cambia mientras no cambie la clave', () => {
    const hud = hudAt(300, 200);
    const size = { width: 900, height: 560 };
    const at = (d: typeof doc, prev?: 'below' | 'beside') => chooseHudFit({ doc: d, ...size, base: BASE, hud, collapsed: false, prev }).pick;
    const tall = (dy: number) => ({ ...doc, regions: doc.regions.map((r, i) => (i === 0 ? { ...r, polygon: r.polygon.map(([x, y], k) => (k === 0 ? [x, y + dy] : [x, y])) } : r)) }) as typeof doc;
    const before = at(doc);
    const flipped = [5, 10, 20, 40, 80, 160, 320, 640].map(tall).find((d) => at(d, before as 'below' | 'beside') !== before);
    expect(flipped, 'la edición debe poder cambiar el candidato para que la prueba valga').toBeDefined();
    // Camino de `useHudInsets`: con el documento congelado de `pickDocFor`, la edición no llega a `chooseHudFit`.
    const k: PickKey = { epoch: 1, refit: 0, ...size, desktop: true };
    const frozen = pickDocFor(pickDocFor(null, k, doc), k, flipped!);
    expect(at(frozen.doc, before as 'below' | 'beside')).toBe(before);
  });
});

describe('needsCompactHud (UA-E3 §3, A-07)', () => {
  const hud = hudAt(280, 236);
  const legend: Box = { left: 16, top: 160, right: 358, bottom: 261 };
  it('una tarjeta de menos de 360 px de alto pide HUD compacto, con o sin medidas', () => {
    expect(needsCompactHud({ width: 452, height: COMPACT_CARD_HEIGHT_PX - 1, base: BASE, hud: null, legend: null })).toBe(true);
    expect(needsCompactHud({ width: 1052, height: 359, base: BASE, hud, legend: null })).toBe(true);
  });
  it('800 × 600 con un aviso: tarjeta de 452 × 270, HUD de 280 × 236 sobre la leyenda', () => {
    expect(needsCompactHud({ width: 452, height: 270, base: BASE, hud, legend })).toBe(true);
  });
  it('si ningún candidato deja el modelo libre, compacto aunque la tarjeta mida ≥ 360', () => {
    const big = hudAt(330, 340);
    expect(insetsFeasible(420, 400, hudCandidates(BASE, big).below)).toBe(false);
    expect(insetsFeasible(420, 400, hudCandidates(BASE, big).beside)).toBe(false);
    expect(needsCompactHud({ width: 420, height: 400, base: BASE, hud: big, legend: null })).toBe(true);
  });
  it('el HUD desplegado que cruza la leyenda pide compacto; con aire suficiente, no', () => {
    expect(needsCompactHud({ width: 1052, height: 576, base: BASE, hud: hudAt(330, 254), legend: { left: 16, top: 200, right: 300, bottom: 301 } })).toBe(true);
    expect(needsCompactHud({ width: 1052, height: 576, base: BASE, hud: hudAt(330, 254), legend: { left: 16, top: 480, right: 300, bottom: 561 } })).toBe(false);
  });
  it('1440 × 900 y 1280 × 800 con el HUD completo: no hace falta', () => {
    expect(needsCompactHud({ width: 1052, height: 576, base: BASE, hud: hudAt(330, 254), legend: { left: 16, top: 480, right: 330, bottom: 561 } })).toBe(false);
    expect(needsCompactHud({ width: 892, height: 476, base: BASE, hud: hudAt(330, 254), legend: { left: 16, top: 400, right: 300, bottom: 461 } })).toBe(false);
  });
});
