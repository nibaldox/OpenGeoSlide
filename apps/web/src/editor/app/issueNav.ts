// Destino de una incidencia de Diagnósticos (R7-11): pestaña del panel lateral, elemento a seleccionar y campo donde
// poner el foco. Lógica pura. Una incidencia sin destino real no se muestra como botón.

import { selectionForPath } from '../panels/forms';
import type { ModelDoc, Selection } from '../types';

export type PanelTabId = 'geometry' | 'materials' | 'water' | 'surface' | 'search' | 'analysis' | 'loads' | 'seismic';

export interface IssueTarget {
  /** Pestaña del panel lateral que se abre (`null`: el destino es el lienzo). */
  tab: PanelTabId | null;
  selection: Selection;
  /** Valor de `data-path` del campo que recibe el foco; `null` = primer control de la pestaña (o el lienzo). */
  fieldPath: string | null;
}

const ANALYSIS_FIELDS = new Set(['slices', 'tolerance', 'max_iterations', 'min_m_alpha', 'methods']);
const SEARCH_FIELDS = new Set(['n_entry', 'n_exit', 'n_radius', 'max_radius_factor', 'min_width']);
const MATERIAL_FIELDS = new Set(['name', 'unit_weight', 'unit_weight_sat', 'cohesion', 'friction_angle', 'ru']);

function index(seg: string | undefined): number | null {
  return seg !== undefined && /^\d+$/.test(seg) ? Number(seg) : null;
}

/** Destino navegable de `path` (puntero JSON) o `null` si no hay ninguno. */
export function issueTarget(path: string | null, doc: ModelDoc): IssueTarget | null {
  if (path === null || path === '') return null;
  const seg = path.split('/').slice(1);
  const [a, b, c, d] = seg;
  const selection = selectionForPath(path, doc);

  if (a === 'regions') {
    const k = index(b);
    if (k === null || k >= doc.regions.length) return null;
    if (c === 'material') return { tab: 'materials', selection, fieldPath: `/regions/${k}/material` };
    // Contorno, vértice o solape: la pestaña «Geometría» muestra la región con sus incidencias y la tabla de vértices.
    const v = c === 'polygon' ? index(d) : null;
    const vertex = v !== null && v < (doc.regions[k]?.polygon.length ?? 0) ? v : 0;
    return { tab: 'geometry', selection, fieldPath: `/regions/${k}/polygon/${vertex}/x` };
  }
  if (a === 'materials') {
    const k = index(b);
    if (k === null || k >= doc.materials.length) return null;
    const field = c !== undefined && MATERIAL_FIELDS.has(c) ? c : 'name';
    return { tab: 'materials', selection, fieldPath: `/materials/${k}/${field}` };
  }
  if (a === 'water') {
    if (b === 'unit_weight') return { tab: 'water', selection, fieldPath: '/water/unit_weight' };
    if (b === 'piezometric_line') {
      const k = index(c);
      const n = doc.water?.piezometric_line?.length ?? 0;
      if (k !== null && k < n) return { tab: 'water', selection, fieldPath: `/water/piezometric_line/${k}/x` };
      return { tab: 'water', selection, fieldPath: null };
    }
    return null;
  }
  if (a === 'loads') {
    const k = index(b);
    if (k === null) return { tab: 'loads', selection, fieldPath: null };
    if (k >= (doc.loads?.length ?? 0)) return null;
    return { tab: 'loads', selection, fieldPath: `/loads/${k}/${c ?? 'x'}` };
  }
  if (a === 'analysis') {
    if (b === undefined) return { tab: 'surface', selection, fieldPath: null };
    if (ANALYSIS_FIELDS.has(b)) return { tab: 'analysis', selection, fieldPath: `/analysis/${b}` };
    if (b === 'surface') return { tab: 'surface', selection, fieldPath: c === 'r' || c === 'xc' || c === 'yc' ? `/analysis/surface/${c}` : '/analysis/surface/xc' };
    if (b === 'seismic') return { tab: 'seismic', selection, fieldPath: `/analysis/seismic/${c === 'kv' ? 'kv' : 'kh'}` };
    if (b === 'search') {
      if (c === 'entry' || c === 'exit') return { tab: 'search', selection, fieldPath: `/analysis/search/${c}/${d === 'hi' ? 'hi' : 'lo'}` };
      if (c !== undefined && SEARCH_FIELDS.has(c)) return { tab: 'search', selection, fieldPath: `/analysis/search/${c}` };
      return { tab: 'search', selection, fieldPath: null };
    }
  }
  return null;
}

/** Selector CSS del campo con `data-path` = `fieldPath` (los punteros solo llevan letras, cifras, `_` y `/`; se escapa por si acaso). */
export function fieldSelector(fieldPath: string): string {
  return `[data-path="${fieldPath.replace(/["\\]/g, '\\$&')}"]`;
}
