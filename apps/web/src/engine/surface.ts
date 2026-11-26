// Estrechamiento de las superficies (F3.3): `SurfaceSpec` y `MethodReport.surface` son uniones círculo | polilínea.
// Estas funciones son los guardas permanentes de tipo (ya no son un puente provisional): el código que trabaja con el centro y
// el radio (tiradores del círculo, columnas xc/yc/r, arco del informe) las usa y recibe null ante una polilínea; el código de la
// polilínea usa `isPolylineReport` o `surface.type === 'polyline'`. Inventario de usos: docs/fase3/iw/NOTAS.md.

import type { Circle, CircleSurfaceSpec, PolylineReportSurface, ReportSurface, SurfaceSpec } from './types';

/** La superficie fija de entrada si es un círculo; null si no hay superficie o es una polilínea. */
export function circleSpec(surface: SurfaceSpec | null | undefined): CircleSurfaceSpec | null {
  // Todo lo que no es polilínea cuenta como círculo (un documento sin `type` ya se trataba así).
  return surface != null && surface.type !== 'polyline' ? surface : null;
}

/** La superficie de un informe si es un círculo `{xc, yc, r}`; null si es una polilínea `{points}`. */
export function reportCircle(surface: ReportSurface): Circle | null {
  return 'points' in surface ? null : surface;
}

/** La superficie de un informe es una polilínea `{points}`. */
export function isPolylineReport(surface: ReportSurface): surface is PolylineReportSurface {
  return 'points' in surface;
}
