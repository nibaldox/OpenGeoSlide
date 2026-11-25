// Modelos de partida del editor: documento nuevo y apertura de un caso publicado como modelo.

import { exampleTitle } from '../../examples/exampleTitles';
import type { VerificationCase } from '../../engine/types';
import { openOgsJson } from '../../io/ogsJson';
import type { Issue, ModelDoc } from '../types';

/** Talud simple de un solo material con búsqueda de superficie crítica; calcula con ambos métodos. */
export function newDoc(): ModelDoc {
  return {
    format: 'opengeoslide',
    version: '0.2',
    meta: { id: 'nuevo', title: 'Modelo nuevo', notes: null },
    units: 'SI',
    materials: [
      {
        id: 'suelo',
        name: 'Suelo',
        model: 'mohr_coulomb',
        unit_weight: 18,
        unit_weight_sat: null,
        cohesion: 15,
        friction_angle: 25,
        ru: null,
      },
    ],
    regions: [
      {
        material: 'suelo',
        polygon: [
          [0, 0],
          [60, 0],
          [60, 10],
          [40, 10],
          [20, 20],
          [0, 20],
        ],
      },
    ],
    water: null,
    loads: [],
    slope: { direction: 'auto' },
    analysis: {
      methods: ['bishop', 'spencer'],
      slices: 50,
      tolerance: 1e-5,
      max_iterations: 500,
      min_m_alpha: 0.2,
      search: {
        type: 'circular_entry_exit',
        entry: [0, 20],
        exit: [40, 60],
        n_entry: 15,
        n_exit: 15,
        n_radius: 10,
        max_radius_factor: 5,
        min_width: null,
        refine: true,
      },
    },
  };
}

/** Abre el modelo de un caso de verificación (descarta sus `checks`). Devuelve `null` si el modelo no es válido. */
export function docFromCase(caseData: VerificationCase): { doc: ModelDoc; issues: Issue[] } | null {
  const opened = openOgsJson(JSON.stringify(caseData.model));
  if (!opened.doc) return null;
  // UX9-04: el título que se muestra es el nombre en español del ejemplo; el archivo del caso no cambia.
  const title = exampleTitle(caseData.id, opened.doc.meta?.title ?? caseData.title);
  const doc = title === opened.doc.meta?.title ? opened.doc : { ...opened.doc, meta: { ...opened.doc.meta, title } };
  return { doc, issues: opened.issues };
}
