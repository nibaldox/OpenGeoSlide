import type { TimeSummary } from '../analysis/runner';
import { formatNumber } from './ResultsTable';

interface Props {
  summary: TimeSummary | null;
  runs: number;
  busy: boolean;
  onRunsChange: (runs: number) => void;
  onMeasure: () => void;
}

export const MAX_PERF_RUNS = 100;

export function PerformancePanel({ summary, runs, busy, onRunsChange, onMeasure }: Props) {
  return (
    <section className="panel" aria-labelledby="perf-title">
      <h2 id="perf-title">Rendimiento</h2>
      <div className="perf-controls">
        <label>
          Repeticiones
          <input
            type="number"
            min={1}
            max={MAX_PERF_RUNS}
            value={runs}
            onChange={(e) => onRunsChange(Number(e.target.value))}
          />
        </label>
        <button type="button" onClick={onMeasure} disabled={busy}>
          Medir
        </button>
      </div>
      {summary ? (
        <dl className="perf-stats">
          <dt>Repeticiones</dt>
          <dd>{summary.runs}</dd>
          <dt>Promedio</dt>
          <dd>{formatNumber(summary.avg, 1)} ms</dd>
          <dt>Mínimo</dt>
          <dd>{formatNumber(summary.min, 1)} ms</dd>
          <dt>Máximo</dt>
          <dd>{formatNumber(summary.max, 1)} ms</dd>
        </dl>
      ) : (
        <p className="muted small">Mide el tiempo del análisis dentro del worker (performance.now).</p>
      )}
    </section>
  );
}
