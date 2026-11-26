// Grieta de tracción y agua embalsada en el informe (F5.3, F5.4, F5.7): textos, tabla por método y filas del CSV. Puro y sin DOM: lo
// consumen el PDF (`content.ts`), el CSV (`io/csv.ts`), Diagnósticos y la tabla de resultados (`ui/`), la Ayuda y el lienzo.

import { forceUnit } from '../editor/canvas/reinforcements';
import type { ModelDoc } from '../editor/types';
import type { CrackReport, MethodKind, MethodReport, TensionCrack } from '../engine/types';
import { lengthUnitOf } from '../editor/canvas/layout';
import { pondMaxDepth, pondPolygons } from '../render/pond';

/** Nota del agua embalsada (F5.3), igual a la del código `water_above_ground` del motor: el informe y la Ayuda dicen lo mismo. */
export const POND_NOTE = 'La piezométrica queda sobre el terreno: el agua embalsada se incluye con su peso y su empuje horizontal (sin sismo).';

/** Convenciones del agua embalsada que el informe y la Ayuda declaran (F5.3, E7 y E15c-ru). */
export const POND_CONVENTIONS: readonly string[] = [
  'Agua embalsada: es la región entre la piezométrica y el terreno donde la piezométrica queda sobre el terreno, en todo el modelo. Se carga sola, sin ningún campo: pesa sobre la dovela y empuja con la presión horizontal sobre el paramento.',
  'El sismo pseudoestático no actúa sobre el agua: ni kh ni kv se aplican al agua embalsada ni al agua de la grieta.',
  'Un material con ru reemplaza a la piezométrica en la presión de poros, con u = ru·(W + V)/b: W es el peso del suelo de la dovela y V el del agua embalsada que tiene encima, sin cargas externas ni sismo. Es la regla de Slide2 y la conservadora (de 1 a 4,5 % menos de FS que contar solo el suelo). No se pudo comparar con un oráculo externo.',
];

/** Fuerza del agua en la grieta (F5.4, G3): la nota breve de la tabla de resultados. */
export const CRACK_PW_NOTE =
  'Pw = ½·γw·hw², con hw = profundidad × fracción de agua. Es horizontal, va en el sentido del deslizamiento y se aplica a un tercio de hw sobre la base de la grieta. Sin sismo.';

/** Convenciones de la grieta de tracción (F5.4). */
export const CRACK_CONVENTIONS: readonly string[] = [
  'Grieta de tracción: es vertical y se ubica en x_c, el primer punto desde la cresta donde el terreno queda a una profundidad igual o mayor que la de la grieta sobre la superficie de falla. Si la superficie nunca llega a esa profundidad, no tiene masa y el motor la descarta (tension_crack_not_reached).',
  'La masa termina en una cara vertical en x_c: el suelo del lado de la cresta se quita y su peso no se conserva como carga. La cara no tiene resistencia y el agua de la grieta no cambia la presión de poros de la base ni pesa.',
  CRACK_PW_NOTE,
  'La fracción de agua va de 0 (grieta seca) a 1 (llena). 1 es lo conservador y lo que usan Slide2 y USACE EM 1110-2-1902; por eso es lo que propone la interfaz al crear la grieta.',
  'Con profundidad «Automática» se usa z = 2c/(γ·tan(45° − φ/2)) − q/γ, con c, φ y γ del material bajo el terreno en cada x, y q la sobrecarga y el agua embalsada en ese punto. No hay tope por la altura del talud.',
];

const DASH = '—';

/** Texto de una grieta que el motor informa con `depth = 0` (E15j-3, E15l-15): no se cortó ninguna grieta. */
export const NO_CRACK_TEXT = 'Sin grieta (z = 0)';

/** ¿El motor informó «sin grieta»? Profundidad no positiva (o no finita): la superficie no tiene grieta aunque el modelo la pida. */
export function isNoCrack(c: { depth: number } | null | undefined): boolean {
  return !!c && !(c.depth > 0);
}

/** Número con coma decimal y hasta `digits` decimales, sin ceros de relleno: «2,4». */
function num(n: number | null | undefined, digits = 3): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  return String(Number(n.toFixed(digits))).replace('.', ',');
}

export interface CrackRecord {
  method: MethodKind;
  x: number;
  depth: number;
  force: number;
  /** F del método; `null` si no es finito. */
  fs: number | null;
}

