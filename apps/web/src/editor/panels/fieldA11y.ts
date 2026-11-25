// Accesibilidad de los campos de formulario (R7-23): qué ids describen un campo y cuándo un error se anuncia.

/** `aria-describedby` de un campo: la ayuda siempre que exista, y el error mientras haya uno. `undefined` si no hay nada. */
export function describedByIds(ids: { hintId?: string; errorId?: string }, present: { hint: boolean; error: boolean }): string | undefined {
  const list = [present.hint ? ids.hintId : undefined, present.error ? ids.errorId : undefined].filter((v): v is string => Boolean(v));
  return list.length > 0 ? list.join(' ') : undefined;
}

/**
 * Estado del aviso de error de un campo: se escribe con cada tecla, pero solo se anuncia (`role="alert"`) cuando el
 * usuario confirma (sale del campo o pulsa Intro) y vuelve a quedar en silencio en cuanto edita de nuevo.
 */
export type FieldAnnounce = 'quiet' | 'announced';

export function nextFieldAnnounce(event: 'edit' | 'commit' | 'reset'): FieldAnnounce {
  return event === 'commit' ? 'announced' : 'quiet';
}

export function errorRole(state: FieldAnnounce): 'alert' | undefined {
  return state === 'announced' ? 'alert' : undefined;
}
