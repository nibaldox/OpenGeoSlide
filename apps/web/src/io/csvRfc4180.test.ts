// R9-07: los CSV de resultados y de superficie se leen sin opciones con un parser RFC 4180 estricto (Python `csv.DictReader`, el mismo
// que usa `pandas.read_csv` por defecto para delimitar): una sola fila de cabecera, el mismo número de campos en todas las filas y la
// columna `unidades` en cada una. Con la línea `# unidades: SI (m, kN/m³, kPa)` anterior, las cabeceras salían partidas por sus comas.
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { loadEngineReport } from '../report/fixtures';
import { resultsCsv, surfaceCoordsCsv } from '../editor/app/reportInput';

const PY = `
import csv, io, json, sys
text = sys.stdin.buffer.read().decode('utf-8')
rows = list(csv.reader(io.StringIO(text, newline=''), strict=True))
header = rows[0]
widths = sorted({len(r) for r in rows})
dicts = list(csv.DictReader(io.StringIO(text, newline=''), strict=True))
print(json.dumps({'header': header, 'widths': widths, 'n': len(dicts), 'units': sorted({d['unidades'] for d in dicts}), 'first': dicts[0]}))
`;

function parse(csv: string): { header: string[]; widths: number[]; n: number; units: string[]; first: Record<string, string> } | null {
  const r = spawnSync('python3', ['-c', PY], { input: csv, encoding: 'utf8', env: { ...process.env, PYTHONPATH: '', PYTHONHOME: '' } });
  if (r.error || r.status !== 0) {
    if (r.error) return null; // sin python3 en el entorno: se omite
    throw new Error(r.stderr);
  }
  return JSON.parse(r.stdout);
}

describe('R9-07: CSV de resultados compatible con RFC 4180', () => {
  const { results } = loadEngineReport('d01-fixed-ltr');
  for (const units of ['SI', 'imperial', undefined] as const) {
    it(`resultados y superficie (${units ?? 'sin units'}): cabecera única, ancho constante y columna unidades`, () => {
      const res = parse(resultsCsv({ engine: 'x', results }, units));
      const sur = parse(surfaceCoordsCsv(results, units));
      if (res === null || sur === null) return;
      const label = units === 'imperial' ? 'imperial' : 'SI';
      const len = units === 'imperial' ? 'ft' : 'm';
      expect(res.header).toEqual(['metodo', 'estado', 'fs', 'iteraciones', 'lambda', `xc_${len}`, `yc_${len}`, `r_${len}`, 'evaluadas', 'validas', 'avisos', 'unidades']);
      expect(res.widths).toEqual([12]);
      expect(res.n).toBe(results.length);
      expect(res.units).toEqual([label]);
      expect(sur.header).toEqual(['metodo', 'estado', 'punto', `x_${len}`, `y_${len}`, 'unidades']);
      expect(sur.widths).toEqual([6]);
      expect(sur.units).toEqual([label]);
    });
  }
});
