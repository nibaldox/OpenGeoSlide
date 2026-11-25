// Lógica pura del panel «Proyecto»: metadatos del documento (`meta`) y sistema de unidades. Sin React ni DOM.
// Campos reales: `Meta` de `engine/types.ts` y `$defs/meta` del esquema `schema/ogs-0.2.schema.json` tienen solo `id`,
// `title` y `notes` (`additionalProperties: false`). La «descripción» del panel es `notes`; el esquema no tiene «autor».

import type { ConfirmOptions } from '../../ui/confirmQueue';
import type { EditorCommand, ModelDoc } from '../types';
import { unitLabels } from './forms';

export type MetaField = 'id' | 'title' | 'notes';

export interface ProjectForm {
  id: string;
  title: string;
  notes: string;
}

export function projectToForm(doc: Pick<ModelDoc, 'meta'>): ProjectForm {
  return { id: doc.meta.id ?? '', title: doc.meta.title ?? '', notes: doc.meta.notes ?? '' };
}

/** Texto normalizado de un campo: el id y el título son de una línea; la descripción conserva los saltos internos. */
function normalizeMeta(field: MetaField, text: string): string {
  if (field === 'notes') return text.replace(/\r\n?/g, '\n').trim();
  return text.replace(/\s*[\r\n]+\s*/g, ' ').trim();
}

/** `meta/patch` para un campo, o `null` si no cambia nada. Un campo vacío se quita del documento. */
export function metaPatchCommand(doc: Pick<ModelDoc, 'meta'>, field: MetaField, text: string): EditorCommand | null {
  const next = normalizeMeta(field, text);
  const current = (doc.meta[field] ?? '').trim();
  if (next === current) return null;
  return { type: 'meta/patch', patch: { [field]: next === '' ? undefined : next } };
}

// ───────── Unidades ─────────

export type UnitsKind = 'SI' | 'imperial';
export type CurrentUnits = { kind: UnitsKind } | { kind: 'other'; raw: string };

/** Sistema de unidades del documento: sin valor cuenta como SI; otro texto se conserva y se avisa. */
export function currentUnits(doc: Pick<ModelDoc, 'units'>): CurrentUnits {
  const u = doc.units;
  if (u === undefined || u === null || u === 'SI') return { kind: 'SI' };
  if (u === 'imperial') return { kind: 'imperial' };
  return { kind: 'other', raw: u };
}

export const UNITS_LABELS: Record<UnitsKind, string> = { SI: 'SI (m, kN/m³, kPa)', imperial: 'Imperial (ft, pcf, psf)' };

export function unitsOptions(current: CurrentUnits): { value: string; label: string }[] {
  const base = (['SI', 'imperial'] as const).map((value) => ({ value, label: UNITS_LABELS[value] }));
  return current.kind === 'other' ? [{ value: current.raw, label: `${current.raw} (sin convención conocida)` }, ...base] : base;
}

/**
 * Cambio de unidades: NO convierte ningún valor, solo cambia `units` (etiquetas y valores por defecto). No existe un comando
 * propio para esto, así que usa `doc/replace` (un solo paso deshacible). Con `fileName: null` el documento queda con
 * cambios sin guardar (con el nombre del archivo, `doc/replace` lo daría por guardado y se perdería el aviso al salir);
 * lo único que se pierde es el nombre del archivo en la barra de estado, que pasa a mostrar el título del proyecto.
 */
export function unitsChangeCommand(doc: ModelDoc, to: string): EditorCommand | null {
  const from = currentUnits(doc);
  if (from.kind !== 'other' && from.kind === to) return null;
  if (from.kind === 'other' && from.raw === to) return null;
  return { type: 'doc/replace', doc: { ...doc, units: to }, fileName: null };
}

/** Confirmación previa: explica con claridad que los números no cambian. */
export function unitsChangeConfirm(from: CurrentUnits, to: UnitsKind): ConfirmOptions {
  const f = unitLabels(from.kind === 'imperial' ? 'imperial' : 'SI');
  const t = unitLabels(to);
  return {
    title: 'Cambiar el sistema de unidades',
    message:
      `Cambiar a ${to === 'imperial' ? 'imperial' : 'SI'} no convierte los valores del modelo. ` +
      `Las coordenadas, los pesos unitarios (${f.unitWeight}), la cohesión (${f.stress}) y las cargas conservarán sus números y pasarán a leerse en ` +
      `${t.length}, ${t.unitWeight} y ${t.stress}. Si ya cargó valores en ${f.length}, debe reescribirlos usted. ` +
      'Puede deshacerlo con Ctrl+Z.',
    confirmLabel: to === 'imperial' ? 'Cambiar a imperial sin convertir' : 'Cambiar a SI sin convertir',
    cancelLabel: 'Mantener las unidades',
    tone: 'danger',
  };
}
