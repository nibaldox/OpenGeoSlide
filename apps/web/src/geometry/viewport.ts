// Transformación mundo ↔ pantalla con aspecto 1:1 (misma escala en x e y), márgenes y ajuste al contenido.
// Pantalla: x crece a la derecha, y crece hacia abajo; el mundo tiene y hacia arriba.

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface Viewport {
  /** Píxeles CSS por metro (igual en x e y). */
  scale: number;
  /** Pantalla x = tx + scale · x. */
  tx: number;
  /** Pantalla y = ty − scale · y. */
  ty: number;
  width: number;
  height: number;
}

/** Ajusta `bounds` al lienzo de `width × height` px con `margin` px por lado. */
export function fitViewport(bounds: Bounds, width: number, height: number, margin: number): Viewport {
  const spanX = Math.max(bounds.maxX - bounds.minX, 1e-9);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1e-9);
  const availW = Math.max(width - 2 * margin, 1);
  const availH = Math.max(height - 2 * margin, 1);
  const scale = Math.min(availW / spanX, availH / spanY);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return {
    scale,
    tx: width / 2 - scale * cx,
    ty: height / 2 + scale * cy,
    width,
    height,
  };
}

export function worldToScreen(vp: Viewport, x: number, y: number): [number, number] {
  return [vp.tx + vp.scale * x, vp.ty - vp.scale * y];
}

export function screenToWorld(vp: Viewport, sx: number, sy: number): [number, number] {
  return [(sx - vp.tx) / vp.scale, (vp.ty - sy) / vp.scale];
}
