// Márgenes de encuadre que dejan libre el HUD (UA2-F1). Mide la caja del HUD relativa a la tarjeta del lienzo con un
// `ResizeObserver` y delega la elección en `chooseHudFit` (lógica pura, `hudFit.ts`).

import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { FitInsets } from '../../canvas/EditorCanvas';
import type { ModelDoc } from '../../types';
import { boxOf, chooseHudFit, insetsEqual, type Box, type HudPick } from './hudFit';
import { FIT_INSETS_DESKTOP, FIT_INSETS_MOBILE } from './layout';

interface Measure {
  hud: Box;
  /** La leyenda (abajo a la izquierda): no entra en el encuadre, pero tapa rótulos del eje. */
  legend: Box | null;
  collapsed: boolean;
  width: number;
  height: number;
}

const sameBox = (a: Box | null, b: Box | null): boolean => a === b || (!!a && !!b && a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom);

const sameMeasure = (a: Measure | null, b: Measure | null): boolean =>
  a === b ||
  (!!a && !!b && a.collapsed === b.collapsed && a.width === b.width && a.height === b.height && a.hud.left === b.hud.left && a.hud.top === b.hud.top && a.hud.right === b.hud.right && a.hud.bottom === b.hud.bottom && sameBox(a.legend, b.legend));

/**
 * `fitInsets` del lienzo. Hasta 760 px (el HUD es estático, debajo del lienzo) son los márgenes móviles. Desde 761 px,
 * los fijos del contrato §4.2 más el margen que pide el HUD, sea desplegado (el mejor de dos candidatos) o plegado.
 */
export function useHudInsets(cardRef: RefObject<HTMLElement | null>, doc: ModelDoc, desktop: boolean): { insets: FitInsets; covered: readonly Box[] } {
  const base = desktop ? FIT_INSETS_DESKTOP : FIT_INSETS_MOBILE;
  const [m, setM] = useState<Measure | null>(null);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const hudEl = card?.querySelector<HTMLElement>(':scope > div.rs') ?? null;
    if (!desktop || !card || !hudEl || typeof ResizeObserver === 'undefined') {
      setM(null);
      return undefined;
    }
    const legendEl = card.querySelector<HTMLElement>(':scope > ul.legend');
    const read = (): void => {
      const c = card.getBoundingClientRect();
      const origin = { left: c.left + card.clientLeft, top: c.top + card.clientTop };
      const next: Measure = { hud: boxOf(hudEl.getBoundingClientRect(), origin), legend: legendEl ? boxOf(legendEl.getBoundingClientRect(), origin) : null, collapsed: hudEl.getAttribute('data-collapsed') === 'true', width: card.clientWidth, height: card.clientHeight };
      setM((prev) => (sameMeasure(prev, next) ? prev : next));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(card);
    ro.observe(hudEl);
    if (legendEl) ro.observe(legendEl);
    const mo = new MutationObserver(read);
    mo.observe(hudEl, { attributes: true, attributeFilter: ['data-collapsed', 'data-state'] });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [cardRef, desktop]);

  const pick = useRef<HudPick | undefined>(undefined);
  const last = useRef<FitInsets>(base);
  const insets = useMemo(() => {
    const fit = m && desktop ? chooseHudFit({ doc, width: m.width, height: m.height, base, hud: m.hud, collapsed: m.collapsed, prev: pick.current }) : { insets: base, pick: 'base' as const };
    pick.current = fit.pick;
    // Misma identidad mientras los valores no cambien: el lienzo no reencuadra por un objeto nuevo.
    if (!insetsEqual(last.current, fit.insets)) last.current = fit.insets;
    return last.current;
  }, [m, doc, base, desktop]);
  // Con el HUD estático (móvil) no cubre nada. Identidad estable mientras la caja no cambie.
  const covered = useMemo<readonly Box[]>(() => (m && desktop ? (m.legend ? [m.hud, m.legend] : [m.hud]) : NO_BOXES), [m, desktop]);
  return { insets, covered };
}

const NO_BOXES: readonly Box[] = [];
