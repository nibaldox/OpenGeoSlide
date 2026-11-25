// Menú desplegable accesible para la barra de acciones (R7-26). Patrón «disclosure»: un `<button>` con
// `aria-expanded` abre un `popover="auto"` (Baseline) que se cierra con Esc y al hacer clic fuera, y devuelve el foco al
// botón. Los elementos del menú siguen siendo `<button>` normales (mismo nombre accesible que fuera del menú).
// Teclado: Intro, Espacio y ↓ abren y entran en el menú; ↑ ↓ Inicio y Fin recorren los botones; Tab recorre el resto de
// controles del menú y, al salir del último, lo cierra.

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { nextRovingIndex } from './rovingTabIndex';

// Las flechas recorren los botones; un <select> del menú (Ejemplos) se alcanza con Tab y conserva sus propias teclas.
const ITEM_SELECTOR = 'button:not(:disabled)';

function menuItems(menu: HTMLElement): HTMLElement[] {
  return Array.from(menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
}

export function DropdownMenu({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const base = useId();
  const triggerId = `${base}-trigger`;
  const menuId = `${base}-menu`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  /** La última apertura vino del teclado: entonces el foco entra en el menú (con el ratón queda en el botón). */
  const keyboardOpen = useRef(false);

  const close = useCallback((): void => {
    const menu = menuRef.current;
    if (menu?.matches(':popover-open')) menu.hidePopover();
  }, []);

  useEffect(() => {
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!menu || !trigger) return;
    const onToggle = (e: Event): void => {
      const isOpen = (e as ToggleEvent).newState === 'open';
      setOpen(isOpen);
      if (isOpen) {
        // Sin «anchor positioning» el popover se colocaría centrado: se sitúa bajo el botón con coordenadas.
        if (!CSS.supports('position-area', 'block-end')) {
          const r = trigger.getBoundingClientRect();
          menu.style.position = 'fixed';
          menu.style.inset = 'auto';
          menu.style.margin = '0';
          menu.style.top = `${r.bottom + 4}px`;
          menu.style.left = `${Math.max(4, Math.min(r.left, window.innerWidth - menu.offsetWidth - 4))}px`;
        }
        if (keyboardOpen.current) menuItems(menu)[0]?.focus();
      }
      keyboardOpen.current = false;
    };
    // Al salir el foco del botón y del menú (Tab, clic en otro control), el menú se cierra.
    const onFocusOut = (e: FocusEvent): void => {
      const next = e.relatedTarget;
      if (next instanceof Node && (menu.contains(next) || trigger.contains(next))) return;
      if (next === null) return; // ventana sin foco o clic en zona no enfocable: lo resuelve el cierre por clic fuera
      close();
    };
    menu.addEventListener('toggle', onToggle);
    menu.addEventListener('focusout', onFocusOut);
    trigger.addEventListener('focusout', onFocusOut);
    return () => {
      menu.removeEventListener('toggle', onToggle);
      menu.removeEventListener('focusout', onFocusOut);
      trigger.removeEventListener('focusout', onFocusOut);
    };
  }, [close]);

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      keyboardOpen.current = true; // el clic nativo del botón abre el popover (invocador)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const menu = menuRef.current;
      if (!menu) return;
      if (menu.matches(':popover-open')) menuItems(menu)[0]?.focus();
      else {
        keyboardOpen.current = true;
        triggerRef.current?.click();
      }
    }
  };

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const menu = menuRef.current;
    if (!menu || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target instanceof HTMLSelectElement) {
      // Una flecha sobre un <select> cerrado cambiaría el valor (y cargaría un ejemplo sin querer): abre la lista.
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.altKey) {
        e.preventDefault();
        try {
          e.target.showPicker();
        } catch {
          /* sin showPicker: el <select> queda con su comportamiento nativo */
        }
      }
      return;
    }
    const items = menuItems(menu);
    const next = nextRovingIndex({ key: e.key, index: items.indexOf(e.target as HTMLElement), count: items.length, orientation: 'vertical' });
    if (next === null) return;
    e.preventDefault();
    items[next]?.focus();
  };

  return (
    <div className={className ? `dd ${className}` : 'dd'}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className="dd-trigger"
        aria-expanded={open}
        aria-controls={menuId}
        // Invocador declarativo (Baseline): el navegador abre y cierra el popover y lo cierra al hacer clic en el botón abierto.
        {...({ commandfor: menuId, command: 'toggle-popover' } as Record<string, string>)}
        onKeyDown={onTriggerKeyDown}
        onPointerDown={() => {
          keyboardOpen.current = false;
        }}
      >
        {label} <span aria-hidden="true">▾</span>
      </button>
      <div
        ref={menuRef}
        id={menuId}
        popover="auto"
        role="group"
        aria-labelledby={triggerId}
        className="dd-menu"
        onKeyDown={onMenuKeyDown}
        onClick={(e) => {
          // Una acción cierra el menú (el foco vuelve al botón). El <select> lo cierra al elegir (onChange).
          const t = e.target instanceof Element ? e.target.closest('button') : null;
          if (t && !t.disabled) close();
        }}
        onChange={(e) => {
          if (e.target instanceof HTMLSelectElement) close();
        }}
      >
        {children}
      </div>
    </div>
  );
}
