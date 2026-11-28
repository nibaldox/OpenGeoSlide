// UA-E6: fórmula del alto del lienzo móvil y su aplicación (sin bucles), con dobles del DOM en Node.
import { describe, expect, it } from 'vitest';
import {
  CANVAS_HEIGHT_VAR,
  CANVAS_MARGIN_PX,
  CANVAS_MIN_PX,
  MAX_STREAK,
  attachCanvasHeight,
  canvasHeightDeficit,
  canvasHeightPush,
  canvasHeightPx,
  canvasHeightRaw,
  readCanvasMetrics,
} from './canvasHeight';

describe('canvasHeightPx', () => {
  it('alto = innerHeight − pie − margen − top del SVG − paleta', () => {
    expect(CANVAS_MARGIN_PX).toBe(8);
    expect(canvasHeightPx({ viewportH: 844, footH: 57, svgTop: 300, paletteH: 100 })).toBe(844 - 57 - 8 - 300 - 100);
  });
  it('no tiene máximo: una ventana alta da un lienzo grande', () => {
    expect(canvasHeightPx({ viewportH: 1024, footH: 57, svgTop: 180, paletteH: 56 })).toBe(723);
  });
  it('MIN = 200: nunca baja de ahí, y el déficit dice cuánto falta', () => {
    expect(CANVAS_MIN_PX).toBe(200);
    const i = { viewportH: 568, footH: 77, svgTop: 360, paletteH: 150 };
    expect(canvasHeightRaw(i)).toBe(-27);
    expect(canvasHeightPx(i)).toBe(200);
    expect(canvasHeightDeficit(i)).toBe(227);
    expect(canvasHeightDeficit({ viewportH: 900, footH: 57, svgTop: 200, paletteH: 56 })).toBe(0);
  });
  it('valores no finitos cuentan como 0 y el resultado es entero', () => {
    expect(canvasHeightPx({ viewportH: 700.9, footH: Number.NaN, svgTop: 100.4, paletteH: 50 })).toBe(Math.floor(700.9 - 8 - 100.4 - 50));
    expect(canvasHeightPx({ viewportH: Number.NaN, footH: 0, svgTop: 0, paletteH: 0 })).toBe(200);
  });
  it('acepta margen y mínimo propios', () => {
    expect(canvasHeightPx({ viewportH: 800, footH: 0, svgTop: 0, paletteH: 0, margin: 0, min: 100 })).toBe(800);
    expect(canvasHeightPx({ viewportH: 100, footH: 0, svgTop: 0, paletteH: 0, min: 120 })).toBe(120);
  });
});

/* ───────── Doble del DOM: un layout apilado en el que el SVG está debajo de los bloques y encima de la paleta ───────── */

interface World {
  innerHeight: number;
  scrollY: number;
  header: number;
  notices: number;
  head: number;
  paletteH: number;
  paletteMargin: number;
  foot: number;
  svgHeight: number; // alto por defecto, antes de que se escriba `--ua-canvas-h`
  cardVisible: boolean;
  mobile: boolean;
}

