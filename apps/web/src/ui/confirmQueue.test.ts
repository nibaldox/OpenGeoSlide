import { describe, expect, it, vi } from 'vitest';
import { createConfirmQueue, normalizeConfirm } from './confirmQueue';

const OPTS = { title: 'Descartar cambios', message: 'Hay cambios sin guardar.', confirmLabel: 'Descartar' };

describe('normalizeConfirm', () => {
  it('rellena «Cancelar» y el tono por omisión', () => {
    expect(normalizeConfirm(OPTS)).toEqual({ ...OPTS, cancelLabel: 'Cancelar', tone: 'default' });
  });
  it('respeta el tono y la etiqueta de cancelar si se dan', () => {
    expect(normalizeConfirm({ ...OPTS, tone: 'danger', cancelLabel: 'Volver' })).toMatchObject({ tone: 'danger', cancelLabel: 'Volver' });
  });
  it('una etiqueta vacía vuelve al valor por omisión', () => {
    expect(normalizeConfirm({ ...OPTS, cancelLabel: '  ' }).cancelLabel).toBe('Cancelar');
  });
});

describe('createConfirmQueue', () => {
  it('sin solicitudes no hay diálogo', () => {
    expect(createConfirmQueue().current()).toBeNull();
  });

  it('la solicitud queda a la vista y se resuelve con true al confirmar', async () => {
    const q = createConfirmQueue();
    const p = q.request(OPTS);
    expect(q.current()?.options.title).toBe('Descartar cambios');
    q.resolve(true);
    await expect(p).resolves.toBe(true);
    expect(q.current()).toBeNull();
  });

  it('cancelar resuelve false', async () => {
    const q = createConfirmQueue();
    const p = q.request(OPTS);
    q.resolve(false);
    await expect(p).resolves.toBe(false);
  });

  it('las solicitudes se atienden en orden, una a la vez', async () => {
    const q = createConfirmQueue();
    const a = q.request({ ...OPTS, title: 'A' });
    const b = q.request({ ...OPTS, title: 'B' });
    expect(q.current()?.options.title).toBe('A');
    expect(q.size()).toBe(2);
    q.resolve(true);
    await expect(a).resolves.toBe(true);
    expect(q.current()?.options.title).toBe('B');
    q.resolve(false);
    await expect(b).resolves.toBe(false);
    expect(q.current()).toBeNull();
  });

  it('resolve sin diálogo abierto no hace nada', () => {
    const q = createConfirmQueue();
    expect(() => q.resolve(true)).not.toThrow();
  });

  it('cada solicitud tiene un id distinto (la interfaz reinicia el diálogo al cambiar)', () => {
    const q = createConfirmQueue();
    void q.request(OPTS);
    const first = q.current()?.id;
    q.resolve(true);
    void q.request(OPTS);
    expect(q.current()?.id).not.toBe(first);
  });

  it('avisa a los suscriptores al pedir y al resolver, y deja de avisar al darse de baja', () => {
    const q = createConfirmQueue();
    const listener = vi.fn();
    const off = q.subscribe(listener);
    void q.request(OPTS);
    q.resolve(true);
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    void q.request(OPTS);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('el valor de current() es estable mientras no cambie la cola (useSyncExternalStore)', () => {
    const q = createConfirmQueue();
    void q.request(OPTS);
    expect(q.current()).toBe(q.current());
  });

  it('guarda el disparador para devolverle el foco', () => {
    const q = createConfirmQueue();
    const opener = { name: 'botón' };
    void q.request(OPTS, opener);
    expect(q.current()?.opener).toBe(opener);
    q.resolve(false);
    void q.request(OPTS);
    expect(q.current()?.opener).toBeNull();
  });

  it('cancelAll resuelve todo como false (el host se desmonta)', async () => {
    const q = createConfirmQueue();
    const a = q.request(OPTS);
    const b = q.request(OPTS);
    q.cancelAll();
    await expect(a).resolves.toBe(false);
    await expect(b).resolves.toBe(false);
    expect(q.current()).toBeNull();
  });
});
