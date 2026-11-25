// Estado vacío del lienzo: el modelo no tiene regiones. Dos acciones («Dibujar región» y «Abrir un ejemplo») y la indicación de
// que también se puede importar un DXF o un CSV. Se muestra sobre el lienzo (`EditorCanvas`, prop `emptyState`).

import './newModel.css';

export function EmptyCanvasState({ onDraw, onExample }: { onDraw: () => void; onExample: () => void }) {
  return (
    <div className="ns-empty" role="group" aria-labelledby="ns-empty-title">
      <p id="ns-empty-title" className="ns-empty-title">
        El modelo no tiene regiones
      </p>
      <p className="ns-empty-text">Dibuje la primera región del talud en el lienzo o parta de un ejemplo ya armado.</p>
      <div className="ns-empty-actions">
        <button type="button" className="primary" onClick={onDraw}>
          Dibujar región
        </button>
        <button type="button" onClick={onExample}>
          Abrir un ejemplo
        </button>
      </div>
      <p className="ns-empty-text small muted">
        También puede importar un DXF o un CSV, o crear un talud simple, desde el menú Archivo.
      </p>
    </div>
  );
}
