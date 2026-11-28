// R7-05 y R7-14: el controlador del cálculo ignora respuestas obsoletas, se reinicia al cambiar de documento y se puede cancelar.
import { describe, expect, it, vi } from 'vitest';
import { EngineCancelledError } from '../../engine/client';
import { EngineError } from '../../engine/engine';
import type { AnalysisReport } from '../../engine/types';
import { createEditorStore } from '../state/store';
import { newDoc } from './docTemplates';
import type { Issue } from '../types';
import { checkButtonState, createEngineCheck, LOCAL_ERRORS_TEXT, localErrorsText } from './engineCheck';
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

/** Un modelo con un vértice no numérico (como el de un campo que se dejó con texto): el reductor no lo admite, se arma el documento entero. */
const setupBadVertex = () => {
  const base = newDoc();
  const region = base.regions[0]!;
  const polygon = region.polygon.map((p) => [...p]) as typeof region.polygon;
  polygon[2] = [polygon[2]![0], Number.NaN];
  const store = createEditorStore({ ...base, regions: [{ ...region, polygon }, ...base.regions.slice(1)] }, null);
  const client = fakeClient();
  return { store, client, ctl: createEngineCheck(store, client) };
};

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
    const text = ctl.getState().message;
    expect(text).toMatch(/^No se puede calcular: /);
    ctl.syncLocal(true);
    expect(ctl.getState().message).toBe(text);
    ctl.syncLocal(false);
    expect(ctl.getState().message).toBeNull();
  });

  it('CM-WC: el aviso de bloqueo nombra el primer error del documento, con su lugar', async () => {
    const { ctl } = setupBadVertex();
    expect(await ctl.check()).toBeNull();
    const msg = ctl.getState().message ?? '';
    expect(msg).toMatch(/^No se puede calcular: Región 1, vértice 3: las coordenadas x e y deben ser números/);
    expect(msg).toMatch(/\(ver Diagnósticos\)\.$/);
    expect(msg).not.toContain('y 1 error más');
    expect(ctl.getState().messageKind).toBe('error');
  });

  it('CM-WC: syncLocal pone al día el primer error si corrigen el primero y queda otro', async () => {
    const { store, ctl } = setupBadVertex();
    store.dispatch({ type: 'analysis/patch', patch: { slices: -3 } });
    await ctl.check();
    const before = ctl.getState().message ?? '';
    expect(before).toContain('error más');
    store.dispatch({ type: 'analysis/patch', patch: { slices: 30 } });
    ctl.syncLocal(true);
    const after = ctl.getState().message ?? '';
    expect(after).not.toBe(before);
    expect(after).not.toContain('error más');
    expect(after).toContain('vértice 3');
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

  it('UA3 A-01: una cancelación externa (Casos o «Reiniciar el motor») no deja el cálculo en «busy»', async () => {
    const { client, ctl } = setup();
    const ok = ctl.check();
    await until(() => client.calls.length === 1);
    client.calls[0]!.resolve({ report: report('previo'), elapsed_ms: 1 });
    await ok;
    const second = ctl.check();
    await until(() => client.calls.length === 2);
    expect(ctl.getState().busy).toBe(true);
    // Otro componente cancela el cliente compartido: este controlador no llamó a `cancel()` y su guardia sigue vigente.
    client.calls[1]!.reject(new EngineCancelledError());
    expect(await second).toBeNull();
    expect(ctl.getState()).toMatchObject({ busy: false, message: 'Cálculo cancelado.', messageKind: 'info' });
    expect(ctl.getState().run?.report.engine).toBe('previo');
    expect(ctl.getState().engine?.status).toBe('ok');
    expect(client.cancel).not.toHaveBeenCalled();
  });

  it('UA3 A-01: tras una cancelación externa se puede calcular de nuevo', async () => {
    const { client, ctl } = setup();
    const first = ctl.check();
    await until(() => client.calls.length === 1);
    client.calls[0]!.reject(new EngineCancelledError());
    await first;
    const again = ctl.check();
    await until(() => client.calls.length === 2);
    client.calls[1]!.resolve({ report: report('nuevo'), elapsed_ms: 1 });
    expect((await again)?.report.engine).toBe('nuevo');
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

describe('localErrorsText (CM-WC: el aviso de bloqueo nombra el error)', () => {
  const err = (text: string, path: string | null = null): Issue => ({ source: 'local', severity: 'error', code: 'editor.out_of_range', text, path });
  const aviso: Issue = { source: 'local', severity: 'aviso', code: 'editor.x', text: 'Un aviso que no bloquea.', path: null };

  it('con un error: lo nombra con su texto y su lugar, sin conteo', () => {
    expect(localErrorsText([err('Región 3, vértice 2: la coordenada y debe ser un número.')])).toBe(
      'No se puede calcular: Región 3, vértice 2: la coordenada y debe ser un número (ver Diagnósticos).',
    );
  });

  it('con dos errores: el primero y «y 1 error más» (singular)', () => {
    expect(localErrorsText([err('Región 3, vértice 2: la coordenada y debe ser un número.'), err('Análisis: los cortes deben ser positivos.')])).toBe(
      'No se puede calcular: Región 3, vértice 2: la coordenada y debe ser un número (y 1 error más; ver Diagnósticos).',
    );
  });

  it('con diez errores: el primero y «y 9 errores más» (plural)', () => {
    const issues = Array.from({ length: 10 }, (_, k) => err(`Región ${k + 1}: no encierra superficie.`));
    expect(localErrorsText(issues)).toBe('No se puede calcular: Región 1: no encierra superficie (y 9 errores más; ver Diagnósticos).');
  });

  it('los avisos y notas no cuentan, aunque vayan antes; el orden es el de los diagnósticos', () => {
    expect(localErrorsText([aviso, err('Sismo: kh fuera de rango.'), aviso, err('Otra cosa.')])).toBe('No se puede calcular: Sismo: kh fuera de rango (y 1 error más; ver Diagnósticos).');
  });

  it('colapsa espacios y quita el punto final del texto antes del paréntesis', () => {
    expect(localErrorsText([err('Región 1:   no  encierra\nsuperficie.  ')])).toBe('No se puede calcular: Región 1: no encierra superficie (ver Diagnósticos).');
  });

  it('sin errores (no debería ocurrir) cae al texto genérico', () => {
    expect(localErrorsText([aviso])).toBe(LOCAL_ERRORS_TEXT);
  });
});
