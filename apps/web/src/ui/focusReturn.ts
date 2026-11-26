// A dónde vuelve el foco al cerrar un diálogo (A-05, B-02). Lógica pura (sin DOM) para probarla en Node: el orden de los
// candidatos y la regla «el primero que se pueda enfocar ahora». `ConfirmDialog.tsx` aporta los adaptadores del DOM.
//
// Orden: 1) `returnFocus` explícito de quien pidió la confirmación; 2) el elemento que tenía el foco al pedirla (el
// disparador); 3) si ese elemento vive en un menú desplegable ya cerrado (un elemento del menú «Archivo»), el botón que
// abre ese menú; 4) `#main-content` (lleva `tabindex="-1"`), para que el foco nunca caiga en `<body>`.

export type ReturnFocusSpec<T> = T | (() => T | null) | null | undefined;

export interface FocusLookup<T> {
  /** Botón que abre el menú desplegable que contiene `el`, o `null` si no está en un menú. */
  menuTrigger(el: T): T | null;
  /** Contenedor principal de la página (último recurso). */
  main(): T | null;
  /** ¿`el` está conectado, visible y se puede enfocar ahora mismo? */
  usable(el: T): boolean;
  /** Distingue la función del elemento (en el DOM, los elementos no son funciones). */
  isResolver(spec: unknown): spec is () => T | null;
}

/** Candidatos en orden de preferencia (puede haber nulos: se descartan al elegir). */
export function returnFocusCandidates<T>(explicit: ReturnFocusSpec<T>, opener: T | null, lookup: FocusLookup<T>): (T | null)[] {
  const first = lookup.isResolver(explicit) ? explicit() : (explicit ?? null);
  const out: (T | null)[] = [first, opener];
  // El disparador del menú sirve cuando `opener` es un elemento del menú, o cuando el explícito se refiere a uno.
  if (opener !== null) out.push(lookup.menuTrigger(opener));
  if (first !== null) out.push(lookup.menuTrigger(first));
  out.push(lookup.main());
  return out;
}

/** El primer candidato que se puede enfocar, o `null`. */
export function pickReturnFocus<T>(explicit: ReturnFocusSpec<T>, opener: T | null, lookup: FocusLookup<T>): T | null {
  for (const c of returnFocusCandidates(explicit, opener, lookup)) if (c !== null && lookup.usable(c)) return c;
  return null;
}

// ───────── Adaptador del DOM ─────────

export type ReturnFocus = ReturnFocusSpec<HTMLElement>;

function usableElement(el: HTMLElement): boolean {
  if (!el.isConnected || (el as HTMLButtonElement).disabled) return false;
  if (typeof el.checkVisibility === 'function') return el.checkVisibility({ visibilityProperty: true });
  return el.getClientRects().length > 0;
}

/** Botón (`aria-controls`) del menú desplegable `[popover]` que contiene a `el`. */
function menuTriggerOf(el: HTMLElement): HTMLElement | null {
  const pop = el.closest<HTMLElement>('[popover]');
  if (!pop?.id) return null;
  return Array.from(document.querySelectorAll<HTMLElement>('[aria-controls]')).find((b) => b.getAttribute('aria-controls') === pop.id) ?? null;
}

export const DOM_FOCUS_LOOKUP: FocusLookup<HTMLElement> = {
  menuTrigger: menuTriggerOf,
  main: () => document.getElementById('main-content'),
  usable: usableElement,
  isResolver: (spec): spec is () => HTMLElement | null => typeof spec === 'function',
};

/**
 * Devuelve el foco al mejor candidato. Resultado: el elemento enfocado o `null` si ninguno servía. `options.preventScroll` evita que
 * `focus()` desplace la página: `#main-content` es alto y enfocarlo sin esa opción sube la página hasta su inicio (R9-11c).
 */
export function restoreFocus(explicit: ReturnFocus, opener: HTMLElement | null, options?: FocusOptions): HTMLElement | null {
  const el = pickReturnFocus(explicit, opener, DOM_FOCUS_LOOKUP);
  el?.focus(options);
  return el;
}