function makeDom(w: World) {
  const props = new Map<string, string>();
  const applied: string[] = [];
  const observed: unknown[] = [];
  const ro = { cbs: [] as Array<() => void>, disconnected: false };
  const listeners = new Map<string, Set<() => void>>();
  const mqListeners = new Set<() => void>();
  // El alto del SVG sale de la propiedad escrita; no influye en ninguno de los bloques que se miden (es la premisa del test).
  const svgH = (): number => parseFloat(props.get(CANVAS_HEIGHT_VAR) ?? '') || w.svgHeight;
  const svgTopInViewport = (): number => w.header + w.notices + w.head + 12 + 1 - w.scrollY; // relleno del panel + borde de la tarjeta
  const els = {
    header: { getBoundingClientRect: () => ({ top: 0, height: w.header }) },
    notices: { getBoundingClientRect: () => ({ top: 0, height: w.notices }) },
    head: { getBoundingClientRect: () => ({ top: 0, height: w.head }) },
    foot: { getBoundingClientRect: () => ({ top: 0, height: w.foot }) },
    palette: { getBoundingClientRect: () => ({ top: svgTopInViewport() + svgH(), height: w.paletteH }) },
    svg: { getBoundingClientRect: () => ({ top: svgTopInViewport(), height: svgH() }) },
  };
  const bySelector: Record<string, unknown> = {
    '.ua-header': els.header,
    '.ua-notices': els.notices,
    '.ua-main-head': els.head,
    '.ua-actions': els.foot,
  };
  const card = {
    style: {
      setProperty: (n: string, v: string) => {
        props.set(n, v);
        applied.push(v);
      },
      removeProperty: (n: string) => {
        props.delete(n);
      },
    },
    querySelector: (s: string) => (s === '.ec-root > .ec-svg' ? els.svg : s === '.ec-palette' ? els.palette : null),
    getBoundingClientRect: () => ({ top: svgTopInViewport() - 1, height: w.cardVisible ? svgH() + w.paletteH + 200 : 0 }),
    ownerDocument: { querySelector: (s: string) => (bySelector[s] as never) ?? null },
  };
  class FakeRO {
    constructor(cb: () => void) {
      ro.cbs.push(cb);
    }
    observe(el: unknown) {
      observed.push(el);
    }
    disconnect() {
      ro.disconnected = true;
    }
  }
  const win = {
    get innerHeight() {
      return w.innerHeight;
    },
    get scrollY() {
      return w.scrollY;
    },
    matchMedia: () => ({
      get matches() {
        return w.mobile;
      },
      addEventListener: (_: 'change', l: () => void) => mqListeners.add(l),
      removeEventListener: (_: 'change', l: () => void) => mqListeners.delete(l),
    }),
    getComputedStyle: () => ({ marginTop: `${w.paletteMargin}px`, marginBottom: '0px' }),
    addEventListener: (t: string, l: () => void) => (listeners.get(t) ?? listeners.set(t, new Set()).get(t)!).add(l),
    removeEventListener: (t: string, l: () => void) => listeners.get(t)?.delete(l),
    ResizeObserver: FakeRO,
  };
  return {
    card,
    win,
    props,
    applied,
    observed,
    ro,
    listeners,
    mqListeners,
    fire: () => ro.cbs.forEach((cb) => cb()),
    emit: (type: string) => listeners.get(type)?.forEach((l) => l()),
  };
}

const world = (o: Partial<World> = {}): World => ({
  innerHeight: 844,
  scrollY: 0,
  header: 120,
  notices: 72,
  head: 110,
  paletteH: 96,
  paletteMargin: 10,
  foot: 57,
  svgHeight: 300,
  cardVisible: true,
  mobile: true,
  ...o,
});
// El top del SVG en el documento del doble es header + avisos + pestañas + 13.
const expected = (w: World): number => w.innerHeight - w.foot - 8 - (w.header + w.notices + w.head + 13) - (w.paletteH + w.paletteMargin);

describe('readCanvasMetrics', () => {
  it('mide el top del SVG en el documento (suma el scroll) y la paleta con su margen', () => {
    const w = world({ scrollY: 150 });
    const d = makeDom(w);
    const m = readCanvasMetrics(d.card as never, d.win as never);
    expect(m).toMatchObject({ viewportH: 844, footH: 57, svgTop: w.header + w.notices + w.head + 13, paletteH: 106, laidOut: true });
  });
});

