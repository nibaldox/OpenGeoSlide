// Marca de la cabecera (contrato UA §4.4, XA4 §1): cuadro de esquinas redondeadas, talud y arco de falla discontinuo.
// Colores por `var(--…)` en `App.css` (`.brand-mark`); aria-hidden: el nombre lo da el texto «OpenGeoSlide».

export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" width={36} height={36} aria-hidden="true" focusable="false">
      <rect className="frame" x="1" y="1" width="30" height="30" rx="8" />
      <path className="g1" d="M5 23h6.5l9-11H27" />
      <path className="g1" d="M10.5 23Q21 23.5 23.5 12" strokeDasharray="2.2 2.4" style={{ strokeWidth: 1.8 }} />
    </svg>
  );
}
