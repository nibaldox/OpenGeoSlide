// F3-W1f: CSV con superficie polilínea, función de Morgenstern-Price y f₀ de Janbu corregido (RFC 4180, leído con Python estricto).
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import type { MethodReport } from '../engine/types';
import { resultsCsv, surfaceCoordsCsv } from '../editor/app/reportInput';
import { polylineSurfaceRows, resultsToCsv } from './csv';

const PTS: [number, number][] = [[30, 25.000001], [35, 25.520953], [40, 26.973391], [45, 29.525055], [51.29111842105263, 35]];
const slices = [{ x_left: 30, x_right: 35, y_base_left: 25, y_base_right: 25.5 }] as unknown as MethodReport['slices'];
const rep = (o: Partial<MethodReport>): MethodReport =>
  ({ method: 'spencer', fos: 1.2, status: 'converged', iterations: 4, lambda: 0.3, surface: { points: PTS }, slices, search: null, warnings: [], ...o }) as MethodReport;

const PY = `
import csv, io, json, sys
text = sys.stdin.buffer.read().decode('utf-8')
rows = list(csv.reader(io.StringIO(text, newline=''), strict=True))
dicts = list(csv.DictReader(io.StringIO(text, newline=''), strict=True))
print(json.dumps({'header': rows[0], 'widths': sorted({len(r) for r in rows}), 'rows': dicts}))
`;
function parse(csv: string): { header: string[]; widths: number[]; rows: Record<string, string>[] } | null {
  const r = spawnSync('python3', ['-c', PY], { input: csv, encoding: 'utf8', env: { ...process.env, PYTHONPATH: '', PYTHONHOME: '' } });
  if (r.error) return null; // sin python3 en el entorno: se omite
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout);
}

describe('CSV de la superficie con polilínea: una fila por punto', () => {
  it('polylineSurfaceRows: [método, estado, n, x, y] por cada punto ajustado del informe, sin redondear', () => {
    const rows = polylineSurfaceRows(rep({ method: 'morgenstern_price' }));
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual(['morgenstern_price', 'converged', 1, 30, 25.000001]);
    expect(rows[4]).toEqual(['morgenstern_price', 'converged', 5, 51.29111842105263, 35]);
    expect(polylineSurfaceRows(rep({ surface: { xc: 1, yc: 2, r: 3 } }))).toEqual([]);
  });
  it('surfaceCoordsCsv: cabecera metodo,estado,punto,x_m,y_m,unidades y los puntos de la polilínea (no los de las dovelas)', () => {
    const csv = surfaceCoordsCsv([rep({ method: 'spencer' })], 'SI');
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('metodo,estado,punto,x_m,y_m,unidades');
    expect(lines).toHaveLength(6);
    expect(lines[1]).toBe('spencer,converged,1,30,25.000001,SI');
    expect(lines[5]).toBe('spencer,converged,5,51.29111842105263,35,SI');
    expect(surfaceCoordsCsv([rep({})], 'imperial').split('\r\n')[0]).toBe('metodo,estado,punto,x_ft,y_ft,unidades');
  });
  it('un método sin convergencia no se exporta, como con el círculo', () => {
    expect(surfaceCoordsCsv([rep({ status: 'not_converged' })], 'SI').trim().split('\r\n')).toHaveLength(1);
  });
  it('lo lee un parser RFC 4180 estricto con ancho constante', () => {
    const p = parse(surfaceCoordsCsv([rep({}), rep({ method: 'janbu_simplified' })], 'SI'));
    if (p === null) return;
    expect(p.widths).toEqual([6]);
    expect(p.rows).toHaveLength(10);
    expect(p.rows[3]).toMatchObject({ metodo: 'spencer', punto: '4', x_m: '45', y_m: '29.525055', unidades: 'SI' });
  });
  it('con el círculo no cambia: los puntos de la base de las dovelas', () => {
    const csv = surfaceCoordsCsv([rep({ surface: { xc: 1, yc: 2, r: 3 } })], 'SI');
    expect(csv.split('\r\n')[1]).toBe('spencer,converged,1,30,25,SI');
    expect(csv.split('\r\n')).toHaveLength(3);
  });
});

describe('CSV de resultados: superficie, función y f₀', () => {
  const circle = { xc: 1, yc: 2, r: 3 };
  it('sin polilínea ni métodos nuevos, la cabecera no cambia (compatibilidad con lo ya exportado)', () => {
    const csv = resultsToCsv([rep({ surface: circle, method: 'bishop' })]);
    expect(csv.split('\r\n')[0]).toBe('metodo,estado,fs,iteraciones,lambda,xc_m,yc_m,r_m,evaluadas,validas,avisos,unidades');
  });
  it('con polilínea, M-P y Janbu corregido, añade superficie, funcion_interslice y f0 al final', () => {
    const csv = resultsToCsv([
      rep({ method: 'morgenstern_price', interslice: { function: 'half_sine' } }),
      rep({ method: 'janbu_corrected', lambda: null, fos: 1.04, correction_factor: 1.0431 }),
      rep({ method: 'janbu_simplified', lambda: null, fos: 1.0 }),
    ]);
    const [head, ...rows] = csv.split('\r\n');
    expect(head).toBe('metodo,estado,fs,iteraciones,lambda,xc_m,yc_m,r_m,evaluadas,validas,avisos,unidades,superficie,funcion_interslice,f0');
    expect(rows[0]).toBe('morgenstern_price,converged,1.2,4,0.3,,,,,,,SI,polilinea,half_sine,');
    expect(rows[1]).toBe('janbu_corrected,converged,1.04,4,,,,,,,,SI,polilinea,,1.0431');
    expect(rows[2]).toBe('janbu_simplified,converged,1,4,,,,,,,,SI,polilinea,,');
  });
  it('M-P con círculo: solo se añade la función; f0 no existe si ningún Janbu corregido convergió', () => {
    const csv = resultsToCsv([
      rep({ method: 'morgenstern_price', surface: circle, interslice: { function: 'data_points', points: [[0, 0], [1, 1]] } }),
      rep({ method: 'janbu_corrected', surface: circle, status: 'not_converged', correction_factor: 1.2 }),
    ]);
    expect(csv.split('\r\n')[0]).toBe('metodo,estado,fs,iteraciones,lambda,xc_m,yc_m,r_m,evaluadas,validas,avisos,unidades,funcion_interslice');
    expect(csv.split('\r\n')[1]).toBe('morgenstern_price,converged,1.2,4,0.3,1,2,3,,,,SI,data_points');
    expect(csv.split('\r\n')[2]).toBe('janbu_corrected,not_converged,,4,,1,2,3,,,,SI,');
  });
  it('resultsCsv lo lee un parser estricto con ancho constante', () => {
    const p = parse(resultsCsv({ engine: 'x', results: [rep({ method: 'janbu_corrected', correction_factor: 1.1 }), rep({})] }, 'imperial'));
    if (p === null) return;
    expect(p.widths).toEqual([14]);
    expect(p.rows[0]).toMatchObject({ metodo: 'janbu_corrected', f0: '1.1', superficie: 'polilinea', unidades: 'imperial' });
  });
});
