// CM-C1W · F7.5: la ruta de cuatro niveles `analysis/search/non_circular/global/<campo>` llega a cada control del panel de búsqueda
// (`issueNav.ts`), también desde los dos avisos nuevos y desde los errores de `validateLocal`.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { warningPath } from '../../engine/warnings';
import { createFakeStore } from '../canvas/fakeStore';
import { SearchPanel } from '../panels/SearchPanel';
import { validateLocal } from '../state/validateLocal';
import type { ModelDoc } from '../types';
import { fieldSelector, issueTarget, issueTargetFor } from './issueNav';

const doc = {
  format: 'opengeoslide',
  version: '0.7',
  meta: {},
  units: 'SI',
  materials: [{ id: 's', name: 'Suelo', model: 'mohr_coulomb', unit_weight: 20, cohesion: 10, friction_angle: 25 }],
  regions: [{ material: 's', polygon: [[0, 0], [60, 0], [60, 35], [0, 35]] }],
  slope: { direction: 'auto' },
  analysis: { methods: ['spencer'], search: { type: 'circular_entry_exit', non_circular: { global: { generated: 10, seed: -2, algorithm: 'path' } } } },
} as unknown as ModelDoc;

const P = '/analysis/search/non_circular';

describe('issueNav: la búsqueda global (cuatro niveles)', () => {
  it('cada campo de global lleva a su control en la pestaña de búsqueda', () => {
    for (const f of ['algorithm', 'generated', 'seed', 'polish']) {
      expect(issueTarget(`${P}/global/${f}`, doc), f).toMatchObject({ tab: 'search', fieldPath: `${P}/global/${f}` });
    }
    expect(issueTarget(`${P}/global`, doc)).toMatchObject({ tab: 'search', fieldPath: `${P}/global` });
    expect(issueTarget(`${P}/global/desconocido`, doc)).toMatchObject({ tab: 'search', fieldPath: `${P}/global` });
  });

  it('los niveles anteriores siguen igual (seeds, max_vertices y la casilla de non_circular)', () => {
    expect(issueTarget(`${P}/seeds`, doc)).toMatchObject({ tab: 'search', fieldPath: `${P}/seeds` });
    expect(issueTarget(`${P}/max_vertices`, doc)).toMatchObject({ tab: 'search', fieldPath: `${P}/max_vertices` });
    expect(issueTarget(P, doc)).toMatchObject({ tab: 'search', fieldPath: P });
    expect(issueTarget(`${P}/otro`, doc)).toMatchObject({ tab: 'search', fieldPath: P });
  });

  it('los dos avisos nuevos llevan a la casilla de la búsqueda global', () => {
    for (const code of ['non_circular_global_no_candidates', 'non_circular_global_tension_rejected']) {
      const path = warningPath(code);
      expect(path).toBe(`${P}/global`);
      expect(issueTargetFor({ path, code: 'engine.warning' }, doc)).toMatchObject({ tab: 'search', fieldPath: `${P}/global` });
    }
  });

  it('los errores de rango de validateLocal llegan a los controles de cada campo', () => {
    const errs = validateLocal(doc).filter((i) => i.severity === 'error' && (i.path ?? '').includes('/global/'));
    expect(errs.map((e) => e.path).sort()).toEqual([`${P}/global/algorithm`, `${P}/global/generated`, `${P}/global/seed`]);
    for (const e of errs) expect(issueTargetFor(e, doc)).toMatchObject({ tab: 'search', fieldPath: e.path });
  });

  it('el selector de cada fieldPath existe en el HTML del panel (data-path real)', () => {
    const okDoc = { ...doc, analysis: { ...doc.analysis, search: { type: 'circular_entry_exit', non_circular: { global: {} } } } } as unknown as ModelDoc;
    const html = renderToStaticMarkup(createElement(SearchPanel, { store: createFakeStore(okDoc) }));
    for (const f of ['', '/algorithm', '/generated', '/seed', '/polish']) {
      const path = `${P}/global${f}`;
      expect(html, path).toContain(`data-path="${path}"`);
      expect(fieldSelector(path)).toBe(`[data-path="${path}"]`);
    }
  });
});
