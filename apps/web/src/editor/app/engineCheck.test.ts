// R7-05 y R7-14: el controlador del cálculo ignora respuestas obsoletas, se reinicia al cambiar de documento y se puede cancelar.
import { describe, expect, it, vi } from 'vitest';
import { EngineCancelledError } from '../../engine/client';
import { EngineError } from '../../engine/engine';
import type { AnalysisReport } from '../../engine/types';
import { createEditorStore } from '../state/store';
import { newDoc } from './docTemplates';
import { checkButtonState, createEngineCheck, LOCAL_ERRORS_TEXT } from './engineCheck';
import { isRunCurrent } from './reportInput';

const report = (engine = 'ogs-core test'): AnalysisReport => ({ engine, results: [] });

/** Cliente de prueba: cada `analyze` queda a la espera de que el test lo resuelva o lo rechace. */
function fakeClient() {
  const calls: { resolve: (r: { report: AnalysisReport; elapsed_ms: number }) => void; reject: (e: unknown) => void }[] = [];
  return {
    calls,
    cancel: vi.fn(),
    analyze: vi.fn(
      () =>
        new Promise<{ report: AnalysisReport; elapsed_ms: number }>((resolve, reject) => {
          calls.push({ resolve, reject });
        }),
    ),
  };
}

const setup = () => {
  const store = createEditorStore(newDoc(), null);
  const client = fakeClient();
  const ctl = createEngineCheck(store, client);
  return { store, client, ctl };
};

/** Deja pasar las microtareas (sha256 y promesas) hasta que `analyze` se haya llamado `n` veces. */
async function until(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !predicate(); i += 1) await new Promise((r) => setTimeout(r, 0));
  expect(predicate()).toBe(true);
}

