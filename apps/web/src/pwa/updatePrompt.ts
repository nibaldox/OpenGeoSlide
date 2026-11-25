// Aviso de «versión nueva» (R5-08): DOM mínimo, sin React, para que funcione aunque la app no haya montado.

type PromptBox = HTMLElement & { ogsApply?: () => void; ogsButton?: HTMLButtonElement };

export const UPDATE_PROMPT_ID = 'ogs-update-prompt';
export const UPDATE_PROMPT_TEXT = 'Hay una versión nueva de OpenGeoSlide';
export const UPDATE_BUTTON_TEXT = 'Actualizar';
export const LATER_BUTTON_TEXT = 'Más tarde';

/**
 * Muestra el aviso con los botones «Actualizar» y «Más tarde». Si ya está visible solo cambia lo que hace el botón (llega otra versión
 * mientras el aviso estaba abierto). Al pulsar, el botón se deshabilita y se llama a `apply`; la recarga la hace el
 * flujo de actualización cuando cambia el controlador.
 */
export function showUpdatePrompt(apply: () => void, doc: Document = document): HTMLElement {
  const existing = doc.getElementById(UPDATE_PROMPT_ID) as PromptBox | null;
  if (existing) {
    existing.ogsApply = apply;
    // Llega otra versión con el aviso abierto: el botón, deshabilitado tras un clic anterior, vuelve a estar activo (R6-01).
    if (existing.ogsButton) existing.ogsButton.disabled = false;
    return existing;
  }
  const box = doc.createElement('div') as PromptBox;
  box.id = UPDATE_PROMPT_ID;
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  box.ogsApply = apply;
  // Los estilos viven en App.css (clase `.ogs-update-prompt`, solo tokens): sin colores en línea (U1-T).
  box.className = 'ogs-update-prompt';
  const text = doc.createElement('span');
  text.textContent = UPDATE_PROMPT_TEXT;
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'primary';
  button.textContent = UPDATE_BUTTON_TEXT;
  button.addEventListener('click', () => {
    button.disabled = true;
    box.ogsApply?.();
  });
  // «Más tarde» cierra el aviso sin recargar; si llega otra versión, `showUpdatePrompt` lo vuelve a mostrar.
  const later = doc.createElement('button');
  later.type = 'button';
  later.textContent = LATER_BUTTON_TEXT;
  later.addEventListener('click', () => box.remove());
  box.ogsButton = button;
  box.append(text, button, later);
  doc.body.append(box);
  return box;
}
