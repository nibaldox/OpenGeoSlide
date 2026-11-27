// Modo de la paleta flotante del lienzo (UA3-C2, B-10c): si no cabe, primero se compacta y, si aun así no cabe, hace scroll con la barra visible.
// Lógica pura; EditorCanvas la aplica midiendo la paleta con `data-compact` y `data-scroll`.

/** `full`: botones de 42 con los rótulos «Herram.» y «Vista». `compact`: botones de 36 y sin rótulos. `scroll`: compacta y con scroll. */
export type PaletteMode = 'full' | 'compact' | 'scroll';

/** Siguiente modo según si, en el actual, el contenido de la paleta excede su alto disponible. Nunca retrocede: eso lo hace el reinicio al cambiar el alto. */
export function nextPaletteMode(mode: PaletteMode, overflows: boolean): PaletteMode {
  if (!overflows) return mode;
  return mode === 'full' ? 'compact' : 'scroll';
}
