// Herramienta «Dividir región» (tecla D): una polilínea que entra y sale del borde de una región la parte en dos, con vértices
// compartidos y en UN solo paso deshacible. Máquina de estados pura, sobre el mismo borrador y el mismo cursor de teclado que
// «Dibujar región» (`draw.ts`); la geometría está en `regionOps.ts`.
//
//   ratón y táctil: cada clic agrega un punto con el ajuste a vértices y aristas; un clic sobre el borde, con la línea ya empezada,
//     intenta dividir. Si la línea todavía no atraviesa la región (por ejemplo, empezó fuera), el punto se agrega y se sigue.
//   teclado: flechas, Espacio e Intro como en «Dibujar región»; Intro sin cursor pendiente divide con los puntos colocados.

import type { Material, Point } from '../../engine/types';
import { validateLocal } from '../state/validateLocal';
import type { ModelDoc, Selection } from '../types';
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
import { insertionCommands, sharedInsertions, splitMessage, splitRegion, type SplitFailure, type SplitResult } from './regionOps';
import type { SnapKind } from './snap';

/** Instrucciones de la herramienta, para el lienzo y la ayuda. */
export const SPLIT_INSTRUCTIONS =
  'Dividir región: trace una línea que entre y salga del borde de una región. Cada clic, toque o Espacio agrega un punto; ' +
  'un clic en el borde, o Intro, divide la región en dos (un solo paso deshacible). ' +
  'La región nueva recibe el material seleccionado, o un material nuevo. Retroceso quita el último punto y Esc cancela.';

export type SplitPlan =
  | { ok: true; actions: CanvasAction[]; announce: string; regionIndex: number; newIndex: number }
  | { ok: false; reason: SplitFailure | 'ambiguous' | 'invalid'; message: string };

function selectedRegion(selection: Selection): number | null {
  return selection.kind === 'region' || selection.kind === 'vertex' ? selection.regionIndex : null;
}

/** Identificador y nombre de un material nuevo, sin repetir los existentes: «estrato-2» / «Estrato 2». */
export function newMaterialIdentity(doc: ModelDoc): { id: string; name: string } {
  const ids = new Set(doc.materials.map((m) => m.id));
  const names = new Set(doc.materials.map((m) => m.name));
  for (let n = doc.materials.length + 1; ; n += 1) {
    const id = `estrato-${n}`;
    const name = `Estrato ${n}`;
    if (!ids.has(id) && !names.has(name)) return { id, name };
  }
}

const REASON_ORDER: SplitFailure[] = ['many_hits', 'on_boundary', 'self_intersect', 'outside', 'same_point', 'degenerate'];

/**
 * Plan de la división con la polilínea `points`: qué región se divide, la parte nueva y su material, y las acciones del store
 * (un solo gesto). La región es la seleccionada si la línea la divide; si no, la única que la línea divide.
 */