describe('attachCanvasHeight', () => {
  it('a ≤ 760 px escribe --ua-canvas-h con la fórmula y observa los bloques de arriba, la paleta y el pie', () => {
    const w = world();
    const d = makeDom(w);
    const seen: Array<number | null> = [];
    attachCanvasHeight(d.card as never, d.win as never, (h) => seen.push(h));
    expect(d.props.get(CANVAS_HEIGHT_VAR)).toBe(`${expected(w)}px`);
    expect(seen).toEqual([expected(w)]);
    expect(d.observed).toHaveLength(5); // header, avisos, pestañas, pie y paleta (ni el SVG ni la tarjeta)
    expect(d.observed).not.toContain(d.card);
    expect(d.listeners.get('resize')?.size).toBe(1);
    expect(d.listeners.get('orientationchange')?.size).toBe(1);
  });

  it('sin bucles: cambiar el alto del SVG no cambia la medida, así que no hay otra escritura', () => {
    const w = world();
    const d = makeDom(w);
    attachCanvasHeight(d.card as never, d.win as never);
    const first = d.props.get(CANVAS_HEIGHT_VAR);
    expect(d.applied).toHaveLength(1);
    // Un ResizeObserver que notifica (p. ej. la tarjeta cambió de tamaño por el SVG) o varios `resize` seguidos: mismo valor, sin escrituras.
    for (let i = 0; i < 5; i += 1) {
      d.fire();
      d.emit('resize');
    }
    expect(d.applied).toHaveLength(1);
    expect(d.props.get(CANVAS_HEIGHT_VAR)).toBe(first);
  });

  it('el top del SVG y los bloques medidos no dependen del alto del SVG', () => {
    const d = makeDom(world());
    const before = readCanvasMetrics(d.card as never, d.win as never);
    d.card.style.setProperty(CANVAS_HEIGHT_VAR, '777px');
    const after = readCanvasMetrics(d.card as never, d.win as never);
    expect(after).toEqual(before);
  });

  it('vuelve a medir cuando cambia un bloque de arriba (aviso nuevo) o el pie, y cuando cambia la ventana', () => {
    const w = world();
    const d = makeDom(w);
    attachCanvasHeight(d.card as never, d.win as never);
    w.notices = 20;
    d.fire();
    expect(d.props.get(CANVAS_HEIGHT_VAR)).toBe(`${expected(w)}px`);
    w.foot = 77;
    d.fire();
    expect(d.props.get(CANVAS_HEIGHT_VAR)).toBe(`${expected(w)}px`);
    w.innerHeight = 1000; // gira o crece la ventana
    d.emit('orientationchange');
    expect(d.props.get(CANVAS_HEIGHT_VAR)).toBe(`${expected(w)}px`);
    expect(expected(w)).toBeGreaterThan(200);
    expect(d.applied).toHaveLength(4);
  });

  it('el scroll de la página no cambia el alto (el top se mide en el documento)', () => {
    const w = world({ scrollY: 0 });
    const d = makeDom(w);
    attachCanvasHeight(d.card as never, d.win as never);
    const at0 = d.props.get(CANVAS_HEIGHT_VAR);
    w.scrollY = 200;
    d.emit('resize');
    expect(d.props.get(CANVAS_HEIGHT_VAR)).toBe(at0);
  });

  it('cae a MIN (200) cuando no cabe', () => {
    const w = world({ innerHeight: 568, notices: 200 });
    const d = makeDom(w);
    attachCanvasHeight(d.card as never, d.win as never);
    expect(expected(w)).toBeLessThan(200);
    expect(d.props.get(CANVAS_HEIGHT_VAR)).toBe('200px');
  });

  it('en escritorio (> 760 px) no toca nada; al pasar a móvil lo aplica y al volver lo retira', () => {
    const w = world({ mobile: false });
    const d = makeDom(w);
    attachCanvasHeight(d.card as never, d.win as never);
    expect(d.props.size).toBe(0);
    expect(d.applied).toHaveLength(0);
    w.mobile = true;
    d.mqListeners.forEach((l) => l());
    expect(d.props.get(CANVAS_HEIGHT_VAR)).toBe(`${expected(w)}px`);
    w.mobile = false;
    d.mqListeners.forEach((l) => l());
    expect(d.props.has(CANVAS_HEIGHT_VAR)).toBe(false);
  });

  it('con la vista oculta (la tarjeta sin caja) no escribe', () => {
    const d = makeDom(world({ cardVisible: false }));
    attachCanvasHeight(d.card as never, d.win as never);
    expect(d.applied).toHaveLength(0);
  });

  it('red de seguridad: si la medida nunca se estabiliza, se detiene tras MAX_STREAK escrituras seguidas', () => {
    const w = world();
    const d = makeDom(w);
    attachCanvasHeight(d.card as never, d.win as never);
    for (let i = 0; i < 40; i += 1) {
      w.notices += 3; // un layout patológico que cambia en cada medida
      d.fire();
    }
    expect(d.applied).toHaveLength(MAX_STREAK);
    d.emit('resize'); // un `resize` real reinicia la cuenta
    expect(d.applied).toHaveLength(MAX_STREAK + 1);
  });

  it('el desmontaje quita la propiedad, los oyentes y el observador', () => {
    const d = makeDom(world());
    const off = attachCanvasHeight(d.card as never, d.win as never);
    off();
    expect(d.props.has(CANVAS_HEIGHT_VAR)).toBe(false);
    expect(d.ro.disconnected).toBe(true);
    expect(d.listeners.get('resize')?.size).toBe(0);
    expect(d.mqListeners.size).toBe(0);
    d.fire();
    expect(d.props.has(CANVAS_HEIGHT_VAR)).toBe(false);
  });
});

