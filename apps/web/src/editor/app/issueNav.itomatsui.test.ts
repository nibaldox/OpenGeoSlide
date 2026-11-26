// Diagnósticos → panel «Refuerzos» con los campos de Ito-Matsui (E15i-1): cada puntero JSON lleva al control plano de la tarjeta del pilote.
import { describe, expect, it } from 'vitest';
import { itoPile } from '../state/reinforcementFixtures';
import type { ModelDoc } from '../types';
import { newDoc } from './docTemplates';
import { issueTarget } from './issueNav';

const doc = (): ModelDoc => ({ ...newDoc(), version: '0.5', reinforcements: [itoPile({ capacity: { shear: 1, moment: 2 } })] }) as ModelDoc;
const path = (p: string): string | null | undefined => issueTarget(p, doc())?.fieldPath;

describe('issueTarget con Ito-Matsui', () => {
  it('diámetro y ubicación llevan a su campo; model y la exclusión, al selector «Origen de la fuerza»', () => {
    expect(path('/reinforcements/0/lateral_pressure/diameter')).toBe('/reinforcements/0/diameter');
    expect(path('/reinforcements/0/lateral_pressure/location')).toBe('/reinforcements/0/location');
    expect(path('/reinforcements/0/lateral_pressure/model')).toBe('/reinforcements/0/lateral_pressure');
    expect(path('/reinforcements/0/lateral_pressure')).toBe('/reinforcements/0/lateral_pressure');
  });

  it('capacity/shear, capacity/moment y capacity (vacía o sin presión) llevan a los campos de capacidad', () => {
    expect(path('/reinforcements/0/capacity/shear')).toBe('/reinforcements/0/shear');
    expect(path('/reinforcements/0/capacity/moment')).toBe('/reinforcements/0/moment');
    expect(path('/reinforcements/0/capacity')).toBe('/reinforcements/0/shear');
  });

  it('el pilote existe: la pestaña es «Refuerzos» y un índice fuera de rango no es navegable', () => {
    expect(issueTarget('/reinforcements/0/lateral_pressure/diameter', doc())?.tab).toBe('reinforcements');
    expect(issueTarget('/reinforcements/3/lateral_pressure/diameter', doc())).toBeNull();
  });

  it('lo de antes sigue igual: pullout/strength → strength', () => {
    expect(path('/reinforcements/0/x2')).toBe('/reinforcements/0/x2');
  });
});
