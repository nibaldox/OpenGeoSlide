// Conversión de unidades del pilote con presión del suelo de Ito-Matsui (E15i-1): `diameter` es una longitud, `capacity.shear` una fuerza
// y `capacity.moment` un momento (fuerza por longitud). `spacing` sigue explícito; `lateral_pressure.location` no cambia.
import { describe, expect, it } from 'vitest';
import { itoPile, pile } from './reinforcementFixtures';
import { UNIT_FACTORS, convertDocUnits } from './units';
import { baseDoc } from './testFixtures';
import type { ModelDoc } from '../types';
import type { PileReinforcement } from '../../engine/types';

const doc = (r: PileReinforcement): ModelDoc => ({ ...baseDoc(), version: '0.5', reinforcements: [r] });
const only = (d: ModelDoc): PileReinforcement => d.reinforcements![0] as PileReinforcement;

describe('conversión de unidades de Ito-Matsui', () => {
  it('el factor del momento es el de la fuerza por el de la longitud', () => {
    expect(UNIT_FACTORS.moment).toBeCloseTo(UNIT_FACTORS.force * UNIT_FACTORS.length, 9);
    expect(UNIT_FACTORS.moment).toBeCloseTo(737.5621, 3); // 1 kN·m = 737,562 lbf·ft
  });

  it('SI → imperial: diameter en ft, shear en lbf, moment en lbf·ft; location y model no cambian', () => {
    const r = only(convertDocUnits(doc(itoPile({ capacity: { shear: 150, moment: 250 } })), 'imperial'));
    expect(r.lateral_pressure).toEqual({ model: 'ito_matsui', diameter: 0.8 * UNIT_FACTORS.length, location: 'centroid' });
    expect(r.capacity?.shear).toBeCloseTo(150 * UNIT_FACTORS.force, 9);
    expect(r.capacity?.moment).toBeCloseTo(250 * UNIT_FACTORS.force * UNIT_FACTORS.length, 9);
    expect(r.spacing).toBeCloseTo(2.4 * UNIT_FACTORS.length, 12);
    expect('force' in r && r.force !== undefined && r.force !== null).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(r, 'force')).toBe(false);
  });

  it('ida y vuelta: vuelve a los números de SI (1e-12 relativo)', () => {
    const d0 = doc(itoPile({ spacing: undefined, capacity: { shear: 150, moment: 250 }, lateral_pressure: { model: 'ito_matsui', diameter: 0.8, location: 'slip_surface' } }));
    const back = only(convertDocUnits(convertDocUnits(d0, 'imperial'), 'SI'));
    expect(back.lateral_pressure).toMatchObject({ location: 'slip_surface' });
    expect(back.lateral_pressure!.diameter).toBeCloseTo(0.8, 12);
    expect(back.capacity?.shear).toBeCloseTo(150, 9);
    expect(back.capacity?.moment).toBeCloseTo(250, 9);
    expect(back.spacing).toBeCloseTo(1, 12); // el omitido (1 m) queda explícito
  });

  it('una capacidad con solo corte o solo momento no inventa el otro; sin capacidad no la crea', () => {
    expect(only(convertDocUnits(doc(itoPile({ capacity: { shear: 90 } })), 'imperial')).capacity).toEqual({ shear: 90 * UNIT_FACTORS.force });
    const m = only(convertDocUnits(doc(itoPile({ capacity: { moment: 40, shear: null } })), 'imperial')).capacity;
    expect(m?.moment).toBeCloseTo(40 * UNIT_FACTORS.moment, 9);
    expect(m?.shear).toBeUndefined();
    expect('capacity' in only(convertDocUnits(doc(itoPile()), 'imperial'))).toBe(false);
  });

  it('un pilote con force sigue convirtiendo la fuerza como antes (identidad) y no gana campos nuevos', () => {
    const r = only(convertDocUnits(doc(pile({ force: 60 })), 'imperial'));
    expect(r.force).toBeCloseTo(60 * UNIT_FACTORS.force, 9);
    expect('lateral_pressure' in r).toBe(false);
    expect('capacity' in r).toBe(false);
  });
});
