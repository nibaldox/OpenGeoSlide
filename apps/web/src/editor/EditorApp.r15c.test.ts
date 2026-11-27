// W-R15c (tarea 3): la cabecera distingue el estado del archivo del de los borradores sin aplicar.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fileStatusText } from './EditorApp';

describe('W-R15c: cabecera con estado separado para archivo y borradores', () => {
  it('sin cambios en el archivo ni borradores indica el estado del archivo y no dice «sin cambios pendientes»', () => {
    const txt = fileStatusText({ dirty: false, pendingDraftCount: 0, busy: false });
    expect(txt).toBe('· archivo sin cambios');
    expect(txt).not.toContain('sin cambios pendientes');
  });

  it('con un borrador sin aplicar sobre un archivo limpio distingue ambos estados sin contradicción', () => {
    const txt = fileStatusText({ dirty: false, pendingDraftCount: 1, busy: false });
    expect(txt).toBe('· archivo sin cambios · borrador sin aplicar');
    expect(txt).not.toContain('sin cambios pendientes');
  });

  it('con varios borradores sin aplicar informa la cantidad en plural', () => {
    const txt = fileStatusText({ dirty: false, pendingDraftCount: 2, busy: false });
    expect(txt).toBe('· archivo sin cambios · 2 borradores sin aplicar');
  });

  it('con cambios sin guardar en el archivo (sin borradores) mantiene «con cambios sin guardar»', () => {
    expect(fileStatusText({ dirty: true, pendingDraftCount: 0, busy: false })).toBe('· archivo con cambios sin guardar');
  });

  it('con cambios sin guardar y borrador sin aplicar muestra ambos', () => {
    expect(fileStatusText({ dirty: true, pendingDraftCount: 1, busy: false })).toBe(
      '· archivo con cambios sin guardar · borrador sin aplicar',
    );
  });

  it('añade «calculando…» cuando el motor está ocupado', () => {
    expect(fileStatusText({ dirty: true, pendingDraftCount: 0, busy: true })).toBe(
      '· archivo con cambios sin guardar · calculando…',
    );
  });

  it('EditorApp.tsx usa fileStatusText en file-status y elimina el literal «sin cambios pendientes»', () => {
    const src = readFileSync(new URL('./EditorApp.tsx', import.meta.url), 'utf8');
    expect(src).toContain('fileStatusText({ dirty, pendingDraftCount: pendingDrafts.length, busy: engine.busy })');
    expect(src).not.toContain("'· sin cambios pendientes'");
  });
});
