// Compuerta de «Comprobar caso» en la vista Casos (R9-03a): antes de llamar al motor se ejecuta la misma validación local que el editor
// (`validateLocal`) y los errores bloquean con el mismo mensaje y criterio. Sin ella, un JSON imperial con piezométrica y sin γw se
// calculaba en silencio con 9,81 «pcf» (FS 2,940 en lugar de 2,638: +11 %, del lado inseguro).

import type { Model } from '../engine/types';
import { validateLocal } from '../editor/state/validateLocal';

/** Mensajes de los errores locales del caso (los avisos no bloquean). Vacío = el caso puede calcularse. */
export function caseBlockers(model: Model): string[] {
  return validateLocal(model)
    .filter((i) => i.severity === 'error')
    .map((i) => i.text);
}

/** Texto del aviso de bloqueo: hasta 3 mensajes completos y el resto contado. */
export function blockedMessage(texts: readonly string[]): string {
  const shown = texts.slice(0, 3).map((t) => (/[.!?]$/.test(t) ? t : `${t}.`));
  const rest = texts.length - shown.length;
  return `No se calculó el caso: ${texts.length === 1 ? 'el modelo tiene un error' : `el modelo tiene ${texts.length} errores`}. ${shown.join(' ')}${rest > 0 ? ` Y ${rest} más.` : ''}`;
}
