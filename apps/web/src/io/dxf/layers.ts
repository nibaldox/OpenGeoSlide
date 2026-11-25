// Capas y unidades del DXF: sugerencia de material por capa y lectura de `$INSUNITS` (X3 §2.7).

import type { DxfImportResult } from '../types';

export interface MaterialRef {
  id: string;
  name: string;
}

/**
 * `$INSUNITS` → unidad (referencia de AutoCAD: 1 = in, 2 = ft, 4 = mm, 5 = cm, 6 = m). Otros valores (0 = sin
 * unidad, millas, yardas…) devuelven `null`: la UI pide al usuario que confirme la unidad.
 */
export function unitsFromInsunits(code: number | null): DxfImportResult['unitsFromHeader'] {
  switch (code) {
    case 1:
      return 'in';
    case 2:
      return 'ft';
    case 4:
      return 'mm';
    case 5:
      return 'cm';
    case 6:
      return 'm';
    default:
      return null;
  }
}

/** Material cuyo `id` o `name` coincide con la capa, sin distinguir mayúsculas; el `id` tiene prioridad. */
export function suggestMaterialId(layer: string, materials: readonly MaterialRef[]): string | null {
  const key = layer.trim().toLowerCase();
  if (key === '') return null;
  const byId = materials.find((m) => m.id.trim().toLowerCase() === key);
  if (byId) return byId.id;
  const byName = materials.find((m) => m.name.trim().toLowerCase() === key);
  return byName ? byName.id : null;
}

/** Lista de capas únicas (orden de aparición) con su material sugerido. */
export function buildLayers(names: readonly string[], materials: readonly MaterialRef[]): DxfImportResult['layers'] {
  const seen = new Set<string>();
  const out: DxfImportResult['layers'] = [];
  for (const name of names) {
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, suggestedMaterialId: suggestMaterialId(name, materials) });
  }
  return out;
}
