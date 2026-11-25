// Reductor puro del editor (X3 §2.1, brief F1-W/W1). Ninguna función de este módulo muta sus argumentos.
//
// Reglas:
//  - un cambio de `doc` empuja el documento anterior a `history.past` (máximo 200), vacía `future` y sube `revision`;
//  - las `UiAction` nunca entran en el historial;
//  - dentro de un gesto (`beginGesture`) las acciones modifican `doc` pero no apilan; `endGesture` apila una sola
//    entrada (`gesture.before`) y `cancelGesture` restaura `before`;
//  - un comando inválido o que no cambia nada devuelve **el mismo objeto de estado** (sin historial ni revisión);
//  - el último elemento de `past` es el documento inmediatamente anterior; el de `future`, el siguiente al rehacer.

import type { Material, Point, Region } from '../../engine/types';
import type {
  EditorCommand,
  EditorState,
  EditorUi,
  ModelDoc,
  Selection,
  UiAction,
} from '../types';
import { allFinite, copyPoints, deepEqual, isFiniteNumber, isPoint, isPointList } from './docUtils';

export const HISTORY_LIMIT = 200;

export const DEFAULT_SNAP: EditorUi['snap'] = { vertex: true, axis: true, gridStep: null, radiusPx: 10 };

export function createInitialState(doc: ModelDoc, fileName: string | null = null): EditorState {
  return {
    doc,
    revision: 0,
    ui: { tool: 'select', selection: { kind: 'none' }, viewport: null, snap: { ...DEFAULT_SNAP } },
    history: { past: [], future: [] },
    file: { name: fileName, savedRevision: 0 },
    diagnostics: { status: 'idle', issues: [], revision: 0 },
    gesture: null,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Comandos sobre el documento
// ---------------------------------------------------------------------------------------------------------------

type Mutable = Record<string, unknown>;

/** Copia superficial de `base` aplicando `patch`; un valor `undefined` elimina la clave. */
function mergePatch<T extends object>(base: T, patch: object): T {
  const out: Mutable = { ...(base as Mutable) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete out[key];
    else out[key] = value;
  }
  return out as T;
}

function omitKey<T extends object>(base: T, key: string): T {
  const out: Mutable = { ...(base as Mutable) };
  delete out[key];
  return out as T;
}

function inRange(index: number, length: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < length;
}

function ensureV02(doc: ModelDoc): ModelDoc {
  return doc.version === '0.2' ? doc : { ...doc, version: '0.2' };
}

export function materialInUse(doc: ModelDoc, materialId: string): boolean {
  return doc.regions.some((r) => r.material === materialId);
}

function hasMaterial(doc: ModelDoc, materialId: string): boolean {
  return doc.materials.some((m) => m.id === materialId);
}

function isLoad(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.id !== undefined && v.id !== null && typeof v.id !== 'string') return false;
  if (v.type === 'udl') return isFiniteNumber(v.x1) && isFiniteNumber(v.x2) && isFiniteNumber(v.q);
  if (v.type === 'line') return isFiniteNumber(v.x) && isFiniteNumber(v.p) && isFiniteNumber(v.angle);
  return false;
}

function isMaterial(value: unknown): value is Material {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === 'string' &&
    m.id !== '' &&
    typeof m.name === 'string' &&
    m.model === 'mohr_coulomb' &&
    isFiniteNumber(m.unit_weight) &&
    isFiniteNumber(m.cohesion) &&
    isFiniteNumber(m.friction_angle) &&
    (m.unit_weight_sat === undefined || m.unit_weight_sat === null || isFiniteNumber(m.unit_weight_sat)) &&
    (m.ru === undefined || m.ru === null || isFiniteNumber(m.ru))
  );
}

function withRegionPolygon(doc: ModelDoc, regionIndex: number, polygon: Point[]): ModelDoc {
  const regions = doc.regions.map((r, i): Region => (i === regionIndex ? { ...r, polygon } : r));
  return { ...doc, regions };
}

function withAnalysis(doc: ModelDoc, patch: object): ModelDoc {
  return { ...doc, analysis: mergePatch(doc.analysis, patch) };
}

