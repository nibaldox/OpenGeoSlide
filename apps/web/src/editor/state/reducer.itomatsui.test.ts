// El reductor acepta el pilote con presión del suelo de Ito-Matsui (v0.5, E15i-1): `force` opcional, `lateral_pressure` y `capacity` con su
// forma, y una copia limpia de los `null`. Los rangos los señala `validateLocal`.
import { describe, expect, it } from 'vitest';
import type { PileReinforcement } from '../../engine/types';
import { itoPile, pile, sheet } from './reinforcementFixtures';
import { createEditorStore } from './store';
import { baseDoc } from './testFixtures';
import type { ModelDoc } from '../types';

const doc = (): ModelDoc => ({ ...baseDoc(), version: '0.5' });
const add = (r: unknown) => {
  const store = createEditorStore(doc());
  store.dispatch({ type: 'reinforcement/upsert', index: null, reinforcement: r as never });
  return store.getState().doc.reinforcements ?? [];
};

describe('reinforcement/upsert con Ito-Matsui', () => {
  it('acepta un pilote con lateral_pressure y sin force', () => {
    const list = add(itoPile());
    expect(list).toHaveLength(1);
    expect((list[0] as PileReinforcement).lateral_pressure).toEqual({ model: 'ito_matsui', diameter: 0.8, location: 'centroid' });
    expect('force' in list[0]!).toBe(false);
  });

  it('acepta capacity con corte, momento o ambos, y borra los null', () => {
    expect((add(itoPile({ capacity: { shear: 150, moment: null } }))[0] as PileReinforcement).capacity).toEqual({ shear: 150 });
    expect((add(itoPile({ capacity: { shear: 150, moment: 250 } }))[0] as PileReinforcement).capacity).toEqual({ shear: 150, moment: 250 });
  });

  it('el reductor no copia el campo force null', () => {
    expect('force' in add(itoPile({ force: null }))[0]!).toBe(false);
  });

  it('rechaza un pilote sin force y sin lateral_pressure', () => {
    expect(add({ ...pile(), force: undefined })).toEqual([]);
  });

  it('con force y lateral_pressure a la vez lo deja pasar (la exclusión es de validateLocal)', () => {
    expect(add({ ...itoPile(), force: 5 })).toHaveLength(1);
  });

  it('rechaza una forma incorrecta: model, location, diameter no numérico, claves desconocidas', () => {
    expect(add(itoPile({ lateral_pressure: { model: 'otro', diameter: 0.8, location: 'centroid' } as never }))).toEqual([]);
    expect(add(itoPile({ lateral_pressure: { model: 'ito_matsui', diameter: 0.8, location: 'cabeza' } as never }))).toEqual([]);
    expect(add(itoPile({ lateral_pressure: { model: 'ito_matsui', diameter: Number.NaN, location: 'centroid' } }))).toEqual([]);
    expect(add(itoPile({ lateral_pressure: { model: 'ito_matsui', diameter: 0.8, location: 'centroid', ru: 1 } as never }))).toEqual([]);
    expect(add(itoPile({ capacity: { shear: 1, flexure: 2 } as never }))).toEqual([]);
    expect(add(itoPile({ capacity: { shear: Number.POSITIVE_INFINITY } }))).toEqual([]);
  });

  it('la tablestaca y los elementos de tracción siguen sin admitir lateral_pressure ni capacity', () => {
    expect(add({ ...sheet(), lateral_pressure: { model: 'ito_matsui', diameter: 0.8, location: 'centroid' } })).toEqual([]);
    expect(add({ ...sheet(), capacity: { shear: 1 } })).toEqual([]);
  });

  it('un pilote con force sigue igual', () => {
    expect(add(pile())).toHaveLength(1);
  });
});
