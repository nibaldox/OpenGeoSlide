// Cola de confirmaciones (reemplazo de `window.confirm`). Modelo puro: sin DOM ni React, para probarlo en Node.
// `ConfirmDialog.tsx` la muestra con un `<dialog>` nativo; `useConfirm()` pide y espera la respuesta.

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  /** Por omisión, «Cancelar». */
  cancelLabel?: string;
  /** `danger` (acción destructiva): el foco inicial va a «Cancelar». Por omisión, `default`. */
  tone?: 'danger' | 'default';
  /**
   * Dónde vuelve el foco al cerrar (por omisión, el elemento enfocado al pedir). Si ese elemento ya no se puede enfocar
   * (un elemento de menú cerrado, una tarjeta eliminada), el foco va al botón del menú o a `#main-content`.
   */
  returnFocus?: HTMLElement | (() => HTMLElement | null) | null;
}

export interface ResolvedConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: 'danger' | 'default';
}

export interface PendingConfirm {
  /** Cambia con cada solicitud: la interfaz reinicia el diálogo al pasar a la siguiente. */
  id: number;
  options: ResolvedConfirmOptions;
  /** Elemento que tenía el foco al pedir (el disparador): el foco vuelve a él al cerrar. */
  opener: unknown;
  /** `returnFocus` pedido por quien llamó (elemento, función o nada). */
  returnFocus: unknown;
}

export const DEFAULT_CANCEL_LABEL = 'Cancelar';

export function normalizeConfirm(options: ConfirmOptions): ResolvedConfirmOptions {
  const cancel = options.cancelLabel?.trim();
  return {
    title: options.title,
    message: options.message,
    confirmLabel: options.confirmLabel,
    cancelLabel: cancel ? cancel : DEFAULT_CANCEL_LABEL,
    tone: options.tone ?? 'default',
  };
}

interface Entry extends PendingConfirm {
  settle: (answer: boolean) => void;
}

export interface ConfirmQueue {
  /** Pide una confirmación; se resuelve con `true` al confirmar y con `false` al cancelar (Esc, «Cancelar»). */
  request(options: ConfirmOptions, opener?: unknown): Promise<boolean>;
  /** Solicitud a la vista (la primera de la cola) o `null`. La referencia es estable mientras no cambie la cola. */
  current(): PendingConfirm | null;
  /** Responde a la solicitud a la vista y pasa a la siguiente. */
  resolve(answer: boolean): void;
  /** Cancela todo (el host se desmonta). */
  cancelAll(): void;
  size(): number;
  subscribe(listener: () => void): () => void;
}

export function createConfirmQueue(): ConfirmQueue {
  const entries: Entry[] = [];
  const listeners = new Set<() => void>();
  let nextId = 1;
  const emit = (): void => listeners.forEach((l) => l());

  return {
    request(options, opener = null) {
      return new Promise<boolean>((settle) => {
        entries.push({ id: nextId++, options: normalizeConfirm(options), opener, returnFocus: options.returnFocus ?? null, settle });
        emit();
      });
    },
    current: () => entries[0] ?? null,
    resolve(answer) {
      const entry = entries.shift();
      if (!entry) return;
      entry.settle(answer);
      emit();
    },
    cancelAll() {
      const pending = entries.splice(0, entries.length);
      for (const e of pending) e.settle(false);
      if (pending.length > 0) emit();
    },
    size: () => entries.length,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Cola compartida de la aplicación: `useConfirm()` pide aquí y el único `<ConfirmHost/>` la muestra. */
export const appConfirmQueue: ConfirmQueue = createConfirmQueue();