/**
 * Aplica un comando al documento. Devuelve `null` si el comando es inválido (índice fuera de rango, valor no
 * finito, `material/remove` de un material en uso, `vertex/remove` que dejaría menos de 3 vértices, ...).
 * Puede devolver el mismo documento (misma referencia) o uno igual si el comando no cambia nada.
 */
export function applyCommand(doc: ModelDoc, cmd: EditorCommand): ModelDoc | null {
  switch (cmd.type) {
    case 'vertex/move': {
      const region = doc.regions[cmd.regionIndex];
      if (!region || !inRange(cmd.vertexIndex, region.polygon.length) || !isPoint(cmd.to)) return null;
      const polygon = region.polygon.map((p, i): Point => (i === cmd.vertexIndex ? [cmd.to[0], cmd.to[1]] : p));
      return withRegionPolygon(doc, cmd.regionIndex, polygon);
    }
    case 'vertex/insert': {
      const region = doc.regions[cmd.regionIndex];
      if (!region || !inRange(cmd.afterIndex, region.polygon.length) || !isPoint(cmd.at)) return null;
      const polygon = [...region.polygon];
      polygon.splice(cmd.afterIndex + 1, 0, [cmd.at[0], cmd.at[1]]);
      return withRegionPolygon(doc, cmd.regionIndex, polygon);
    }
    case 'vertex/remove': {
      const region = doc.regions[cmd.regionIndex];
      if (!region || !inRange(cmd.vertexIndex, region.polygon.length) || region.polygon.length <= 3) return null;
      return withRegionPolygon(
        doc,
        cmd.regionIndex,
        region.polygon.filter((_, i) => i !== cmd.vertexIndex),
      );
    }
    case 'region/add': {
      const r = cmd.region as unknown;
      if (typeof r !== 'object' || r === null) return null;
      const { material, polygon } = cmd.region;
      if (typeof material !== 'string' || !hasMaterial(doc, material)) return null;
      if (!isPointList(polygon) || polygon.length < 3) return null;
      return { ...doc, regions: [...doc.regions, { material, polygon: copyPoints(polygon) }] };
    }
    case 'region/remove': {
      if (!inRange(cmd.regionIndex, doc.regions.length)) return null;
      return { ...doc, regions: doc.regions.filter((_, i) => i !== cmd.regionIndex) };
    }
    case 'region/setMaterial': {
      if (!inRange(cmd.regionIndex, doc.regions.length) || !hasMaterial(doc, cmd.materialId)) return null;
      return {
        ...doc,
        regions: doc.regions.map((r, i): Region => (i === cmd.regionIndex ? { ...r, material: cmd.materialId } : r)),
      };
    }
    case 'material/upsert': {
      if (!isMaterial(cmd.material)) return null;
      const material: Material = { ...cmd.material };
      const index = doc.materials.findIndex((m) => m.id === material.id);
      const materials =
        index < 0 ? [...doc.materials, material] : doc.materials.map((m, i) => (i === index ? material : m));
      return { ...doc, materials };
    }
    case 'material/remove': {
      if (!hasMaterial(doc, cmd.materialId) || materialInUse(doc, cmd.materialId)) return null;
      return { ...doc, materials: doc.materials.filter((m) => m.id !== cmd.materialId) };
    }
    case 'water/setUnitWeight': {
      if (cmd.value === undefined) {
        if (!doc.water || doc.water.unit_weight === undefined) return doc;
        return { ...doc, water: omitKey(doc.water, 'unit_weight') };
      }
      if (!isFiniteNumber(cmd.value)) return null;
      return { ...doc, water: { ...(doc.water ?? {}), unit_weight: cmd.value } };
    }
    case 'piezo/set': {
      if (cmd.points === null) {
        if (!doc.water || doc.water.piezometric_line === undefined || doc.water.piezometric_line === null) return doc;
        return { ...doc, water: omitKey(doc.water, 'piezometric_line') };
      }
      if (!isPointList(cmd.points)) return null;
      return { ...doc, water: { ...(doc.water ?? {}), piezometric_line: copyPoints(cmd.points) } };
    }
    case 'surface/set': {
      if (cmd.surface !== null && (!allFinite(cmd.surface) || cmd.surface.type !== 'circle')) return null;
      return withAnalysis(doc, { surface: cmd.surface === null ? null : { ...cmd.surface } });
    }
    case 'search/set': {
      if (cmd.search !== null && (!allFinite(cmd.search) || cmd.search.type !== 'circular_entry_exit')) return null;
      return withAnalysis(doc, { search: cmd.search === null ? null : { ...cmd.search } });
    }
    case 'analysis/patch': {
      if (typeof cmd.patch !== 'object' || cmd.patch === null || !allFinite(cmd.patch)) return null;
      const next = withAnalysis(doc, cmd.patch);
      const seismic = next.analysis.seismic;
      return seismic !== undefined && seismic !== null ? ensureV02(next) : next;
    }
    case 'slope/setDirection': {
      if (cmd.direction !== 'auto' && cmd.direction !== 'left_to_right' && cmd.direction !== 'right_to_left') return null;
      return { ...doc, slope: { ...(doc.slope ?? {}), direction: cmd.direction } };
    }
    case 'meta/patch': {
      if (typeof cmd.patch !== 'object' || cmd.patch === null) return null;
      return { ...doc, meta: mergePatch(doc.meta, cmd.patch) };
    }
    case 'seismic/set': {
      if (cmd.seismic === null) {
        if (doc.analysis.seismic === undefined) return doc;
        return { ...doc, analysis: omitKey(doc.analysis, 'seismic') };
      }
      if (!isFiniteNumber(cmd.seismic.kh) || !isFiniteNumber(cmd.seismic.kv)) return null;
      return ensureV02(withAnalysis(doc, { seismic: { kh: cmd.seismic.kh, kv: cmd.seismic.kv } }));
    }
    case 'loads/set': {
      if (!Array.isArray(cmd.loads) || !cmd.loads.every(isLoad)) return null;
      if (cmd.loads.length === 0 && doc.loads === undefined) return doc;
      const next: ModelDoc = { ...doc, loads: cmd.loads.map((l) => ({ ...l })) };
      return cmd.loads.length > 0 ? ensureV02(next) : next;
    }
    case 'load/upsert': {
      const loads = doc.loads ?? [];
      if (!isLoad(cmd.load)) return null;
      if (cmd.index !== null && !inRange(cmd.index, loads.length)) return null;
      const load = { ...cmd.load };
      const next = cmd.index === null ? [...loads, load] : loads.map((l, i) => (i === cmd.index ? load : l));
      return ensureV02({ ...doc, loads: next });
    }
    case 'load/remove': {
      const loads = doc.loads ?? [];
      if (!inRange(cmd.index, loads.length)) return null;
      return { ...doc, loads: loads.filter((_, i) => i !== cmd.index) };
    }
    case 'doc/replace':
    case 'doc/load': {
      if (typeof cmd.doc !== 'object' || cmd.doc === null) return null;
      return cmd.doc;
    }
  }
}

