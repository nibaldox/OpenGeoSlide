import type { EngineInfo } from '../engine/protocol';

export type EngineIndicatorKind = 'loading' | 'ok' | 'simulated' | 'error';

export interface EngineIndicatorState {
  kind: EngineIndicatorKind;
  /** Texto del indicador compacto. */
  text: string;
}

/** Estado del motor para el indicador compacto de la cabecera (UX-03). Los fallos se siguen mostrando con detalle aparte. */
export function engineIndicator(info: EngineInfo | null, error: string | null): EngineIndicatorState {
  if (error) return { kind: 'error', text: 'Motor no disponible' };
  if (!info) return { kind: 'loading', text: 'Cargando el motor…' };
  if (info.name === 'mock') return { kind: 'simulated', text: 'Motor simulado' };
  return { kind: 'ok', text: `Motor: ogs-core ${info.version} (WASM)` };
}

/** Indicador compacto del motor. Conserva `data-testid="engine-banner"` y el texto «Motor: ogs-core …» del recorrido e2e. */
export function EngineIndicator({ info, error }: { info: EngineInfo | null; error: string | null }) {
  const s = engineIndicator(info, error);
  return (
    <p className={`engine-badge engine-badge-${s.kind}`} data-testid="engine-banner" data-engine-state={s.kind}>
      <span className="engine-dot" aria-hidden="true" />
      {s.text}
    </p>
  );
}
