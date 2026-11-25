// Formato único del factor de seguridad en pantalla (UX9-05): siempre 3 decimales y coma decimal («1,200», no «1,2»).

const fsFormat = new Intl.NumberFormat('es', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** FS con 3 decimales, o «—» si no hay valor (método sin convergencia o no finito). */
export function formatFs(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return fsFormat.format(value);
}