/** ¿Se puede aplicar el comando a este documento? (`false` = el reductor lo ignoraría por inválido). */
export function canApply(doc: ModelDoc, cmd: EditorCommand): boolean {
  return applyCommand(doc, cmd) !== null;
}

// ---------------------------------------------------------------------------------------------------------------
// Selección coherente con el documento
// ---------------------------------------------------------------------------------------------------------------

const NONE: Selection = { kind: 'none' };

/** ¿La selección apunta a un elemento que existe en el documento? */
export function isSelectionValid(sel: Selection, doc: ModelDoc): boolean {
  switch (sel.kind) {
    case 'none':
      return true;
    case 'vertex': {
      const region = doc.regions[sel.regionIndex];
      return region !== undefined && inRange(sel.vertexIndex, region.polygon.length);
    }
    case 'region':
      return inRange(sel.regionIndex, doc.regions.length);
    case 'material':
      return hasMaterial(doc, sel.materialId);
    case 'piezo_point':
      return inRange(sel.index, doc.water?.piezometric_line?.length ?? 0);
    case 'surface_circle':
      return doc.analysis.surface !== undefined && doc.analysis.surface !== null;
    case 'search_range':
      return doc.analysis.search !== undefined && doc.analysis.search !== null;
    case 'load':
      return inRange(sel.index, doc.loads?.length ?? 0);
  }
}

