// Destino de una incidencia de Diagnósticos (R7-11): pestaña del panel lateral, elemento a seleccionar y campo donde
// poner el foco. Lógica pura. Una incidencia sin destino real no se muestra como botón.

import { selectionForPath } from '../panels/forms';
import { matchesTarget, type TargetSpec } from '../../onboarding/tour';
import type { Issue, ModelDoc, Selection } from '../types';

export type PanelTabId = 'geometry' | 'materials' | 'water' | 'surface' | 'search' | 'analysis' | 'loads' | 'reinforcements' | 'seismic' | 'project';

export interface IssueTarget {
  /** Pestaña del panel lateral que se abre (`null`: el destino es el lienzo). */
  tab: PanelTabId | null;
  selection: Selection;
  /** Valor de `data-path` del campo que recibe el foco; `null` = primer control de la pestaña (o el lienzo). */
  fieldPath: string | null;
  /**
   * Controles fuera del panel (la barra o el lienzo) que reciben el foco, el primero visible de la lista (B-03). Tiene
   * prioridad sobre `fieldPath`. `EditorApp` lo aplica con `findIssueFocus`.
   */
  focus?: TargetSpec[];
}

/** «Dibujar región»: el botón del estado vacío del lienzo y, si no se ve, la herramienta de la barra. */
const DRAW_REGION_FOCUS: TargetSpec[] = [
  { selector: '.ns-empty button', text: '^Dibujar región' },
  { selector: '[aria-label=\"Herramienta del lienzo\"] button', text: '^Dibujar región' },
];

/** Primer control visible que cumple `target.focus`, o `null` (entonces se usa `fieldPath`). */
export function findIssueFocus(target: IssueTarget, root: ParentNode = document): HTMLElement | null {
  for (const spec of target.focus ?? []) {
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(spec.selector))) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && matchesTarget(spec, el.textContent ?? '')) return el;
    }
  }
  return null;
}

const ANALYSIS_FIELDS = new Set(['slices', 'tolerance', 'max_iterations', 'min_m_alpha', 'methods']);
const SEARCH_FIELDS = new Set(['n_entry', 'n_exit', 'n_radius', 'max_radius_factor', 'min_width']);
const META_FIELDS = new Set(['id', 'title', 'notes']);
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
    // Colección sin índice (`/regions`: modelo sin regiones): Geometría, con el foco en «Dibujar región».
    if (b === undefined) return { tab: 'geometry', selection, fieldPath: null, focus: DRAW_REGION_FOCUS };
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
  // Datos del proyecto: título, id y descripción (`meta`) y sistema de unidades (`units`) viven en la pestaña «Proyecto».
  if (a === 'meta') return { tab: 'project', selection, fieldPath: `/meta/${b !== undefined && META_FIELDS.has(b) ? b : 'title'}` };
  if (a === 'units') return { tab: 'project', selection, fieldPath: '/units' };
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
  if (a === 'reinforcements') {
    // Sin índice (`/reinforcements`): la pestaña. Los campos de `pullout` (`/reinforcements/k/pullout/strength`) son controles planos
    // en el panel (`/reinforcements/k/strength`); el propio `pullout` es la lista del modelo de arrancamiento.
    const k = index(b);
    if (k === null) return { tab: 'reinforcements', selection, fieldPath: null };
    if (k >= (doc.reinforcements?.length ?? 0)) return null;
    // E15i-1: `lateral_pressure/diameter` y `/location` son controles planos (`diameter`, `location`); `capacity/shear` y `/moment`, también; el resto de
    // `lateral_pressure` (model, o la exclusión con `force`) lleva al selector «Origen de la fuerza», y `capacity` entera, al campo del corte.
    let field = c ?? 'id';
    if (c === 'pullout' && d !== undefined) field = d;
    else if (c === 'lateral_pressure') field = d === 'diameter' || d === 'location' ? d : 'lateral_pressure';
    else if (c === 'capacity') field = d === 'moment' ? 'moment' : 'shear';
    return { tab: 'reinforcements', selection, fieldPath: `/reinforcements/${k}/${field}` };
  }
  if (a === 'analysis') {
    if (b === undefined) return { tab: 'surface', selection, fieldPath: null };
    if (ANALYSIS_FIELDS.has(b)) return { tab: 'analysis', selection, fieldPath: `/analysis/${b}` };
    // F5.7: la grieta de tracción vive en «Análisis»; cualquier subcampo desconocido lleva a la casilla.
    if (b === 'tension_crack') return { tab: 'analysis', selection, fieldPath: c === 'depth' || c === 'water_fill' ? `/analysis/tension_crack/${c}` : '/analysis/tension_crack' };
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

/**
 * Destino de una incidencia completa. Manda el puntero (`issueTarget`); sin puntero, algunos códigos tienen destino propio:
 * - `NoValidSurface` (error del motor) y `engine.invalid` (método sin superficie válida): la búsqueda, si el modelo busca,
 *   o la superficie fija en otro caso;
 * - `NoSurface`: el panel de superficie (el modelo no define ninguna).
 */
export function issueTargetFor(issue: Pick<Issue, 'path' | 'code'>, doc: ModelDoc): IssueTarget | null {
  const byPath = issueTarget(issue.path, doc);
  if (byPath) return byPath;
  if (issue.path !== null && issue.path !== '') return null;
  switch (issue.code) {
    case 'NoValidSurface':
    case 'engine.invalid':
      return doc.analysis?.search ? issueTarget('/analysis/search', doc) : issueTarget('/analysis/surface', doc);
    case 'NoSurface':
      return issueTarget('/analysis', doc);
    default:
      return null;
  }
}
