// Paleta FIJA del informe PDF (U1-T, UX-15 y R7-27). Son constantes RGB para papel blanco: nunca se lee CSS, `color-scheme`
// ni el tema de la aplicación, de modo que el PDF sigue siendo claro aunque la interfaz esté en oscuro. Los materiales
// coinciden con `--canvas-mat-0…6` del tema CLARO de styles/tokens.css (lo comprueba palette.test.ts).

export type Rgb = [number, number, number];

export const PDF_PALETTE = {
  pageBg: [255, 255, 255],
  /** Texto y marco del dibujo. */
  ink: [0, 0, 0],
  frame: [0, 0, 0],
  /** Texto secundario (extremos de los ejes, pie de página). */
  inkMuted: [75, 85, 99],
  /** Filas de cabecera de las tablas y sus filetes. */
  tableHeaderBg: [230, 230, 230],
  tableRule: [180, 180, 180],
  tableTopRule: [120, 120, 120],
  /** Filete bajo los títulos. */
  headingRule: [150, 150, 150],
  /** Contorno de las regiones y de las muestras de material de la leyenda. */
  regionEdge: [55, 65, 81],
  surface: [185, 28, 28],
  piezo: [29, 78, 216],
  slices: [100, 116, 139],
  /** Siete tonos, en el mismo orden y tono que el tema claro del lienzo. */
  materials: [
    [216, 183, 122],
    [156, 194, 154],
    [159, 185, 217],
    [219, 165, 165],
    [194, 168, 216],
    [227, 207, 134],
    [169, 212, 208],
  ],
} as const satisfies Record<string, Rgb | readonly Rgb[]>;

/** Color del material de índice `index` (cíclico, como en el lienzo). */
export function pdfMaterialColor(index: number): Rgb {
  const n = PDF_PALETTE.materials.length;
  return [...(PDF_PALETTE.materials[((index % n) + n) % n] as Rgb)] as Rgb;
}
