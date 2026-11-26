import { describe, expect, it } from 'vitest';
import { formatNumber } from './layout';
import { ALL_TYPES, ANCHOR, GEO, NAIL, PILE, SHEET, asReinforcement, docWith, force } from './reinforcementFixtures';
import { VP } from './fakeStore';
import {
  APPLICATION_LABEL,
  FORCE_ARROW_MAX_PX,
  FORCE_ARROW_MIN_PX,
  REINFORCEMENT_TYPES,
  REINFORCEMENT_TYPE_LABEL,
  forceLabelText,
  forceShapes,
  forceUnit,
  moveBody,
  moveEnd,
  newReinforcement,
  nextReinforcementId,
  refCenter,
  refLength,
  reinforcementCenterLabel,
  reinforcementEndLabel,
  reinforcementShape,
  reinforcementShapes,
  reinforcementTitle,
} from './reinforcements';
import { makeDoc } from './fakeStore';

describe('rótulos de los tipos', () => {
  it('son los de F4.11, en español', () => {
    expect(REINFORCEMENT_TYPES.map((t) => REINFORCEMENT_TYPE_LABEL[t])).toEqual(['Anclaje', 'Clavo', 'Geosintético', 'Pilote', 'Tablestaca']);
    expect(APPLICATION_LABEL).toEqual({ active: 'activa', passive: 'pasiva' });
  });
});

describe('mover extremos y cuerpo', () => {
  it('un extremo de un anclaje se mueve libremente', () => {
    const r = moveEnd(ANCHOR, 2, [12, 9]);
    expect(r).toMatchObject({ x1: 30, y1: 15, x2: 12, y2: 9 });
  });

  it('la tablestaca conserva la x: solo cambia la y del extremo', () => {
    const r = moveEnd(SHEET, 2, [77, -3]);
    expect(r).toMatchObject({ x1: 50, x2: 50, y2: -3 });
    expect(moveEnd(SHEET, 1, [0, 12])).toMatchObject({ x1: 50, x2: 50, y1: 12 });
  });

  it('un refuerzo sin longitud no se acepta (F4.2: L > 0)', () => {
    expect(moveEnd(ANCHOR, 2, [30, 15])).toBeNull();
    expect(moveEnd(SHEET, 2, [0, 10])).toBeNull(); // x fija: queda en (50, 10), la cabeza
    expect(moveEnd(ANCHOR, 2, [Number.NaN, 1])).toBeNull();
  });

  it('el centro mueve los dos extremos; la tablestaca sigue vertical', () => {
    expect(moveBody(ANCHOR, 2, -1)).toMatchObject({ x1: 32, y1: 14, x2: 17, y2: 11 });
    const s = moveBody(SHEET, 3, 0.5);
    expect(s).toMatchObject({ x1: 53, x2: 53, y1: 10.5, y2: 1.5 });
    expect(refLength(s!)).toBeCloseTo(refLength(SHEET), 12);
    expect(refCenter(ANCHOR)).toEqual([22.5, 13.5]);
  });
});

describe('refuerzo nuevo', () => {
  it('el anclaje propone end1_capacity = tensile_capacity (E14m-2) y es activo', () => {
    const r = newReinforcement('anchor', 'anclaje-1', [30, 15], [15, 12]);
    expect(r).toMatchObject({ type: 'anchor', application: 'active', direction: 'axial' });
    expect((r as { end1_capacity: number }).end1_capacity).toBe((r as { tensile_capacity: number }).tensile_capacity);
  });

  it('cada tipo trae los campos obligatorios de F4.2 y ninguno sobra (sin location)', () => {
    for (const type of REINFORCEMENT_TYPES) {
      const r = newReinforcement(type, `${type}-1`, [10, 10], [10, 2]) as unknown as Record<string, unknown>;
      expect(r.id).toBe(`${type}-1`);
      expect(['active', 'passive']).toContain(r.application);
      expect('location' in r).toBe(false);
      if (type === 'pile' || type === 'sheet_pile') {
        expect(r.direction).toBe('angle');
        expect(r.angle).toBe(0);
        expect(r.force).toBeGreaterThan(0);
      } else {
        expect(r.direction).toBe('axial');
        expect(r.tensile_capacity).toBeGreaterThan(0);
      }
    }
    expect('spacing' in (newReinforcement('sheet_pile', 't', [0, 0], [0, -5]) as object)).toBe(false); // la tablestaca no tiene spacing
  });

  it('la tablestaca nueva es vertical aunque la punta llegue con otra x', () => {
    expect(newReinforcement('sheet_pile', 't', [20, 10], [27, 2])).toMatchObject({ x1: 20, x2: 20, y2: 2 });
  });

  it('en un modelo imperial las fuerzas van en lbf y lbf/ft', () => {
    const si = newReinforcement('nail', 'c', [0, 0], [-5, -1], 'SI') as unknown as { tensile_capacity: number; pullout: { strength: number } };
    const imp = newReinforcement('nail', 'c', [0, 0], [-5, -1], 'imperial') as unknown as { tensile_capacity: number; pullout: { strength: number } };
    // Tres cifras significativas: 22 481 lbf se propone como 22 500.
    expect(imp.tensile_capacity / (si.tensile_capacity * 224.809)).toBeCloseTo(1, 2);
    expect(imp.pullout.strength / (si.pullout.strength * 68.5218)).toBeCloseTo(1, 2);
  });

  it('el id no repite ninguno existente', () => {
    const doc = docWith(ANCHOR, asReinforcement({ ...ANCHOR, id: 'anclaje-3' }));
    expect(nextReinforcementId(doc, 'anchor')).toBe('anclaje-4');
    expect(nextReinforcementId(doc, 'sheet_pile')).toBe('tablestaca-1');
    expect(nextReinforcementId(makeDoc(), 'geosynthetic')).toBe('geosintetico-1');
  });
});

