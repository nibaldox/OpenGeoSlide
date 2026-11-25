import type { Scene } from '../render/scene';
import { legendItems, type LegendOptions } from './legendItems';

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
      {legendItems(scene, options).map((item) => (
        <li key={item.key}>
          <span className={`swatch ${item.swatch}`} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
