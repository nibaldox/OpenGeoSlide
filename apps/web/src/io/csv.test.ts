import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../editor/types';
import type { MethodReport } from '../engine/types';
import { csvToPoints, csvToRegions, escapeCsvText, modelToCsv, parseCsv, piezoToCsv, resultsToCsv, toCsv } from './csv';

describe('parseCsv', () => {
  it('detecta la coma y deja el punto decimal', () => {
    const r = parseCsv('capa,x,y\nsuelo,0,0\nsuelo,10.5,0\nsuelo,10,5\n');
    expect(r.ok).toBe(true);
    expect(r.delimiter).toBe(',');
    expect(r.rows[1]).toEqual({ capa: 'suelo', x: '10.5', y: '0' });
  });

  it('detecta ; con BOM y cabeceras en mayúsculas, y normaliza la coma decimal', () => {
    const r = parseCsv('\ufeffCapa;X;Y\r\nARCILLA;30,5;-2,25\r\nARCILLA;31;4\r\n');
    expect(r.ok).toBe(true);
    expect(r.delimiter).toBe(';');
    expect(r.rows[0]).toEqual({ capa: 'ARCILLA', x: '30.5', y: '-2.25' });
  });

  it('detecta tabulación', () => {
    const r = parseCsv('x\ty\n1,5\t2\n3\t4,5\n');
    expect(r.delimiter).toBe('\t');
    expect(r.rows).toEqual([{ x: '1.5', y: '2' }, { x: '3', y: '4.5' }]);
  });

  it('con delimitador coma, «30,5» entre comillas NO es decimal y se rechaza al convertir', () => {
    const r = parseCsv('x,y\n"30,5",2\n1,2\n');
    expect(r.delimiter).toBe(',');
    expect(r.rows[0]?.x).toBe('30,5');
    const pts = csvToPoints(r);
    expect(pts.points).toEqual([]);
    expect(pts.issues[0]).toMatchObject({ severity: 'error', line: 2 });
    expect(pts.issues[0]?.text).toContain('Fila de datos 1');
  });

  it('no toca la coma de una columna de texto', () => {
    const r = parseCsv('capa;x;y\n1,5;1;2\n');
    expect(r.rows[0]?.capa).toBe('1,5');
  });

  it('reporta filas incompletas con su número', () => {
    const r = parseCsv('capa,x,y\ns,0,0\ns,1\ns,2,2\n');
    expect(r.ok).toBe(false);
    const e = r.issues.find((i) => i.severity === 'error');
    expect(e?.text).toContain('fila de datos 2');
    expect(e?.line).toBe(3);
  });

  it('vacío y solo cabecera no son válidos', () => {
    expect(parseCsv('').ok).toBe(false);
    expect(parseCsv('x,y\n').ok).toBe(false);
  });
});

describe('csvToPoints / csvToRegions', () => {
  it('x,y → puntos', () => {
    const r = csvToPoints(parseCsv('x;y\n0;12\n40;6,5\n'));
    expect(r.points).toEqual([[0, 12], [40, 6.5]]);
    expect(r.issues).toEqual([]);
  });

  it('rechaza vacíos, NaN e Infinity como coordenadas', () => {
    for (const bad of ['', 'abc', 'NaN', 'Infinity', '1e999', '1,2,3']) {
      const r = csvToPoints(parseCsv(`x,y\n0,0\n${JSON.stringify(bad).replace(/^"|"$/g, '"')},1\n`));
      expect(r.points).toEqual([]);
      expect(r.issues.length).toBeGreaterThan(0);
    }
  });

  it('falta de columnas', () => {
    expect(csvToPoints(parseCsv('a,b\n1,2\n')).issues[0]?.text).toContain('«x» y «y»');
    expect(csvToRegions(parseCsv('x,y\n1,2\n')).issues[0]?.text).toContain('«capa»');
  });

  it('capa,x,y → polígonos por tramo, sin vértice de cierre repetido', () => {
    const csv = [
      'capa,x,y',
      'roca,0,0', 'roca,10,0', 'roca,10,5', 'roca,0,0',
      'suelo,0,5', 'suelo,10,5', 'suelo,10,8',
    ].join('\n');
    const r = csvToRegions(parseCsv(csv));
    expect(r.issues).toEqual([]);
    expect(r.regions).toEqual([
      { layer: 'roca', polygon: [[0, 0], [10, 0], [10, 5]] },
      { layer: 'suelo', polygon: [[0, 5], [10, 5], [10, 8]] },
    ]);
  });

  it('un tramo con menos de 3 vértices genera aviso y se omite', () => {
    const r = csvToRegions(parseCsv('layer,x,y\na,0,0\na,1,1\n'));
    expect(r.regions).toEqual([]);
    expect(r.issues[0]?.severity).toBe('aviso');
  });
});

describe('exportación', () => {
  it('escapeCsvText antepone comilla simple en = + - @ tab CR', () => {
    for (const s of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx', '\rx']) expect(escapeCsvText(s)).toBe(`'${s}`);
    expect(escapeCsvText('suelo')).toBe('suelo');
    expect(escapeCsvText('a=b')).toBe('a=b');
  });

  it('toCsv protege textos pero no números negativos; comillas y comas se citan', () => {
    const csv = toCsv(['capa', 'x', 'y'], [['=HYPERLINK("http://x")', -1.5, 2], ['a,b', 0, null]]);
    expect(csv).toBe('capa,x,y\r\n"\'=HYPERLINK(""http://x"")",-1.5,2\r\n"a,b",0,');
  });

  it('coma decimal solo con delimitador distinto de la coma', () => {
    expect(toCsv(['x'], [[1.5]], { delimiter: ';', decimalComma: true })).toBe('x\r\n1,5');
    expect(toCsv(['x'], [[1.5]], { delimiter: ',', decimalComma: true })).toBe('x\r\n1.5');
  });

  it('modelo → CSV → modelo (ida y vuelta de coordenadas)', () => {
    const doc = {
      format: 'opengeoslide', version: '0.2', meta: {}, materials: [],
      regions: [{ material: 'r1', polygon: [[0, 0], [10.25, 0], [10, 5.5]] }, { material: '=x', polygon: [[0, 5], [10, 5], [10, 8]] }],
      water: { piezometric_line: [[0, 12], [40, 6.5]] },
      analysis: {},
    } as unknown as ModelDoc;
    const regions = csvToRegions(parseCsv(modelToCsv(doc, { delimiter: ';', decimalComma: true })));
    expect(regions.regions[0]).toEqual({ layer: 'r1', polygon: doc.regions[0]?.polygon });
    expect(regions.regions[1]?.layer).toBe("'=x");
    expect(csvToPoints(parseCsv(piezoToCsv(doc, { delimiter: '\t' }))).points).toEqual([[0, 12], [40, 6.5]]);
  });

  it('resultsToCsv escribe el FS solo si convergió', () => {
    const base = { lambda: null, slices: [], warnings: [], iterations: 3, surface: { xc: 1, yc: 2, r: 3 }, search: { evaluated: 10, valid: 4 } };
    const results: MethodReport[] = [
      { ...base, method: 'bishop', fos: 1.234, status: 'converged' },
      { ...base, method: 'spencer', fos: 0.9, status: 'not_converged', lambda: 0.1 },
    ];
    expect(resultsToCsv(results)).toBe(
      'metodo,estado,fs,iteraciones,lambda,xc,yc,r,evaluadas,validas\r\n' +
        'bishop,converged,1.234,3,,1,2,3,10,4\r\n' +
        'spencer,not_converged,,3,0.1,1,2,3,10,4',
    );
  });
});
