// F3B-W2: `DiagnosticsPanel.tsx` con `hoek_brown_not_converged` (acción sugerida) y las tres notas con ruta a `/materials` y `/analysis/search`.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { issuesFromReport } from '../app/diagnostics';
import {
  hoekBrownFixture,
  hoekBrownNotConvergedFixture,
  nonCircularPolylineWinsFixture,
  shansepFixture,
} from '../../report/f3bFixtures';
import {
  DiagnosticsPanel,
  HOEK_BROWN_NOT_CONVERGED_ACTION,
  diagnosticsTargetFor,
  issueSuggestedAction,
} from './DiagnosticsPanel';
import { createFakeStore } from './fakeStore';

describe('DiagnosticsPanel con los avisos y notas de F6.7', () => {
  it('hoek_brown_not_converged muestra su acción sugerida y navega a la pestaña «Materiales» seleccionando el material Hoek-Brown', () => {
    const { model, report } = hoekBrownNotConvergedFixture();
    const issues = issuesFromReport(report);
    const hbIssue = issues.find((i) => i.code === 'hoek_brown_not_converged')!;
    expect(hbIssue).toBeDefined();
    expect(hbIssue.path).toBe('/materials');
    expect(issueSuggestedAction(hbIssue)).toBe(HOEK_BROWN_NOT_CONVERGED_ACTION);

    const target = diagnosticsTargetFor(hbIssue, model);
    expect(target).toEqual({
      tab: 'materials',
      selection: { kind: 'material', materialId: 'roca' },
      fieldPath: '/materials/1/name',
    });

    const store = createFakeStore(model, { diagnostics: { status: 'ok', issues, revision: 0 } });
    const html = renderToStaticMarkup(createElement(DiagnosticsPanel, { store }));
    expect(html).toContain(HOEK_BROWN_NOT_CONVERGED_ACTION);
    expect(html).toContain('data-testid="issue-suggested-action"');
    // Es un botón clicable (tiene destino navegable a `/materials`).
    const li = html.split('<li ').find((s) => s.includes('hoek_brown_not_converged')) ?? '';
    expect(li).toContain('<button type="button" class="ep-issue">');
    expect(li).toContain('motor: hoek_brown_not_converged · /materials');
  });

  it('las tres notas (`hoek_brown_low_confinement`, `shansep_nonpositive_stress`, `non_circular_large_change`) son botones con su ruta al panel', () => {
    const hb = hoekBrownFixture();
    const hbIssues = issuesFromReport(hb.report);
    const lowConf = hbIssues.find((i) => i.code === 'hoek_brown_low_confinement')!;
    expect(lowConf.path).toBe('/materials');
    expect(issueSuggestedAction(lowConf)).toBeNull();
    expect(diagnosticsTargetFor(lowConf, hb.model)).toEqual({
      tab: 'materials',
      selection: { kind: 'material', materialId: 'roca' },
      fieldPath: '/materials/1/name',
    });

    const sh = shansepFixture();
    const shIssues = issuesFromReport(sh.report);
    const nonPos = shIssues.find((i) => i.code === 'shansep_nonpositive_stress')!;
    expect(nonPos.path).toBe('/materials');
    expect(diagnosticsTargetFor(nonPos, sh.model)).toEqual({
      tab: 'materials',
      selection: { kind: 'material', materialId: 'arc_ocr' },
      fieldPath: '/materials/0/name',
    });

    const nc = nonCircularPolylineWinsFixture(true);
    const ncIssues = issuesFromReport(nc.report);
    const largeChange = ncIssues.find((i) => i.code === 'non_circular_large_change')!;
    expect(largeChange.path).toBe('/analysis/search');
    expect(diagnosticsTargetFor(largeChange, nc.model)).toEqual({
      tab: 'search',
      selection: { kind: 'none' },
      fieldPath: null,
    });

    for (const [doc, list, code] of [
      [hb.model, [lowConf], 'hoek_brown_low_confinement'],
      [sh.model, [nonPos], 'shansep_nonpositive_stress'],
      [nc.model, [largeChange], 'non_circular_large_change'],
    ] as const) {
      const html = renderToStaticMarkup(
        createElement(DiagnosticsPanel, {
          store: createFakeStore(doc, { diagnostics: { status: 'ok', issues: [...list], revision: 0 } }),
        }),
      );
      expect(html, code).toContain('<button type="button" class="ep-issue">');
      expect(html, code).not.toContain('data-testid="issue-suggested-action"');
    }
  });
});
