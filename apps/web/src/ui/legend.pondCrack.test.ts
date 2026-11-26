import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { crackGeometry } from '../render/crack';
import { legendItems } from './legendItems';

const keys = (items: { key: string }[]): string[] => items.map((i) => i.key);
const slices = [{ x_left: 30, x_right: 47, y_base_left: 25, y_base_right: 32.6 }] as never;
const pond = [[[20, 27], [34, 27], [30, 25], [20, 25]]] as never;

describe('legendItems: agua embalsada y grieta (F5.3, F5.4)', () => {
  it('«Agua embalsada» va tras la piezométrica y solo con agua sobre el terreno', () => {
    const wet = { piezo: [[20, 27], [70, 27]] as [number, number][], pond };
    expect(keys(legendItems(wet, { piezoExtrapolated: true, loads: true }))).toEqual(['surface', 'slices', 'piezo', 'piezo-extrapolated', 'pond', 'loads']);
    expect(legendItems(wet).find((i) => i.key === 'pond')).toMatchObject({ label: 'Agua embalsada (piezométrica sobre el terreno)', swatch: 'pond' });
    expect(keys(legendItems({ piezo: [[0, 0], [1, 1]] as [number, number][] }))).not.toContain('pond');
  });
  it('«Grieta de tracción» sigue a las dovelas; con la grieta seca lo dice', () => {
    const wetCrack = crackGeometry({ x: 47, depth: 2.4, water_force: 28.2 }, slices, 1)!;
    const dryCrack = crackGeometry({ x: 47, depth: 2.4, water_force: 0 }, slices, 0)!;
    expect(keys(legendItems({ piezo: null, crack: wetCrack }))).toEqual(['surface', 'slices', 'crack']);
    expect(legendItems({ piezo: null, crack: wetCrack }).find((i) => i.key === 'crack')?.label).toContain('Pw');
    expect(legendItems({ piezo: null, crack: dryCrack }).find((i) => i.key === 'crack')?.label).toBe('Grieta de tracción (seca)');
    expect(legendItems({ piezo: null, crack: wetCrack }).find((i) => i.key === 'crack')?.swatch).toBe('line-crack');
  });
  it('las muestras usan solo tokens --canvas-*', () => {
    const css = readFileSync(new URL('./legend.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.legend \.swatch\.pond[\s\S]*var\(--canvas-pond\)[\s\S]*var\(--canvas-piezo\)/);
    expect(css).toMatch(/\.legend \.swatch\.line-crack[\s\S]*dashed var\(--canvas-surface\)/);
  });
});
