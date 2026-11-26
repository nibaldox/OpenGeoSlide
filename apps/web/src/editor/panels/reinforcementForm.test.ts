// Lógica pura del formulario de refuerzos (v0.4, F4.11): rótulos por tipo, valores iniciales, formulario ↔ refuerzo y comandos.
import { describe, expect, it } from 'vitest';
import type { Reinforcement } from '../../engine/types';
import type { ModelDoc } from '../types';
import { selectionForPath } from './forms';
import {
  APPLICATION_OPTIONS,
  PILE_DIRECTION_OPTIONS,
  PULLOUT_OPTIONS,
  REINFORCEMENT_ADD_LABELS,
  REINFORCEMENT_TYPES,
  REINFORCEMENT_TYPE_LABELS,
  TENSION_DIRECTION_OPTIONS,
  alignedSheet,
  defaultReinforcement,
  isInclinedSheet,
  nextReinforcementId,
  reinforcementFromForm,
  reinforcementLength,
  reinforcementRemoveCommand,
  reinforcementToForm,
  reinforcementUnits,
  reinforcementUpsertCommand,
  reinforcementsEqual,
  switchDirection,
  switchPullout,
} from './reinforcementForm';
import { FIVE, anchor, pile, sheet } from '../state/reinforcementFixtures';
import { validateLocal } from '../state/validateLocal';
import { baseDoc } from '../state/testFixtures';
import { UNIT_FACTORS } from '../state/units';

const slope = (over: Partial<ModelDoc> = {}): ModelDoc => ({
  ...baseDoc(),
  version: '0.2',
  units: 'SI',
  materials: [{ id: 'm1', name: 'm1', model: 'mohr_coulomb', unit_weight: 18, cohesion: 10, friction_angle: 25 }],
  regions: [{ material: 'm1', polygon: [[0, 0], [0, 15], [10, 15], [32.5, 0]] }],
  water: null,
  slope: { direction: 'auto' },
  ...over,
});

const ctx = { otherIds: [] as string[], index: null as number | null };
const errorsOf = (r: ReturnType<typeof reinforcementFromForm>): Record<string, string> => (r.ok ? {} : r.errors);

describe('rótulos', () => {
  it('los cinco tipos en español, en orden', () => {
    expect(REINFORCEMENT_TYPES).toEqual(['anchor', 'nail', 'geosynthetic', 'pile', 'sheet_pile']);
    expect(REINFORCEMENT_TYPE_LABELS).toEqual({ anchor: 'Anclaje', nail: 'Clavo', geosynthetic: 'Geosintético', pile: 'Pilote', sheet_pile: 'Tablestaca' });
    expect(REINFORCEMENT_ADD_LABELS.sheet_pile).toBe('Agregar tablestaca');
  });

  it('las opciones cubren los valores del formato', () => {
    expect(APPLICATION_OPTIONS.map((o) => o.value)).toEqual(['active', 'passive']);
    expect(TENSION_DIRECTION_OPTIONS.map((o) => o.value)).toEqual(['axial', 'tangent', 'bisector']);
    expect(PILE_DIRECTION_OPTIONS.map((o) => o.value)).toEqual(['angle', 'tangent', 'perpendicular']);
    expect(PULLOUT_OPTIONS.map((o) => o.value)).toEqual(['none', 'bond', 'interface', 'development']);
  });

  it('unidades SI e imperial', () => {
    expect(reinforcementUnits('SI')).toEqual({ length: 'm', force: 'kN', forcePerLength: 'kN/m', stress: 'kPa', moment: 'kN·m' });
    expect(reinforcementUnits('imperial')).toEqual({ length: 'ft', force: 'lbf', forcePerLength: 'lbf/ft', stress: 'psf', moment: 'lbf·ft' });
    expect(reinforcementUnits(undefined).force).toBe('kN');
  });
});

