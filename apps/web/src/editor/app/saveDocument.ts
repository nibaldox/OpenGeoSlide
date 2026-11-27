// Guardar el documento (botón, Ctrl+S y paleta). Lógica pura: las dependencias llegan por parámetro (la interfaz pasa las
// reales; las pruebas, dobles).
//
// R16B-01: con borradores de tarjeta sin aplicar, el documento no coincide con lo que muestran las tarjetas. Guardar descargaría
// un modelo distinto del que el usuario ve, así que se bloquea con su motivo visible, igual que «Comprobar» y las exportaciones.

import { saveOgsJson } from '../../io/ogsJson';
import { pendingDraftsNotice } from '../panels/forms';
import type { ModelDoc } from '../types';
import { baseFileName } from './reportInput';

export interface SaveDeps {
  getState(): { doc: ModelDoc; file: { name: string | null } };
  markSaved(name: string): void;
  /** Tarjetas con cambios sin aplicar al modelo, en el momento de guardar. */
  getPendingDrafts(): readonly string[];
  download(text: string, fileName: string, mime: string): void;
  notify(kind: 'info' | 'aviso' | 'error', text: string): void;
  sha256(text: string): Promise<string>;
  /** Tras guardar: el documento ya no es un ejemplo y el borrador de esta pestaña sobra. */
  afterSave(): void;
}

export type SaveOutcome = 'saved' | 'blocked' | 'error';

/** Nombre final del archivo: el actual con la extensión `.ogs.json`, o uno derivado del modelo. */
export function saveFileName(name: string | null, doc: ModelDoc): string {
  const base = name ?? `${baseFileName(null, doc)}.ogs.json`;
  return /\.ogs\.json$/i.test(base) ? base : `${baseFileName(base, doc)}.ogs.json`;
}

export async function saveDocument(deps: SaveDeps): Promise<SaveOutcome> {
  const drafts = deps.getPendingDrafts();
  if (drafts.length > 0) {
    deps.notify('aviso', pendingDraftsNotice(drafts));
    return 'blocked';
  }
  try {
    const s = deps.getState();
    const text = saveOgsJson(s.doc);
    const finalName = saveFileName(s.file.name, s.doc);
    deps.download(text, finalName, 'application/json');
    deps.markSaved(finalName);
    deps.afterSave();
    const sha = await deps.sha256(text);
    deps.notify('info', `Guardado «${finalName}». SHA-256: ${sha}`);
    return 'saved';
  } catch (err) {
    deps.notify('error', `No se pudo guardar: ${err instanceof Error ? err.message : String(err)}`);
    return 'error';
  }
}

/**
 * Ctrl+S con el foco en un campo de texto: el valor escrito se confirma al perder el foco (`onBlur`), así que se saca el foco antes
 * de guardar; si no, el archivo llevaría el valor anterior mientras el campo muestra el nuevo. Devuelve si había un campo con foco.
 */
export function commitFocusedField(active: { tagName?: string; blur?: () => void } | null | undefined): boolean {
  const tag = (active?.tagName ?? '').toLowerCase();
  if (tag !== 'input' && tag !== 'textarea') return false;
  active?.blur?.();
  return true;
}
