// CM-WB: reencuadre del lienzo cuando una edición confirmada cambia la caja del modelo (X34 §3). El encuadre del HUD (`useHudInsets`)
// deja libre la zona del HUD para el modelo de ese momento; si luego se sube un vértice (o se importa algo) y la caja crece, el modelo
// entraría bajo el HUD. Regla de UA-E6: se reencuadra solo si la vista sigue en el último encuadre automático (si el usuario hizo zoom
// o movió la vista, no se toca), y nunca en medio de un arrastre: al soltar, sí. Sin React: se prueba en Node con el store real.

import type { EditorState, EditorStore } from '../../types';
import { modelBoundsKey } from './hudFit';

export interface ModelRefitStep {
  /** Clave de la caja del modelo (`modelBoundsKey`). */
  key: string;
  /** Hay un gesto o un arrastre en curso: no se reencuadra hasta soltar. */
  busy: boolean;
  /** La vista actual sigue siendo el último encuadre automático (`isLastAutoFit`). */
  auto: boolean;
}

/**
 * Compuerta del reencuadre: recuerda la última caja ya atendida. Devuelve `true` solo cuando la caja cambió, no hay gesto en curso y
 * la vista sigue en el último encuadre automático. Con un gesto en curso deja la caja pendiente: la primera llamada sin gesto la atiende.
 * La primera llamada solo fija la caja de partida (el encuadre inicial ya lo hace el lienzo).
 */
export function createModelRefitGate(): (step: ModelRefitStep) => boolean {
  let settled: string | null = null;
  return ({ key, busy, auto }) => {
    if (settled === null) {
      settled = key;
      return false;
    }
    if (key === settled || busy) return false;
    settled = key;
    return auto;
  };
}

export interface ModelRefitHooks {
  /** ¿La vista sigue siendo el último encuadre automático? */
  isAuto(): boolean;
  /** Reencuadra con el documento y el tamaño de ese momento (y apunta el nuevo «último encuadre automático»). */
  refit(): void;
  /** Un arrastre del lienzo que el store aún no ve (la vista previa del gesto). */
  isBusy?(): boolean;
}

/**
 * Se suscribe al store y reencuadra cuando cambia la caja del modelo. Devuelve la función que lo deshace. Cada reencuadre pasa por
 * `hooks.refit`, que solo cambia la vista: no toca el documento, así que la caja no cambia y no hay bucle.
 */
export function attachModelRefit(store: Pick<EditorStore, 'getState' | 'subscribe'>, hooks: ModelRefitHooks): () => void {
  const gate = createModelRefitGate();
  let lastDoc: EditorState['doc'] | null = null;
  let key = '';
  const onChange = (): void => {
    const s = store.getState();
    if (s.doc !== lastDoc) {
      lastDoc = s.doc;
      key = modelBoundsKey(s.doc);
    }
    const busy = s.gesture !== null || hooks.isBusy?.() === true;
    // `auto` solo se lee si hace falta: es lo único que depende del DOM del lienzo.
    if (gate({ key, busy, auto: !busy && key !== '' ? hooks.isAuto() : false })) hooks.refit();
  };
  onChange();
  return store.subscribe(onChange);
}
