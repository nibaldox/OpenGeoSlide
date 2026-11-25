import { describe, expect, it } from 'vitest';
import { shouldWarnBeforeUnload } from './useDraftAutosave';

const ok = { dirty: true, autosaveEnabled: true, persistent: true, failure: null };

describe('shouldWarnBeforeUnload (R7-18)', () => {
  it('sin cambios pendientes no avisa', () => {
    expect(shouldWarnBeforeUnload({ ...ok, dirty: false, failure: 'x', persistent: false })).toBe(false);
  });
  it('con cambios y el borrador guardándose bien no avisa', () => {
    expect(shouldWarnBeforeUnload(ok)).toBe(false);
  });
  it('con cambios y el último guardado del borrador falló, avisa', () => {
    expect(shouldWarnBeforeUnload({ ...ok, failure: 'El borrador supera 1 MB.' })).toBe(true);
  });
  it('con cambios y el almacenamiento solo en memoria, avisa', () => {
    expect(shouldWarnBeforeUnload({ ...ok, persistent: false })).toBe(true);
  });
  it('con cambios y el autoguardado en pausa (se ofrece recuperar un borrador), avisa', () => {
    expect(shouldWarnBeforeUnload({ ...ok, autosaveEnabled: false })).toBe(true);
  });
});
