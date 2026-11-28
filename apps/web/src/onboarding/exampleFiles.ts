// Archivos de ejemplo descargables (CM-WC): un DXF y un CSV de regiones, en `public/examples/`. Los enlaces salen del diálogo de
// importación y de la Ayuda. La ruta es relativa a la base de la app (`import.meta.env.BASE_URL`): GitHub Pages sirve bajo
// `/OpenGeoSlide/`, y un enlace absoluto `/examples/...` caería fuera de la aplicación.

export interface ExampleFile {
  /** Ruta bajo `public/`, sin barra inicial. */
  path: string;
  /** Nombre con el que se guarda la descarga. */
  fileName: string;
  /** Texto del enlace. */
  label: string;
  /** Qué trae, para la Ayuda. */
  description: string;
}

export const EXAMPLE_FILES = {
  dxf: {
    path: 'examples/terraplen.dxf',
    fileName: 'terraplen.dxf',
    label: 'Descargar un DXF de ejemplo',
    description: 'terraplen.dxf: un terraplén con las capas SUELO_1 y arcilla (regiones cerradas) y TERRENO (polilínea abierta), en metros.',
  },
  csv: {
    path: 'examples/regiones.csv',
    fileName: 'regiones.csv',
    label: 'Descargar un CSV de ejemplo',
    description: 'regiones.csv: las mismas dos regiones en columnas capa, x, y.',
  },
} as const satisfies Record<string, ExampleFile>;

/** URL del archivo de ejemplo bajo la base de la app (`/` en local, `/OpenGeoSlide/` en Pages). */
export function exampleFileUrl(file: Pick<ExampleFile, 'path'>, base: string = import.meta.env.BASE_URL): string {
  return `${base.endsWith('/') ? base : `${base}/`}${file.path}`;
}
