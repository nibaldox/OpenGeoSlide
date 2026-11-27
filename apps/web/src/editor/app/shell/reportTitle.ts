// Vista Informe: título del documento y aviso de bloqueo. Lógica pura, probada en Node.

/** La misma regla que el PDF (`report/content.ts`): título, o id del modelo, o «Sin título» (UA3 B-07). */
export function reportDocTitle(title: string | null | undefined, id: string | null | undefined): string {
  return (title ?? '').trim() || (id ?? '').trim() || 'Sin título';
}

/**
 * Aviso visible en la tarjeta de Informe cuando lo que muestra no es el modelo que se ve (UA3 B-07). Con borradores sin aplicar,
 * su texto; con un resultado de una revisión anterior, la pista de desactualizado; si no, `null`. Sin cálculo la lista de contenido
 * ya lo explica.
 */
export function reportNotice({ hasRun, current, hasDrafts, draftsText, staleText }: { hasRun: boolean; current: boolean; hasDrafts: boolean; draftsText: string; staleText: string | undefined }): string | null {
  if (hasDrafts) return draftsText;
  if (hasRun && !current) return staleText ?? null;
  return null;
}
