// E15l-16 (R12 B-06): `tension_crack_not_reached` se traduce al español, en sus dos formas (superficie fija y búsqueda, E15l-7), y la
// incidencia lleva al control de la grieta (`/analysis/tension_crack`).
import { describe, expect, it } from 'vitest';
import { issueFromEngineError } from '../editor/app/diagnostics';
import { newDoc } from '../editor/app/docTemplates';
import { issueTargetFor } from '../editor/app/issueNav';
import { humanizeEngineError } from './errors';

const FIXED = 'NoValidSurface: tension_crack_not_reached: la superficie no alcanza la profundidad de la grieta de tracción';
const SEARCH = 'NoValidSurface: la búsqueda con bishop no encontró ninguna superficie convergida (7400 evaluadas, 0 válidas; 7400 no alcanzan la grieta de tracción, tension_crack_not_reached)';
const SEARCH_PLAIN = 'NoValidSurface: la búsqueda con bishop no encontró ninguna superficie convergida (1820 evaluadas, 0 válidas)';

describe('E15l-16: errores de la grieta en español', () => {
  it('superficie fija: sin el código interno y con la causa y la salida', () => {
    const t = humanizeEngineError(FIXED);
    expect(t).not.toContain('tension_crack_not_reached');
    expect(t).toContain('la superficie no alcanza la profundidad de la grieta de tracción');
    expect(t).toMatch(/Reduzca la profundidad de la grieta/);
  });
  it('búsqueda (E15l-7): conserva las cifras, quita el código y orienta', () => {
    const t = humanizeEngineError(SEARCH);
    expect(t).not.toContain('tension_crack_not_reached');
    expect(t).toContain('7400 evaluadas, 0 válidas; 7400 no alcanzan la grieta de tracción');
    expect(t).toMatch(/Reduzca la profundidad de la grieta/);
  });
  it('una búsqueda sin descartes por la grieta no cambia', () => {
    expect(humanizeEngineError(SEARCH_PLAIN)).toBe(`No hay ninguna superficie de deslizamiento válida: ${SEARCH_PLAIN.slice('NoValidSurface: '.length)}`);
  });
  it('navegación: ambas formas llevan a /analysis/tension_crack; sin grieta del motor, a la superficie o a la búsqueda como siempre', () => {
    const doc = { ...newDoc(), version: '0.5' } as ReturnType<typeof newDoc>;
    for (const raw of [FIXED, SEARCH]) {
      const issue = issueFromEngineError(new Error(raw));
      expect(issueTargetFor(issue, doc), raw).toMatchObject({ tab: 'analysis', fieldPath: '/analysis/tension_crack' });
    }
    const plain = issueFromEngineError(new Error(SEARCH_PLAIN));
    expect(issueTargetFor(plain, doc)?.fieldPath).not.toBe('/analysis/tension_crack');
  });
});
