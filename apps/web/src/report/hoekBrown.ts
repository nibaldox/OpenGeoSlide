// Parámetros derivados de Hoek-Brown generalizado (Hoek, Carranza-Torres y Corkum, 2002, ecs. 3 a 5; F6.2).
// Una sola calculadora en la web: la de `editor/state/hoekBrown.ts` (W1). Este archivo solo adapta su firma al informe
// (`mi`, `gsi`, `disturbance`) y no repite las fórmulas; la paridad está en `hoekBrown.f3b.test.ts`.

import { hoekBrownParameters } from '../editor/state/hoekBrown';

export interface HoekBrownDerived {
  mb: number;
  s: number;
  a: number;
}

/** Calcula `mb`, `s` y `a` a partir de `mi`, `GSI` y el factor de perturbación `D` (`disturbance`). */
export function deriveHoekBrown(mi: number, gsi: number, disturbance: number): HoekBrownDerived {
  return hoekBrownParameters(gsi, mi, disturbance);
}

/** Devuelve `{ mb, s, a }` cuando `mi`, `gsi` y `disturbance` son números finitos; `null` si falta alguno. */
export function deriveHoekBrownFromMaterial(mat: {
  mi?: number | null;
  gsi?: number | null;
  disturbance?: number | null;
}): HoekBrownDerived | null {
  const { mi, gsi, disturbance } = mat;
  if (
    typeof mi !== 'number' ||
    !Number.isFinite(mi) ||
    typeof gsi !== 'number' ||
    !Number.isFinite(gsi) ||
    typeof disturbance !== 'number' ||
    !Number.isFinite(disturbance)
  ) {
    return null;
  }
  return deriveHoekBrown(mi, gsi, disturbance);
}
