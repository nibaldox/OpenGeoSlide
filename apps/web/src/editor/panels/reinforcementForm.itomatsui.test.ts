// Formulario del pilote con presión del suelo de Ito-Matsui (v0.5, E15i-1): selector de la fuerza, diámetro, ubicación y capacidad. Las reglas
// y los textos son los de `validateLocal`: lo que el formulario rechaza lo rechaza también el diagnóstico.
import { describe, expect, it } from 'vitest';
import type { PileReinforcement, Reinforcement } from '../../engine/types';
import { itoPile, pile, sheet } from '../state/reinforcementFixtures';
import { baseDoc } from '../state/testFixtures';
import { validateLocal } from '../state/validateLocal';
import type { ModelDoc } from '../types';
import {
  LOCATION_OPTIONS,
  PILE_SOURCE_OPTIONS,
  alignedSheet,
  evaluateCard,
  isInclinedVertical,
  itoMatsuiRatio,
  reinforcementFromForm,
  reinforcementToForm,
  reinforcementUnits,
  switchPileSource,
  type ReinforcementForm,
  type ReinforcementFormContext,
} from './reinforcementForm';

const ctx: ReinforcementFormContext = { otherIds: [], index: 3, units: 'SI' };
const ok = (form: ReinforcementForm, c = ctx): Reinforcement => {
  const r = reinforcementFromForm(form, c);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
};
const errorsOf = (form: ReinforcementForm, c = ctx): Record<string, string> => {
  const r = reinforcementFromForm(form, c);
  return r.ok ? {} : r.errors;
};
const ito = (over: Partial<ReinforcementForm> = {}): ReinforcementForm => ({ ...reinforcementToForm(itoPile()), ...over });
const slope = (): ModelDoc => ({ ...baseDoc(), version: '0.5', regions: [{ material: 'm1', polygon: [[0, 0], [0, 15], [10, 15], [32.5, 0]] }], water: null });

describe('opciones del selector', () => {
  it('«Fuerza dada» y «Presión del suelo (Ito-Matsui)»', () => {
    expect(PILE_SOURCE_OPTIONS).toEqual([
      { value: 'force', label: 'Fuerza dada' },
      { value: 'ito_matsui', label: 'Presión del suelo (Ito-Matsui)' },
    ]);
  });

  it('la ubicación: centroide por defecto y superficie de falla', () => {
    expect(LOCATION_OPTIONS.map((o) => o.value)).toEqual(['centroid', 'slip_surface']);
    expect(LOCATION_OPTIONS[0]!.label).toContain('por defecto');
  });

  it('las unidades traen el momento (kN·m / lbf·ft)', () => {
    expect(reinforcementUnits('SI').moment).toBe('kN·m');
    expect(reinforcementUnits('imperial').moment).toBe('lbf·ft');
  });
});

describe('refuerzo → formulario', () => {
  it('un pilote con force queda con el origen «force» y sin datos de Ito-Matsui', () => {
    const f = reinforcementToForm(pile());
    expect(f.pileSource).toBe('force');
    expect(f.force).toBe('60');
    expect([f.diameter, f.shear, f.moment]).toEqual(['', '', '']);
    expect(f.location).toBe('centroid');
  });

  it('un pilote con lateral_pressure y capacidad llena diámetro, ubicación, corte y momento; force queda vacío', () => {
    const f = reinforcementToForm(itoPile({ capacity: { shear: 150, moment: 250 }, lateral_pressure: { model: 'ito_matsui', diameter: 0.8, location: 'slip_surface' } }));
    expect(f).toMatchObject({ pileSource: 'ito_matsui', diameter: '0,8', location: 'slip_surface', shear: '150', moment: '250', force: '' });
  });

  it('una capacidad con solo uno de los dos deja el otro vacío', () => {
    expect(reinforcementToForm(itoPile({ capacity: { moment: 40, shear: null } }))).toMatchObject({ shear: '', moment: '40' });
  });

  it('una tablestaca no tiene origen de fuerza de pilote', () => {
    expect(reinforcementToForm(sheet()).pileSource).toBe('force');
  });
});

