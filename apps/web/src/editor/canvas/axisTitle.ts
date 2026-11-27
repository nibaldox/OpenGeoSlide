// Título del eje vertical «y (m)» (UA3-C2, B-13b): se dibuja en el primer hueco libre del eje, no bajo el HUD ni bajo la leyenda ni encima de un rótulo
// de marca. Lógica pura, con la misma geometría que `labelCovered` (los rótulos del eje y se dibujan en x = 4, con la línea base a `px - 2`).

export interface AxisBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Aire, en px, entre el título y lo que lo rodea. */
const AIR = 2;

/** Caja del rótulo `label` cuya línea de la cuadrícula está en `px` (la línea base queda a `px - 2`). */
export function axisLabelBox(label: string, px: number, fontPx: number, x = 4): AxisBox {
  return { left: x, top: px - 2 - fontPx, right: x + label.length * fontPx * 0.62, bottom: px - 2 + 3 };
}

const hits = (a: AxisBox, b: AxisBox): boolean => a.right + AIR > b.left && a.left - AIR < b.right && a.bottom + AIR > b.top && a.top - AIR < b.bottom;

export interface AxisTitleInput {
  /** «y (m)». */
  title: string;
  fontPx: number;
  /** Alto del lienzo en px. */
  height: number;
  /** Cajas que una capa flotante deja tapadas (HUD, leyenda). */
  covered: readonly AxisBox[];
  /** Rótulos de marca del eje y que sí se dibujan (texto y línea de la cuadrícula). */
  ticks: readonly { label: string; px: number }[];
  /** Esquina izquierda del título (6 px de siempre). */
  x?: number;
  /** Línea base preferida (la de siempre: arriba del todo). */
  preferred?: number;
}

/**
 * Línea base del título: la preferida si está libre y, si no, la primera que lo está yendo hacia abajo en pasos de 2 px. Se detiene por encima de la
 * franja del eje x (rótulos y título «x (m)»). `null` si el eje no tiene ningún hueco: entonces el título no se dibuja.
 */
export function axisTitleBaseline(input: AxisTitleInput): number | null {
  const { title, fontPx, height, covered, ticks, x = 6, preferred = fontPx + 4 } = input;
  const obstacles: AxisBox[] = [...covered, ...ticks.map((t) => axisLabelBox(t.label, t.px, fontPx))];
  const floor = height - fontPx - 8;
  for (let baseline = preferred; baseline <= floor; baseline += 2) {
    if (!obstacles.some((o) => hits(axisLabelBox(title, baseline + 2, fontPx, x), o))) return baseline;
  }
  return null;
}
