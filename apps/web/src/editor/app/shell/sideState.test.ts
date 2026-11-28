import { describe, expect, it } from 'vitest';
import { readSideCollapsed, SIDE_KEY, sideLayout, writeSideCollapsed, type SideStorage } from './sideState';
import type { ViewId } from './views';

function memory(initial: Record<string, string> = {}): SideStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe('estado plegado de la barra lateral', () => {
  it('la clave es ogs.ui.side.v1', () => {
    expect(SIDE_KEY).toBe('ogs.ui.side.v1');
  });
  it('sin valor o con otro valor, desplegada', () => {
    expect(readSideCollapsed(memory())).toBe(false);
    expect(readSideCollapsed(memory({ [SIDE_KEY]: 'cualquier cosa' }))).toBe(false);
    expect(readSideCollapsed(null)).toBe(false);
  });
  it('guarda y lee ida y vuelta', () => {
    const m = memory();
    writeSideCollapsed(m, true);
    expect(m.data[SIDE_KEY]).toBe('collapsed');
    expect(readSideCollapsed(m)).toBe(true);
    writeSideCollapsed(m, false);
    expect(readSideCollapsed(m)).toBe(false);
  });
  it('un almacenamiento que falla no rompe nada', () => {
    const broken: SideStorage = {
      getItem() {
        throw new Error('SecurityError');
      },
      setItem() {
        throw new Error('QuotaExceededError');
      },
    };
    expect(readSideCollapsed(broken)).toBe(false);
    expect(() => writeSideCollapsed(broken, true)).not.toThrow();
    expect(() => writeSideCollapsed(null, true)).not.toThrow();
  });
});

describe('sideLayout (UA-E3 §1 y §2)', () => {
  it('desplegada en Lienzo, Resultados e Informe: nada oculto', () => {
    for (const view of ['canvas', 'results', 'report'] as ViewId[]) expect(sideLayout({ view, preference: false, desktop: true })).toEqual({ collapsed: false, hidden: false });
  });
  it('en Casos la barra y el pie quedan ocultos, plegada o no, y no cuenta como plegada', () => {
    expect(sideLayout({ view: 'cases', preference: false, desktop: true })).toEqual({ collapsed: false, hidden: true });
    expect(sideLayout({ view: 'cases', preference: true, desktop: true })).toEqual({ collapsed: false, hidden: true });
    expect(sideLayout({ view: 'cases', preference: false, desktop: false })).toEqual({ collapsed: false, hidden: true });
  });
  it('plegada desde 761 px: oculta y con «Mostrar panel»', () => {
    expect(sideLayout({ view: 'canvas', preference: true, desktop: true })).toEqual({ collapsed: true, hidden: true });
  });
  it('hasta 760 px no se puede plegar: se ignora la preferencia guardada', () => {
    expect(sideLayout({ view: 'canvas', preference: true, desktop: false })).toEqual({ collapsed: false, hidden: false });
    expect(sideLayout({ view: 'report', preference: true, desktop: false })).toEqual({ collapsed: false, hidden: false });
  });
});
