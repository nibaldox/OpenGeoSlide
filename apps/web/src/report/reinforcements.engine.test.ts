// R11B-06 / E14o-16 con el motor real (OGS_BIN): V047a con dos refuerzos fuera del círculo fijo; los métodos convergen y ningún refuerzo cruza.
import { describe, expect, it } from 'vitest';
import { engineRun, haveEngine, OGS_BIN } from '../editor/state/engineRun.testutil';
import type { ModelDoc } from '../editor/types';
import type { MethodReport, Reinforcement } from '../engine/types';
import { buildReportContent } from './content';
import { loadPublishedDoc } from './fixtures';
import { syntheticReinforcedInput } from './reinforcementFixtures';

const OUTSIDE = [
  { id: 's1', type: 'sheet_pile', x1: 75, y1: 33, x2: 75, y2: 22, application: 'passive', force: 120, direction: 'angle', angle: 0 },
  { id: 'g1', type: 'geosynthetic', x1: 70, y1: 35, x2: 80, y2: 35, application: 'passive', tensile_capacity: 50, spacing: 1, direction: 'axial' },
] as unknown as Reinforcement[];

describe.skipIf(!haveEngine)(`informe con refuerzos que no cruzan, con el motor real (${OGS_BIN})`, () => {
  it('Bishop y Spencer convergen sin cruces: el texto lo dice y lista s1 y g1', () => {
    const doc = { ...loadPublishedDoc('V047a'), version: '0.4', reinforcements: OUTSIDE } as ModelDoc;
    const run = engineRun(doc);
    expect(run.code, run.out).toBe(0);
    const base = syntheticReinforcedInput({ reinforcements: OUTSIDE });
    const results = run.results.filter((r) => r.method === 'bishop' || r.method === 'spencer') as unknown as MethodReport[];
    expect(results.map((r) => r.status)).toEqual(['converged', 'converged']);
    expect(results.every((r) => (r.reinforcement_forces?.length ?? 0) === 0)).toBe(true);
    const sec = buildReportContent({ ...base, model: doc, results }).sections.find((s) => s.id === 'reinforcements')!;
    const text = sec.blocks.map((b) => (b.kind === 'paragraph' ? b.text : '')).join(' ');
    expect(text).toContain('Ningún refuerzo cruzó la superficie final de los métodos que convergieron (Bishop simplificado, Spencer): no aportaron fuerza. Refuerzos sin cruce: s1, g1.');
    expect(text).not.toContain('Ningún método devolvió fuerzas');
  });
});
