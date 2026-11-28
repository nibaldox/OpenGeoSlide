// «Comprobar»: controlador del cálculo con el motor, sin React (se prueba en Node; `useEngineCheck` lo envuelve).
//
// - Un token de solicitud (`runGuard`) descarta las respuestas obsoletas: de otro documento (`reset`), de un cálculo
//   cancelado o de una petición anterior a otra más reciente (R7-05).
// - `reset()` vacía resultado, diagnóstico y mensaje: se llama al cargar otro documento.
// - `cancel()` termina el Worker (R7-14); el resultado anterior se conserva y sigue marcado según su revisión.
//
// Al motor se envía exactamente lo que guarda `saveOgsJson`, sin redondeo (E12g, R5-02).

import { EngineCancelledError, type EngineClient, type EngineStatus } from '../../engine/client';
import { saveOgsJson, sha256Hex } from '../../io/ogsJson';
import { validateLocal } from '../state/validateLocal';
import type { EditorStore, Issue } from '../types';
import { hasErrors, issueFromEngineError, issuesFromReport, type EngineDiagState } from './diagnostics';
import type { EngineRun } from './reportInput';
import { createRunGuard } from './runGuard';

/** Texto genérico: solo si no hay un error local del que tomar el texto (no ocurre con `hasErrors`, pero el tipo lo permite). */
export const LOCAL_ERRORS_TEXT = 'El modelo tiene errores: corríjalos (ver Diagnósticos) antes de calcular.';
export const CANCELLED_TEXT = 'Cálculo cancelado.';

export interface EngineCheckState {
  /** Cálculo en curso. */
  busy: boolean;
  /** Último cálculo correcto (puede ser de una revisión anterior). */
  run: EngineRun | null;
  engine: EngineDiagState | null;
  /** Mensaje de la última pulsación (errores locales que impidieron calcular, cálculo cancelado). */
  message: string | null;
  messageKind: 'error' | 'info';
}

export interface EngineCheckController {
  getState(): EngineCheckState;
  subscribe(listener: () => void): () => void;
  /** Ejecuta el cálculo. Devuelve el resultado, o `null` si no se calculó, falló, se canceló o quedó obsoleto. */
  check(): Promise<EngineRun | null>;
  /** Otro documento: descarta resultado, diagnóstico y mensaje, y las respuestas pendientes. */
  reset(): void;
  /** Termina el cálculo en curso (y su Worker). */
  cancel(): void;
  /** Informa de si el modelo tiene errores locales: si ya no los tiene, se retira el mensaje que los citaba. */
  syncLocal(localHasErrors: boolean): void;
}

/**
 * Aviso de bloqueo que nombra el primer error local, con su texto y su lugar (el texto ya empieza por «Región 3, vértice 2:»…),
 * y cuántos más hay. Sale de los mismos diagnósticos locales que ve el panel «Diagnósticos»: no hay otro canal.
 * Ej.: «No se puede calcular: Región 3, vértice 2: … (y 1 error más; ver Diagnósticos).»
 */
export function localErrorsText(issues: readonly Issue[]): string {
  const errors = issues.filter((i) => i.severity === 'error');
  const first = errors[0];
  if (!first) return LOCAL_ERRORS_TEXT;
  const more = errors.length - 1;
  const head = first.text.replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '');
  const tail = more === 0 ? 'ver Diagnósticos' : `y ${more} ${more === 1 ? 'error más' : 'errores más'}; ver Diagnósticos`;
  return `No se puede calcular: ${head} (${tail}).`;
}

const EMPTY: EngineCheckState = { busy: false, run: null, engine: null, message: null, messageKind: 'error' };

export function createEngineCheck(store: EditorStore, client: Pick<EngineClient, 'analyze' | 'cancel'>): EngineCheckController {
  const guard = createRunGuard();
  const listeners = new Set<() => void>();
  let state: EngineCheckState = EMPTY;
  /** Diagnóstico anterior al cálculo en curso: es el que vuelve si se cancela. */
  let previousEngine: EngineDiagState | null = null;
  /** Último aviso de bloqueo por errores locales (para retirarlo o actualizarlo cuando esos errores cambian). */
  let localMessage: string | null = null;

  const set = (patch: Partial<EngineCheckState>): void => {
    state = { ...state, ...patch };
    for (const l of [...listeners]) l();
  };

  async function check(): Promise<EngineRun | null> {
    if (state.busy) return null;
    const { doc, revision } = store.getState();
    const local = validateLocal(doc);
    if (hasErrors(local)) {
      localMessage = localErrorsText(local);
      set({ message: localMessage, messageKind: 'error' });
      return null;
    }
    localMessage = null;
    const id = guard.next();
    previousEngine = state.engine;
    set({ busy: true, message: null, engine: { status: 'checking', issues: [], revision } });
    try {
      const json = saveOgsJson(doc);
      const sha256 = await sha256Hex(json);
      if (!guard.isCurrent(id)) return null; // cancelado o reiniciado mientras se calculaba el hash
      const { report, elapsed_ms } = await client.analyze(json);
      if (!guard.isCurrent(id)) return null;
      const result: EngineRun = { revision, doc, json, sha256, report, elapsedMs: elapsed_ms, checkedAt: new Date().toISOString() };
      set({ busy: false, run: result, engine: { status: 'ok', issues: issuesFromReport(report), revision } });
      return result;
    } catch (error) {
      if (!guard.isCurrent(id)) return null;
      if (error instanceof EngineCancelledError) {
        // Cancelación externa (UA3 A-01): el cliente es compartido (Casos, «Reiniciar el motor») y la guardia sigue vigente,
        // así que nadie más va a cerrar este cálculo: se restaura el estado como en `cancel()`.
        guard.invalidate();
        set({ busy: false, engine: previousEngine, message: CANCELLED_TEXT, messageKind: 'info' });
        return null;
      }
      set({ busy: false, run: null, engine: { status: 'error', issues: [issueFromEngineError(error)], revision } });
      return null;
    }
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    check,
    reset() {
      guard.invalidate();
      previousEngine = null;
      localMessage = null;
      set({ ...EMPTY });
    },
    cancel() {
      if (!state.busy) return;
      guard.invalidate();
      client.cancel();
      set({ busy: false, engine: previousEngine, message: CANCELLED_TEXT, messageKind: 'info' });
    },
    syncLocal(localHasErrors) {
      if (localMessage === null || state.message !== localMessage) return;
      if (!localHasErrors) {
        localMessage = null;
        set({ message: null });
        return;
      }
      // Siguen los errores, pero quizá ya no es el mismo el primero: el aviso nombra el de ahora.
      const local = validateLocal(store.getState().doc);
      if (!hasErrors(local)) return;
      const next = localErrorsText(local);
      if (next === localMessage) return;
      localMessage = next;
      set({ message: next });
    },
  };
}

export interface CheckButtonState {
  label: string;
  disabled: boolean;
  /** Texto visible junto al botón cuando el motor no permite calcular (`null` si no hay nada que decir). */
  status: string | null;
}

/** Texto y estado del botón «Comprobar» según el cálculo y el estado del motor (R7-14). */
export function checkButtonState(s: { busy: boolean; engineStatus: EngineStatus }): CheckButtonState {
  if (s.busy) return { label: 'Calculando…', disabled: true, status: null };
  if (s.engineStatus === 'loading') return { label: 'Comprobar', disabled: true, status: 'Cargando el motor…' };
  if (s.engineStatus === 'failed') {
    return { label: 'Comprobar', disabled: true, status: 'El motor no está disponible. Reinícielo o recargue la página.' };
  }
  return { label: 'Comprobar', disabled: false, status: null };
}
