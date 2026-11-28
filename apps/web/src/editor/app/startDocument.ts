// El modelo de arranque y el historial (RCM-B-09). «Importar → Reemplazar» sobre el modelo de arranque crea un modelo nuevo y se
// deshace con Ctrl+Z; al deshacer hasta el documento inicial, la cabecera vuelve a ser la de la primera visita: rótulo «Ejemplo: …»,
// documento limpio y «Reemplazar» como destino por defecto de la siguiente importación.
//
// Se decide con la identidad del documento, no comparándolo entero: el historial guarda las mismas referencias que se deshacen, así que
// `state.doc === start` es exacto y cuesta O(1) por render. `file.name === null` descarta lo guardado o abierto desde un archivo: un
// documento guardado ya no es un «ejemplo» aunque vuelva a ser el mismo objeto.

import type { EditorState, ModelDoc } from '../types';

/**
 * ¿El documento actual es el de arranque (el mismo objeto) y nunca se guardó ni se abrió desde un archivo? Es el «modelo de arranque sin
 * cambios» para el que «Reemplazar» es el destino por defecto al importar (CM-WC).
 */
export function isStartDocument(state: Pick<EditorState, 'doc' | 'file'>, start: ModelDoc): boolean {
  return state.doc === start && state.file.name === null;
}

/**
 * Qué hay que restaurar cuando el historial vuelve al documento de arranque: el rótulo de ejemplo y el estado limpio
 * (`markClean`: la revisión actual no es la guardada, pero el contenido es el del arranque). `null` si no se vuelve a él.
 */
export function startRestoration(state: Pick<EditorState, 'doc' | 'file' | 'revision'>, start: ModelDoc): { example: true; markClean: boolean } | null {
  if (!isStartDocument(state, start)) return null;
  return { example: true, markClean: state.revision !== state.file.savedRevision };
}

/**
 * El rótulo de ejemplo que corresponde al documento actual cuando el historial cambia de documento: `true` si es el de arranque, `false` si
 * es uno de los modelos nuevos creados por una importación «Reemplazar» sobre el arranque (`freshDocs`: Ctrl+Z y Ctrl+Shift+Z cruzan esa
 * frontera), `null` si el documento no cambia el rótulo (una edición conserva el que tenía).
 */
export function exampleLabelFor(state: Pick<EditorState, 'doc' | 'file'>, start: ModelDoc, freshDocs: { has(doc: ModelDoc): boolean }): boolean | null {
  if (isStartDocument(state, start)) return true;
  return freshDocs.has(state.doc) ? false : null;
}
