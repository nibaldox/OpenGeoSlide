// Paridad editor/motor (E12j, R5-10): el editor y `ogs-core` deben aceptar y rechazar los mismos documentos.
// La tabla vive en parityCases.ts. Con OGS_BIN apuntando a un binario `ogs` real, cada caso se ejecuta también
// contra el motor y su veredicto debe coincidir con el de la tabla.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PARITY_CASES } from './parityCases';
import { validateLocal } from './validateLocal';

const OGS_BIN = process.env.OGS_BIN;
const haveEngine = OGS_BIN !== undefined && existsSync(OGS_BIN);
/** `OGS_ENGINE_G1=1` indica que el binario ya incluye E12j de G1 (`material.id` vacío). */
const engineHasG1 = process.env.OGS_ENGINE_G1 === '1';

function engineVerdict(doc: unknown): { verdict: 'accept' | 'reject'; message: string } {
  const dir = mkdtempSync(join(tmpdir(), 'ogs-parity-'));
  try {
    const file = join(dir, 'm.ogs.json');
    writeFileSync(file, JSON.stringify(doc));
    const r = spawnSync(OGS_BIN as string, ['analyze', file], { encoding: 'utf8' });
    const out = `${r.stderr}${r.stdout}`;
    const message = out.trim().split('\n')[0] ?? '';
    // Rechazo de la validación: InvalidModel, NoSurface o JSON no válido. Un NoValidSurface no es un rechazo.
    const reject = r.status !== 0 && /InvalidModel|NoSurface|Json|json/.test(out);
    return { verdict: reject ? 'reject' : 'accept', message };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('paridad editor/motor (E12j)', () => {
  it('la tabla cubre los 4 casos de R5-10 y los de E12c, sin nombres repetidos', () => {
    expect(PARITY_CASES.filter((c) => c.from === 'R5-10')).toHaveLength(4);
    expect(PARITY_CASES.filter((c) => c.from === 'E12c').length).toBeGreaterThanOrEqual(10);
    expect(new Set(PARITY_CASES.map((c) => c.name)).size).toBe(PARITY_CASES.length);
  });

  describe.each(PARITY_CASES)('$name', (c) => {
    it(`el editor ${c.verdict === 'reject' ? 'rechaza' : 'acepta'} como el motor`, () => {
      const errors = validateLocal(c.doc).filter((i) => i.severity === 'error');
      expect(errors.length > 0 ? 'reject' : 'accept').toBe(c.verdict);
      if (c.codes) expect([...new Set(errors.map((i) => i.code))]).toEqual(c.codes);
    });

    it.skipIf(!haveEngine)('el motor real da el veredicto de la tabla', (ctx) => {
      if (c.engineSince === 'G1' && !engineHasG1) ctx.skip();
      const r = engineVerdict(c.doc);
      expect(r.verdict, r.message).toBe(c.verdict);
    });
  });
});
