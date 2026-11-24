import type { Scene } from '../render/scene';

export function Legend({ scene }: { scene: Scene }) {
  return (
    <ul className="legend" aria-label="Leyenda de materiales">
      {scene.materials.map((m) => (
        <li key={m.id}>
          <span className="swatch" style={{ background: m.color }} aria-hidden="true" />
          {m.name} <span className="muted small">({m.id})</span>
        </li>
      ))}
      <li>
        <span className="swatch line-red" aria-hidden="true" />
        Superficie crítica
      </li>
      <li>
        <span className="swatch slice" aria-hidden="true" />
        Dovelas
      </li>
      {scene.piezo ? (
        <li>
          <span className="swatch line-blue" aria-hidden="true" />
          Piezométrica
        </li>
      ) : null}
    </ul>
  );
}
