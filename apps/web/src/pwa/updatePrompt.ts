// Aviso de «versión nueva» (R5-08): DOM mínimo, sin React, para que funcione aunque la app no haya montado.

export const UPDATE_PROMPT_ID = 'ogs-update-prompt';
export const UPDATE_PROMPT_TEXT = 'Hay una versión nueva de OpenGeoSlide';
export const UPDATE_BUTTON_TEXT = 'Actualizar';

/**
 * Muestra el aviso con el botón «Actualizar». Si ya está visible solo cambia lo que hace el botón (llega otra versión
 * mientras el aviso estaba abierto). Al pulsar, el botón se deshabilita y se llama a `apply`; la recarga la hace el
 * flujo de actualización cuando cambia el controlador.
 */
export function showUpdatePrompt(apply: () => void, doc: Document = document): HTMLElement {
  const existing = doc.getElementById(UPDATE_PROMPT_ID);
  if (existing) {
    (existing as HTMLElement & { ogsApply?: () => void }).ogsApply = apply;
    return existing;
  }
  const box = doc.createElement('div') as HTMLElement & { ogsApply?: () => void };
  box.id = UPDATE_PROMPT_ID;
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  box.ogsApply = apply;
  Object.assign(box.style, {
    position: 'fixed',
    left: '50%',
    bottom: '16px',
    transform: 'translateX(-50%)',
    zIndex: '2147483647',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    background: '#12324a',
    color: '#fff',
    border: '1px solid #fff',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,.35)',
    font: '14px system-ui, sans-serif',
  });
  const text = doc.createElement('span');
  text.textContent = UPDATE_PROMPT_TEXT;
  const button = doc.createElement('button');
  button.type = 'button';
  button.textContent = UPDATE_BUTTON_TEXT;
  Object.assign(button.style, { font: 'inherit', padding: '4px 12px', cursor: 'pointer' });
  button.addEventListener('click', () => {
    button.disabled = true;
    box.ogsApply?.();
  });
  box.append(text, button);
  doc.body.append(box);
  return box;
}