/** Reubica los índices de la selección tras insertar o quitar elementos; lo que desaparece pasa a `none`. */
function remapSelection(sel: Selection, cmd: EditorCommand): Selection {
  switch (cmd.type) {
    case 'region/remove':
      if (sel.kind === 'vertex' || sel.kind === 'region') {
        if (sel.regionIndex === cmd.regionIndex) return NONE;
        if (sel.regionIndex > cmd.regionIndex) return { ...sel, regionIndex: sel.regionIndex - 1 };
      }
      return sel;
    case 'vertex/remove':
      if (sel.kind === 'vertex' && sel.regionIndex === cmd.regionIndex) {
        if (sel.vertexIndex === cmd.vertexIndex) return { kind: 'region', regionIndex: sel.regionIndex };
        if (sel.vertexIndex > cmd.vertexIndex) return { ...sel, vertexIndex: sel.vertexIndex - 1 };
      }
      return sel;
    case 'vertex/insert':
      if (sel.kind === 'vertex' && sel.regionIndex === cmd.regionIndex && sel.vertexIndex > cmd.afterIndex) {
        return { ...sel, vertexIndex: sel.vertexIndex + 1 };
      }
      return sel;
    case 'load/remove':
      if (sel.kind === 'load') {
        if (sel.index === cmd.index) return NONE;
        if (sel.index > cmd.index) return { kind: 'load', index: sel.index - 1 };
      }
      return sel;
    default:
      return sel;
  }
}

function fixSelection(sel: Selection, doc: ModelDoc): Selection {
  return isSelectionValid(sel, doc) ? sel : NONE;
}

// ---------------------------------------------------------------------------------------------------------------
// Transiciones de estado
// ---------------------------------------------------------------------------------------------------------------

export function pushPast(past: readonly ModelDoc[], doc: ModelDoc): ModelDoc[] {
  const next = [...past, doc];
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
}

/**
 * Fija un nuevo documento: sube `revision`, deja el diagnóstico en `stale` (si ya se había calculado) y corrige la
 * selección. `pushHistory` indica si el documento anterior entra en `past` (falso dentro de un gesto y al deshacer).
 */
export function withDoc(
  state: EditorState,
  doc: ModelDoc,
  options: { history: EditorState['history']; selection?: Selection; file?: EditorState['file'] },
): EditorState {
  const revision = state.revision + 1;
  const diagnostics =
    state.diagnostics.status === 'idle' || state.diagnostics.status === 'stale'
      ? state.diagnostics
      : { ...state.diagnostics, status: 'stale' as const };
  const selection = fixSelection(options.selection ?? state.ui.selection, doc);
  return {
    ...state,
    doc,
    revision,
    history: options.history,
    file: options.file ?? state.file,
    diagnostics,
    ui: selection === state.ui.selection ? state.ui : { ...state.ui, selection },
  };
}

function reduceCommand(state: EditorState, cmd: EditorCommand): EditorState {
  const next = applyCommand(state.doc, cmd);
  if (next === null) return state;
  if (cmd.type === 'doc/load') {
    // Otro documento: el historial y el gesto del anterior no le pertenecen (Ctrl+Z no debe mezclar modelos, R7-08).
    // No se marca como guardado: quien carga lo decide (`markSaved`; un borrador recuperado sigue sin guardar).
    return withDoc({ ...state, gesture: null }, next, {
      history: { past: [], future: [] },
      selection: NONE,
      file: { name: cmd.fileName, savedRevision: state.file.savedRevision },
    });
  }
  const isReplace = cmd.type === 'doc/replace';
  if (!isReplace && (next === state.doc || deepEqual(next, state.doc))) return state;
  const history: EditorState['history'] = state.gesture
    ? state.history
    : { past: pushPast(state.history.past, state.doc), future: [] };
  if (isReplace) {
    const revision = state.revision + 1;
    return withDoc(state, next, {
      history,
      selection: NONE,
      file: { name: cmd.fileName, savedRevision: cmd.fileName !== null ? revision : state.file.savedRevision },
    });
  }
  return withDoc(state, next, { history, selection: remapSelection(state.ui.selection, cmd) });
}