describe('formulario → refuerzo', () => {
  it('Ito-Matsui sin capacidad: lateral_pressure, sin force ni capacity', () => {
    const r = ok(ito()) as PileReinforcement;
    expect(r.lateral_pressure).toEqual({ model: 'ito_matsui', diameter: 0.8, location: 'centroid' });
    expect('force' in r).toBe(false);
    expect('capacity' in r).toBe(false);
    expect(r.x2).toBe(r.x1);
  });

  it('con corte, con momento y con ambos: capacity lleva solo lo escrito', () => {
    expect((ok(ito({ shear: '150' })) as PileReinforcement).capacity).toEqual({ shear: 150 });
    expect((ok(ito({ moment: '250,5' })) as PileReinforcement).capacity).toEqual({ moment: 250.5 });
    expect((ok(ito({ shear: '150', moment: '250' })) as PileReinforcement).capacity).toEqual({ shear: 150, moment: 250 });
  });

  it('con el origen «force» los campos de Ito-Matsui se ignoran (no se escriben) aunque tengan texto', () => {
    const r = ok({ ...reinforcementToForm(pile()), diameter: '0,8', shear: '10', moment: '10' }) as PileReinforcement;
    expect(r.force).toBe(60);
    expect('lateral_pressure' in r).toBe(false);
    expect('capacity' in r).toBe(false);
  });

  it('ubicación slip_surface se conserva', () => {
    expect((ok(ito({ location: 'slip_surface' })) as PileReinforcement).lateral_pressure?.location).toBe('slip_surface');
  });

  it('diámetro vacío, cero, negativo o no numérico: error en diameter con las palabras de validateLocal', () => {
    for (const diameter of ['', '0', '-1', 'abc']) {
      const e = errorsOf(ito({ diameter }));
      expect(Object.keys(e), diameter).toEqual(['diameter']);
      expect(e.diameter).toContain('Diámetro');
    }
    expect(errorsOf(ito({ diameter: '0' })).diameter).toContain('mayor que 0');
  });

  it('capacidad: ≤ 0 es error en shear o moment', () => {
    expect(Object.keys(errorsOf(ito({ shear: '0' })))).toEqual(['shear']);
    expect(Object.keys(errorsOf(ito({ moment: '-5' })))).toEqual(['moment']);
    expect(errorsOf(ito({ shear: '0' })).shear).toContain('Capacidad al corte');
    expect(errorsOf(ito({ moment: '-5' })).moment).toContain('Capacidad a momento');
  });

  it('el espaciamiento debe ser mayor que el diámetro: error en spacing que cita el diámetro', () => {
    const e = errorsOf(ito({ spacing: '0,8' }));
    expect(Object.keys(e)).toEqual(['spacing']);
    expect(e.spacing).toContain('diámetro');
    expect(e.spacing).toContain('0,8 m');
    expect(Object.keys(errorsOf(ito({ spacing: '0,5' })))).toEqual(['spacing']);
  });

  it('sin espaciamiento vale 1: con un diámetro de 1,2 es un error; con 0,8 es válido', () => {
    expect(Object.keys(errorsOf(ito({ spacing: '', diameter: '1,2' })))).toEqual(['spacing']);
    expect((ok(ito({ spacing: '' })) as PileReinforcement).spacing).toBeUndefined();
  });

  it('el pilote con Ito-Matsui es vertical: x2 siempre es la x de la cabeza, aunque el texto de x2 diga otra cosa', () => {
    const r = ok(ito({ x1: '40', x2: '45' })) as PileReinforcement;
    expect(r.x2).toBe(40);
  });

  it('un pilote inclinado que trae un archivo (inclined) enseña el error en x2 hasta alinearlo', () => {
    const inclined = itoPile({ x2: 42 });
    expect(isInclinedVertical(inclined)).toBe(true);
    const e = errorsOf(reinforcementToForm(inclined), { ...ctx, inclined: true });
    expect(Object.keys(e)).toEqual(['x2']);
    expect(e.x2).toContain('vertical');
    expect(isInclinedVertical(itoPile())).toBe(false);
    expect(isInclinedVertical(pile({ x2: 45 }))).toBe(false); // con force un pilote puede ser inclinado
    expect(isInclinedVertical(sheet({ x2: 41 }))).toBe(true);
    expect(alignedSheet(inclined).x2).toBe(inclined.x1);
  });

  it('cabeza y punta coincidentes: el error va a y2, porque x2 está fijada', () => {
    expect(Object.keys(errorsOf(ito({ y2: '12' })))).toEqual(['y2']);
  });
});

