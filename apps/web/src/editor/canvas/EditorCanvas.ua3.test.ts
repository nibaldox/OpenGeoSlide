// UA3-C2: paleta compacta o con scroll visible (B-10c) y título del eje «y (m)» en el primer hueco libre (B-13b).
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { axisLabelBox, axisTitleBaseline, type AxisBox } from './axisTitle';
import { EditorCanvas } from './EditorCanvas';
import { createFakeStore, makeDoc } from './fakeStore';
import { nextPaletteMode } from './paletteMode';

const css = readFileSync(new URL('./canvas.css', import.meta.url), 'utf8');
const FONT = 12;
const box = (left: number, top: number, right: number, bottom: number): AxisBox => ({ left, top, right, bottom });
const base = { title: 'y (m)', fontPx: FONT, height: 600, covered: [] as AxisBox[], ticks: [] as { label: string; px: number }[] };

describe('B-10c: modo de la paleta', () => {
  it('cabe: se queda como está; no cabe: full → compact → scroll, y scroll es el final', () => {
    expect(nextPaletteMode('full', false)).toBe('full');
    expect(nextPaletteMode('full', true)).toBe('compact');
    expect(nextPaletteMode('compact', false)).toBe('compact');
    expect(nextPaletteMode('compact', true)).toBe('scroll');
    expect(nextPaletteMode('scroll', true)).toBe('scroll');
    expect(nextPaletteMode('scroll', false)).toBe('scroll');
  });

  it('el marcado inicial es el completo: sin data-compact ni data-scroll (con rótulos)', () => {
    const html = renderToStaticMarkup(createElement(EditorCanvas, { store: createFakeStore(makeDoc()) }));
    const nav = /<nav[^>]*class="ec-palette"[^>]*>/.exec(html)?.[0] ?? '';
    expect(nav).not.toContain('data-compact');
    expect(nav).not.toContain('data-scroll');
    expect(html).toContain('ec-palette-label');
  });

  it('hoja de estilos: la compacta mide 36 sin rótulos (solo desde 761 px) y el scroll tiene la barra fina con color propio', () => {
    const media = /@media \(min-width: 761px\) \{([\s\S]*?)\n\}\n/.exec(css)?.[1] ?? '';
    expect(media).toMatch(/\[data-compact='true'\] \.ec-palette-label\s*\{\s*display:\s*none/);
    expect(media).toMatch(/\.ec-tool\s*\{\s*width:\s*36px;\s*height:\s*36px/);
    expect(media).toMatch(/\.ec-tool\s*\{[^}]*min-height:\s*36px/); // `.gs-tool` fija min-height: 42px y ganaría sobre height
    const scroll = /\.ec-palette\[data-scroll='true'\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(scroll).toMatch(/overflow-y:\s*auto/);
    expect(scroll).toMatch(/scrollbar-width:\s*thin/);
    expect(scroll).toMatch(/scrollbar-color:\s*var\(--ui-control-border\)/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe('B-13b: título del eje y en el primer hueco libre', () => {
  it('sin nada que lo tape queda donde siempre (línea base 16, arriba)', () => {
    expect(axisTitleBaseline(base)).toBe(FONT + 4);
  });

  it('bajo el HUD (arriba a la izquierda): baja justo por debajo de su borde', () => {
    const hud = box(16, 16, 346, 270);
    const y = axisTitleBaseline({ ...base, covered: [hud] });
    expect(y).not.toBeNull();
    const placed = axisLabelBox('y (m)', (y as number) + 2, FONT, 6);
    expect(placed.top).toBeGreaterThan(hud.bottom); // no toca el HUD
    expect(placed.top - hud.bottom).toBeLessThanOrEqual(8); // y es el primer hueco, no uno cualquiera
  });

  it('con el HUD plegado (píldora) baja menos que con el desplegado', () => {
    const pill = axisTitleBaseline({ ...base, covered: [box(16, 16, 200, 52)] }) as number;
    const open = axisTitleBaseline({ ...base, covered: [box(16, 16, 346, 270)] }) as number;
    expect(pill).toBeLessThan(open);
  });

  it('no queda bajo la leyenda ni bajo el HUD: se salta ambos', () => {
    const hud = box(16, 16, 346, 270);
    const legend = box(16, 280, 330, 320);
    const y = axisTitleBaseline({ ...base, covered: [hud, legend] }) as number;
    const placed = axisLabelBox('y (m)', y + 2, FONT, 6);
    for (const b of [hud, legend]) expect(placed.bottom + 2 <= b.top || placed.top - 2 >= b.bottom).toBe(true);
    expect(placed.top).toBeGreaterThan(legend.bottom);
  });

  it('no se superpone a un rótulo de marca del eje', () => {
    const ticks = [{ label: '50', px: 34 }, { label: '40', px: 80 }];
    const y = axisTitleBaseline({ ...base, ticks }) as number;
    const placed = axisLabelBox('y (m)', y + 2, FONT, 6);
    for (const t of ticks) {
      const b = axisLabelBox(t.label, t.px, FONT);
      expect(placed.right + 2 <= b.left || placed.left - 2 >= b.right || placed.bottom + 2 <= b.top || placed.top - 2 >= b.bottom).toBe(true);
    }
  });

  it('sin hueco en todo el eje, no se dibuja (null); nunca invade la franja del eje x', () => {
    expect(axisTitleBaseline({ ...base, covered: [box(0, 0, 400, 600)] })).toBeNull();
    const y = axisTitleBaseline({ ...base, covered: [box(0, 0, 400, 560)] });
    expect(y === null || y <= 600 - FONT - 8).toBe(true);
  });

  it('el título más largo (imperial: «y (ft)») ocupa más ancho pero se coloca igual', () => {
    expect(axisTitleBaseline({ ...base, title: 'y (ft)' })).toBe(FONT + 4);
  });

  it('EditorCanvas dibuja el título bajo el HUD solo si hay hueco: con una caja arriba a la izquierda, su `y` baja', () => {
    const hud = box(16, 16, 346, 270);
    const render = (covered?: AxisBox[]): number => {
      const html = renderToStaticMarkup(createElement(EditorCanvas, { store: createFakeStore(makeDoc()), coveredBoxes: covered }));
      const m = /data-axis-title="y"[^>]*? y="([\d.]+)"|y="([\d.]+)"[^>]*data-axis-title="y"/.exec(html);
      return Number(m?.[1] ?? m?.[2]);
    };
    const free = render();
    const covered = render([hud]);
    expect(free).toBe(FONT + 4);
    expect(covered).toBeGreaterThan(hud.bottom);
  });
});
