// CM-WC: los archivos de ejemplo descargables existen en `public/examples/`, se leen con el importador y los enlaces siguen la base de la app.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { csvToRegions, parseCsv } from '../io/csv';
import { parseDxf } from '../io/dxf';
import { EXAMPLE_FILES, exampleFileUrl } from './exampleFiles';
import { EXAMPLE_FILES as FROM_HELP } from './helpContent';

const publicFile = (path: string): string => readFileSync(new URL(`../../public/${path}`, import.meta.url), 'utf8');

describe('exampleFileUrl', () => {
  it('cuelga de la base de la app, con o sin la barra final', () => {
    expect(exampleFileUrl(EXAMPLE_FILES.dxf, '/')).toBe('/examples/terraplen.dxf');
    expect(exampleFileUrl(EXAMPLE_FILES.dxf, '/OpenGeoSlide/')).toBe('/OpenGeoSlide/examples/terraplen.dxf');
    expect(exampleFileUrl(EXAMPLE_FILES.csv, '/OpenGeoSlide')).toBe('/OpenGeoSlide/examples/regiones.csv');
    expect(exampleFileUrl(EXAMPLE_FILES.csv, './')).toBe('./examples/regiones.csv');
  });
  it('nunca es una ruta absoluta que ignore la base (salvo que la base sea «/»)', () => {
    expect(exampleFileUrl(EXAMPLE_FILES.dxf, '/OpenGeoSlide/').startsWith('/examples/')).toBe(false);
  });
  it('la Ayuda y el diálogo usan la misma tabla', () => {
    expect(FROM_HELP).toBe(EXAMPLE_FILES);
  });
});

describe('archivos de public/examples', () => {
  it('terraplen.dxf es el mismo que el de las pruebas de io/dxf y se lee sin errores', () => {
    const text = publicFile('examples/terraplen.dxf');
    expect(text).toBe(readFileSync(new URL('../io/dxf/fixtures/terraplen.dxf', import.meta.url), 'utf8'));
    const r = parseDxf(text, { materials: [] });
    expect(r.ok).toBe(true);
    expect(r.regions).toHaveLength(2);
  });
  it('regiones.csv se lee sin incidencias y trae dos regiones (SUELO_1 y arcilla)', () => {
    const csv = parseCsv(publicFile('examples/regiones.csv'));
    expect(csv.ok).toBe(true);
    const read = csvToRegions(csv);
    expect(read.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(read.regions.map((r) => r.layer)).toEqual(['SUELO_1', 'arcilla']);
    expect(read.regions.map((r) => r.polygon.length)).toEqual([6, 4]);
  });
  it('cada ejemplo declara su nombre de descarga, su texto y su descripción', () => {
    for (const f of Object.values(EXAMPLE_FILES)) {
      expect(publicFile(f.path).length).toBeGreaterThan(20);
      expect(f.path.endsWith(f.fileName)).toBe(true);
      expect(f.label).toMatch(/^Descargar un (DXF|CSV) de ejemplo$/);
      expect(f.description.startsWith(f.fileName)).toBe(true);
    }
  });
});
