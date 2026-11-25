// Título que se muestra del documento abierto (UX-11): el título del proyecto con su archivo, el ejemplo con su título real o el título del modelo.

export interface TitleInput {
  fileName: string | null;
  /** `meta.title` del documento. */
  title: string | null | undefined;
  /** El documento viene de un ejemplo publicado y aún no tiene archivo propio. */
  example: boolean;
}

export function documentTitle({ fileName, title, example }: TitleInput): string {
  const t = (title ?? '').trim();
  // Con archivo, el título del proyecto (panel «Proyecto») va primero y el archivo entre paréntesis.
  if (fileName !== null) return t === '' ? fileName : `${t} (${fileName})`;
  if (example) return t === '' ? 'Ejemplo' : `Ejemplo: ${t}`;
  return t === '' ? 'Sin título' : t;
}
