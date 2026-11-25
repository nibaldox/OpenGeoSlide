// «Comprobar»: ejecuta `analyze` con el motor real (worker), guarda el último cálculo y mantiene el diagnóstico del
// store (incidencias locales + las del motor). Un segundo cálculo se bloquea mientras hay uno en curso.
//
// Al motor se envía exactamente lo que guarda `saveOgsJson`, sin redondeo (E12g, R5-02): el cálculo y el archivo
// guardado coinciden bit a bit con el modelo del documento.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EngineClient } from '../../engine/client';
import { saveOgsJson, sha256Hex } from '../../io/ogsJson';
import { useEditorStore, useLocalIssues, validateLocal } from '../state';
import type { EditorStore } from '../types';
import { composeDiagnostics, hasErrors, issueFromEngineError, issuesFromReport, type EngineDiagState } from './diagnostics';
import { isRunCurrent, type EngineRun } from './reportInput';

export const LOCAL_ERRORS_TEXT = 'El modelo tiene errores: corríjalos (ver Diagnósticos) antes de calcular.';

export interface EngineCheck {
  /** Cálculo en curso. */
  busy: boolean;
  /** Último cálculo correcto (puede ser de una revisión anterior: ver `current`). */
  run: EngineRun | null;
  /** `true` si `run` corresponde a la revisión actual del documento. */
  current: boolean;
  /** Mensaje de la última pulsación (p. ej. errores locales que impidieron calcular). */
  message: string | null;
  /** Ejecuta el cálculo. Devuelve el resultado o `null` si no se calculó o falló. */
  check(): Promise<EngineRun | null>;
}

export function useEngineCheck(store: EditorStore, client: EngineClient): EngineCheck {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [run, setRun] = useState<EngineRun | null>(null);
  const [engine, setEngine] = useState<EngineDiagState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const localIssues = useLocalIssues(store);
  const revision = useEditorStore(store, (s) => s.revision);

  // El store guarda el diagnóstico combinado: lo ven el panel de Diagnósticos y el estado `stale`.
  useEffect(() => {
    store.setDiagnostics(composeDiagnostics(localIssues, engine, revision));
  }, [store, localIssues, engine, revision]);

  const check = useCallback(async (): Promise<EngineRun | null> => {
    if (busyRef.current) return null;
    const { doc, revision: rev } = store.getState();
    if (hasErrors(validateLocal(doc))) {
      setMessage(LOCAL_ERRORS_TEXT);
      return null;
    }
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    setEngine({ status: 'checking', issues: [], revision: rev });
    try {
      const json = saveOgsJson(doc);
      const sha256 = await sha256Hex(json);
      const { report, elapsed_ms } = await client.analyze(json);
      const result: EngineRun = {
        revision: rev,
        doc,
        json,
        sha256,
        report,
        elapsedMs: elapsed_ms,
        checkedAt: new Date().toISOString(),
      };
      setRun(result);
      setEngine({ status: 'ok', issues: issuesFromReport(report), revision: rev });
      return result;
    } catch (error) {
      setRun(null);
      setEngine({ status: 'error', issues: [issueFromEngineError(error)], revision: rev });
      return null;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [store, client]);

  return { busy, run, current: isRunCurrent(run, revision), message, check };
}
