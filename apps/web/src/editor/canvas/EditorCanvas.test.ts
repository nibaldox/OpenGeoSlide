import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CANVAS_INSTRUCTIONS, EditorCanvas } from './EditorCanvas';
import { createFakeStore, makeDoc } from './fakeStore';

function render(
  patch: (doc: ReturnType<typeof makeDoc>) => void = () => undefined,
  ui: Parameters<typeof createFakeStore>[1] = {},
  props: Omit<Parameters<typeof EditorCanvas>[0], 'store'> = {},
): string {
  const doc = makeDoc();
  patch(doc);
  const store = createFakeStore(doc, ui);
  return renderToStaticMarkup(createElement(EditorCanvas, { store, ...props }));
}

describe('EditorCanvas (render estático)', () => {
  it('dibuja regiones, tiradores enfocables con aria-label en español y role=application', () => {
    const html = render();
    expect(html).toContain('role="application"');
    expect((html.match(/data-region=/g) ?? []).length).toBe(2);
    expect((html.match(/data-handle="vertex"/g) ?? []).length).toBe(10);
    expect(html).toContain('aria-label="Región 1, vértice 3: x 60,0 m, y 5,0 m"');
    expect(html).toContain('aria-label="Región 2, vértice 5: x 20,0 m, y 20,0 m"');
    expect(html).toContain('tabindex="0"');
  });

  it('dibuja la piezométrica con sus puntos y el círculo con tiradores de centro y radio', () => {
    const html = render();
    expect(html).toContain('data-layer="piezometric"');
    expect((html.match(/data-handle="piezo_point"/g) ?? []).length).toBe(3);
    expect(html).toContain('data-handle="circle_center"');
    expect(html).toContain('data-handle="circle_radius"');
    expect(html).toContain('aria-label="Círculo de falla, radio: 25,0 m"');
  });

  it('omite piezométrica y círculo si el modelo no los tiene', () => {
    const html = render((d) => {
      d.water = null;
      d.analysis.surface = null;
    });
    expect(html).not.toContain('data-layer="piezometric"');
    expect(html).not.toContain('data-handle="circle_center"');
  });

  it('dibuja las bandas de entry y exit', () => {
    const html = render((d) => {
      d.analysis.search = { type: 'circular_entry_exit', entry: [0, 10], exit: [45, 55] };
    });
    expect(html).toContain('data-search-range="entry"');
    expect(html).toContain('data-search-range="exit"');
    expect(html).toContain('Entrada: x 0,0 a 10,0 m');
    expect(render()).not.toContain('data-search-range');
  });

  it('cargas y sismo en capas aria-hidden', () => {
    const html = render((d) => {
      d.loads = [{ type: 'udl', x1: 40, x2: 60, q: 20 }, { type: 'line', x: 50, p: 15, angle: 10 }];
      d.analysis.seismic = { kh: 0.1, kv: 0 };
    });
    expect(html).toContain('<g data-layer="loads" aria-hidden="true">');
    expect(html).toContain('<g data-layer="seismic" aria-hidden="true">');
    expect(html).toContain('q = 20,0 kPa');
    expect(html).toContain('p = 15,0 kN/m · 10°');
    expect(html).toContain('kh = 0,10 · kv = 0,00');
    expect((html.match(/data-load=/g) ?? []).length).toBe(2);
  });

  it('sin sismo ni cargas las capas quedan vacías', () => {
    const html = render();
    expect(html).toMatch(/<g data-layer="loads" aria-hidden="true"><\/g>/);
    expect(html).toMatch(/<g data-layer="seismic" aria-hidden="true"><\/g>/);
  });

  it('el color de la región sigue al material', () => {
    const html = render();
    expect(html).toContain('fill="var(--canvas-mat-0)"'); // m1 = índice 0
    expect(html).toContain('fill="var(--canvas-mat-1)"'); // m2 = índice 1
    expect(render((d) => (d.regions[0].material = 'no-existe'))).toContain('fill="var(--canvas-mat-unknown)"');
  });

  it('sin result no dibuja la capa de resultado; con result dibuja dovelas en gris y la superficie crítica en rojo', () => {
    expect(render()).not.toContain('data-layer="result"');
    const doc = makeDoc();
    const store = createFakeStore(doc, {});
    const slice = (x0: number, x1: number) => ({
      x_left: x0,
      x_right: x1,
      y_base_left: 10,
      y_base_right: 9,
      y_top_mid: 20,
      width: x1 - x0,
      alpha: 0.1,
      base_length: 10,
      weight: 100,
      cohesion: 5,
      tan_phi: 0.5,
      pore_pressure: 0,
      material: 0,
      weight_extra: 0,
      h_force: 0,
      h_moment_base: 0,
      driving_extra: 0,
      y_centroid: 0,
    });
    const html = renderToStaticMarkup(
      createElement(EditorCanvas, {
        store,
        result: { surface: { xc: 30, yc: 40, r: 30 }, slices: [slice(20, 30), slice(30, 40)] },
      }),
    );
    expect(html).toContain('data-layer="result"');
    expect((html.match(/data-slice=/g) ?? []).length).toBe(2);
    expect(html).toContain('data-critical-surface');
    expect(html).toContain('stroke="var(--canvas-surface)"');
    expect(html).toContain('fill="var(--canvas-slice-fill)"');
    // UX-06: halo bajo la superficie crítica, para que se lea sobre cualquier material en ambos temas.
    expect(html).toMatch(/<polyline[^>]*stroke="var\(--canvas-halo\)"[^>]*data-halo="critical-surface"/);
  });

  it('el lienzo no escribe colores literales: todo sale de los tokens --canvas-*', () => {
    const html = render((d) => {
      d.loads = [{ type: 'udl', x1: 40, x2: 60, q: 20 }, { type: 'line', x: 50, p: 15, angle: 10 }];
      d.analysis.seismic = { kh: 0.1, kv: 0 };
    });
    expect(html).not.toMatch(/(#[0-9a-fA-F]{3,8}\b|rgba?\()/);
    expect(html).toContain('background:var(--canvas-bg)');
    expect(html).toContain('fill="var(--canvas-seismic-bg)"');
    expect(html).toContain('paint-order="stroke"'); // etiquetas de las cargas con halo
  });

  it('UX-20 y UX-06: las etiquetas de los ejes miden 12 px o más y llevan halo (paint-order: stroke)', () => {
    const html = render();
    const texts = [...html.matchAll(/<text [^>]*>/g)].map((m) => m[0]).filter((t) => t.includes('var(--canvas-axis-text)'));
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) {
      expect(Number(/font-size="(\d+)"/.exec(t)?.[1])).toBeGreaterThanOrEqual(12);
      expect(t).toContain('paint-order="stroke"');
      expect(t).toContain('stroke="var(--canvas-halo)"');
    }
  });
});


const tabStops = (html: string): number => (html.match(/tabindex="0"/g) ?? []).length;

describe('R7-04: tabindex itinerante, instrucciones y anuncios', () => {
  it('el lienzo es una sola parada de tabulación: el tirador activo (el primero) tiene 0 y los demás −1', () => {
    const html = render();
    expect(tabStops(html)).toBe(1);
    const handles = [...html.matchAll(/<(?:g|circle|rect)[^>]*data-handle="[^"]+"[^>]*>/g)].map((m) => m[0]);
    expect(handles.length).toBe(15);
    expect(handles.filter((h) => h.includes('tabindex="0"'))).toHaveLength(1);
    expect(handles[0]).toContain('tabindex="0"');
    expect(handles.slice(1).every((h) => h.includes('tabindex="-1"'))).toBe(true);
  });

  it('el tirador seleccionado es la parada de tabulación', () => {
    const html = render(undefined, { selection: { kind: 'vertex', regionIndex: 1, vertexIndex: 4 } });
    expect(tabStops(html)).toBe(1);
    expect(html).toMatch(/<g[^>]*data-handle-key="v-1-4"[^>]*tabindex="0"|<g[^>]*tabindex="0"[^>]*data-handle-key="v-1-4"/);
  });

  it('con un círculo seleccionado el centro es el tirador activo por omisión', () => {
    const html = render(undefined, { selection: { kind: 'surface_circle' } });
    expect(html).toMatch(/data-handle-key="c-center"[^>]*tabindex="0"|tabindex="0"[^>]*data-handle-key="c-center"/);
  });

  it('sin tiradores el propio lienzo es la parada de tabulación', () => {
    const html = render((d) => {
      d.regions = [];
      d.water = null;
      d.analysis.surface = null;
    });
    expect(tabStops(html)).toBe(1);
    expect(html).toMatch(/<svg[^>]*tabindex="0"/);
  });

  it('B-01: con 344 tiradores hay una sola parada de tabulación (un tirador con tabindex 0)', () => {
    const many = (selection?: { regionIndex: number; vertexIndex: number }) =>
      render(
        (d) => {
          const n = 340;
          const ring = Array.from({ length: n }, (_, i): [number, number] => [30 + 25 * Math.cos((2 * Math.PI * i) / n), 15 + 12 * Math.sin((2 * Math.PI * i) / n)]);
          d.regions = [{ material: 'm1', polygon: ring }];
          d.water = null;
          d.analysis.surface = { type: 'circle', xc: 30, yc: 30, r: 25 };
        },
        selection ? { selection: { kind: 'vertex', ...selection } } : {},
      );
    for (const html of [many(), many({ regionIndex: 0, vertexIndex: 200 })]) {
      const handles = [...html.matchAll(/<g[^>]*data-handle-key="([^"]+)"[^>]*>/g)].map((m) => m[0]);
      expect(handles).toHaveLength(342);
      expect(handles.filter((h) => /tabindex="0"/.test(h))).toHaveLength(1);
      expect(handles.filter((h) => /tabindex="-1"/.test(h))).toHaveLength(341);
    }
    expect(many({ regionIndex: 0, vertexIndex: 200 })).toMatch(/data-handle-key="v-0-200"[^>]*tabindex="0"|tabindex="0"[^>]*data-handle-key="v-0-200"/);
  });

  it('el lienzo (svg) tiene tabindex −1 cuando hay tiradores', () => {
    expect(render()).toMatch(/<svg[^>]*tabindex="-1"/);
  });

  it('aria-describedby apunta a unas instrucciones que documentan [ ], Insert, Supr, + − 0 y las flechas', () => {
    const html = render();
    const id = /<svg[^>]*aria-describedby="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeTruthy();
    const m = new RegExp(`id="${id}"[^>]*>([^<]*)<`).exec(html);
    expect(m).not.toBeNull();
    const text = m?.[1] ?? '';
    for (const part of ['Tab', '[', ']', 'Insert', 'Supr', '+', '0', 'flechas', 'Mayús']) expect(text).toContain(part);
  });

  it('R9-10: el tirador activo (tabindex 0) lleva aria-describedby con instrucciones breves; los demás no', () => {
    const html = render(undefined, { selection: { kind: 'vertex', regionIndex: 1, vertexIndex: 4 } });
    const handles = [...html.matchAll(/<g[^>]*data-handle=\"[^\"]+\"[^>]*>/g)].map((m) => m[0]);
    const active = handles.filter((h) => h.includes('tabindex=\"0\"'));
    expect(active).toHaveLength(1);
    const id = /aria-describedby=\"([^\"]+)\"/.exec(active[0] ?? '')?.[1];
    expect(id).toBeTruthy();
    // El svg se describe con otro texto (el largo): el del tirador es una versión breve.
    expect(id).not.toBe(/<svg[^>]*aria-describedby=\"([^\"]+)\"/.exec(html)?.[1]);
    const text = new RegExp(`id=\"${id}\"[^>]*>([^<]*)<`).exec(html)?.[1] ?? '';
    for (const part of ['[', ']', 'Flechas', 'Supr', 'Tab']) expect(text).toContain(part);
    expect(text.length).toBeLessThan(220);
    expect(text.length).toBeLessThan(CANVAS_INSTRUCTIONS.length / 2);
    expect(handles.filter((h) => h.includes('tabindex=\"-1\"') && h.includes('aria-describedby'))).toHaveLength(0);
  });

  it('sin onAnnounce el lienzo trae su propia región aria-live; con onAnnounce no (la pone la aplicación)', () => {
    expect(render()).toMatch(/aria-live="polite"/);
    expect(render(undefined, {}, { onAnnounce: () => undefined })).not.toMatch(/aria-live="polite"/);
  });
});

describe('R7-10 · UX-05: objetivos', () => {
  it('cada tirador lleva un área de acierto de 24 px o más y una marca visible de 12 px o más con anillo de contraste', () => {
    const html = render();
    const hits = [...html.matchAll(/<circle[^>]*data-hit-area[^>]*>/g)].map((m) => m[0]);
    expect(hits.length).toBe(15);
    for (const h of hits) expect(Number(/ r="([\d.]+)"/.exec(h)?.[1]) * 2).toBeGreaterThanOrEqual(24);
    const vis = [...html.matchAll(/<circle[^>]*data-handle-shape="vertex"[^>]*>/g)].map((m) => m[0]);
    expect(vis.length).toBe(10);
    for (const v of vis) {
      expect(Number(/ r="([\d.]+)"/.exec(v)?.[1]) * 2).toBeGreaterThanOrEqual(12);
      expect(v).toContain('stroke="var(--canvas-handle-ring)"');
    }
  });
});

describe('R7-10: móvil sin atrapar el desplazamiento', () => {
  it('touch-action solo es none con la herramienta «Mover vista»; en el resto deja desplazar la página', () => {
    expect(render()).toContain('touch-action:pan-x pan-y');
    expect(render(undefined, { tool: 'pan' })).toContain('touch-action:none');
    expect(render()).not.toContain('touch-action:none');
  });

  it('el lienzo rellena el contenedor y el contenedor sale de la tarjeta del armazón, sin clamp', () => {
    // UA1-A: una sola fuente de altura (`.ua-canvas` en el armazón: ocupa toda la tarjeta, que es el alto restante del área);
    // `.ec-root` la rellena. Ya no hay un `clamp` por tamaño de pantalla.
    const css = readFileSync(new URL('./canvas.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.ec-root\s*\{[^}]*height:\s*100%/);
    const shell = readFileSync(new URL('../app/shell/shell.css', import.meta.url), 'utf8');
    expect(shell).toMatch(/\.ua-canvas\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0/);
    expect(shell).toMatch(/\.ua-canvas-card\s*\{[^}]*position:\s*relative/);
    const app = readFileSync(new URL('../../App.css', import.meta.url), 'utf8');
    for (const css of [shell, app]) expect(css).not.toMatch(/clamp\(320px/);
    expect(app).not.toMatch(/\.ea-canvas\s*\{/);
    expect(render()).toContain('class="ec-root"');
  });
});

describe('R7-02: zoom y encuadre sobre el lienzo', () => {
  it('hay botones accesibles Acercar, Alejar y Encuadrar dentro de un grupo con nombre', () => {
    const html = render();
    expect(html).toMatch(/role="group"[^>]*aria-label="Zoom y encuadre"/);
    for (const name of ['Acercar', 'Alejar', 'Encuadrar']) expect(html).toMatch(new RegExp(`<button[^>]*aria-label="${name}"`));
    expect(html).toMatch(/<button[^>]*type="button"/);
  });
});

describe('U2-C: props del contrato', () => {
  const slice = {
    x_left: 20, x_right: 30, y_base_left: 10, y_base_right: 9, y_top_mid: 20, width: 10, alpha: 0.1, base_length: 10,
    weight: 100, cohesion: 5, tan_phi: 0.5, pore_pressure: 0, material: 0,
    weight_extra: 0, h_force: 0, h_moment_base: 0, driving_extra: 0, y_centroid: 0,
  };
  const result = { surface: { xc: 30, yc: 40, r: 30 }, slices: [slice] };

  it('surfaceConverged=false dibuja la superficie discontinua con --canvas-surface-unconverged', () => {
    const html = render(undefined, {}, { result, surfaceConverged: false });
    const tag = /<polyline[^>]*data-critical-surface[^>]*>/.exec(html)?.[0] ?? '';
    expect(tag).toContain('stroke="var(--canvas-surface-unconverged)"');
    expect(tag).toMatch(/stroke-dasharray="[^"]+"/);
  });

  it('por defecto (convergida) la superficie es continua y usa --canvas-surface', () => {
    const tag = /<polyline[^>]*data-critical-surface[^>]*>/.exec(render(undefined, {}, { result }))?.[0] ?? '';
    expect(tag).toContain('stroke="var(--canvas-surface)"');
    expect(tag).not.toContain('stroke-dasharray');
    const explicit = /<polyline[^>]*data-critical-surface[^>]*>/.exec(render(undefined, {}, { result, surfaceConverged: true }))?.[0] ?? '';
    expect(explicit).not.toContain('stroke-dasharray');
  });

  it('units=imperial pasa las etiquetas accesibles y los ejes a ft', () => {
    const html = render(
      (d) => {
        d.analysis.search = { type: 'circular_entry_exit', entry: [0, 10], exit: [45, 55] };
      },
      {},
      { units: 'imperial' },
    );
    expect(html).toContain('aria-label="Región 1, vértice 3: x 60,0 ft, y 5,0 ft"');
    expect(html).toContain('aria-label="Piezométrica, punto 2: x 30,0 ft, y 8,0 ft"');
    expect(html).toContain('aria-label="Círculo de falla, centro: x 30,0 ft, y 30,0 ft"');
    expect(html).toContain('aria-label="Círculo de falla, radio: 25,0 ft"');
    expect(html).toContain('Entrada: x 0,0 a 10,0 ft');
    expect(html).toContain('x (ft)');
    expect(html).toContain('y (ft)');
    expect(html).not.toContain('x (m)');
  });

  it('units por omisión (SI) usa m en etiquetas y ejes', () => {
    const html = render();
    expect(html).toContain('x 60,0 m, y 5,0 m');
    expect(html).toContain('x (m)');
    expect(html).toContain('y (m)');
  });

  it('sin la prop `units` se respeta la unidad del propio documento', () => {
    const html = render((d) => {
      d.units = 'imperial';
    });
    expect(html).toContain('x 60,0 ft');
    expect(html).toContain('x (ft)');
  });

  it('«Dibujar región»: muestra la ayuda sobre el lienzo y la capa del dibujo; con «Seleccionar» no', () => {
    const html = render(() => undefined, { tool: 'draw_region' });
    expect(html).toContain('data-testid="draw-hint"');
    expect(html).toContain('Dibujar región');
    expect(html).toContain('data-layer="draw"');
    expect(html).toContain('cursor:crosshair');
    const normal = render();
    expect(normal).not.toContain('data-testid="draw-hint"');
    expect(normal).not.toContain('data-layer="draw"');
  });

  it('estado vacío: con el modelo sin regiones muestra el contenido de `emptyState`; con regiones o dibujando, no', () => {
    const empty = (d: ReturnType<typeof makeDoc>) => {
      d.regions = [];
    };
    const content = createElement('p', null, 'Sin regiones: dibuje la primera');
    expect(render(empty, {}, { emptyState: content })).toContain('data-testid="canvas-empty"');
    expect(render(empty, {}, { emptyState: content })).toContain('Sin regiones: dibuje la primera');
    expect(render(() => undefined, {}, { emptyState: content })).not.toContain('data-testid="canvas-empty"');
    const drawing = render(empty, { tool: 'draw_region' }, { emptyState: content });
    expect(drawing).not.toContain('data-testid="canvas-empty"');
  });
});
