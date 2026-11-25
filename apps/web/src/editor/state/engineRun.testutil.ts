// Ayuda SOLO para tests: ejecuta el binario `ogs analyze` (OGS_BIN) sobre un documento y devuelve los resultados por método.
// No se importa desde código de producción.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveOgsJson } from '../../io/ogsJson';
import type { ModelDoc } from '../types';

export const OGS_BIN = process.env.OGS_BIN;
export const haveEngine = OGS_BIN !== undefined && existsSync(OGS_BIN);

export interface EngineMethodResult {
  method: string;
  fos: number | null;
  status: string;
  surface?: { xc: number; yc: number; r: number };
  slices?: { x_left: number; x_right: number; y_base_left: number; y_base_right: number }[];
}

export interface EngineRun {
  code: number | null;
  out: string;
  results: EngineMethodResult[];
}

export function engineRun(doc: ModelDoc): EngineRun {
  const dir = mkdtempSync(join(tmpdir(), 'ogs-strata-'));
  try {
    const file = join(dir, 'm.ogs.json');
    writeFileSync(file, saveOgsJson(doc));
    const r = spawnSync(OGS_BIN as string, ['analyze', file], { encoding: 'utf8', maxBuffer: 1 << 28 });
    const out = `${r.stderr}${r.stdout}`;
    const parsed = r.status === 0 ? (JSON.parse(r.stdout) as { results: EngineMethodResult[] }) : { results: [] };
    return { code: r.status, out, results: parsed.results };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Ordenada mínima (la más profunda) de la superficie crítica, a partir de las bases de las dovelas. */
export function deepestPoint(r: EngineMethodResult): number {
  const ys = (r.slices ?? []).flatMap((s) => [s.y_base_left, s.y_base_right]);
  return ys.length === 0 ? NaN : Math.min(...ys);
}
