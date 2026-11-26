// Herramienta «Dibujar refuerzo» (tecla E): dos clics, la cabeza y la punta. Máquina de estados pura sobre el mismo borrador, el
// mismo ajuste y el mismo cursor de teclado que las demás herramientas de trazo (`draw.ts`); no entra en el historial hasta
// el segundo punto, que emite UN solo `reinforcement/upsert` (un paso deshacible) y vuelve a «Seleccionar».
//
//   ratón y táctil: el clic (o toque) suelta un punto con el ajuste a vértices, aristas, ejes y rejilla: el primero es la
//     cabeza (en el paramento o en la superficie del terreno) y el segundo la punta, dentro del suelo.
//   teclado: flechas (cursor), Espacio o Intro colocan el punto; Retroceso lo quita y Esc cancela.
//   Tablestaca: es vertical, así que la punta toma la x de la cabeza.

import type { Point } from '../../engine/types';
import {
  EMPTY_DRAFT,
  coords,
  noStep,
  reject,
  same,
  snapAt,
  snapNote,
  toolKey,
  type DrawDraft,
  type DrawKeyInput,
  type DrawKeyResult,
  type DrawStep,
  type ToolOps,
} from './draw';
import type { CanvasAction, GestureContext, PointerInput } from './gesture';
import { REINFORCEMENT_TYPE_LABEL, newReinforcement, nextReinforcementId, type ReinforcementType } from './reinforcements';
import type { SnapKind } from './snap';

/** Instrucciones de la herramienta, para el lienzo y la ayuda. */
export const REINFORCE_INSTRUCTIONS =
  'Dibujar refuerzo: elija el tipo (Anclaje, Clavo, Geosintético, Pilote o Tablestaca). El primer clic, toque o Espacio marca la cabeza, en el paramento o en la superficie del terreno, ' +
  'y el segundo la punta, dentro del suelo. Con el teclado, las flechas mueven el cursor (Mayús ×10, Ctrl ×100). ' +
  'La tablestaca es vertical: su punta toma la x de la cabeza. Retroceso quita el punto y Esc cancela.';

export const REINFORCE_SAME_POINT = 'La punta coincide con la cabeza. Elija otro lugar.';

/** Con una tablestaca el cursor de la punta conserva la x de la cabeza. Sin esa condición, el borrador no cambia. */
export function constrainReinforceDraft(tool: string, type: ReinforcementType, draft: DrawDraft): DrawDraft {
  if (tool !== 'draw_reinforcement' || type !== 'sheet_pile' || draft.points.length !== 1 || !draft.cursor) return draft;
  const head = draft.points[0] as Point;
  return draft.cursor[0] === head[0] ? draft : { ...draft, cursor: [head[0], draft.cursor[1]] };
}

/** Coloca un punto: el primero es la cabeza; el segundo crea el refuerzo. */
export function reinforcePlace(type: ReinforcementType, draft: DrawDraft, ctx: GestureContext, p: Point, kind: SnapKind = 'none'): DrawStep {
  if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) return noStep(draft);
  const { doc } = ctx;
  const name = REINFORCEMENT_TYPE_LABEL[type];
  if (draft.points.length === 0) {
    const hint = type === 'sheet_pile' ? ' La tablestaca es vertical: marque la punta arriba o abajo.' : ' Marque la punta, dentro del suelo.';
    return { draft: { points: [[p[0], p[1]]], cursor: [p[0], p[1]], pending: false, snapKind: 'none' }, actions: [], announce: `Cabeza colocada${snapNote(kind)}: ${coords(p, doc.units)}.${hint}` };
  }
  const head = draft.points[0] as Point;
  const tip: Point = type === 'sheet_pile' ? [head[0], p[1]] : [p[0], p[1]];
  if (same(tip, head)) return reject(draft, REINFORCE_SAME_POINT);
  const index = doc.reinforcements?.length ?? 0;
  const id = nextReinforcementId(doc, type);
  const reinforcement = newReinforcement(type, id, head, tip, doc.units);
  const actions: CanvasAction[] = [
    { type: 'reinforcement/upsert', index: null, reinforcement },
    { type: 'ui/select', selection: { kind: 'reinforcement', index } },
    { type: 'ui/tool', tool: 'select' },
  ];
  return {
    draft: EMPTY_DRAFT,
    actions,
    announce: `Refuerzo ${index + 1} (${name}) creado: cabeza ${coords(head, doc.units)}; punta ${coords(tip, doc.units)}${snapNote(kind)}. Edite sus datos en el panel «Refuerzos». Ctrl+Z lo deshace.`,
  };
}

/** Clic o toque: suelta un punto con el ajuste a vértices, aristas, ejes y rejilla. */
export function reinforceClick(type: ReinforcementType, draft: DrawDraft, ctx: GestureContext, input: PointerInput): DrawStep {
  const s = snapAt(draft, ctx, input);
  return s ? reinforcePlace(type, draft, ctx, s.point, s.kind) : noStep(draft);
}

export function reinforceOps(type: ReinforcementType): ToolOps {
  return {
    place: (draft, ctx, p, kind) => reinforcePlace(type, draft, ctx, p, kind),
    finish: (draft) => reject(draft, 'Marque la cabeza y la punta con dos puntos.'),
    // Con un solo punto Intro coloca el segundo en el cursor; nunca «cierra».
    canFinish: () => false,
  };
}

export function reinforceKey(type: ReinforcementType, draft: DrawDraft, ctx: GestureContext, k: DrawKeyInput): DrawKeyResult {
  return toolKey(draft, ctx, k, reinforceOps(type));
}
