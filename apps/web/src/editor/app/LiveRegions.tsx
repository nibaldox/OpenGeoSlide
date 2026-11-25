// Regiones vivas persistentes (R7-12, WCAG 4.1.3): una `polite` para el resumen del cálculo y los avisos, y una
// `alert` para los errores. Existen siempre en el DOM y solo cambia su texto, que es lo que los lectores de pantalla
// anuncian de forma fiable. Están ocultas a la vista: el contenido visible es el resumen y la lista de mensajes.

export function LiveRegions({ polite, alert }: { polite: string; alert: string }) {
  return (
    <>
      <div className="visually-hidden" aria-live="polite" aria-atomic="true" data-testid="live-polite">
        {polite}
      </div>
      <div className="visually-hidden" role="alert" aria-atomic="true" data-testid="live-alert">
        {alert}
      </div>
    </>
  );
}