export function planSplit(doc: ModelDoc, selection: Selection, points: readonly Point[]): SplitPlan {
  if (points.length < 2) return { ok: false, reason: 'too_short', message: splitMessage('too_short') };
  if (doc.regions.length === 0) return { ok: false, reason: 'few_hits', message: 'El modelo no tiene regiones que dividir. Dibuje una región primero (tecla R).' };
  const results: { index: number; r: SplitResult }[] = doc.regions.map((region, index) => ({ index, r: splitRegion(region.polygon, points) }));
  const valid = results.filter((x): x is { index: number; r: Extract<SplitResult, { ok: true }> } => x.r.ok);
  if (valid.length === 0) {
    const failures = results.map((x) => (x.r.ok ? null : x.r.reason));
    const reason = REASON_ORDER.find((o) => failures.includes(o)) ?? ('few_hits' as const);
    return { ok: false, reason, message: splitMessage(reason) };
  }
  const chosenIndex = selectedRegion(selection);
  const pick = valid.find((x) => x.index === chosenIndex) ?? (valid.length === 1 ? valid[0] : undefined);
  if (!pick) {
    const list = valid.map((x) => x.index + 1).join(', ');
    return { ok: false, reason: 'ambiguous', message: `La línea divide varias regiones (${list}). Seleccione la región que quiere dividir (herramienta Seleccionar, clic en ella) y vuelva a pulsar D.` };
  }
  const { index, r } = pick;
  const region = doc.regions[index]!;
  const source: Material | undefined = doc.materials.find((m) => m.id === region.material);

  // Material de la región nueva: el seleccionado en el panel (si no es el de la región) o uno nuevo con los mismos parámetros.
  const wanted = selection.kind === 'material' && selection.materialId !== region.material ? doc.materials.find((m) => m.id === selection.materialId) : undefined;
  const upsert: CanvasAction[] = [];
  let materialId: string;
  let materialName: string;
  if (wanted) {
    materialId = wanted.id;
    materialName = wanted.name;
  } else {
    const ident = newMaterialIdentity(doc);
    materialId = ident.id;
    materialName = ident.name;
    const base: Material = source ?? { id: ident.id, name: ident.name, model: 'mohr_coulomb', unit_weight: 18, cohesion: 5, friction_angle: 30, unit_weight_sat: null, ru: null };
    upsert.push({ type: 'material/upsert', material: { ...base, id: ident.id, name: ident.name } });
  }

  const newIndex = doc.regions.length;
  const shared = sharedInsertions(doc, [r.entry.point, r.exit.point], index);
  // Comprobación final con las mismas reglas del editor (polígonos simples, sin solape): solo cuentan las dos regiones resultantes.
  const trial: ModelDoc = {
    ...doc,
    materials: wanted ? doc.materials : [...doc.materials, { ...(source ?? ({} as Material)), id: materialId, name: materialName } as Material],
    regions: [...doc.regions.map((x, i) => (i === index ? { ...x, polygon: r.kept } : x)), { material: materialId, polygon: r.added }],
  };
  const own = (path: string | null): boolean => path !== null && [index, newIndex].some((i) => path === `/regions/${i}` || path.startsWith(`/regions/${i}/`));
  const bad = validateLocal(trial).find((i) => i.severity === 'error' && own(i.path));
  if (bad) return { ok: false, reason: 'invalid', message: bad.text.endsWith('.') ? bad.text : `${bad.text}.` };

  const regionName = doc.materials.find((m) => m.id === region.material)?.name ?? region.material;
  const actions: CanvasAction[] = [
    { type: 'gesture/begin', label: 'Dividir región' },
    ...upsert,
    { type: 'region/setPolygon', regionIndex: index, polygon: r.kept },
    { type: 'region/add', region: { material: materialId, polygon: r.added } },
    ...insertionCommands(shared),
    { type: 'gesture/end' },
    { type: 'ui/select', selection: { kind: 'region', regionIndex: newIndex } },
    { type: 'ui/tool', tool: 'select' },
  ];
  const note = wanted ? '' : ` Material nuevo «${materialName}» con los parámetros de «${regionName}»: edítelos en Materiales.`;
  const sharedNote = shared.length > 0 ? ` El corte se comparte con ${shared.length === 1 ? 'una arista vecina' : `${shared.length} aristas vecinas`}.` : '';
  return {
    ok: true,
    actions,
    regionIndex: index,
    newIndex,
    announce: `Región ${index + 1} dividida en dos: la región ${index + 1} conserva «${regionName}» y la región ${newIndex + 1} recibe «${materialName}».${note}${sharedNote} Ctrl+Z deshace la división.`,
  };
}

const done = (plan: Extract<SplitPlan, { ok: true }>): DrawStep => ({ draft: EMPTY_DRAFT, actions: plan.actions, announce: plan.announce });

/** Agrega un punto (ya ajustado). Sobre el borde, con la línea empezada, intenta dividir; si aún no atraviesa la región, sigue. */
export function splitPlace(draft: DrawDraft, ctx: GestureContext, p: Point, kind: SnapKind = 'none'): DrawStep {
  if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) return noStep(draft);
  const n = draft.points.length;
  if (n > 0 && same(p, draft.points[n - 1] as Point)) return reject(draft, 'Ese punto coincide con el punto anterior. Elija otro lugar.');
  const points: Point[] = [...draft.points, [p[0], p[1]]];
  if (n >= 1 && (kind === 'edge' || kind === 'vertex')) {
    const plan = planSplit(ctx.doc, ctx.ui.selection, points);
    if (plan.ok) return done(plan);
    if (plan.reason !== 'few_hits' && plan.reason !== 'too_short') return reject(draft, plan.message);
  }
  const hint =
    points.length === 1
      ? ' Siga hasta el otro lado de la región: un clic en el borde, o Intro, la divide.'
      : ' Un clic en el borde, o Intro, divide la región.';
  return {
    draft: { points, cursor: [p[0], p[1]], pending: false, snapKind: 'none' },
    actions: [],
    announce: `Punto ${points.length} colocado${snapNote(kind)}: ${coords(p, ctx.doc.units)}.${hint}`,
  };
}

/** Intro sin cursor pendiente: divide con los puntos colocados, o explica qué falta. */
export function splitFinish(draft: DrawDraft, ctx: GestureContext): DrawStep {
  const plan = planSplit(ctx.doc, ctx.ui.selection, draft.points);
  return plan.ok ? done(plan) : reject(draft, plan.message);
}

/** Clic o toque: agrega un punto con el ajuste a vértices y aristas. */
export function splitClick(draft: DrawDraft, ctx: GestureContext, input: PointerInput): DrawStep {
  const s = snapAt(draft, ctx, input);
  return s ? splitPlace(draft, ctx, s.point, s.kind) : noStep(draft);
}

const SPLIT_OPS: ToolOps = {
  place: splitPlace,
  finish: splitFinish,
  canFinish: (draft) => draft.points.length >= 1 && !draft.pending,
};

export function splitKey(draft: DrawDraft, ctx: GestureContext, k: DrawKeyInput): DrawKeyResult {
  return toolKey(draft, ctx, k, SPLIT_OPS);
}