describe('nombres accesibles estables', () => {
  it('extremos y centro llevan número, tipo y coordenadas con unidad', () => {
    expect(reinforcementEndLabel(1, ANCHOR, 1, 'SI')).toBe('Refuerzo 2 (Anclaje), cabeza: x 30,0 m, y 15,0 m');
    expect(reinforcementEndLabel(0, ANCHOR, 2, 'SI')).toBe('Refuerzo 1 (Anclaje), punta: x 15,0 m, y 12,0 m');
    expect(reinforcementCenterLabel(0, SHEET, 'imperial')).toBe('Refuerzo 1 (Tablestaca), centro: x 50,0 ft, y 5,5 ft');
    expect(reinforcementTitle(2, PILE, 'SI')).toBe('Refuerzo 3: Pilote, pasiva, longitud 8,0 m');
  });
});

describe('símbolo de cada tipo', () => {
  const shape = (r = ANCHOR) => reinforcementShape(r, 0, VP, 'SI');

  it('los extremos están en pantalla donde dice la proyección', () => {
    const s = shape();
    expect(s.p1).toEqual([VP.tx + 10 * 30, VP.ty - 10 * 15]);
    expect(s.p2).toEqual([VP.tx + 10 * 15, VP.ty - 10 * 12]);
  });

  it('anclaje: cuerpo, placa en la cabeza y bulbo en la punta', () => {
    const parts = shape(ANCHOR).parts;
    expect(parts).toHaveLength(3);
    const bulb = parts[2];
    expect(bulb.kind === 'poly' && bulb.width).toBeGreaterThan(6);
    // la placa es perpendicular al cuerpo
    const plate = parts[1];
    if (plate.kind !== 'poly') throw new Error('placa');
    const s = shape();
    const ux = s.p2[0] - s.p1[0];
    const uy = s.p2[1] - s.p1[1];
    const px = plate.pts[1][0] - plate.pts[0][0];
    const py = plate.pts[1][1] - plate.pts[0][1];
    expect(Math.abs(ux * px + uy * py)).toBeLessThan(1e-9);
  });

  it('clavo: cabeza cuadrada rellena; geosintético: zigzag; pilote: aro en la cabeza; tablestaca: dientes', () => {
    const nailHead = shape(NAIL).parts[1];
    expect(nailHead).toMatchObject({ kind: 'poly', closed: true, fill: true });
    const geo = shape(GEO).parts[0];
    expect(geo.kind === 'poly' && geo.pts.length).toBeGreaterThan(4);
    expect(shape(PILE).parts.some((p) => p.kind === 'circle')).toBe(true);
    expect(shape(SHEET).parts.length).toBeGreaterThan(3);
  });

  it('cada tipo tiene una silueta distinta', () => {
    const sig = ALL_TYPES.map((r) => JSON.stringify(shape(r).parts.map((p) => [p.kind, p.width, p.kind === 'poly' ? Boolean(p.closed) : null])));
    expect(new Set(sig).size).toBe(ALL_TYPES.length);
  });

  it('el rótulo del símbolo queda del lado de arriba y dice tipo y número', () => {
    for (const r of ALL_TYPES) {
      const s = reinforcementShape(r, 3, VP, 'SI');
      expect(s.label.text).toBe(`${REINFORCEMENT_TYPE_LABEL[r.type]} 4`);
      expect(s.label.y).toBeLessThanOrEqual(s.mid[1] + 1e-9);
    }
  });
});

