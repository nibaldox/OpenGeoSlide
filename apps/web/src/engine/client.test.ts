// R7-14: el cliente del motor no se queda colgado si el Worker falla, y se puede cancelar un cálculo.
import { describe, expect, it, vi } from 'vitest';
import { EngineCancelledError, EngineClient, type EngineStatus, type PortLike } from './client';
import { EngineFatalError } from './engine';
import type { Request } from './protocol';

type Listener = (event: { data?: unknown; message?: string }) => void;

/** Worker de prueba: guarda lo enviado y permite emitir eventos a mano. */
function manualPort() {
  const sent: Request[] = [];
  const listeners: Record<string, Listener[]> = {};
  const port: PortLike & { terminated: boolean } = {
    terminated: false,
    postMessage(message) {
      sent.push(message);
    },
    addEventListener(type: string, listener: Listener) {
      (listeners[type] ??= []).push(listener);
    },
    terminate() {
      port.terminated = true;
    },
  };
  const emit = (type: string, event: { data?: unknown; message?: string }): void => {
    for (const l of listeners[type] ?? []) l(event);
  };
  return { port, sent, emit };
}

const infoOk = (id: number) => ({ id, ok: true, result: { name: 'ogs-core', version: '0.1.0', fallback_reason: null }, elapsed_ms: 1 });

describe('EngineClient: fallos del Worker', () => {
  it('un evento error del Worker rechaza las peticiones pendientes y deja el estado en «failed»', async () => {
    const w = manualPort();
    const client = new EngineClient(w.port);
    const pending = client.analyze('{}');
    w.emit('error', { message: 'Failed to fetch dynamically imported module' });
    const err = await pending.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EngineFatalError);
    expect((err as Error).message).toContain('Failed to fetch dynamically imported module');
    expect(client.getStatus()).toBe('failed');
  });

  it('un evento messageerror también rechaza las pendientes', async () => {
    const w = manualPort();
    const client = new EngineClient(w.port);
    const pending = client.version();
    w.emit('messageerror', {});
    await expect(pending).rejects.toBeInstanceOf(EngineFatalError);
    expect(client.getStatus()).toBe('failed');
  });

  it('una petición enviada después de un fallo no se queda colgada: se rechaza de inmediato', async () => {
    const w = manualPort();
    const client = new EngineClient(w.port);
    w.emit('error', { message: 'x' });
    await expect(client.analyze('{}')).rejects.toBeInstanceOf(EngineFatalError);
  });
});

describe('EngineClient: estado y cancelación', () => {
  it('empieza en «loading» y pasa a «ready» con la primera respuesta correcta; avisa a los suscritos', async () => {
    const w = manualPort();
    const client = new EngineClient(w.port);
    const seen: EngineStatus[] = [];
    client.subscribe(() => seen.push(client.getStatus()));
    expect(client.getStatus()).toBe('loading');
    const info = client.info();
    w.emit('message', { data: infoOk(w.sent[0]!.id) });
    await info;
    expect(client.getStatus()).toBe('ready');
    expect(seen).toEqual(['ready']);
  });

  it('cancel() rechaza lo pendiente con EngineCancelledError, termina el Worker y crea otro', async () => {
    const first = manualPort();
    const second = manualPort();
    const ports = [first, second];
    const factory = vi.fn(() => ports.shift()!.port);
    const client = new EngineClient(factory);
    const pending = client.analyze('{}');
    client.cancel();
    await expect(pending).rejects.toBeInstanceOf(EngineCancelledError);
    expect(first.port.terminated).toBe(true);
    expect(factory).toHaveBeenCalledTimes(2);
    // El Worker nuevo recibe el calentamiento (info) y las peticiones siguientes.
    expect(second.sent.map((r) => r.type)).toEqual(['engine']);
    expect(client.getStatus()).toBe('loading');
    second.emit('message', { data: infoOk(second.sent[0]!.id) });
    await Promise.resolve();
    expect(client.getStatus()).toBe('ready');
  });

  it('una respuesta tardía del Worker cancelado se ignora', async () => {
    const first = manualPort();
    const second = manualPort();
    const ports = [first, second];
    const client = new EngineClient(() => ports.shift()!.port);
    const stale = client.analyze('{}');
    const staleId = first.sent[0]!.id;
    client.cancel();
    await stale.catch(() => undefined);
    // El mismo id llegando por el Worker viejo no debe resolver nada del nuevo.
    const next = client.version();
    const nextId = second.sent[second.sent.length - 1]!.id;
    expect(nextId).not.toBe(staleId);
    first.emit('message', { data: { id: nextId, ok: true, result: 'viejo', elapsed_ms: 0 } });
    second.emit('message', { data: { id: nextId, ok: true, result: '9.9.9', elapsed_ms: 0 } });
    await expect(next).resolves.toBe('9.9.9');
  });

  it('un error del Worker viejo, ya cancelado, no estropea el estado del nuevo', () => {
    const first = manualPort();
    const second = manualPort();
    const ports = [first, second];
    const client = new EngineClient(() => ports.shift()!.port);
    client.cancel();
    first.emit('error', { message: 'tardío' });
    expect(client.getStatus()).toBe('loading');
  });
});
