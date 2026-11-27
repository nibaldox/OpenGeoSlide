// F3B-W2: exportación CSV (`io/csv.ts`) para Hoek-Brown, SHANSEP, búsqueda no circular e identidad byte a byte de un modelo v0.5.
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { resultsCsv, surfaceCoordsCsv } from '../editor/app/reportInput';
import type { MethodReport } from '../engine/types';
import {
  F3B_CRITICAL_POLYLINE,
  hoekBrownFixture,
  nonCircularCircleWinsFixture,
  nonCircularPolylineWinsFixture,
  shansepFixture,
} from '../report/f3bFixtures';
import { polylineSurfaceRows, resultsToCsv, slicesToCsv, surfaceToCsv } from './csv';

const PY_STRICT_CSV = `
import csv, io, json, sys
text = sys.stdin.buffer.read().decode('utf-8')
rows = list(csv.reader(io.StringIO(text, newline=''), strict=True))
dicts = list(csv.DictReader(io.StringIO(text, newline=''), strict=True))
print(json.dumps({'header': rows[0], 'widths': sorted({len(r) for r in rows}), 'rows': dicts}))
`;

function parseStrict(csvText: string): { header: string[]; widths: number[]; rows: Record<string, string>[] } | null {
  const r = spawnSync('python3', ['-c', PY_STRICT_CSV], {
    input: csvText,
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: '', PYTHONHOME: '' },
  });
  if (r.error) return null;
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout);
}

describe('CSV por dovela (`slicesToCsv`, F6.6)', () => {
  it('Hoek-Brown: incluye `ley` y `normal_stress_kpa` (y omite `vertical_stress` y `ocr`)', () => {
    const { model, report } = hoekBrownFixture();
    const csv = slicesToCsv([report.results[0]!], { units: 'SI', materials: model.materials });
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(
      'metodo,estado,dovela,x_izq_m,x_der_m,y_base_izq_m,y_base_der_m,y_sup_m,ancho_m,alfa_rad,long_base_m,peso_kn_m,cohesion_kpa,tan_phi,presion_poros_kpa,material,unidades,ley,normal_stress_kpa',
    );
    expect(lines).toHaveLength(1 + report.results[0]!.slices.length);

    const parsed = parseStrict(csv);
    if (parsed) {
      expect(parsed.widths).toEqual([19]);
      expect(parsed.rows[0]).toMatchObject({ dovela: '1', ley: 'hoek_brown', normal_stress_kpa: '4.2' });
      expect(parsed.rows[4]).toMatchObject({ dovela: '5', ley: 'mohr_coulomb', normal_stress_kpa: '' });
    }

    const impCsv = slicesToCsv([report.results[0]!], { units: 'imperial', materials: model.materials });
    expect(impCsv.split('\r\n')[0]).toContain('normal_stress_psf');
  });

  it('SHANSEP: incluye `ley`, `vertical_stress_kpa` y `ocr` (y omite `normal_stress`)', () => {
    const { model, report } = shansepFixture();
    const csv = slicesToCsv(report.results, { units: 'SI', materials: model.materials });
    const header = csv.split('\r\n')[0]!;
    expect(header.endsWith(',unidades,ley,vertical_stress_kpa,ocr')).toBe(true);
    expect(header).not.toContain('normal_stress');

    const parsed = parseStrict(csv);
    if (parsed) {
      expect(parsed.widths).toEqual([20]);
      expect(parsed.rows[0]).toMatchObject({ ley: 'shansep', vertical_stress_kpa: '0', ocr: '1.5' });
      expect(parsed.rows[1]).toMatchObject({ ley: 'shansep', vertical_stress_kpa: '59.7', ocr: '1.35' });
    }
  });

  it('modelo mixto Hoek-Brown + SHANSEP: ancho RFC 4180 constante con ambas familias de columnas', () => {
    const hb = hoekBrownFixture().report.results[0]!;
    const sh = { ...shansepFixture().report.results[0]!, method: 'spencer' as const };
    const csv = slicesToCsv([hb, sh], { units: 'SI' });
    const parsed = parseStrict(csv);
    expect(csv.split('\r\n')[0]).toContain(',ley,normal_stress_kpa,vertical_stress_kpa,ocr');
    if (parsed) {
      expect(parsed.widths).toEqual([21]);
    }
  });
});

