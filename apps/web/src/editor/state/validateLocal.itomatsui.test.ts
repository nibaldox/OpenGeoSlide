// Validación local de la presión del suelo de Ito-Matsui (v0.5, E15i-1): una regla, un código `editor.reinforcement_*` y su puntero JSON.
// Los textos son los del motor con las palabras de la interfaz: «Refuerzo N, <campo>: <regla>».
import { describe, expect, it } from 'vitest';
import type { Reinforcement } from '../../engine/types';
import type { Issue, ModelDoc } from '../types';
import { itoPile, pile } from './reinforcementFixtures';
import { baseDoc } from './testFixtures';
import { validateLocal } from './validateLocal';

const withR = (list: unknown[], version: ModelDoc['version'] = '0.5', units?: string): ModelDoc => ({ ...baseDoc(), version, ...(units ? { units } : {}), reinforcements: list as Reinforcement[] });
const issues = (list: unknown[], version?: ModelDoc['version']): Issue[] => validateLocal(withR(list, version)).filter((i) => i.severity === 'error' && (i.code.startsWith('editor.reinforcement_') || i.code === 'editor.out_of_range'));
const one = (r: unknown, version?: ModelDoc['version']): Issue[] => issues([r], version);
const codePath = (list: Issue[]): string[] => list.map((i) => `${i.code} ${i.path ?? ''}`);
const lp = (over: Record<string, unknown> = {}) => ({ model: 'ito_matsui', diameter: 0.8, location: 'centroid', ...over });

describe('Ito-Matsui válido', () => {
  it('el pilote de la fixture, con y sin capacidad, con location slip_surface, no da incidencias', () => {
    expect(issues([itoPile()])).toEqual([]);
    expect(issues([itoPile({ capacity: { shear: 150, moment: 250 } })])).toEqual([]);
    expect(issues([itoPile({ capacity: { shear: 150 } })])).toEqual([]);
    expect(issues([itoPile({ capacity: { moment: 250 } })])).toEqual([]);
    expect(issues([itoPile({ lateral_pressure: lp({ location: 'slip_surface' }) as never })])).toEqual([]);
  });

  it('con direction tangent y otros ángulos también es válido (E15i-6: la dirección sale del refuerzo)', () => {
    expect(issues([itoPile({ direction: 'tangent', angle: undefined })])).toEqual([]);
  });

  it('S/D = 1,0001 es válido aunque el aviso de rango sea del motor; la lista nula se ignora', () => {
    expect(issues([itoPile({ spacing: 0.8001 })])).toEqual([]);
    expect(issues([pile({ lateral_pressure: null, capacity: null })])).toEqual([]);
  });
});

describe('exclusión de force y lateral_pressure', () => {
  it('con los dos: un error en lateral_pressure que dice que va uno solo', () => {
    const e = one(itoPile({ force: 50 }));
    expect(codePath(e)).toEqual(['editor.reinforcement_pressure_xor /reinforcements/0/lateral_pressure']);
    expect(e[0]?.text).toContain('Refuerzo 1');
    expect(e[0]?.text).toContain('fuerza');
    expect(e[0]?.text).toContain('Ito-Matsui');
  });

  it('con ninguno: un error en la fuerza que ofrece las dos salidas', () => {
    const e = one(pile({ force: undefined }));
    expect(codePath(e)).toEqual(['editor.reinforcement_pressure_xor /reinforcements/0/force']);
    expect(e[0]?.text).toContain('Ito-Matsui');
  });

  it('`force: null` cuenta como ausente: con lateral_pressure es válido', () => {
    expect(issues([itoPile({ force: null })])).toEqual([]);
  });
});

describe('lateral_pressure', () => {
  it('model distinto de ito_matsui', () => {
    const e = one(itoPile({ lateral_pressure: lp({ model: 'otro' }) as never }));
    expect(codePath(e)).toEqual(['editor.reinforcement_pressure_model /reinforcements/0/lateral_pressure/model']);
    expect(e[0]?.text).toContain('ito_matsui');
  });

  it.each([0, -0.5])('diameter %s: debe ser mayor que 0', (d) => {
    const e = one(itoPile({ lateral_pressure: lp({ diameter: d }) as never }));
    expect(codePath(e)).toEqual(['editor.reinforcement_pressure_diameter /reinforcements/0/lateral_pressure/diameter']);
    expect(e[0]?.text).toContain('Refuerzo 1, diámetro');
    expect(e[0]?.text).toContain('mayor que 0');
  });

  it('diameter no finito: sale non_finite y no un error de rango', () => {
    const e = one(itoPile({ lateral_pressure: lp({ diameter: Number.NaN }) as never }));
    expect(codePath(e)).toEqual(['editor.reinforcement_non_finite /reinforcements/0/lateral_pressure/diameter']);
  });

  it('location ausente o desconocido', () => {
    const missing = one(itoPile({ lateral_pressure: { model: 'ito_matsui', diameter: 0.8 } as never }));
    expect(codePath(missing)).toEqual(['editor.reinforcement_pressure_location /reinforcements/0/lateral_pressure/location']);
    const bad = one(itoPile({ lateral_pressure: lp({ location: 'cabeza' }) as never }));
    expect(codePath(bad)).toEqual(['editor.reinforcement_pressure_location /reinforcements/0/lateral_pressure/location']);
    expect(bad[0]?.text).toContain('slip_surface');
  });
});

