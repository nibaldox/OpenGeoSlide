import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { legendItems } from './legendItems';

const dry = { piezo: null };
const wet = { piezo: [[0, 0], [1, 1]] as [number, number][] };
const keys = (items: { key: string }[]): string[] => items.map((i) => i.key);

describe('legendItems', () => {
  it('por defecto (Casos): superficie crítica y dovelas, y la piezométrica solo si existe', () => {
    expect(keys(legendItems(dry))).toEqual(['surface', 'slices']);
    expect(keys(legendItems(wet))).toEqual(['surface', 'slices', 'piezo']);
    expect(legendItems(dry)[0]).toMatchObject({ label: 'Superficie crítica', swatch: 'line-red' });
  });
  it('una superficie sin convergencia se rotula y se dibuja discontinua', () => {
    expect(legendItems(dry, { unconverged: true })[0]).toMatchObject({ label: 'Superficie evaluada (sin convergencia)', swatch: 'line-unconverged' });
  });
  it('editor sin resultado: solo lo que existe en el modelo', () => {
    expect(keys(legendItems(dry, { surface: false, slices: false }))).toEqual([]);
    expect(keys(legendItems(wet, { surface: false, slices: false, bands: true, loads: true, seismic: true }))).toEqual([
      'piezo',
      'band-entry',
      'band-exit',
      'loads',
      'seismic',
    ]);
  });
  it('orden estable con todo activo', () => {
    expect(keys(legendItems(wet, { bands: true, loads: true, seismic: true }))).toEqual(['surface', 'slices', 'piezo', 'band-entry', 'band-exit', 'loads', 'seismic']);
  });
});

describe('muestra «Dovelas» (B-05)', () => {
  const css = readFileSync(new URL('./legend.css', import.meta.url), 'utf8');
  const legend = readFileSync(new URL('./Legend.tsx', import.meta.url), 'utf8');
  it('es un trazo con --canvas-slice-edge, no el relleno translúcido', () => {
    expect(css).toContain('.legend .swatch.slice');
    expect(css).toContain('var(--canvas-slice-edge)');
    expect(css).not.toMatch(/var\(--canvas-slice-fill\)/);
    expect(css).toMatch(/border:\s*0/);
  });
  it('Legend.tsx carga la hoja', () => {
    expect(legend).toContain("import './legend.css';");
  });
});