describe('CSV de resultados y de superficie crítica no circular', () => {
  it('búsqueda no circular (gana polilínea): exporta los vértices críticos en el mismo formato de las polilíneas y añade las columnas NC', () => {
    const { report } = nonCircularPolylineWinsFixture(true);
    const surfCsv = surfaceCoordsCsv(report.results, 'SI');
    const surfLines = surfCsv.split('\r\n');
    expect(surfLines[0]).toBe('metodo,estado,punto,x_m,y_m,unidades');
    expect(surfLines).toHaveLength(1 + F3B_CRITICAL_POLYLINE.length * 2);
    expect(surfLines[1]).toBe('spencer,converged,1,30,25,SI');
    expect(surfLines[F3B_CRITICAL_POLYLINE.length]).toBe('spencer,converged,7,51.2,35,SI');
    expect(polylineSurfaceRows(report.results[0]!)).toHaveLength(F3B_CRITICAL_POLYLINE.length);

    const resCsv = resultsCsv(report, 'SI');
    const [head, row0] = resCsv.split('\r\n');
    expect(head).toBe(
      'metodo,estado,fs,iteraciones,lambda,xc_m,yc_m,r_m,evaluadas,validas,avisos,unidades,superficie,funcion_interslice,semillas_nc,evaluadas_nc,fs_semilla,fs_polilinea',
    );
    expect(row0).toBe('spencer,converged,1.32,8,0.198,,,,8085,4715,non_circular_large_change,SI,polilinea,,3,4500,1.62,1.32');
  });

  it('búsqueda no circular (gana el círculo): `superficie` vale `circulo` y conserva xc, yc, r y las estadísticas NC', () => {
    const { report } = nonCircularCircleWinsFixture(false);
    const resCsv = resultsCsv(report, 'SI');
    const [head, row] = resCsv.split('\r\n');
    expect(head).toBe('metodo,estado,fs,iteraciones,lambda,xc_m,yc_m,r_m,evaluadas,validas,avisos,unidades,superficie,semillas_nc,evaluadas_nc,fs_semilla,fs_polilinea');
    expect(row).toBe('spencer,converged,0.402,7,0.142,29.51,53.74,28.74,8139,4200,,SI,circulo,3,4502,0.402,0.412');
    expect(polylineSurfaceRows(report.results[0]!)).toEqual([]);
  });

  it('Hoek-Brown: `resultsToCsv` agrega `pasadas_hb` solo cuando existe `strength.passes`', () => {
    const { report } = hoekBrownFixture();
    const lines = resultsToCsv(report.results, { units: 'SI' }).split('\r\n');
    expect(lines[0]).toBe('metodo,estado,fs,iteraciones,lambda,xc_m,yc_m,r_m,evaluadas,validas,avisos,unidades,pasadas_hb');
    expect(lines[1]!.endsWith(',SI,11')).toBe(true);
    expect(lines[2]!.endsWith(',SI,12')).toBe(true);
  });
});

describe('Identidad byte a byte del CSV de un modelo v0.5', () => {
  it('un informe v0.5 (con grieta de tracción, M-P y Janbu corregido, sin `strength` ni `non_circular`) queda byte a byte idéntico', () => {
    const v05Results: MethodReport[] = [
      {
        method: 'morgenstern_price',
        fos: 1.142,
        status: 'converged',
        iterations: 8,
        lambda: 0.245,
        interslice: { function: 'half_sine' },
        surface: { xc: 29.51, yc: 53.74, r: 28.74 },
        slices: [
          {
            x_left: 30,
            x_right: 40,
            y_base_left: 25,
            y_base_right: 26,
            y_top_mid: 30,
            width: 10,
            alpha: 0.09966865249116204,
            base_length: 10.04987562112089,
            weight: 200,
            cohesion: 5,
            tan_phi: 0.36,
            pore_pressure: 4,
            material: 0,
            weight_extra: 0,
            h_force: 0,
            h_moment_base: 0,
            driving_extra: 0,
            y_centroid: 0,
          },
        ],
        search: { evaluated: 4000, valid: 2500 },
        warnings: ['water_above_ground'],
        tension_crack: { x: 47.5, depth: 2, water_force: 19.62 },
      },
      {
        method: 'janbu_corrected',
        fos: 1.118,
        status: 'converged',
        iterations: 6,
        lambda: null,
        correction_factor: 1.052,
        surface: { xc: 29.51, yc: 53.74, r: 28.74 },
        slices: [],
        search: { evaluated: 4000, valid: 2500 },
        warnings: [],
        tension_crack: { x: 47.5, depth: 2, water_force: 19.62 },
      },
    ];

    const expectedV05ResultsCsv =
      'metodo,estado,fs,iteraciones,lambda,xc_m,yc_m,r_m,evaluadas,validas,avisos,unidades,funcion_interslice,f0,grieta_x_m,grieta_profundidad_m,grieta_pw_kn_m\r\n' +
      'morgenstern_price,converged,1.142,8,0.245,29.51,53.74,28.74,4000,2500,water_above_ground,SI,half_sine,,47.5,2,19.62\r\n' +
      'janbu_corrected,converged,1.118,6,,29.51,53.74,28.74,4000,2500,,SI,,1.052,47.5,2,19.62';

    expect(resultsToCsv(v05Results, { units: 'SI' })).toBe(expectedV05ResultsCsv);
    expect(surfaceToCsv([['morgenstern_price', 'converged', 1, 30, 25], ['morgenstern_price', 'converged', 2, 40, 26]], { units: 'SI' })).toBe(
      'metodo,estado,punto,x_m,y_m,unidades\r\n' + 'morgenstern_price,converged,1,30,25,SI\r\n' + 'morgenstern_price,converged,2,40,26,SI',
    );

    const v05SlicesHeader = slicesToCsv(v05Results, { units: 'SI' }).split('\r\n')[0]!;
    expect(v05SlicesHeader).not.toContain('ley');
    expect(v05SlicesHeader).not.toContain('normal_stress');
    expect(v05SlicesHeader).not.toContain('vertical_stress');
    expect(v05SlicesHeader).not.toContain('ocr');
  });
});