/* ───────── CM-WB: cifras reales de 320 × 568 y la paleta entera bajo el pie cuando no cabe ───────── */

describe('canvasHeightPx a 320 × 568 (medido en Chrome, X34 §2 y barrido de CM-WB)', () => {
  // v0.5.1: la cabecera de la app medía 185 px y la del lienzo 108: svgTop = 185 + 108 + 12 + 1 = 306 y la paleta, 99 + 10 de margen.
  const v051 = { viewportH: 568, footH: 57, svgTop: 306, paletteH: 109, paletteTopMargin: 10 };
  // Con la cabecera compacta (≤ 360 px): 87 + 92 + 8 + 1 = 188 sin avisos; la paleta, 99 + 6 de margen.
  const compact = { viewportH: 568, footH: 57, svgTop: 188, paletteH: 105, paletteTopMargin: 6 };

  it('antes: alto disponible 88 (déficit 112, el mínimo gana); la paleta empieza en 516, bajo el borde del pie (511)', () => {
    expect(canvasHeightRaw(v051)).toBe(88);
    expect(canvasHeightDeficit(v051)).toBe(112);
    expect(canvasHeightPx(v051)).toBe(CANVAS_MIN_PX);
    expect(v051.svgTop + canvasHeightPx(v051) + v051.paletteTopMargin).toBeGreaterThanOrEqual(568 - 57);
  });
  it('después: la cabecera compacta deja 210 px sin avisos y la paleta termina encima del pie', () => {
    expect(canvasHeightRaw(compact)).toBe(210);
    expect(canvasHeightDeficit(compact)).toBe(0);
    expect(canvasHeightPx(compact)).toBe(210);
    expect(compact.svgTop + 210 + compact.paletteH + CANVAS_MARGIN_PX).toBe(568 - 57);
  });
  it('con un aviso de una línea (48 px) no cabe: la paleta se baja entera bajo el pie, con el lienzo en 263', () => {
    const withNotice = { ...compact, svgTop: 242 };
    expect(canvasHeightRaw(withNotice)).toBe(156);
    expect(canvasHeightPx(withNotice)).toBe(263);
    expect(canvasHeightPush(withNotice)).toBe(263);
    // La paleta empieza en 242 + 263 + 6 = 511 = borde superior del pie.
    expect(withNotice.svgTop + 263 + withNotice.paletteTopMargin).toBe(568 - 57);
  });
  it('«calcular y editar» (pie de 129 px) tampoco cabe: lienzo en 245 y la paleta empieza en el borde del pie', () => {
    const edit = { ...compact, footH: 129 };
    expect(canvasHeightRaw(edit)).toBe(138);
    expect(canvasHeightPx(edit)).toBe(245);
    expect(edit.svgTop + 245 + edit.paletteTopMargin).toBe(568 - 129);
  });
});

