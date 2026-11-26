import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { sampleInput } from './fixtures';
import { PDF_PALETTE } from './palette';
import { buildReportPdfWith, type FontLoader } from './pdf';

// UX-15 y R7-27: el PDF tiene una paleta RGB fija, alineada con el tema claro del lienzo, que no depende del tema de la app.

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8');
const loadFont: FontLoader = async (file) => new Uint8Array(readFileSync(new URL(`../../public/fonts/${file}`, import.meta.url)));

const hex = (rgb: readonly number[]): string => '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');

describe('PDF_PALETTE', () => {
  it('los 7 materiales coinciden con --canvas-mat-0…6 del tema CLARO del lienzo', () => {
    const css = read('../styles/tokens.css');
    const light = [...css.matchAll(/--canvas-mat-([0-6]):\s*light-dark\((#[0-9a-f]{6}),/gi)].map((m) => m[2]);
    expect(light).toHaveLength(7);
    expect(PDF_PALETTE.materials.map(hex)).toEqual(light.map((c) => c.toLowerCase()));
  });

  it('el color de los refuerzos coincide con --canvas-reinforcement del tema CLARO', () => {
    const css = read('../styles/tokens.css');
    const m = /--canvas-reinforcement:\s*light-dark\((#[0-9a-f]{6}),/i.exec(css);
    expect(m).not.toBeNull();
    expect(hex(PDF_PALETTE.reinforcement)).toBe((m as RegExpExecArray)[1].toLowerCase());
  });

  it('la superficie, la piezométrica y el contorno de las regiones son visibles sobre papel blanco (≥ 3:1)', () => {
    const lum = ([r, g, b]: readonly number[]): number => {
      const l = (c: number): number => ((c / 255) <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
      return 0.2126 * l(r) + 0.7152 * l(g) + 0.0722 * l(b);
    };
    const ratio = (a: readonly number[], b: readonly number[]): number => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    for (const c of [PDF_PALETTE.surface, PDF_PALETTE.piezo, PDF_PALETTE.regionEdge, PDF_PALETTE.slices, PDF_PALETTE.reinforcement]) {
      expect(ratio(c, PDF_PALETTE.pageBg)).toBeGreaterThanOrEqual(3);
    }
    expect(ratio(PDF_PALETTE.inkMuted, PDF_PALETTE.pageBg)).toBeGreaterThanOrEqual(4.5);
  });

  it('es una paleta de constantes RGB: tres enteros 0–255 por color', () => {
    const all = [
      PDF_PALETTE.pageBg, PDF_PALETTE.ink, PDF_PALETTE.inkMuted, PDF_PALETTE.frame, PDF_PALETTE.tableHeaderBg, PDF_PALETTE.tableRule,
      PDF_PALETTE.regionEdge, PDF_PALETTE.surface, PDF_PALETTE.piezo, PDF_PALETTE.slices, ...PDF_PALETTE.materials,
    ];
    for (const c of all) {
      expect(c).toHaveLength(3);
      for (const v of c) expect(Number.isInteger(v) && v >= 0 && v <= 255).toBe(true);
    }
  });
});

describe('el PDF no depende del tema de la aplicación (U1-T c)', () => {
  const g = globalThis as Record<string, unknown>;
  const saved = { document: g.document, matchMedia: g.matchMedia, localStorage: g.localStorage };
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete g[k];
      else g[k] = v;
    }
  });

  it('el código del informe no lee CSS, el DOM ni el esquema de color', () => {
    for (const file of ['content.ts', 'pdf.ts', 'palette.ts']) {
      const src = read(`./${file}`).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); // sin comentarios
      expect(src, file).not.toMatch(/getComputedStyle|matchMedia|prefers-color-scheme|color-scheme|document\.|window\.|localStorage|var\(--|data-theme|useTheme|from '\.\.\/theme/);
    }
  });

  it('mismo PDF en claro y en oscuro: mismo contenido con el DOM del tema oscuro simulado', async () => {
    const strip = (pdf: string): string => pdf.replace(/\/(CreationDate|ModDate) \(D:[^)]*\)/g, '').replace(/\/ID \[[^\]]*\]/g, '');
    const build = async (): Promise<string> => strip(Buffer.from(await (await buildReportPdfWith(sampleInput(), { loadFont, compress: false })).arrayBuffer()).toString('latin1'));
    const light = await build();
    g.document = { documentElement: { getAttribute: () => 'dark', dataset: { theme: 'dark' } } };
    g.matchMedia = () => ({ matches: true });
    g.localStorage = { getItem: () => 'dark' };
    const dark = await build();
    expect(dark).toBe(light);
  });
});