function snapPatchValid(patch: Partial<EditorUi['snap']>): boolean {
  if (typeof patch !== 'object' || patch === null) return false;
  if (patch.vertex !== undefined && typeof patch.vertex !== 'boolean') return false;
  if (patch.axis !== undefined && typeof patch.axis !== 'boolean') return false;
  if (patch.gridStep !== undefined && patch.gridStep !== null && !(isFiniteNumber(patch.gridStep) && patch.gridStep > 0)) return false;
  if (patch.radiusPx !== undefined && !(isFiniteNumber(patch.radiusPx) && patch.radiusPx > 0)) return false;
  return true;
}

function reduceUi(state: EditorState, action: UiAction): EditorState {
  switch (action.type) {
    case 'ui/select': {
      if (!isSelectionValid(action.selection, state.doc) || deepEqual(action.selection, state.ui.selection)) return state;
      return { ...state, ui: { ...state.ui, selection: action.selection } };
    }
    case 'ui/tool': {
      if (action.tool !== 'select' && action.tool !== 'add_vertex' && action.tool !== 'draw_region' && action.tool !== 'pan') return state;
      return action.tool === state.ui.tool ? state : { ...state, ui: { ...state.ui, tool: action.tool } };
    }
    case 'ui/viewport': {
      const a = action.viewport;
      const b = state.ui.viewport;
      if (a === b || deepEqual(a, b)) return state;
      if (a !== null && !allFinite(a)) return state;
      return { ...state, ui: { ...state.ui, viewport: a } };
    }
    case 'ui/snap': {
      if (!snapPatchValid(action.patch)) return state;
      const snap = mergePatch(state.ui.snap, action.patch) as EditorUi['snap'];
      return deepEqual(snap, state.ui.snap) ? state : { ...state, ui: { ...state.ui, snap } };
    }
  }
}

/** Reductor principal. Función pura: no muta `state` ni `action`. */
export function reduce(state: EditorState, action: EditorCommand | UiAction): EditorState {
  return action.type.startsWith('ui/') ? reduceUi(state, action as UiAction) : reduceCommand(state, action as EditorCommand);
}

// ---------------------------------------------------------------------------------------------------------------
// Gestos
// ---------------------------------------------------------------------------------------------------------------

/** Abre un gesto. Si ya hay uno abierto se ignora (conserva el primero). */
export function beginGesture(state: EditorState, label: string): EditorState {
  return state.gesture ? state : { ...state, gesture: { label, before: state.doc } };
}

/** Cierra el gesto: una sola entrada de historial (`before`) si el documento cambió. */
export function endGesture(state: EditorState): EditorState {
  const gesture = state.gesture;
  if (!gesture) return state;
  if (gesture.before === state.doc || deepEqual(gesture.before, state.doc)) return { ...state, gesture: null };
  return { ...state, gesture: null, history: { past: pushPast(state.history.past, gesture.before), future: [] } };
}

/** Cancela el gesto y restaura el documento previo. No deja rastro en el historial. */
export function cancelGesture(state: EditorState): EditorState {
  const gesture = state.gesture;
  if (!gesture) return state;
  if (gesture.before === state.doc) return { ...state, gesture: null };
  const restored = withDoc({ ...state, gesture: null }, gesture.before, { history: state.history });
  return restored;
}

/** Marca la revisión actual como guardada (`file.savedRevision`). Opcionalmente fija el nombre del archivo. */
export function markSaved(state: EditorState, fileName?: string | null): EditorState {
  const name = fileName === undefined ? state.file.name : fileName;
  if (state.file.savedRevision === state.revision && state.file.name === name) return state;
  return { ...state, file: { name, savedRevision: state.revision } };
}
