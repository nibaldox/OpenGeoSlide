// Guía de primera visita (UX-12): recorrido NO modal de 5 pasos. Cada paso resalta un control real con un anillo y muestra un
// cuadro (`popover="manual"`, `role="dialog"`) colocado junto a él. No bloquea la aplicación: no hay `inert` ni fondo
// atenuado, y el resto de la página sigue operable. La lógica (pasos, estado, colocación) está en `tour.ts`.
//
// Foco: al abrirse sola (primera visita) NO se mueve el foco (no secuestra la página); el cuadro está justo después de la
// cabecera en el orden de tabulación. Si el usuario la abre desde «Ayuda», el foco va a «Siguiente». Esc o «Omitir» la
// cierran y el foco vuelve al control destacado (o, si no es enfocable, al botón «Ayuda»).

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { TOUR_STEPS, matchesTarget, placePopover, ringRect, shouldCloseTourOnEscape, stepProgress, type Placed, type Rect, type TargetSpec } from './tour';

const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]';

/** Primer elemento visible que cumple el destino (selector y, si lo pide, el texto). */
export function findTarget(spec: TargetSpec, root: ParentNode = document): HTMLElement | null {
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(spec.selector))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && matchesTarget(spec, el.textContent ?? '')) return el;
  }
  return null;
}

function toRect(r: DOMRect): Rect {
  return { x: r.left, y: r.top, width: r.width, height: r.height };
}

function focusTargetOrFallback(target: HTMLElement | null, fallback: HTMLElement | null): void {
  const el = target?.matches(FOCUSABLE) ? target : (target?.querySelector<HTMLElement>(FOCUSABLE) ?? null);
  if (el && !el.hasAttribute('disabled')) el.focus();
  else fallback?.focus();
}

interface Layout {
  ring: Rect | null;
  pop: Placed | null;
}

export interface GuidedTourProps {
  open: boolean;
  index: number;
  /** El foco entra al cuadro al abrir (apertura pedida por el usuario desde «Ayuda»). */
  focusOnOpen: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  /** Botón al que vuelve el foco si el control destacado no se puede enfocar. */
  fallbackFocus: () => HTMLElement | null;
}

export function GuidedTour({ open, index, focusOnOpen, onNext, onPrev, onSkip, fallbackFocus }: GuidedTourProps) {
  const step = TOUR_STEPS[Math.min(index, TOUR_STEPS.length - 1)]!;
  const progress = stepProgress(index);
  const titleId = useId();
  const bodyId = useId();
  const popRef = useRef<HTMLElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [layout, setLayout] = useState<Layout>({ ring: null, pop: null });
  const [announcement, setAnnouncement] = useState('');
  const lastTarget = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  const update = useCallback((reveal: boolean): void => {
    const pop = popRef.current;
    if (!pop) return;
    const target = findTarget(step.target);
    lastTarget.current = target;
    if (target && reveal) target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const rect = target ? toRect(target.getBoundingClientRect()) : null;
    const size = { width: pop.offsetWidth, height: pop.offsetHeight };
    const vp = { width: document.documentElement.clientWidth, height: window.innerHeight };
    setLayout({ ring: rect ? ringRect(rect) : null, pop: placePopover(rect, size, vp) });
  }, [step]);

  // Mostrar y ocultar los dos elementos de la capa superior; al abrir, colocar el cuadro (ya visible, para medirlo) y seguir al
  // control si cambia el tamaño o se desplaza la página.
  useLayoutEffect(() => {
    const pop = popRef.current;
    const ring = ringRef.current;
    if (!pop || !ring) return;
    if (!open) {
      if (pop.matches(':popover-open')) pop.hidePopover();
      if (ring.matches(':popover-open')) ring.hidePopover();
      return;
    }
    if (!ring.matches(':popover-open')) ring.showPopover();
    if (!pop.matches(':popover-open')) pop.showPopover();
    update(true);
    const again = window.setTimeout(() => update(false), 200); // el texto del paso puede cambiar el tamaño del cuadro
    let frame = 0;
    const onChange = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => update(false));
    };
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onChange);
    observer?.observe(document.body);
    return () => {
      window.clearTimeout(again);
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
      observer?.disconnect();
    };
  }, [open, update, index]);

  // Anuncio del paso en la región viva (sin mover el foco). Se escribe tras un instante para no chocar con otras voces.
  useEffect(() => {
    if (!open) {
      setAnnouncement('');
      return;
    }
    const t = window.setTimeout(() => setAnnouncement(`Guía de primera visita, ${progress.label.toLowerCase()}: ${step.title}. Pulse Tab para llegar a la guía.`), 400);
    return () => window.clearTimeout(t);
  }, [open, progress.label, step.title]);

  // Foco: solo si el usuario la abrió desde «Ayuda». Al cerrar con el foco dentro, vuelve al control destacado.
  useEffect(() => {
    if (open && !wasOpen.current && focusOnOpen) {
      const frame = requestAnimationFrame(() => nextRef.current?.focus());
      wasOpen.current = true;
      return () => cancelAnimationFrame(frame);
    }
    wasOpen.current = open;
  }, [open, focusOnOpen]);

  const close = useCallback((): void => {
    const insideFocus = popRef.current?.contains(document.activeElement) ?? false;
    const target = lastTarget.current;
    onSkip();
    if (insideFocus) requestAnimationFrame(() => focusTargetOrFallback(target, fallbackFocus()));
  }, [onSkip, fallbackFocus]);

  // Esc cierra la guía desde cualquier lugar (A-06): la guía no es modal y el foco suele estar en el lienzo o en un campo. Un
  // `<dialog>` abierto o un menú desplegable tienen prioridad, y un manejador que ya atendió la tecla (el lienzo) también.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      const ctx = {
        key: e.key,
        defaultPrevented: e.defaultPrevented,
        dialogOpen: document.querySelector('dialog[open]') !== null,
        menuOpen: document.querySelector('[popover="auto"]:popover-open') !== null,
      };
      if (shouldCloseTourOnEscape(ctx)) close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  const finishOrNext = (): void => {
    if (progress.last) close();
    else onNext();
  };

  return (
    <>
      <div className="visually-hidden" role="status" aria-live="polite" data-testid="tour-live">
        {announcement}
      </div>
      <div ref={ringRef} popover="manual" className="tour-ring" aria-hidden="true" data-testid="tour-ring" style={layout.ring ? { left: layout.ring.x, top: layout.ring.y, width: layout.ring.width, height: layout.ring.height } : { display: 'none' }} />
      <section
        ref={popRef}
        popover="manual"
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="tour-popover"
        data-testid="guided-tour"
        data-step={step.id}
        data-placement={layout.pop?.placement ?? 'pending'}
        style={layout.pop ? { left: layout.pop.left, top: layout.pop.top } : { visibility: 'hidden' }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            close();
          }
        }}
      >
        <p className="tour-progress small">{progress.label}</p>
        <h2 id={titleId} className="tour-title">
          {step.title}
        </h2>
        <p id={bodyId} className="tour-body">
          {step.body}
        </p>
        <div className="tour-actions">
          <button type="button" className="link-button" onClick={close}>
            Omitir
          </button>
          <span className="tour-spacer" />
          <button type="button" onClick={onPrev} disabled={progress.first}>
            Anterior
          </button>
          <button ref={nextRef} type="button" className="primary" onClick={finishOrNext}>
            {progress.last ? 'Terminar' : 'Siguiente'}
          </button>
        </div>
      </section>
    </>
  );
}