describe('canvasHeightPx: la paleta nunca cruza el borde del pie', () => {
  it('con hasta MARGEN px de déficit se queda en MIN y la paleta aún termina encima del pie', () => {
    const i = { viewportH: 600, footH: 57, svgTop: 600 - 57 - CANVAS_MARGIN_PX - 100 - (CANVAS_MIN_PX - CANVAS_MARGIN_PX), paletteH: 100, paletteTopMargin: 6 };
    expect(canvasHeightRaw(i)).toBe(CANVAS_MIN_PX - CANVAS_MARGIN_PX);
    expect(canvasHeightPx(i)).toBe(CANVAS_MIN_PX);
    expect(i.svgTop + CANVAS_MIN_PX + i.paletteH).toBeLessThanOrEqual(600 - 57);
  });
  it('un píxel más de déficit y la paleta pasa entera bajo el pie', () => {
    const i = { viewportH: 600, footH: 57, svgTop: 600 - 57 - CANVAS_MARGIN_PX - 100 - (CANVAS_MIN_PX - CANVAS_MARGIN_PX) + 1, paletteH: 100, paletteTopMargin: 6 };
    expect(canvasHeightPx(i)).toBeGreaterThan(CANVAS_MIN_PX);
    expect(i.svgTop + canvasHeightPx(i) + i.paletteTopMargin).toBeGreaterThanOrEqual(600 - 57);
  });
  it('barrido: para todo viewport, pie, top del SVG y paleta, el borde del pie no cae dentro de la paleta', () => {
    let cases = 0;
    for (const viewportH of [568, 640, 664, 740, 844, 915, 1024]) {
      for (const footH of [57, 77, 113, 129, 137]) {
        for (let svgTop = 100; svgTop <= 700; svgTop += 7) {
          for (const [paletteH, paletteTopMargin] of [[105, 6], [109, 10], [60, 10], [160, 10]] as const) {
            const i = { viewportH, footH, svgTop, paletteH, paletteTopMargin };
            const h = canvasHeightPx(i);
            expect(h).toBeGreaterThanOrEqual(CANVAS_MIN_PX);
            const footTop = viewportH - footH;
            const palTop = svgTop + h + paletteTopMargin;
            const palBottom = svgTop + h + paletteH;
            expect(palTop < footTop && palBottom > footTop, `vh=${viewportH} foot=${footH} top=${svgTop} pal=${paletteH}: ${palTop}-${palBottom} / pie ${footTop}`).toBe(false);
            cases += 1;
          }
        }
      }
    }
    expect(cases).toBeGreaterThan(5000);
  });
  it('sin margen superior de la paleta medido (0) el empuje usa el borde del SVG', () => {
    expect(canvasHeightPush({ viewportH: 568, footH: 57, svgTop: 242, paletteH: 105 })).toBe(269);
  });
});

describe('attachCanvasHeight: la paleta entera bajo el pie cuando el alto disponible cae bajo MIN', () => {
  it('escribe el alto de empuje (> MIN) y no el mínimo', () => {
    const w = world({ innerHeight: 568, header: 87, notices: 48, head: 92, paletteH: 99, paletteMargin: 6, foot: 57 });
    const d = makeDom(w);
    attachCanvasHeight(d.card as never, d.win as never);
    const svgTop = w.header + w.notices + w.head + 13;
    expect(expected(w)).toBeLessThan(CANVAS_MIN_PX - CANVAS_MARGIN_PX);
    expect(d.props.get(CANVAS_HEIGHT_VAR)).toBe(`${568 - 57 - svgTop - 6}px`);
    // Una segunda medida con el mismo mundo no escribe nada: el alto del SVG no mueve ninguno de los bloques medidos.
    d.fire();
    expect(d.applied).toHaveLength(1);
  });
});
