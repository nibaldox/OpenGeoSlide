// Valor que muestra el `<select>` de material de una capa DXF (ImportDialogs). Lógica pura, para poder probarla.

import { SKIP_LAYER } from './importPlan';

/**
 * Elección vigente para una capa: lo que dice `mapping`, o «omitir» si la capa no está mapeada.
 * `Object.hasOwn` (igual que `planRegionImport`): una capa llamada «constructor» o «toString» no debe heredar nada
 * de `Object.prototype` y mostrar una función como valor.
 */
export function layerChoice(mapping: Record<string, string>, layer: string): string {
  return Object.hasOwn(mapping, layer) ? (mapping[layer] ?? SKIP_LAYER) : SKIP_LAYER;
}
