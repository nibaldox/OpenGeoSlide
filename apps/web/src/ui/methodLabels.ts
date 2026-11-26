import type { MethodKind } from '../engine/types';

export const METHOD_LABELS: Record<MethodKind, string> = {
  bishop: 'Bishop simplificado',
  spencer: 'Spencer',
  morgenstern_price: 'Morgenstern-Price',
  janbu_simplified: 'Janbu simplificado',
  janbu_corrected: 'Janbu corregido',
};
