// Lectura de archivos del usuario sin promesas sin capturar y sin ruido: ver R7-28.

import { openOgsJson, type OpenOgsResult } from '../../io/ogsJson';
import type { ModelDoc } from '../types';

export interface FileNotice {
  kind: 'info' | 'aviso' | 'error';
  text: string;
}

/** Lo mínimo de un `File`: el nombre y la lectura del texto. */
export interface TextFileLike {
  name: string;
  text(): Promise<string>;
}

function reason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Lee el texto de un archivo; si el navegador no puede, devuelve el aviso en lugar de lanzar. */
export async function readTextFile(file: TextFileLike): Promise<{ ok: true; text: string } | { ok: false; notice: FileNotice }> {
  try {
    return { ok: true, text: await file.text() };
  } catch (err) {
    return { ok: false, notice: { kind: 'error', text: `No se pudo leer «${file.name}»: ${reason(err)}` } };
  }
}

/**
 * Abre un `.ogs.json`. Los avisos del archivo solo se emiten si el usuario acepta descartar el trabajo actual
 * (`confirmDiscard` va antes: si cancela, no queda ruido de un archivo que no se abrió). Un archivo rechazado muestra
 * sus errores sin preguntar, porque no hay nada que descartar.
 */
export async function readOpenFile(
  file: TextFileLike,
  confirmDiscard: () => boolean,
  open: (text: string) => OpenOgsResult = openOgsJson,
): Promise<{ doc: ModelDoc | null; notices: FileNotice[] }> {
  const read = await readTextFile(file);
  if (!read.ok) return { doc: null, notices: [read.notice] };
  let opened: OpenOgsResult;
  try {
    opened = open(read.text);
  } catch (err) {
    return { doc: null, notices: [{ kind: 'error', text: `No se pudo abrir «${file.name}»: ${reason(err)}` }] };
  }
  const notices: FileNotice[] = opened.issues.map((i) => ({ kind: i.severity === 'error' ? 'error' : 'aviso', text: `${file.name}: ${i.text}` }));
  if (!opened.doc) return { doc: null, notices };
  if (!confirmDiscard()) return { doc: null, notices: [] };
  return { doc: opened.doc, notices };
}