describe('capacity', () => {
  it('sin lateral_pressure no se admite', () => {
    const e = one(pile({ capacity: { shear: 100 } }));
    expect(codePath(e)).toEqual(['editor.reinforcement_capacity_alone /reinforcements/0/capacity']);
    expect(e[0]?.text).toContain('Ito-Matsui');
  });

  it('vacía: ni shear ni moment', () => {
    for (const cap of [{}, { shear: null, moment: null }]) {
      expect(codePath(one(itoPile({ capacity: cap })))).toEqual(['editor.reinforcement_capacity_empty /reinforcements/0/capacity']);
    }
  });

  it.each([0, -3])('shear y moment deben ser > 0 (%s)', (v) => {
    expect(codePath(one(itoPile({ capacity: { shear: v } })))).toEqual(['editor.reinforcement_capacity /reinforcements/0/capacity/shear']);
    expect(codePath(one(itoPile({ capacity: { moment: v } })))).toEqual(['editor.reinforcement_capacity /reinforcements/0/capacity/moment']);
    expect(one(itoPile({ capacity: { shear: v } }))[0]?.text).toContain('capacidad al corte');
    expect(one(itoPile({ capacity: { moment: v } }))[0]?.text).toContain('capacidad a momento');
  });

  it('un valor no finito es non_finite', () => {
    expect(codePath(one(itoPile({ capacity: { shear: Number.POSITIVE_INFINITY } })))).toEqual(['editor.reinforcement_non_finite /reinforcements/0/capacity/shear']);
  });
});

describe('geometría del pilote con presión del suelo', () => {
  it('debe ser vertical: x2 distinta de x1 es un error en x2 con la x de la cabeza', () => {
    const e = one(itoPile({ x2: 41 }));
    expect(codePath(e)).toEqual(['editor.reinforcement_pile_vertical /reinforcements/0/x2']);
    expect(e[0]?.text).toContain('vertical');
    expect(e[0]?.text).toContain('x1 = 40');
  });

  it('una diferencia dentro de la tolerancia (1e-12) se acepta', () => {
    expect(issues([itoPile({ x2: 40 + 1e-12 })])).toEqual([]);
  });

  it('un pilote con force inclinado sigue siendo válido', () => {
    expect(issues([pile({ x2: 45 })])).toEqual([]);
  });

  it('spacing debe ser mayor que el diámetro', () => {
    for (const spacing of [0.8, 0.5]) {
      const e = one(itoPile({ spacing }));
      expect(codePath(e)).toEqual(['editor.reinforcement_spacing /reinforcements/0/spacing']);
      expect(e[0]?.text).toContain('diámetro');
      expect(e[0]?.text).toContain('0,8 m');
    }
  });

  it('sin spacing vale 1: con un diámetro de 1,2 m es un error; con 0,8 es válido', () => {
    expect(issues([itoPile({ spacing: undefined })])).toEqual([]);
    const e = one(itoPile({ spacing: undefined, lateral_pressure: lp({ diameter: 1.2 }) as never }));
    expect(codePath(e)).toEqual(['editor.reinforcement_spacing /reinforcements/0/spacing']);
    expect(e[0]?.text).toContain('1,2 m');
  });

  it('application y direction siguen siendo obligatorios', () => {
    expect(codePath(one(itoPile({ direction: 'angle', angle: undefined })))).toEqual(['editor.reinforcement_angle /reinforcements/0/angle']);
  });

  it('en un modelo imperial el diámetro se cita en ft', () => {
    const e = validateLocal(withR([itoPile({ spacing: 0.5 })], '0.5', 'imperial')).filter((i) => i.code === 'editor.reinforcement_spacing');
    expect(e[0]?.text).toContain('0,8 ft');
  });
});

describe('versión mínima 0.5', () => {
  it.each(['0.2', '0.3', '0.4'] as const)('con la versión %s y lateral_pressure: error en /version que nombra la 0.5', (v) => {
    const e = validateLocal(withR([itoPile()], v)).filter((i) => i.code === 'editor.reinforcement_pressure_version');
    expect(e).toHaveLength(1);
    expect(e[0]?.path).toBe('/version');
    expect(e[0]?.text).toContain('0.5');
    expect(e[0]?.text).toContain(v);
    expect(e[0]?.text).toContain('Ito-Matsui');
  });

  it('con la 0.5 no hay error de versión, y un pilote con force no lo pide', () => {
    expect(validateLocal(withR([itoPile()], '0.5')).filter((i) => i.code === 'editor.reinforcement_pressure_version')).toEqual([]);
    expect(validateLocal(withR([pile()], '0.4')).filter((i) => i.code === 'editor.reinforcement_pressure_version')).toEqual([]);
  });
});