describe('cambio de origen de la fuerza', () => {
  it('«Presión del suelo» propone diámetro 0,8 m, ubicación centroide, punta vertical y ángulo 0, y conserva lo que ya hay', () => {
    const f = switchPileSource({ ...reinforcementToForm(pile({ x2: 45, direction: 'tangent', angle: undefined })), force: '60' }, 'ito_matsui', 'SI');
    expect(f).toMatchObject({ pileSource: 'ito_matsui', diameter: '0,8', location: 'centroid', x2: f.x1, direction: 'angle', angle: '0', force: '60' });
  });

  it('con ya un diámetro, una ubicación o un ángulo escritos, los respeta', () => {
    const f = switchPileSource({ ...reinforcementToForm(pile()), diameter: '1,2', location: 'slip_surface' }, 'ito_matsui', 'SI');
    expect(f).toMatchObject({ diameter: '1,2', location: 'slip_surface', direction: 'angle', angle: '0' });
  });

  it('en imperial el diámetro propuesto es 2,62 ft (0,8 m con tres cifras)', () => {
    expect(switchPileSource(reinforcementToForm(pile()), 'ito_matsui', 'imperial').diameter).toBe('2,62');
  });

  it('volver a «Fuerza dada» propone la fuerza por omisión si estaba vacía y conserva el resto', () => {
    const back = switchPileSource({ ...ito(), force: '' }, 'force', 'SI');
    expect(back.pileSource).toBe('force');
    expect(back.force).toBe('100');
    expect(back.diameter).toBe('0,8');
    expect(switchPileSource({ ...ito(), force: '75' }, 'force', 'SI').force).toBe('75');
    expect(switchPileSource({ ...ito(), force: '' }, 'force', 'imperial').force).toBe('22500');
  });

  it('el pilote que sale del formulario con Ito-Matsui supera la validación local', () => {
    const f = switchPileSource(reinforcementToForm(pile({ id: 'p1' })), 'ito_matsui', 'SI');
    const r = ok(f, { ...ctx, index: 0 });
    const issues = validateLocal({ ...slope(), reinforcements: [r] }).filter((i) => i.severity === 'error');
    expect(issues).toEqual([]);
  });
});

describe('tarjeta: borrador y modelo', () => {
  it('cambiar el origen escribe el pilote nuevo (commit) y deshacer vuelve al del modelo', () => {
    const p = pile({ id: 'p1' });
    const next = switchPileSource(reinforcementToForm(p), 'ito_matsui', 'SI');
    const ev = evaluateCard(next, p, { ...ctx, index: 0 });
    expect(ev.errors).toEqual({});
    expect((ev.commit as PileReinforcement).lateral_pressure?.diameter).toBe(0.8);
    const same = evaluateCard(reinforcementToForm(p), p, { ...ctx, index: 0 });
    expect(same.commit).toBeNull();
  });

  it('un diámetro inválido deja el cambio pendiente y no escribe nada', () => {
    const p = itoPile();
    const ev = evaluateCard({ ...reinforcementToForm(p), diameter: '0' }, p, { ...ctx, index: 0 });
    expect(ev.commit).toBeNull();
    expect(ev.pending).toBe(true);
  });
});

describe('S/D', () => {
  it('S/D = spacing / diameter; sin spacing vale 1; sin diámetro válido es null', () => {
    expect(itoMatsuiRatio(itoPile())).toBeCloseTo(3, 12);
    expect(itoMatsuiRatio(itoPile({ spacing: undefined }))).toBeCloseTo(1.25, 12);
    expect(itoMatsuiRatio(pile())).toBeNull();
    expect(itoMatsuiRatio(itoPile({ lateral_pressure: { model: 'ito_matsui', diameter: 0, location: 'centroid' } }))).toBeNull();
  });
});
