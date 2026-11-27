// Método cuya superficie se dibuja tras un cálculo (UA3 B-05): el del FS mínimo que muestra el HUD. Lógica pura.

import type { AnalysisReport, MethodKind } from '../../../engine/types';
import { fsMinimum } from '../shellModel';

/**
 * - Si el usuario eligió un método (`chosen`) y sigue en el informe, se respeta.
 * - Si no, el primero de `fsMinimum(report).methods` (el que da el FS mínimo convergido).
 * - Si ninguno convergió, `results[0]`. Sin resultados, `null`.
 */
export function pickShownMethod(report: AnalysisReport, chosen: MethodKind | null): MethodKind | null {
  if (chosen && report.results.some((r) => r.method === chosen)) return chosen;
  return fsMinimum(report).methods[0] ?? report.results[0]?.method ?? null;
}