describe('createEngineCheck', () => {
  it('guarda el resultado de la revisión calculada', async () => {
    const { client, ctl } = setup();
    const done = ctl.check();
    await until(() => client.calls.length === 1);
    expect(ctl.getState().busy).toBe(true);
    client.calls[0]!.resolve({ report: report(), elapsed_ms: 3 });
    const run = await done;
    expect(run?.report.engine).toBe('ogs-core test');
    expect(ctl.getState()).toMatchObject({ busy: false, message: null });
    expect(ctl.getState().engine?.status).toBe('ok');
  });

  it('R7-05: reset() borra resultado, diagnóstico y mensaje del modelo anterior', async () => {
    const { client, ctl } = setup();
    const done = ctl.check();
    await until(() => client.calls.length === 1);
    client.calls[0]!.resolve({ report: report(), elapsed_ms: 3 });
    await done;
    expect(ctl.getState().run).not.toBeNull();
    ctl.reset();
    expect(ctl.getState()).toMatchObject({ busy: false, run: null, engine: null, message: null });
  });

  it('R7-05: una respuesta que llega tras reset() (otro documento) se descarta', async () => {
    const { client, ctl } = setup();
    const done = ctl.check();
    await until(() => client.calls.length === 1);
    ctl.reset();
    client.calls[0]!.resolve({ report: report('viejo'), elapsed_ms: 3 });
    expect(await done).toBeNull();
    expect(ctl.getState().run).toBeNull();
    expect(ctl.getState().busy).toBe(false);
  });

  it('R7-05: tras reset() se puede calcular de nuevo y la respuesta vieja no pisa a la nueva', async () => {
    const { client, ctl } = setup();
    const first = ctl.check();
    await until(() => client.calls.length === 1);
    ctl.reset();
    const second = ctl.check();
    await until(() => client.calls.length === 2);
    client.calls[1]!.resolve({ report: report('nuevo'), elapsed_ms: 1 });
    await second;
    client.calls[0]!.resolve({ report: report('viejo'), elapsed_ms: 1 });
    await first;
    expect(ctl.getState().run?.report.engine).toBe('nuevo');
    expect(ctl.getState().busy).toBe(false);
  });

  it('R7-05: un fallo de la petición vieja tras reset() no borra el estado de la nueva', async () => {
    const { client, ctl } = setup();
    const first = ctl.check();
    await until(() => client.calls.length === 1);
    ctl.reset();
    const second = ctl.check();
    await until(() => client.calls.length === 2);
    client.calls[1]!.resolve({ report: report('nuevo'), elapsed_ms: 1 });
    await second;
    client.calls[0]!.reject(new EngineError('InvalidModel: x'));
    await first;
    expect(ctl.getState().run?.report.engine).toBe('nuevo');
    expect(ctl.getState().engine?.status).toBe('ok');
  });

  it('editar mientras se calcula deja el resultado marcado como obsoleto, no como actual', async () => {
    const { store, client, ctl } = setup();
    const done = ctl.check();
    await until(() => client.calls.length === 1);
    store.dispatch({ type: 'meta/patch', patch: { title: 'editado durante el cálculo' } });
    client.calls[0]!.resolve({ report: report(), elapsed_ms: 1 });
    await done;
    expect(isRunCurrent(ctl.getState().run, store.getState().revision)).toBe(false);
  });

  it('R7-05: el mensaje de errores locales se limpia cuando esos errores desaparecen', async () => {
    const { store, ctl } = setup();
    store.dispatch({ type: 'analysis/patch', patch: { slices: -3 } });
    expect(await ctl.check()).toBeNull();
    expect(ctl.getState().message).toBe(LOCAL_ERRORS_TEXT);
    ctl.syncLocal(true);
    expect(ctl.getState().message).toBe(LOCAL_ERRORS_TEXT);
    ctl.syncLocal(false);
    expect(ctl.getState().message).toBeNull();
  });

  it('syncLocal no borra otros mensajes', async () => {
    const { client, ctl } = setup();
    const done = ctl.check();
    await until(() => client.calls.length === 1);
    ctl.cancel();
    client.calls[0]!.reject(new EngineCancelledError());
    await done;
    expect(ctl.getState().message).toBe('Cálculo cancelado.');
    ctl.syncLocal(false);
    expect(ctl.getState().message).toBe('Cálculo cancelado.');
  });

  it('R7-14: cancelar termina el cálculo, conserva el resultado anterior y avisa', async () => {
    const { client, ctl } = setup();
    const ok = ctl.check();
    await until(() => client.calls.length === 1);
    client.calls[0]!.resolve({ report: report('previo'), elapsed_ms: 1 });
    await ok;
    const second = ctl.check();
    await until(() => client.calls.length === 2);
    expect(ctl.getState().busy).toBe(true);
    ctl.cancel();
    expect(client.cancel).toHaveBeenCalledTimes(1);
    expect(ctl.getState()).toMatchObject({ busy: false, message: 'Cálculo cancelado.', messageKind: 'info' });
    client.calls[1]!.reject(new EngineCancelledError());
    expect(await second).toBeNull();
    expect(ctl.getState().run?.report.engine).toBe('previo');
    expect(ctl.getState().engine?.status).toBe('ok');
  });

  it('cancelar sin cálculo en curso no hace nada', () => {
    const { client, ctl } = setup();
    ctl.cancel();
    expect(client.cancel).not.toHaveBeenCalled();
  });

  it('un error del motor en la petición vigente se refleja en el diagnóstico', async () => {
    const { client, ctl } = setup();
    const done = ctl.check();
    await until(() => client.calls.length === 1);
    client.calls[0]!.reject(new EngineError('NoValidSurface: nada'));
    expect(await done).toBeNull();
    expect(ctl.getState().engine?.status).toBe('error');
    expect(ctl.getState().run).toBeNull();
  });

  it('notifica a los suscritos y deja de hacerlo al darse de baja', async () => {
    const { client, ctl } = setup();
    const l = vi.fn();
    const off = ctl.subscribe(l);
    const done = ctl.check();
    await until(() => client.calls.length === 1);
    expect(l).toHaveBeenCalled();
    off();
    l.mockClear();
    ctl.reset();
    expect(l).not.toHaveBeenCalled();
    client.calls[0]!.resolve({ report: report(), elapsed_ms: 1 });
    await done;
  });
});

describe('checkButtonState', () => {
  it('deshabilitado y con estado visible mientras el motor carga', () => {
    expect(checkButtonState({ busy: false, engineStatus: 'loading' })).toEqual({ label: 'Comprobar', disabled: true, status: 'Cargando el motor…' });
  });
  it('deshabilitado con el motor caído, con el motivo', () => {
    const s = checkButtonState({ busy: false, engineStatus: 'failed' });
    expect(s.disabled).toBe(true);
    expect(s.status).toMatch(/motor no está disponible/i);
  });
  it('habilitado con el motor listo; en cálculo muestra «Calculando…» y sigue bloqueado', () => {
    expect(checkButtonState({ busy: false, engineStatus: 'ready' })).toEqual({ label: 'Comprobar', disabled: false, status: null });
    expect(checkButtonState({ busy: true, engineStatus: 'ready' })).toEqual({ label: 'Calculando…', disabled: true, status: null });
  });
});
