// UA3 B-07: el título y el aviso de la vista Informe dicen lo mismo que el PDF y que el resto de la pantalla.
import { describe, expect, it } from 'vitest';
import { reportDocTitle, reportNotice } from './reportTitle';

describe('reportDocTitle', () => {
  it('título, si lo hay', () => expect(reportDocTitle('  ACADS 1(a) ', 'V047a')).toBe('ACADS 1(a)'));
  it('sin título, el id del modelo (como el PDF)', () => {
    expect(reportDocTitle('', 'PROY-2026-01')).toBe('PROY-2026-01');
    expect(reportDocTitle('   ', ' PROY-2026-01 ')).toBe('PROY-2026-01');
    expect(reportDocTitle(undefined, 'X')).toBe('X');
  });
  it('sin título ni id, «Sin título»', () => {
    expect(reportDocTitle('', '')).toBe('Sin título');
    expect(reportDocTitle(null, undefined)).toBe('Sin título');
  });
});

describe('reportNotice', () => {
  const base = { hasRun: true, current: true, hasDrafts: false, draftsText: 'Hay cambios sin aplicar', staleText: 'El modelo cambió' };
  it('sin motivo de bloqueo no hay aviso', () => expect(reportNotice(base)).toBeNull());
  it('resultado de una revisión anterior: la pista de desactualizado', () => expect(reportNotice({ ...base, current: false })).toBe('El modelo cambió'));
  it('borradores sin aplicar: su texto, con prioridad', () => expect(reportNotice({ ...base, current: false, hasDrafts: true })).toBe('Hay cambios sin aplicar'));
  it('sin cálculo la lista de contenido ya lo explica', () => expect(reportNotice({ ...base, hasRun: false, current: false })).toBeNull());
});
