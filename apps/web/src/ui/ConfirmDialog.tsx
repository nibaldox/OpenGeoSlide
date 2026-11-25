// Diálogo de confirmación propio (reemplaza a `window.confirm`: con el tema de la app, sin bloquear la pestaña).
//   const confirm = useConfirm();
//   if (await confirm({ title, message, confirmLabel, tone: 'danger' })) { … }
// `<ConfirmHost/>` se monta UNA vez en App.tsx y muestra la cola de solicitudes de una en una. Es un `<dialog>` nativo
// (`showModal`): el navegador deja inerte el resto de la página, atrapa el foco y cierra con Esc (= cancelar). El foco
// inicial va al botón seguro («Cancelar» en las acciones destructivas) y, al cerrar, vuelve al disparador.

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { restoreFocus } from './focusReturn';
import { appConfirmQueue, type ConfirmOptions, type PendingConfirm } from './confirmQueue';

export type { ConfirmOptions } from './confirmQueue';

/** Devuelve `confirm(opts)`: una promesa que da `true` al confirmar y `false` al cancelar. La función es estable. */
export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  return useCallback((opts: ConfirmOptions) => {
    const opener = typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return appConfirmQueue.request(opts, opener);
  }, []);
}

function Dialog({ pending }: { pending: PendingConfirm }) {
  const { title, message, confirmLabel, cancelLabel, tone } = pending.options;
  const returnFocus = pending.returnFocus;
  const titleId = useId();
  const messageId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  // El disparador se fija una sola vez (en desarrollo, StrictMode ejecuta el efecto dos veces y el foco ya estaría en el diálogo).
  const [previous] = useState<HTMLElement | null>(() =>
    pending.opener instanceof HTMLElement ? pending.opener : document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    // Foco seguro: en una acción destructiva, «Cancelar»; en el resto, la acción que se pide.
    (tone === 'danger' ? cancelRef : confirmRef).current?.focus();
    return () => {
      // Al desmontar, el navegador saca el diálogo de la capa superior; solo falta devolver el foco. Si el disparador ya no se
      // puede enfocar (elemento de un menú cerrado, tarjeta eliminada), va al botón del menú o a #main-content (A-05, B-02).
      restoreFocus(returnFocus as HTMLElement | (() => HTMLElement | null) | null, previous);
    };
  }, [previous, returnFocus, tone]);

  return (
    <dialog
      ref={dialogRef}
      className="ea-dialog ogs-confirm"
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      data-testid="confirm-dialog"
      data-tone={tone}
      onCancel={(e) => {
        e.preventDefault(); // Esc: el estado decide cuándo desaparece
        appConfirmQueue.resolve(false);
      }}
    >
      <h2 id={titleId}>{title}</h2>
      <p id={messageId} className="ogs-confirm-message">
        {message}
      </p>
      <div className="ogs-confirm-actions">
        <button ref={cancelRef} type="button" onClick={() => appConfirmQueue.resolve(false)}>
          {cancelLabel}
        </button>
        <button ref={confirmRef} type="button" className={tone === 'danger' ? 'ogs-danger' : 'primary'} onClick={() => appConfirmQueue.resolve(true)}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

export function ConfirmHost() {
  const pending = useSyncExternalStore(appConfirmQueue.subscribe, appConfirmQueue.current, appConfirmQueue.current);
  // Si el host desaparece con solicitudes pendientes, quien espera recibe `false` en lugar de quedarse colgado.
  useEffect(() => () => appConfirmQueue.cancelAll(), []);
  return pending ? <Dialog key={pending.id} pending={pending} /> : null;
}
