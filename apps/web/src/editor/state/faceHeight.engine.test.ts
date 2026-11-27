// E15m-15 (R13): `tension_crack.face_height` con el motor real (OGS_BIN) y la conversión de unidades, con `a04_udl` (grieta automática bajo una UDL).
//
// El motor de esta rama aún NO emite `face_height` (lo trae la integración de E15m-15). Mientras no lo emita, esta suite se omite (`skipIf`): la integración
// la activa sola en cuanto el binario de `OGS_BIN` devuelva el campo; no hay que editar el test. Las salidas construidas a mano están en
// `report/crack.faceHeight.test.ts` y `render/crack.faceHeight.test.ts`.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isAnalysisReport } from '../../engine/validate';
import { crackRecords, crackTable, isCutNoCrack } from '../../report/crackReport';
import { engineRun, haveEngine, type EngineMethodResult } from './engineRun.testutil';
import { convertDocUnits } from './units';
import { openOgsJson } from '../../io/ogsJson';
import type { ModelDoc } from '../types';
import type { MethodReport } from '../../engine/types';

type Row = EngineMethodResult & { tension_crack?: { x: number; depth: number; water_force: number; face_height?: number } };

const A04 = new URL('../../../../../crates/ogs-core/tests/data/f3g7m/a04_udl.json', import.meta.url);
const memo = <T,>(f: () => T): (() => T) => {
  let v: T | undefined;
  return () => (v === undefined ? (v = f()) : v);
};
const doc = (): ModelDoc => {
  const r = openOgsJson(readFileSync(A04, 'utf8'));
  if (!r.doc) throw new Error('a04_udl no abre');
  return r.doc;
};
const SI = memo(() => engineRun(doc()).results as Row[]);
const IMP = memo(() => engineRun(convertDocUnits(doc(), 'imperial')).results as Row[]);

/** ¿El binario de OGS_BIN ya emite `face_height` en `a04_udl`? (se evalúa una vez, al reunir los tests, y solo con motor). */
const engineEmitsFaceHeight = (): boolean => haveEngine && SI().some((r) => r.tension_crack?.face_height !== undefined);

describe.skipIf(!engineEmitsFaceHeight())('face_height con el motor real (se activa con la integración de E15m-15)', () => {
  it('a04_udl: depth 0, water_force 0 y face_height ≈ 1,7827 (la cara cortada bajo la UDL)', () => {
    const c = SI().find((r) => r.method === 'bishop')!.tension_crack!;
    expect(c.depth).toBeLessThan(1e-9);
    expect(c.water_force).toBe(0);
    expect(c.face_height).toBeGreaterThan(1.78);
    expect(c.face_height).toBeLessThan(1.7835);
    expect(isCutNoCrack(c)).toBe(true);
  });
  it('el informe del motor pasa isAnalysisReport y la tabla dice el corte, no «Sin grieta»', () => {
    const results = SI() as unknown as MethodReport[];
    expect(isAnalysisReport({ engine: 'ogs', results })).toBe(true);
    const t = crackTable(crackRecords(results), 'SI', 1);
    expect(t.rows[0]!.join(' ')).toContain('Corte de la masa en x =');
    expect(t.rows[0]!.join(' ')).not.toContain('Sin grieta');
  });
  it('conversión de unidades: face_height en ft = face_height en m × 3,28084 (1e-6)', () => {
    for (const r of SI()) {
      const a = r.tension_crack?.face_height;
      const b = IMP().find((x) => x.method === r.method)?.tension_crack?.face_height;
      expect(a, r.method).toBeDefined();
      expect(b, r.method).toBeDefined();
      expect(Math.abs((b as number) - (a as number) * 3.280839895), r.method).toBeLessThan(1e-6 * Math.max(1, b as number));
    }
  });
  it('el FS no cambia entre SI e imperial (1e-9)', () => {
    for (const r of SI()) expect(Math.abs((r.fos as number) - (IMP().find((x) => x.method === r.method)!.fos as number))).toBeLessThan(1e-9);
  });
});

// Con el motor de esta rama (sin face_height) el motor real no debe romper la validación ni la tabla: se prueba siempre que haya OGS_BIN.
describe.skipIf(!haveEngine)('a04_udl con el motor real: el informe sigue siendo válido (con o sin face_height)', () => {
  it('pasa isAnalysisReport y crackTable no lanza', () => {
    const results = SI() as unknown as MethodReport[];
    expect(results.length).toBeGreaterThan(0);
    expect(isAnalysisReport({ engine: 'ogs', results })).toBe(true);
    expect(crackTable(crackRecords(results), 'SI', 1).rows.length).toBe(results.length);
  });
});
