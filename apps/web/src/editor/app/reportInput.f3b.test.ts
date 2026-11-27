import { describe, expect, it } from 'vitest';
import { parse } from 'papaparse';
import { hoekBrownFixture, shansepFixture } from '../../report/f3bFixtures';
import { exportAvailability, slicesCsv, type EngineRun } from './reportInput';

describe('exportación de dovelas F3B', () => {
  it('usa el documento del cálculo y lleva las leyes y esfuerzos al CSV', () => {
    for (const fixture of [hoekBrownFixture(), shansepFixture()]) {
      const csv = slicesCsv({ doc: fixture.model, report: fixture.report });
      const parsed = parse<Record<string, string>>(csv, { header: true });
      expect(parsed.errors).toEqual([]);
      const law = fixture.model.materials.some(m => m.model === 'hoek_brown') ? 'hoek_brown' : 'shansep';
      const row = parsed.data.find(r => r.ley === law);
      expect(row).toBeDefined();
      expect(row?.unidades).toBe('SI');
      expect(law === 'hoek_brown' ? row?.normal_stress_kpa : row?.vertical_stress_kpa).toBeTruthy();
    }
  });
  it('no habilita descarga de resultado ausente u obsoleto', () => {
    const f = hoekBrownFixture();
    const run = { doc: f.model, report: f.report } as EngineRun;
    expect(exportAvailability(null, false).canExportSurface).toBe(false);
    expect(exportAvailability(run, false).canExportSurface).toBe(false);
    expect(exportAvailability(run, true).canExportSurface).toBe(true);
  });
});