describe('valores iniciales', () => {
  it('cada tipo nace válido para validateLocal, con un id libre', () => {
    for (const units of ['SI', 'imperial']) {
      let doc = slope({ units });
      for (const type of REINFORCEMENT_TYPES) {
        const r = defaultReinforcement(type, doc);
        expect(r, type).not.toBeNull();
        doc = { ...doc, version: '0.4', reinforcements: [...(doc.reinforcements ?? []), r as Reinforcement] };
      }
      const bad = validateLocal(doc).filter((i) => i.severity === 'error');
      expect(bad, units).toEqual([]);
      expect((doc.reinforcements ?? []).map((r) => r.id)).toEqual(['a1', 'n1', 'g1', 'p1', 's1']);
    }
  });

  // R11B-08 / E14o-16: el pilote y la tablestaca nuevos son siempre válidos, hacia abajo y dentro del suelo, también con un pie largo y bajo.
  describe('pilote y tablestaca nuevos con terreno de pie largo (R11B-08)', () => {
    const toe = (yToe: number, top = 40): ModelDoc => slope({ regions: [{ material: 'm1', polygon: [[0, 0], [100, 0], [100, yToe], [40, yToe], [20, top], [0, top]] }] });
    /** Cota de la base del suelo en `x` (todas las regiones de estos modelos llegan hasta y = 0). */
    const checkInside = (doc: ModelDoc, type: 'pile' | 'sheet_pile'): Reinforcement => {
      const r = defaultReinforcement(type, doc) as Reinforcement;
      expect(r, type).not.toBeNull();
      expect(r.y2, `${type}: la punta debe quedar bajo la cabeza (y1 ${r.y1}, y2 ${r.y2})`).toBeLessThan(r.y1);
      expect(r.y2, `${type}: la punta debe quedar dentro del suelo`).toBeGreaterThan(0);
      expect(r.x1).toBe(r.x2);
      const bad = validateLocal({ ...doc, version: '0.4', reinforcements: [r] }).filter((i) => i.severity === 'error');
      expect(bad, type).toEqual([]);
      return r;
    };
    it.each(['pile', 'sheet_pile'] as const)('%s: pie de 2 con la cota yMin + 5 % de la altura (contraejemplo del revisor: longitud 0)', (type) => {
      const r = checkInside(toe(2), type);
      expect(r.y1).toBeGreaterThan(r.y2 + 0.01);
    });
    it.each(['pile', 'sheet_pile'] as const)('%s: pie de 1, menor que yMin + 5 % (contraejemplo: la punta quedaba sobre la cabeza)', (type) => {
      checkInside(toe(1), type);
    });
    it.each(['pile', 'sheet_pile'] as const)('%s: siempre válido con pies de 0,05 a 38 y taludes de 3 a 200 de alto', (type) => {
      for (const top of [3, 10, 40, 200]) for (const yToe of [0.05, 0.2, 1, 2, top * 0.05, top * 0.5, top - 0.5]) if (yToe < top) checkInside(toe(yToe, top), type);
    });
    it('con terreno sin espesor en el centro, busca una columna con suelo', () => {
      const r = checkInside(toe(0.5), 'pile');
      expect(r.y1).toBeLessThanOrEqual(40);
    });
  });

  it('un anclaje nuevo propone end1_capacity = tensile_capacity (E14m-2)', () => {
    const r = defaultReinforcement('anchor', slope());
    expect(r?.type).toBe('anchor');
    if (r?.type === 'anchor') {
      expect(r.end1_capacity).toBe(r.tensile_capacity);
      expect(r.application).toBe('active');
    }
  });

  // E14o-12: el panel en imperial propone valores de la misma resistencia por unidad de ancho (capacidad entre espaciamiento) que en SI.
  it('en imperial, la resistencia por ancho de cada tipo con espaciamiento equivale a la de SI (5 %)', () => {
    type Flat = { tensile_capacity?: number; force?: number; spacing?: number };
    for (const type of ['anchor', 'nail', 'geosynthetic', 'pile'] as const) {
      const si = defaultReinforcement(type, slope({ units: 'SI' })) as unknown as Flat;
      const im = defaultReinforcement(type, slope({ units: 'imperial' })) as unknown as Flat;
      const wSi = (si.tensile_capacity ?? si.force ?? 0) / (si.spacing ?? 1);
      const wIm = (im.tensile_capacity ?? im.force ?? 0) / (im.spacing ?? 1);
      expect(Math.abs(wIm / UNIT_FACTORS.lineForce / wSi - 1), `${type}: ${wIm} lbf/ft vs ${wSi} kN/m`).toBeLessThan(0.05);
    }
  });

  it('el valor inicial cambia con las unidades', () => {
    const si = defaultReinforcement('anchor', slope({ units: 'SI' }));
    const im = defaultReinforcement('anchor', slope({ units: 'imperial' }));
    if (si?.type === 'anchor' && im?.type === 'anchor') expect(im.tensile_capacity).toBeGreaterThan(si.tensile_capacity * 100);
    else throw new Error('tipo inesperado');
  });

  it('la tablestaca es vertical y el pilote parte del terreno hacia abajo', () => {
    const s = defaultReinforcement('sheet_pile', slope());
    expect(s && s.x1 === s.x2 && s.y2 < s.y1).toBe(true);
    const p = defaultReinforcement('pile', slope());
    expect(p && p.y2 < p.y1).toBe(true);
  });

  it('la punta del clavo va hacia el lado alto del terreno (la masa se mueve hacia el bajo)', () => {
    const left = defaultReinforcement('nail', slope()); // terreno alto a la izquierda: la punta va a la izquierda
    expect(left && left.x2 < left.x1).toBe(true);
    const right = defaultReinforcement('nail', slope({ regions: [{ material: 'm1', polygon: [[0, 0], [22.5, 15], [32.5, 15], [32.5, 0]] }] }));
    expect(right && right.x2 > right.x1).toBe(true);
    const forced = defaultReinforcement('nail', slope({ slope: { direction: 'right_to_left' } }));
    expect(forced && forced.x2 > forced.x1).toBe(true);
  });

  it('sin geometría no hay valor inicial', () => {
    expect(defaultReinforcement('anchor', slope({ regions: [] }))).toBeNull();
  });

  it('nextReinforcementId salta los usados', () => {
    expect(nextReinforcementId([anchor({ id: 'a1' }), anchor({ id: 'a2' })], 'anchor')).toBe('a3');
    expect(nextReinforcementId([], 'geosynthetic')).toBe('g1');
  });
});

