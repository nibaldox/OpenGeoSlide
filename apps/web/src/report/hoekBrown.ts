// Parámetros derivados de Hoek-Brown generalizado (Hoek, Carranza-Torres y Corkum, 2002, ecs. 3 a 5; F6.2).
// Nota para B2: escrito aquí en W2 porque `editor/state/hoekBrown.ts` pertenece a W1 en B1; unificar en la integración.

export interface HoekBrownDerived {
  mb: number;
  s: number;
  a: number;
}

/** Calcula `mb`, `s` y `a` a partir de `mi`, `GSI` y el factor de perturbación `D` (`disturbance`). */
export function deriveHoekBrown(mi: number, gsi: number, disturbance: number): HoekBrownDerived {
  const mb = mi * Math.exp((gsi - 100) / (28 - 14 * disturbance));
  const s = Math.exp((gsi - 100) / (9 - 3 * disturbance));
  const a = 0.5 + (Math.exp(-gsi / 15) - Math.exp(-20 / 3)) / 6;
  return { mb, s, a };
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
