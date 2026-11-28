// «Comprobar» en React: envuelve el controlador de `engineCheck.ts` (token de solicitud, reinicio y cancelación) y
// mantiene el diagnóstico del store (incidencias locales + las del motor).

import { useCallback, useMemo, useEffect, useSyncExternalStore } from 'react';
import type { EngineClient } from '../../engine/client';
import { clearPendingDrafts, getPendingDrafts, hasPendingDrafts, subscribePendingDrafts } from '../panels/forms';
import { useEditorStore, useLocalIssues } from '../state';
import type { EditorStore } from '../types';
import { composeDiagnostics, hasErrors } from './diagnostics';
import { createEngineCheck, type EngineCheckState } from './engineCheck';
import { isRunCurrent, type EngineRun } from './reportInput';

export { LOCAL_ERRORS_TEXT } from './engineCheck';

export interface EngineCheck {
  /** Cálculo en curso. */
  busy: boolean;
  /** Último cálculo correcto (puede ser de una revisión anterior: ver `current`). */
  run: EngineRun | null;
  /** `true` si `run` corresponde a la revisión actual del documento. */
  current: boolean;
  /** Tarjetas con borradores sin aplicar al documento (R15B-01): bloquean «Comprobar» y exportaciones. */
  pendingDrafts: readonly string[];
  /** Mensaje de la última pulsación (errores locales que impidieron calcular, cálculo cancelado). */
  message: string | null;
  messageKind: EngineCheckState['messageKind'];
  /** Ejecuta el cálculo. Devuelve el resultado o `null` si no se calculó, falló o se descartó. */
  check(): Promise<EngineRun | null>;
  /** Cambio de documento (Nuevo, Abrir, Ejemplos, Recuperar): descarta resultado, diagnóstico y respuestas pendientes. */
  reset(): void;
  /** Termina el cálculo en curso y recrea el Worker. */
  cancel(): void;
}

export function useEngineCheck(store: EditorStore, client: EngineClient): EngineCheck {
  const controller = useMemo(() => createEngineCheck(store, client), [store, client]);
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const pendingDrafts = useSyncExternalStore(
    useCallback((listener: () => void) => subscribePendingDrafts(store, listener), [store]),
    useCallback(() => getPendingDrafts(store), [store]),
    useCallback(() => getPendingDrafts(store), [store]),
  );
  const localIssues = useLocalIssues(store);
  const revision = useEditorStore(store, (s) => s.revision);

  // El store guarda el diagnóstico combinado: lo ven el panel de Diagnósticos y el estado `stale`.
  useEffect(() => {
    store.setDiagnostics(composeDiagnostics(localIssues, state.engine, revision));
  }, [store, localIssues, state.engine, revision]);

  // Al corregir los errores locales, el mensaje que los citaba deja de tener sentido.
  const localHasErrors = hasErrors(localIssues);
  useEffect(() => {
    controller.syncLocal(localHasErrors);
    // CM-WC: con los errores aún presentes, el aviso sigue al primer error vigente (`localIssues` cambia con cada edición).
  }, [controller, localHasErrors, localIssues]);

  // R15B-01: nunca calcular sobre el material o refuerzo anterior mientras una tarjeta muestra un borrador sin aplicar.
  const check = useCallback(async (): Promise<EngineRun | null> => {
    if (hasPendingDrafts(store)) return null;
    return controller.check();
  }, [store, controller]);

  const reset = useCallback((): void => {
    clearPendingDrafts(store);
    controller.reset();
  }, [store, controller]);

  return {
    busy: state.busy,
    run: state.run,
    current: isRunCurrent(state.run, revision),
    pendingDrafts,
    message: state.message,
    messageKind: state.messageKind,
    check,
    reset,
    cancel: controller.cancel,
  };
}
