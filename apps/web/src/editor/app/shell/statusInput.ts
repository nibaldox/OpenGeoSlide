// Entrada del chip de la cabecera (`runStatus`) a partir del estado del armazón: lógica pura, probada en Node.
// Lo que el chip dice del cálculo es verdad sobre el modelo que se ve (UA3 A-02, B-01, A-03, UA-E3 §4).

import type { EngineStatus } from '../../../engine/client';
import type { RunStatusInput } from '../shellModel';
import type { EngineRun } from '../reportInput';

export interface StatusInputSource {
  engineStatus: EngineStatus;
  busy: boolean;
  run: EngineRun | null;
  /** `run` corresponde a la revisión actual del documento. */
  current: boolean;
  pendingDrafts: number;
  regions: number;
  localErrors: number;
  methodsRequested: number;
  /** Mensaje de la última pulsación (`useEngineCheck`). */
  message: string | null;
  messageKind: 'error' | 'info';
  /** Texto del error del motor en Diagnósticos (`NoValidSurface`…), o `null`. */
  engineErrorText: string | null;
  /** Avisos locales más avisos del cálculo actual (`advisoryCounts().total`). */
  advisories: number;
}

export function buildRunStatusInput(s: StatusInputSource): RunStatusInput {
  const engineFailure = s.message === null && s.engineErrorText !== null;
  return {
    engineStatus: s.engineStatus,
    busy: s.busy,
    run: s.run,
    // Con borradores sin aplicar el resultado no es el del modelo que se ve.
    current: s.current && s.pendingDrafts === 0,
    pendingDrafts: s.pendingDrafts,
    hasRegions: s.regions > 0,
    localErrors: s.localErrors,
    methodsRequested: s.methodsRequested,
    message: s.message ?? s.engineErrorText,
    messageKind: engineFailure ? 'error' : s.messageKind,
    advisories: s.advisories,
  };
}
