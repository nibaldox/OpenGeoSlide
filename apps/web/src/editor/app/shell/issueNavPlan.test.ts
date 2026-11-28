// UA3 A-10 y A-09: a dónde lleva una incidencia de Diagnósticos.
import { describe, expect, it } from 'vitest';
import { issueTarget } from '../issueNav';
import { newDoc } from '../docTemplates';
import { issueNavPlan } from './issueNavPlan';

const doc = newDoc();

describe('issueNavPlan', () => {
  it('A-10: «El modelo no tiene regiones» (/regions) vuelve a Lienzo, porque su foco es «Dibujar región»', () => {
    const t = issueTarget('/regions', doc);
    expect(t).not.toBeNull();
    expect(issueNavPlan(t!)).toEqual({ step: 'geometry', toCanvas: true, expandSide: false });
  });
  it('un destino en el lienzo (tab nulo) vuelve a Lienzo y no despliega la barra', () => {
    expect(issueNavPlan({ tab: null, selection: { kind: 'none' }, fieldPath: null })).toEqual({ step: null, toCanvas: true, expandSide: false });
  });
  it('un campo de un paso abre el paso, despliega la barra y no cambia de vista', () => {
    const t = issueTarget('/meta/title', doc);
    expect(issueNavPlan(t!)).toEqual({ step: 'project', toCanvas: false, expandSide: true });
  });
});
