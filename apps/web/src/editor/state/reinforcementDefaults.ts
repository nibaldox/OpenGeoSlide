// Valores por omisión de un refuerzo nuevo: UNA sola fuente para el botón «Agregar» del panel «Refuerzos» y para la herramienta
// «Dibujar refuerzo» del lienzo (E14o-16, R11B-07). Antes cada uno tenía su identificador («a1» frente a «anclaje-1») y sus valores
// (dirección «tangent» frente a «axial» o «angle» 0, otras capacidades). Solo cambia la geometría: el panel la calcula del modelo y
// el lienzo la toma de los dos clics.
import type { PileDirection, Reinforcement } from '../../engine/types';

type ReinforcementType = Reinforcement['type'];
import { UNIT_FACTORS, isImperialUnits } from './units';

const PREFIX: Readonly<Record<ReinforcementType, string>> = { anchor: 'a', nail: 'n', geosynthetic: 'g', pile: 'p', sheet_pile: 's' };

/** Siguiente id libre del tipo: `a1`, `n1`, `g1`, `p1`, `s1` (no repite ninguno de `list`). */
export function nextReinforcementId(list: readonly Reinforcement[], type: ReinforcementType): string {
  const used = new Set(list.map((r) => r.id));
  for (let n = 1; ; n += 1) {
    const id = `${PREFIX[type]}${n}`;
    if (!used.has(id)) return id;
  }
}

/** Valores en SI (kN, kN/m, m). En imperial se convierten con tres cifras significativas: la resistencia por unidad de ancho es la misma (E14o-12). */
const SI = {
  anchor: { capacity: 200, spacing: 2.5 },
  nail: { capacity: 100, spacing: 1.5, bond: 50 },
  geosynthetic: { capacity: 40, spacing: 1 },
  pile: { force: 100, spacing: 2 },
  sheet_pile: { force: 100 },
} as const;

const three = (v: number): number => Number(v.toPrecision(3));
/** kN → lbf (por elemento). */
const forceIn = (imperial: boolean, kn: number): number => (imperial ? three(kn * UNIT_FACTORS.force) : kn);
/** kN/m → lbf/ft (por metro). */
const perLengthIn = (imperial: boolean, knPerM: number): number => (imperial ? three(knPerM * UNIT_FACTORS.lineForce) : knPerM);
/** m → ft. Un `spacing` en pies con el número de SI sería otra malla (E14o-12, R11B-07). */
const spacingIn = (imperial: boolean, m: number): number => (imperial ? three(m * UNIT_FACTORS.length) : m);

/** Todo refuerzo nuevo sin la geometría ni el id (`Omit` de cada variante). */
type WithoutPlace<R> = R extends Reinforcement ? Omit<R, 'id' | 'x1' | 'y1' | 'x2' | 'y2'> : never;
export type ReinforcementDefaults = WithoutPlace<Reinforcement>;

const TANGENT: PileDirection = 'tangent';

/**
 * Campos por omisión de un refuerzo de `type` en `units` (`'SI'` o `'imperial'`). Anclaje: activo, con `end1_capacity = tensile_capacity`
 * (E14m-2). Clavo (con adherencia, axial) y geosintético (tangente): pasivos. Pilote y tablestaca: pasivos, con la fuerza
 * tangente a la superficie de falla. La tablestaca no lleva `spacing` (su fuerza es por metro de muro).
 */
export function reinforcementDefaults(type: ReinforcementType, units?: string | null): ReinforcementDefaults {
  const imp = isImperialUnits(units);
  switch (type) {
    case 'anchor': {
      const capacity = forceIn(imp, SI.anchor.capacity);
      return { type, application: 'active', direction: 'axial', tensile_capacity: capacity, end1_capacity: capacity, spacing: spacingIn(imp, SI.anchor.spacing) };
    }
    case 'nail':
      return {
        type,
        application: 'passive',
        direction: 'axial',
        tensile_capacity: forceIn(imp, SI.nail.capacity),
        spacing: spacingIn(imp, SI.nail.spacing),
        pullout: { model: 'bond', strength: perLengthIn(imp, SI.nail.bond) },
      };
    case 'geosynthetic':
      return { type, application: 'passive', direction: 'tangent', tensile_capacity: forceIn(imp, SI.geosynthetic.capacity), spacing: spacingIn(imp, SI.geosynthetic.spacing) };
    case 'pile':
      return { type, application: 'passive', direction: TANGENT, force: forceIn(imp, SI.pile.force), spacing: spacingIn(imp, SI.pile.spacing) };
    case 'sheet_pile':
      return { type, application: 'passive', direction: TANGENT, force: perLengthIn(imp, SI.sheet_pile.force) };
  }
}

/** Diámetro por omisión de un pilote con presión del suelo (E15i-1): 0,8 m, o su equivalente en pies con tres cifras (2,62 ft). */
export function itoMatsuiDiameterDefault(units?: string | null): number {
  return spacingIn(isImperialUnits(units), 0.8);
}
