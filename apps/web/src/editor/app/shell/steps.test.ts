import { describe, expect, it } from 'vitest';
import { STEP_ORDER } from '../shellModel';
import { panelOrder, STATUS_TEXT, STEP_LABELS, stepIndex, stepOrder } from './steps';

describe('pasos de la barra lateral', () => {
  it('son los diez de siempre, con sus nombres (UA-D2)', () => {
    expect(STEP_ORDER.map((id) => STEP_LABELS[id])).toEqual(['Geometría', 'Materiales', 'Agua', 'Superficie', 'Búsqueda', 'Análisis', 'Cargas', 'Refuerzos', 'Sismo', 'Proyecto']);
  });
  it('el panel cuelga justo debajo del paso activo (order)', () => {
    for (let active = 0; active < STEP_ORDER.length; active++) {
      const orders = STEP_ORDER.map((_, i) => stepOrder(i));
      const panel = panelOrder(active);
      expect(panel).toBeGreaterThan(stepOrder(active));
      if (active + 1 < STEP_ORDER.length) expect(panel).toBeLessThan(stepOrder(active + 1));
      expect(orders).not.toContain(panel);
    }
  });
  it('el estado se dice en una palabra corta', () => {
    for (const text of Object.values(STATUS_TEXT)) expect(text.length).toBeLessThanOrEqual(10);
  });
  it('stepIndex', () => {
    expect(stepIndex(STEP_ORDER, 'geometry')).toBe(0);
    expect(stepIndex(STEP_ORDER, 'project')).toBe(9);
  });
});
