import { describe, expect, it } from 'vitest';
import { readSideCollapsed, SIDE_KEY, writeSideCollapsed, type SideStorage } from './sideState';

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
