// Mensajes legibles para los errores del motor.
//
// Contrato E6 (briefs/00_CONTRATOS.md §4.5): el `Display` de `OgsError` es "<Código>: <mensaje en español>",
// con Código ∈ {InvalidModel, NoSurface, NoValidSurface, Json}. Se clasifica por ese prefijo exacto; el resto
// del texto es el detalle que ya viene en español desde el motor.

import { EngineFatalError } from './engine';

export const FATAL_ENGINE_TEXT =
  'Fallo interno del motor de cálculo. Recargue la página para reiniciarlo; si se repite, revise la consola del navegador.';

/** Texto para la UI de cualquier fallo del motor: fatal (trap, distinto de E6) o de modelo (código E6). */
export function userMessage(error: unknown): string {
  if (error instanceof EngineFatalError) return `${FATAL_ENGINE_TEXT} Detalle: ${error.message}`;
  return humanizeEngineError(error instanceof Error ? error.message : String(error));
}

export const ENGINE_ERROR_CODES = ['InvalidModel', 'NoSurface', 'NoValidSurface', 'Json'] as const;

export type EngineErrorCode = (typeof ENGINE_ERROR_CODES)[number];

const ERROR_PATTERN = /^(InvalidModel|NoSurface|NoValidSurface|Json):\s*([\s\S]*)$/;

/** Código del error (`InvalidModel`, ...) o `null` si el texto no empieza por un código conocido. */
export function engineErrorCode(raw: string): EngineErrorCode | null {
  const match = ERROR_PATTERN.exec(raw.trim());
  return match ? (match[1] as EngineErrorCode) : null;
}

/** Consejo que acompaña al error de la grieta (E15l-16): el texto en español del código `tension_crack_not_reached`. */
export const CRACK_NOT_REACHED_HINT = 'Reduzca la profundidad de la grieta de tracción o use una superficie (o un rango de búsqueda) más profundo.';

/**
 * ¿El error de «sin superficie válida» se debe a la grieta de tracción (E15l-16)? Acepta el texto crudo del motor (con el código
 * `tension_crack_not_reached`, en la forma de superficie fija y en la de búsqueda de E15l-7) y el texto ya traducido por `humanizeEngineError`.
 */
export function isCrackNotReached(text: string): boolean {
  return text.includes('tension_crack_not_reached') || text.includes(CRACK_NOT_REACHED_HINT);
}

/** Texto en español para mostrar al usuario. Un texto sin código conocido se muestra como error genérico. */
export function humanizeEngineError(raw: string): string {
  const text = raw.trim();
  const match = ERROR_PATTERN.exec(text);
  if (!match) {
    return `Error del motor: ${text}`;
  }
  const code = match[1] as EngineErrorCode;
  const detail = match[2].trim();
  switch (code) {
    case 'NoSurface':
      return `Modelo incompleto: ${detail}`;
    case 'NoValidSurface': {
      if (!detail.includes('tension_crack_not_reached')) return `No hay ninguna superficie de deslizamiento válida: ${detail}`;
      // E15l-16: se quita el código interno (en la forma fija va de prefijo; en la de búsqueda, al final del paréntesis, E15l-7).
      const plain = detail.replace(/tension_crack_not_reached:\s*/, '').replace(/,\s*tension_crack_not_reached/, '');
      return `No hay ninguna superficie de deslizamiento válida: ${plain}. ${CRACK_NOT_REACHED_HINT}`;
    }
    case 'InvalidModel':
      return `Modelo no válido: ${detail}`;
    case 'Json':
      return `JSON no válido: ${detail}`;
  }
}
