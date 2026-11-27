import type { Scene } from '../render/scene';
import './legend.css';
import { FIXED_POLYLINE_LABEL, legendItems, type LegendExtraItem, type LegendOptions } from './legendItems';

/** Rótulo de la polilínea crítica obtenida por búsqueda no circular (F6.10, W-R15c). */
export const CRITICAL_POLYLINE_LABEL = 'Superficie crítica (polilínea)';

/**
 * Resuelve los elementos de la leyenda: si la polilínea dibujada proviene de una búsqueda no circular
 * convergida (`scene.surface.search === true`), se rotula «Superficie crítica (polilínea)» y no «Superficie fija (polilínea)».
 */
export function resolveLegendItems(scene: Scene, options?: LegendOptions): LegendExtraItem[] {
  const isCriticalPolyline = Boolean(scene.surface?.polyline) && scene.surface?.search === true && !options?.unconverged;
  return legendItems(scene, options).map((item) =>
    isCriticalPolyline && item.key === 'surface' && item.label === FIXED_POLYLINE_LABEL
      ? { ...item, label: CRITICAL_POLYLINE_LABEL }
      : item,
  );
}

/** Leyenda de la sección: materiales y elementos dibujados. El editor pasa `options` para mostrar solo lo que hay. */
export function Legend({ scene, options, label = 'Leyenda de materiales' }: { scene: Scene; options?: LegendOptions; label?: string }) {
  return (
    <ul className="legend" aria-label={label}>
      {scene.materials.map((m) => (
        <li key={m.id}>
          <span className="swatch" style={{ background: m.color }} aria-hidden="true" />
          {m.name} <span className="muted small">({m.id})</span>
        </li>
      ))}
      {resolveLegendItems(scene, options).map((item) => (
        <li key={item.key}>
          <span className={`swatch ${item.swatch}`} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