describe('formulario ↔ refuerzo', () => {
  it('los cinco tipos del formato dan la misma pieza al volver', () => {
    for (const r of FIVE) {
      const out = reinforcementFromForm(reinforcementToForm(r), ctx);
      expect(out.ok, r.id).toBe(true);
      if (out.ok) expect(reinforcementsEqual(out.value, r), r.id).toBe(true);
    }
  });

  it('el texto admite coma o punto decimal y los espacios sobrantes', () => {
    const f = { ...reinforcementToForm(anchor()), tensile_capacity: ' 150,5 ', x1: '44.25' };
    const out = reinforcementFromForm(f, ctx);
    expect(out.ok && out.value.type === 'anchor' && out.value.tensile_capacity).toBe(150.5);
    expect(out.ok && out.value.x1).toBe(44.25);
  });

  it('los opcionales vacíos no se escriben', () => {
    const f = { ...reinforcementToForm(anchor({ end1_capacity: 5, spacing: 2 })), end1_capacity: '', spacing: '' };
    const out = reinforcementFromForm(f, ctx);
    expect(out.ok && 'end1_capacity' in out.value).toBe(false);
    expect(out.ok && 'spacing' in out.value).toBe(false);
    expect(out.ok && 'pullout' in out.value).toBe(false);
  });

  it('la tablestaca copia la x de la cabeza a la punta', () => {
    const f = { ...reinforcementToForm(sheet()), x1: '41,5', x2: '99' };
    const out = reinforcementFromForm(f, ctx);
    expect(out.ok && out.value.x1 === 41.5 && out.value.x2 === 41.5).toBe(true);
  });

  // R11B-10: con `inclined` (la tablestaca abierta ya traía x1 ≠ x2) el formulario no fuerza x2 = x1: lo valida, con el texto de validateLocal.
  it('una tablestaca inclinada conserva su x2 y el formulario da el mismo error que validateLocal', () => {
    const f = reinforcementToForm(sheet({ x1: 40, x2: 42 }));
    const out = reinforcementFromForm(f, { ...ctx, inclined: true });
    expect(errorsOf(out).x2).toMatch(/la tablestaca es vertical; la x de la punta debe ser igual a la de la cabeza \(x1 = 40/);
    expect(errorsOf(out).x2).toContain('Valor actual: 42');
    const fixed = reinforcementFromForm({ ...f, x2: '40' }, { ...ctx, inclined: true });
    expect(fixed.ok && fixed.value.x2 === 40).toBe(true);
    // Sin `inclined` se conserva el comportamiento de siempre (la x de la punta es la de la cabeza).
    expect(reinforcementFromForm(f, ctx).ok).toBe(true);
  });

  it('alignedSheet devuelve la tablestaca con x2 = x1 y no toca el resto', () => {
    const r = sheet({ x1: 40, x2: 42 });
    expect(alignedSheet(r)).toEqual({ ...r, x2: 40 });
    expect(isInclinedSheet(r)).toBe(true);
    expect(isInclinedSheet(sheet())).toBe(false);
    expect(isInclinedSheet(pile())).toBe(false);
  });

  it('el ángulo solo se escribe con la dirección «Ángulo»', () => {
    const tangent = reinforcementFromForm({ ...reinforcementToForm(pile()), direction: 'tangent', angle: '20' }, ctx);
    expect(tangent.ok && 'angle' in tangent.value).toBe(false);
    const angle = reinforcementFromForm({ ...reinforcementToForm(pile()), angle: '-15' }, ctx);
    expect(angle.ok && angle.value.type === 'pile' && angle.value.angle).toBe(-15);
  });

  it('campos vacíos o fuera de rango dan un error por campo con el texto de la validación', () => {
    const base = reinforcementToForm(anchor({ pullout: { model: 'bond', strength: 30, bonded_length: 5 } }));
    expect(errorsOf(reinforcementFromForm({ ...base, tensile_capacity: '' }, ctx)).tensile_capacity).toMatch(/Capacidad a tracción: falta el valor/);
    expect(errorsOf(reinforcementFromForm({ ...base, tensile_capacity: '-1' }, ctx)).tensile_capacity).toBe('Capacidad a tracción: use un valor igual o mayor que 0');
    expect(errorsOf(reinforcementFromForm({ ...base, tensile_capacity: 'abc' }, ctx)).tensile_capacity).toMatch(/escriba un número/);
    expect(errorsOf(reinforcementFromForm({ ...base, spacing: '0' }, ctx)).spacing).toMatch(/Espaciamiento: use un valor mayor que 0/);
    expect(errorsOf(reinforcementFromForm({ ...base, x1: '' }, ctx)).x1).toMatch(/Cabeza x1/);
    expect(errorsOf(reinforcementFromForm({ ...base, strength: '-3' }, ctx)).strength).toMatch(/Resistencia de adherencia por metro/);
    expect(errorsOf(reinforcementFromForm({ ...base, bonded_length: '0' }, ctx)).bonded_length).toMatch(/Longitud adherida: use un valor mayor que 0/);
  });

  it('bonded_length mayor que la longitud, con la longitud en el texto', () => {
    const base = reinforcementToForm(anchor({ pullout: { model: 'bond', strength: 30, bonded_length: 5 } }));
    const e = errorsOf(reinforcementFromForm({ ...base, bonded_length: '15' }, ctx)).bonded_length;
    expect(e).toMatch(/no puede superar la longitud del refuerzo \(14,56 m\)/);
  });

  it('interfaz y desarrollo: rangos', () => {
    const i = reinforcementToForm(anchor({ pullout: { model: 'interface', adhesion: 10, friction_angle: 20, coverage: 0.8 } }));
    expect(errorsOf(reinforcementFromForm({ ...i, coverage: '0' }, ctx)).coverage).toMatch(/Cobertura Rc/);
    expect(errorsOf(reinforcementFromForm({ ...i, friction_angle: '90' }, ctx)).friction_angle).toMatch(/Fricción de la interfaz/);
    expect(errorsOf(reinforcementFromForm({ ...i, adhesion: '-1' }, ctx)).adhesion).toMatch(/Adhesión/);
    const d = reinforcementToForm(anchor({ pullout: { model: 'development', length1: 3, length2: 4 } }));
    expect(errorsOf(reinforcementFromForm({ ...d, length1: '-1' }, ctx)).length1).toMatch(/Longitud de desarrollo en la cabeza/);
    expect(reinforcementFromForm({ ...d, length1: '0', length2: '0' }, ctx).ok).toBe(true);
  });

  it('ángulo: obligatorio con «Ángulo» y en (−90, 90)', () => {
    const p = reinforcementToForm(pile());
    expect(errorsOf(reinforcementFromForm({ ...p, angle: '' }, ctx)).angle).toMatch(/Ángulo: falta el valor/);
    expect(errorsOf(reinforcementFromForm({ ...p, angle: '90' }, ctx)).angle).toMatch(/sin incluirlos/);
    expect(errorsOf(reinforcementFromForm({ ...p, angle: '-90' }, ctx)).angle).toMatch(/sin incluirlos/);
    expect(reinforcementFromForm({ ...p, angle: '89,99' }, ctx).ok).toBe(true);
  });

  it('id vacío, repetido, y longitud cero', () => {
    const f = reinforcementToForm(anchor());
    expect(errorsOf(reinforcementFromForm({ ...f, id: '  ' }, ctx)).id).toMatch(/no puede estar vacío/);
    expect(errorsOf(reinforcementFromForm({ ...f, id: 'a2' }, { otherIds: ['a2'], index: 0 })).id).toMatch(/«a2» ya lo usa otro refuerzo/);
    expect(reinforcementFromForm({ ...f, id: 'a1' }, { otherIds: ['a2'], index: 0 }).ok).toBe(true);
    expect(errorsOf(reinforcementFromForm({ ...f, x2: f.x1, y2: f.y1 }, ctx)).x2).toMatch(/cabeza y la punta coinciden/);
    const s = reinforcementToForm(sheet());
    expect(errorsOf(reinforcementFromForm({ ...s, y2: s.y1 }, ctx)).y2).toMatch(/cabeza y la punta coinciden/);
  });

  it('cada error del formulario también lo da la validación local con el mismo texto de regla', () => {
    // El panel y el diagnóstico usan las mismas reglas: lo que el formulario rechaza, validateLocal lo rechaza también.
    const cases: [Reinforcement, Record<string, string>][] = [
      [anchor(), { tensile_capacity: '-5' }],
      [anchor(), { spacing: '-1' }],
      [pile(), { angle: '95' }],
      [pile(), { force: '-1' }],
      [anchor({ pullout: { model: 'bond', strength: 1, bonded_length: 5 } }), { bonded_length: '99' }],
    ];
    for (const [r, change] of cases) {
      const out = reinforcementFromForm({ ...reinforcementToForm(r), ...change }, ctx);
      expect(out.ok, JSON.stringify(change)).toBe(false);
    }
  });
});

describe('cambio de arrancamiento y de dirección', () => {
  it('switchPullout rellena valores válidos para el modelo nuevo y descarta los del anterior', () => {
    const f = reinforcementToForm(anchor());
    for (const kind of ['bond', 'interface', 'development'] as const) {
      const g = switchPullout(f, kind, 'SI');
      expect(g.pullout).toBe(kind);
      expect(reinforcementFromForm(g, ctx).ok, kind).toBe(true);
    }
    expect(switchPullout(switchPullout(f, 'bond', 'SI'), 'none', 'SI').pullout).toBe('none');
    const out = reinforcementFromForm(switchPullout(f, 'none', 'SI'), ctx);
    expect(out.ok && 'pullout' in out.value).toBe(false);
  });

  it('switchPullout conserva lo ya escrito al volver a un modelo', () => {
    const f = { ...switchPullout(reinforcementToForm(anchor()), 'bond', 'SI'), strength: '77' };
    expect(switchPullout(f, 'bond', 'SI').strength).toBe('77');
  });

  it('switchDirection a «Ángulo» propone 0 y al salir lo vacía', () => {
    const p = { ...reinforcementToForm(pile({ direction: 'tangent', angle: undefined })) };
    expect(p.angle).toBe('');
    const a = switchDirection(p, 'angle');
    expect(a.direction).toBe('angle');
    expect(a.angle).toBe('0');
    expect(reinforcementFromForm(a, ctx).ok).toBe(true);
    expect(switchDirection(a, 'perpendicular').angle).toBe('');
  });
});

describe('comandos y utilidades', () => {
  it('upsert y remove', () => {
    expect(reinforcementUpsertCommand(null, anchor())).toEqual({ type: 'reinforcement/upsert', index: null, reinforcement: anchor() });
    expect(reinforcementUpsertCommand(2, pile())).toEqual({ type: 'reinforcement/upsert', index: 2, reinforcement: pile() });
    expect(reinforcementRemoveCommand(1)).toEqual({ type: 'reinforcement/remove', index: 1 });
  });

  it('reinforcementsEqual ignora opcionales ausentes frente a undefined', () => {
    expect(reinforcementsEqual(anchor(), anchor({ spacing: undefined }))).toBe(true);
    expect(reinforcementsEqual(anchor(), anchor({ spacing: 2 }))).toBe(false);
    expect(reinforcementsEqual(anchor(), pile())).toBe(false);
  });

  it('longitud del refuerzo', () => {
    expect(reinforcementLength(anchor())).toBeCloseTo(Math.hypot(14, 4), 12);
    expect(reinforcementLength(sheet())).toBe(12);
  });

  it('selectionForPath lleva las rutas de refuerzos a su selección', () => {
    const doc = { ...baseDoc(), version: '0.4' as const, reinforcements: [anchor(), pile()] };
    expect(selectionForPath('/reinforcements/1', doc)).toEqual({ kind: 'reinforcement', index: 1 });
    expect(selectionForPath('/reinforcements/0/pullout/strength', doc)).toEqual({ kind: 'reinforcement', index: 0 });
    expect(selectionForPath('/reinforcements/5/x1', doc)).toEqual({ kind: 'none' });
    expect(selectionForPath('/reinforcements', doc)).toEqual({ kind: 'none' });
  });
});
