// Márgenes de encuadre que dejan libre el HUD (UA2-F1). Mide la caja del HUD relativa a la tarjeta del lienzo con un
// `ResizeObserver` y delega la elección en `chooseHudFit` (lógica pura, `hudFit.ts`). El candidato (`below` / `beside`) no se
// vuelve a elegir al editar el documento (UA3 A-08), y `compact` pide al HUD que se pliegue en ventanas bajas (UA-E3 §3, A-07).

import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { FitInsets } from '../../canvas/EditorCanvas';
import type { ModelDoc } from '../../types';
import { boxOf, chooseHudFit, insetsEqual, needsCompactHud, pickDocFor, type Box, type HudPick, type PickDoc } from './hudFit';
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
 *
 * `docEpoch` cambia al cargar otro documento. El candidato solo se elige de nuevo si cambia el tamaño del HUD o de la tarjeta,
 * `docEpoch`, o con «Encuadrar» y la tecla 0; editar vértices no reencuadra.
 */
export function useHudInsets(
  cardRef: RefObject<HTMLElement | null>,
  doc: ModelDoc,
  desktop: boolean,
  docEpoch = 0,
): { insets: FitInsets; covered: readonly Box[]; compact: boolean } {
  const base = desktop ? FIT_INSETS_DESKTOP : FIT_INSETS_MOBILE;
  const [m, setM] = useState<Measure | null>(null);
  const [refit, setRefit] = useState(0);
  // Última caja del HUD desplegado: con el HUD plegado a píldora no se puede medir.
  const expandedHud = useRef<Box | null>(null);

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
      if (!next.collapsed) expandedHud.current = next.hud;
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

  // «Encuadrar» (botón de la paleta) y la tecla 0 piden elegir de nuevo el candidato con el documento de ese momento.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return undefined;
    const onClick = (e: MouseEvent): void => {
      if (e.target instanceof Element && e.target.closest('button[aria-label="Encuadrar"]')) setRefit((n) => n + 1);
    };
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (e.key === '0' && !e.ctrlKey && !e.metaKey && !e.altKey && !['INPUT', 'SELECT', 'TEXTAREA'].includes(t?.tagName ?? '')) setRefit((n) => n + 1);
    };
    card.addEventListener('click', onClick, true);
    card.addEventListener('keydown', onKey, true);
    return () => {
      card.removeEventListener('click', onClick, true);
      card.removeEventListener('keydown', onKey, true);
    };
  }, [cardRef]);

  const docRef = useRef(doc);
  docRef.current = doc;
  const pickDoc = useRef<PickDoc | null>(null);
  const pick = useRef<HudPick | undefined>(undefined);
  const last = useRef<FitInsets>(base);
  const insets = useMemo(() => {
    // A-08: el documento solo se renueva con la clave (otro documento, «Encuadrar», tamaño de la tarjeta); editarlo no cambia el candidato.
    pickDoc.current = pickDocFor(pickDoc.current, { epoch: docEpoch, refit, width: m?.width ?? 0, height: m?.height ?? 0, desktop }, docRef.current);
    const fit = m && desktop ? chooseHudFit({ doc: pickDoc.current.doc, width: m.width, height: m.height, base, hud: m.hud, collapsed: m.collapsed, prev: pick.current }) : { insets: base, pick: 'base' as const };
    pick.current = fit.pick;
    // Misma identidad mientras los valores no cambien: el lienzo no reencuadra por un objeto nuevo.
    if (!insetsEqual(last.current, fit.insets)) last.current = fit.insets;
    return last.current;
    // `doc` no entra a propósito: ver arriba.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, docEpoch, refit, base, desktop]);
  // UA-E3 §3: con el HUD plegado se usa la última caja medida del desplegado. Si el usuario lo despliega a mano, se mide esa.
  const compact = useMemo(() => {
    if (!m || !desktop) return false;
    return needsCompactHud({ width: m.width, height: m.height, base, hud: m.collapsed ? expandedHud.current : m.hud, legend: m.legend });
  }, [m, desktop, base]);
  // Con el HUD estático (móvil) no cubre nada. Identidad estable mientras la caja no cambie.
  const covered = useMemo<readonly Box[]>(() => (m && desktop ? (m.legend ? [m.hud, m.legend] : [m.hud]) : NO_BOXES), [m, desktop]);
  return { insets, covered, compact };
}

const NO_BOXES: readonly Box[] = [];