describe('rótulos de refuerzos vecinos', () => {
  it('no se pisan: el segundo se desplaza en vertical', () => {
    const two = reinforcementShapes([PILE, { ...PILE, id: 'pilote-2', x1: 45.5, x2: 45.5 }], VP, 'SI');
    expect(two[0].label.text).not.toBe(two[1].label.text);
    expect(Math.abs(two[1].label.y - two[0].label.y)).toBeGreaterThanOrEqual(14);
  });

  it('un refuerzo solo conserva su rótulo en el sitio natural', () => {
    const one = reinforcementShapes([ANCHOR], VP, 'SI')[0];
    expect(one.label.y).toBeCloseTo(reinforcementShape(ANCHOR, 0, VP, 'SI').label.y, 9);
  });
});

describe('flechas de fuerza del resultado', () => {
  it('apunta en la dirección de (fx, fy), con la y de pantalla invertida', () => {
    const [s] = forceShapes([force({ fx: 100, fy: 0 })], VP, 'SI');
    expect(s.applied).toBe(true);
    expect(s.tip![0]).toBeGreaterThan(s.at[0]);
    expect(s.tip![1]).toBeCloseTo(s.at[1], 9);
    const [up] = forceShapes([force({ fx: 0, fy: 50 })], VP, 'SI');
    expect(up.tip![1]).toBeLessThan(up.at[1]);
    const [diag] = forceShapes([force({ fx: -30, fy: -40 })], VP, 'SI');
    const dx = diag.tip![0] - diag.at[0];
    const dy = diag.tip![1] - diag.at[1];
    expect(dx / Math.hypot(dx, dy)).toBeCloseTo(-0.6, 9);
    expect(dy / Math.hypot(dx, dy)).toBeCloseTo(0.8, 9); // fy < 0 → hacia abajo en pantalla
  });

  it('el largo va de 30 a 60 px según la magnitud relativa', () => {
    const shapes = forceShapes([force({ id: 'a', fx: 100, fy: 0 }), force({ id: 'b', fx: 25, fy: 0 })], VP, 'SI');
    const len = (i: number): number => Math.hypot(shapes[i].tip![0] - shapes[i].at[0], shapes[i].tip![1] - shapes[i].at[1]);
    expect(len(0)).toBeCloseTo(FORCE_ARROW_MAX_PX, 9);
    expect(len(1)).toBeCloseTo(FORCE_ARROW_MIN_PX + (FORCE_ARROW_MAX_PX - FORCE_ARROW_MIN_PX) * 0.25, 9);
  });

  it('los estados que no aplican van en gris, sin flecha, con su rótulo', () => {
    const cases: [string, string][] = [
      ['outside_mass', 'fuera de la masa'],
      ['compression_ignored', 'ignorada por compresión'],
      ['no_capacity', 'sin capacidad'],
    ];
    for (const [status, text] of cases) {
      const [s] = forceShapes([force({ status: status as never, fx: 0, fy: 0 })], VP, 'SI');
      expect(s.applied).toBe(false);
      expect(s.tip).toBeNull();
      expect(s.label.text).toBe(`anclaje-1: ${text}`);
    }
  });

  it('el rótulo dice la magnitud con unidad por metro; una pasiva, que se divide por F', () => {
    expect(forceLabelText(force({ fx: -150, fy: 0 }), 'SI')).toBe('anclaje-1: 150,0 kN/m (activa)');
    expect(forceLabelText(force({ id: 'clavo-1', application: 'passive', fx: 3, fy: 4 }), 'SI')).toBe('clavo-1: 5,0 kN/m (pasiva, dividida por F)');
    // el rótulo corto del dibujo no pisa a los vecinos; el título y la tabla dicen el texto completo
    expect(forceLabelText(force({ id: 'clavo-1', application: 'passive', fx: 3, fy: 4 }), 'SI', true)).toBe('clavo-1: 5,0 kN/m (pasiva)');
    expect(forceUnit('imperial')).toBe('lbf/ft');
    expect(forceLabelText(force({ fx: 100, fy: 0 }), 'imperial')).toContain('lbf/ft');
    expect(formatNumber(5)).toBe('5,0');
  });

  it('una fuerza aplicada nula no dibuja flecha', () => {
    expect(forceShapes([force({ fx: 0, fy: 0 })], VP, 'SI')[0].tip).toBeNull();
  });

  it('sin fuerzas no hay formas', () => {
    expect(forceShapes(undefined, VP, 'SI')).toEqual([]);
  });
});
