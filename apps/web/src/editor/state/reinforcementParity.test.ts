// Paridad de la validación de los refuerzos v0.4 (F4.2, tarea 6 de R1-WA): la web (`openOgsJson` + `validateLocal`) y el motor real
// (`ogs analyze`, OGS_BIN) dan el mismo veredicto sobre la tabla de acuerdo de `verification/tools/test_schema.py`, y los errores
// de rango llevan el mismo puntero JSON.
//
// Veredicto del motor: rechazo si falla antes de resolver ninguna superficie (`InvalidModel`, `Json`); lo que pasa la validación
// y llega al cálculo cuenta como aceptado (el cálculo con refuerzos todavía es un `todo!` en la base de R1-WA).
//
// E14m-3: el motor de esta base aún exige `location` en pile y sheet_pile (R1-V lo quita en su rama). Si se detecta, el documento
// que se le envía lleva `location: "slip_surface"` en los que no lo traen, y las dos filas de `location` no se comparan con él.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openOgsJson } from '../../io/ogsJson';
import { ENGINE_PATH_ROWS, PARITY_TABLE, baseV04, type Json, type Mutation } from './reinforcementParityCases';
import { validateLocal } from './validateLocal';

const OGS_BIN = process.env.OGS_BIN;
const haveEngine = OGS_BIN !== undefined && existsSync(OGS_BIN);

const V097A = (JSON.parse(readFileSync(new URL('../../../../../verification/cases/V097a.json', import.meta.url), 'utf8')) as { model: Json }).model;

const build = (mutate: Mutation): Json => {
  const model = baseV04(V097A);
  mutate(model);
  return model;
};

interface Verdict {
  verdict: 'accept' | 'reject';
  /** Primera línea del error, o `''`. */
  message: string;
  /** Códigos y rutas de las incidencias locales con severidad error. */
  paths: string[];
}

/** La web: el archivo se abre (forma, claves, versión) y el documento resultante se valida. */
function webVerdict(model: Json): Verdict {
  const opened = openOgsJson(JSON.stringify(model));
  if (opened.doc === null) {
    const errs = opened.issues.filter((i) => i.severity === 'error');
    return { verdict: 'reject', message: errs[0]?.text ?? '', paths: errs.map((i) => i.path ?? '') };
  }
  const errs = validateLocal(opened.doc).filter((i) => i.severity === 'error');
  return { verdict: errs.length > 0 ? 'reject' : 'accept', message: errs[0]?.text ?? '', paths: errs.map((i) => i.path ?? '') };
}

function runEngine(model: Json): { verdict: 'accept' | 'reject'; message: string } {
  const dir = mkdtempSync(join(tmpdir(), 'ogs-reinf-parity-'));
  try {
    const file = join(dir, 'm.ogs.json');
    writeFileSync(file, JSON.stringify(model));
    const r = spawnSync(OGS_BIN as string, ['analyze', file], { encoding: 'utf8', maxBuffer: 1 << 28 });
    const out = `${r.stderr}${r.stdout}`;
    const rejected = r.status !== 0 && /InvalidModel|NoSurface|Json: /.test(out);
    return { verdict: rejected ? 'reject' : 'accept', message: out.trim().split('\n')[0] ?? '' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** ¿El motor de esta base todavía exige `location`? (R1-V lo quita; mientras tanto se le añade al enviarle el documento.) */
const engineNeedsLocation = ((): boolean => {
  if (!haveEngine) return false;
  const m = build((x) => {
    x.reinforcements = [{ id: 'p', type: 'pile', x1: 40, y1: 12, x2: 40, y2: 2, application: 'passive', force: 60, direction: 'tangent' }];
  });
  return /missing field `location`/.test(runEngine(m).message);
})();

function forEngine(model: Json): Json {
  if (!engineNeedsLocation) return model;
  const copy = JSON.parse(JSON.stringify(model)) as Json;
  if (Array.isArray(copy.reinforcements)) {
    for (const r of copy.reinforcements as Json[]) {
      if (r !== null && typeof r === 'object' && (r.type === 'pile' || r.type === 'sheet_pile') && !('location' in r)) r.location = 'slip_surface';
    }
  }
  return copy;
}

describe('refuerzos v0.4: la web sola cumple la tabla de acuerdo', () => {
  it('la tabla tiene al menos 25 aceptaciones y rechazos y 5 reglas solo del motor', () => {
    expect(PARITY_TABLE.length).toBeGreaterThanOrEqual(25);
    expect(PARITY_TABLE.filter((r) => r.engineOnly).length).toBeGreaterThanOrEqual(5);
    expect(PARITY_TABLE.some((r) => r.accepted)).toBe(true);
    expect(PARITY_TABLE.some((r) => !r.accepted)).toBe(true);
  });

  it('el modelo base de la tabla se acepta', () => {
    expect(webVerdict(build(() => {})).verdict).toBe('accept');
  });

  for (const row of PARITY_TABLE) {
    it(`${row.accepted ? 'acepta' : 'rechaza'}: ${row.name}`, () => {
      const w = webVerdict(build(row.mutate));
      expect(w.verdict, w.message).toBe(row.accepted ? 'accept' : 'reject');
    });
  }

  it('las reglas solo del motor las rechaza `validateLocal` (el archivo se abre) con un código editor.reinforcement_*', () => {
    for (const row of PARITY_TABLE.filter((r) => r.engineOnly)) {
      const model = build(row.mutate);
      const opened = openOgsJson(JSON.stringify(model));
      expect(opened.doc, row.name).not.toBeNull();
      const codes = validateLocal(opened.doc as NonNullable<typeof opened.doc>)
        .filter((i) => i.severity === 'error')
        .map((i) => i.code);
      expect(codes.length, row.name).toBeGreaterThan(0);
      expect(codes.every((c) => c.startsWith('editor.reinforcement_')), `${row.name}: ${codes.join(',')}`).toBe(true);
    }
  });
});

describe.skipIf(!haveEngine)('refuerzos v0.4: paridad web ↔ motor real (OGS_BIN)', () => {
  const summary = { rows: 0, agree: 0, skippedLocation: 0 };

  for (const row of PARITY_TABLE) {
    it(`${row.name}`, () => {
      const model = build(row.mutate);
      const w = webVerdict(model);
      if (row.locationRow && engineNeedsLocation) {
        // El motor de esta base acepta `location`; R1-V lo quita. La web ya lo rechaza (E14m-3).
        summary.skippedLocation += 1;
        expect(w.verdict).toBe('reject');
        return;
      }
      const e = runEngine(forEngine(model));
      summary.rows += 1;
      expect(w.verdict, `web: ${w.message} | motor: ${e.message}`).toBe(e.verdict);
      expect(e.verdict, `motor: ${e.message}`).toBe(row.accepted ? 'accept' : 'reject');
      summary.agree += 1;
    });
  }

  it('los errores de rango llevan el mismo puntero JSON que el motor', () => {
    for (const { mutate, enginePath, localPath } of ENGINE_PATH_ROWS) {
      const model = build(mutate);
      const e = runEngine(forEngine(model));
      expect(e.verdict, enginePath).toBe('reject');
      expect(e.message, enginePath).toContain(enginePath);
      expect(webVerdict(model).paths, enginePath).toContain(localPath);
    }
  });

  it('resumen', () => {
    console.log(`paridad refuerzos: ${summary.agree}/${summary.rows} filas con el mismo veredicto; ${summary.skippedLocation} filas de location sin comparar (motor de la base)`);
    expect(summary.agree).toBe(summary.rows);
  });
});
