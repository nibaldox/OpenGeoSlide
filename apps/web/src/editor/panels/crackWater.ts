// E15l-14 (R12 B-01): al activar el agua de la grieta en un modelo imperial, el γw se escribe explícito.
//
// El motor usa 9,81 si falta `water.unit_weight` y no convierte unidades: en un modelo en pcf el agua pesaría «9,81 pcf» (6,37 veces menos) y
// el FS cambiaría. Se escribe 9,81 kN/m³ convertido (62,45 pcf) solo si falta; un γw explícito del usuario no se toca.
import type { TensionCrack } from '../../engine/types';
import type { EditorCommand, ModelDoc } from '../types';
import { WATER_UNIT_WEIGHT_SI, isImperialUnits, UNIT_FACTORS } from '../state/units';
import { crackCommands } from './forms';

/** Comandos de «Editar la grieta de tracción»: los de la grieta y, en imperial con agua en la grieta y sin γw, el γw explícito. */
export function crackEditCommands(doc: ModelDoc, value: TensionCrack | null): EditorCommand[] {
  const commands = crackCommands(doc, value);
  const usesWater = value !== null && value.water_fill > 0;
  if (usesWater && isImperialUnits(doc.units) && typeof doc.water?.unit_weight !== 'number') {
    commands.push({ type: 'water/setUnitWeight', value: WATER_UNIT_WEIGHT_SI * UNIT_FACTORS.unitWeight });
  }
  return commands;
}
