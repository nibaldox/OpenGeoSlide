// R15B-09: paridad de validateLocal con la CLI para non_circular cuando se omite analysis.methods (por defecto incluye bishop).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { VerificationCase } from '../../engine/types';
import { engineModel } from '../../io/ogsJson';
import { validateLocal } from './validateLocal';

const OGS_BIN = process.env.OGS_BIN;
const haveEngine = OGS_BIN !== undefined && existsSync(OGS_BIN);
const v001Path = resolve(fileURLToPath(new URL('../../../../../verification/cases/V001-nc.json', import.meta.url)));

function loadV001Model() {
  const c = JSON.parse(readFileSync(v001Path, 'utf8')) as VerificationCase;
  return structuredClone(c.model);
}

function cliVerdict(doc: unknown): { reject: boolean; output: string } {
  const dir = mkdtempSync(join(tmpdir(), 'ogs-r15b09-'));
  try {
    const file = join(dir, 'm.ogs.json');
    writeFileSync(file, JSON.stringify(doc));
    const r = spawnSync(OGS_BIN as string, ['analyze', file], { encoding: 'utf8' });
    const output = `${r.stderr}${r.stdout}`.trim();
    const reject = r.status !== 0 && /InvalidModel|NoSurface/.test(output);
    return { reject, output };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('R15B-09: non_circular con analysis.methods omitido', () => {
  it('validateLocal rechaza non_circular cuando falta analysis.methods (por defecto bishop) y acepta con spencer', () => {
    const withoutMethods = loadV001Model();
    delete withoutMethods.analysis.methods;
    const errs = validateLocal(withoutMethods).filter((i) => i.severity === 'error');
    expect(errs.some((e) => e.path === '/analysis/methods' && e.text.includes('non_circular'))).toBe(true);

    const withSpencer = loadV001Model();
    withSpencer.analysis.methods = ['spencer'];
    expect(validateLocal(withSpencer).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it.skipIf(!haveEngine)('coincide con la CLI de ogs-core al rechazar sin methods y aceptar con spencer', () => {
    const withoutMethods = loadV001Model();
    delete withoutMethods.analysis.methods;
    const localRejects = validateLocal(withoutMethods).some((i) => i.severity === 'error');
    const cliNoMethods = cliVerdict(engineModel(withoutMethods));
    expect(cliNoMethods.reject, cliNoMethods.output).toBe(true);
    expect(localRejects).toBe(cliNoMethods.reject);

    const withSpencer = loadV001Model();
    withSpencer.analysis.methods = ['spencer'];
    const localAccepts = !validateLocal(withSpencer).some((i) => i.severity === 'error');
    const cliSpencer = cliVerdict(engineModel(withSpencer));
    expect(cliSpencer.reject, cliSpencer.output).toBe(false);
    expect(localAccepts).toBe(!cliSpencer.reject);
  });
});
