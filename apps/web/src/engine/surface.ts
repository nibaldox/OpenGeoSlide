// Acceso a las superficies como círculo mientras la web no maneja polilíneas (F3.3).
// Con la v0.3, `SurfaceSpec` y `MethodReport.surface` son uniones: el código que solo sabe de círculos pasa por
// estas funciones, que devuelven null ante una polilínea en lugar de leer campos que no existen.
// F3-W1e/W1f reemplazan esos usos por el soporte completo de la polilínea.

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