/** Filas de la grieta: un resultado por método que la trae. Vacío sin grieta (la omite el motor). */
export function crackRecords(results: readonly MethodReport[]): CrackRecord[] {
  return results.flatMap((r) => {
    const c: CrackReport | undefined = r.tension_crack;
    if (!c) return [];
    return [{ method: r.method, x: c.x, depth: c.depth, force: c.water_force, fs: typeof r.fos === 'number' && Number.isFinite(r.fos) ? r.fos : null }];
  });
}

export function crackUnits(units: string | null | undefined): { length: string; line: string } {
  return { length: lengthUnitOf(units), line: forceUnit(units) };
}

/** Texto de la profundidad de la grieta del modelo: «Automática» o el número con su unidad. */
export function crackDepthSetting(crack: TensionCrack, units: string | null | undefined): string {
  return crack.depth === 'auto' ? 'Automática' : `${num(crack.depth)} ${lengthUnitOf(units)}`;
}

/** Porcentaje de la fracción de agua: «100 % (llena)», «0 % (seca)» o «50 %». */
export function waterFillText(fill: number): string {
  const pct = `${num(fill * 100, 1)} %`;
  return fill === 0 ? `${pct} (seca)` : fill === 1 ? `${pct} (llena)` : pct;
}

/** Filas clave/valor de la grieta de entrada para «Datos del modelo»; vacío sin grieta. */
export function crackInputRows(model: Pick<ModelDoc, 'analysis' | 'units'>): [string, string][] {
  const c = model.analysis.tension_crack;
  if (!c) return [];
  return [
    ['Grieta de tracción', 'Sí'],
    ['Profundidad de la grieta', crackDepthSetting(c, model.units)],
    ['Fracción de agua en la grieta', waterFillText(c.water_fill)],
  ];
}

/**
 * Tabla de la grieta por método: x_c, profundidad usada (la fija o la automática en x_c), fracción de agua y Pw por metro de talud.
 * `waterFill` es la del modelo (`null` si no se conoce: la celda queda en blanco).
 */
export function crackTable(records: readonly CrackRecord[], units: string | null | undefined, waterFill: number | null | undefined): { header: string[]; rows: string[][] } {
  const u = crackUnits(units);
  return {
    header: ['Método', `x_c (${u.length})`, `Profundidad (${u.length})`, 'Agua en la grieta', `Pw (${u.line})`],
    // E15l-15: con `depth ≤ 0` no hay grieta: ni x_c, ni porcentaje de agua, ni Pw.
    rows: records.map((r) =>
      isNoCrack(r)
        ? [METHOD_NAME[r.method], DASH, NO_CRACK_TEXT, DASH, DASH]
        : [METHOD_NAME[r.method], num(r.x), num(r.depth), waterFill === null || waterFill === undefined ? DASH : waterFillText(waterFill), num(r.force)],
    ),
  };
}

const METHOD_NAME: Record<MethodKind, string> = {
  bishop: 'Bishop simplificado',
  spencer: 'Spencer',
  morgenstern_price: 'Morgenstern-Price',
  janbu_simplified: 'Janbu simplificado',
  janbu_corrected: 'Janbu corregido',
};

/** Resumen del agua embalsada del modelo: calado máximo y si existe. `null` sin agua sobre el terreno. */
export function pondSummary(model: Pick<ModelDoc, 'regions' | 'water' | 'units'>): { maxDepth: number; text: string } | null {
  const line = model.water?.piezometric_line;
  if (!line || line.length === 0) return null;
  if (pondPolygons(model.regions, line).length === 0) return null;
  const maxDepth = pondMaxDepth(model.regions, line);
  return { maxDepth, text: `Agua embalsada: calado máximo ${num(maxDepth, 2)} ${lengthUnitOf(model.units)}. ${POND_NOTE}` };
}

/** Columnas del CSV de resultados cuando algún método trae grieta: `grieta_x_<L>`, `grieta_profundidad_<L>` y `grieta_pw_<F>`. */
export function crackCsvHeader(units: string | null | undefined): string[] {
  const imperial = forceUnit(units) === 'lbf/ft';
  const L = lengthUnitOf(units);
  return [`grieta_x_${L}`, `grieta_profundidad_${L}`, `grieta_pw_${imperial ? 'lbf_ft' : 'kn_m'}`];
}
