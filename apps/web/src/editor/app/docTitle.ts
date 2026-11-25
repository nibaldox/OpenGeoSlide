// Título que se muestra del documento abierto (UX-11): el archivo, el ejemplo con su título real o el título del modelo.

export interface TitleInput {
  fileName: string | null;
  /** `meta.title` del documento. */
  title: string | undefined;
  /** El documento viene de un ejemplo publicado y aún no tiene archivo propio. */
  example: boolean;
}

export function documentTitle({ fileName, title, example }: TitleInput): string {
  if (fileName !== null) return fileName;
  const t = (title ?? '').trim();
  if (example) return t === '' ? 'Ejemplo' : `Ejemplo: ${t}`;
  return t === '' ? 'Sin título' : t;
}
