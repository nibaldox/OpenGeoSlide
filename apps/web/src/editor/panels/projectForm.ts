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
 * «Solo cambiar la etiqueta»: NO convierte ningún valor, solo cambia `units` (etiquetas y valores por defecto). Usa `units/set`:
 * un único paso deshacible que conserva el nombre del archivo y deja el documento «con cambios sin guardar».
 */
export function unitsChangeCommand(doc: ModelDoc, to: string): EditorCommand | null {
  const from = currentUnits(doc);
  if (from.kind !== 'other' && from.kind === to) return null;
  if (from.kind === 'other' && from.raw === to) return null;
  return { type: 'units/set', units: to };
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

// ───────── Diálogo de cambio de unidades (R8 A-02) ─────────

export type UnitsChoice = 'convert' | 'label' | 'cancel';

export interface UnitsDialogOption {
  id: UnitsChoice;
  label: string;
  description: string;
  /** La opción recomendada (se destaca y recibe el foco). */
  recommended: boolean;
}

export interface UnitsDialog {
  title: string;
  intro: string;
  options: UnitsDialogOption[];
  /** Opción con el foco inicial. */
  defaultOption: UnitsChoice;
}

/** Texto y opciones del diálogo: convertir (por defecto), solo la etiqueta (con la advertencia de siempre) o cancelar. */
export function unitsChangeDialog(from: CurrentUnits, to: UnitsKind): UnitsDialog {
  const name = to === 'imperial' ? 'imperial' : 'SI';
  const t = unitLabels(to);
  const f = unitLabels(from.kind === 'imperial' ? 'imperial' : 'SI');
  const cancel: UnitsDialogOption = { id: 'cancel', label: 'Cancelar', description: 'Mantiene las unidades y los valores actuales.', recommended: false };
  const labelOnly: UnitsDialogOption = {
    id: 'label',
    label: 'Solo cambiar la etiqueta',
    description: unitsChangeConfirm(from, to).message,
    recommended: false,
  };
  const intro = `El modelo pasa a unidades ${name} (${t.length}, ${t.unitWeight}, ${t.stress}).`;
  if (from.kind === 'other') {
    return {
      title: 'Cambiar el sistema de unidades',
      intro: `${intro} El sistema actual («${from.raw}») no tiene una convención conocida, así que no se pueden convertir los valores.`,
      options: [labelOnly, cancel],
      defaultOption: 'label',
    };
  }
  const gammaW = to === 'imperial' ? ' El peso del agua pasa de 9,81 kN/m³ a 62,45 pcf (y se escribe explícito).' : ' El peso del agua vuelve a su equivalente en kN/m³.';
  const convert: UnitsDialogOption = {
    id: 'convert',
    label: 'Convertir los valores',
    description:
      `Reescribe los números de ${f.length}, ${f.unitWeight}, ${f.stress} a ${t.length}, ${t.unitWeight}, ${t.stress}: coordenadas, radios y parámetros de longitud de la búsqueda, ` +
      'γ, γsat y γw, c y q, y la carga lineal p. No cambian φ, ru, kh, kv ni los ángulos. El factor de seguridad no cambia.' +
      `${gammaW} Se deshace con un solo Ctrl+Z.`,
    recommended: true,
  };
  return { title: 'Cambiar el sistema de unidades', intro, options: [convert, labelOnly, cancel], defaultOption: 'convert' };
}

/** `units/convert` (valores reescritos, FS invariante), o `null` si ya está en `to` o el sistema actual no tiene convención conocida. */
export function unitsConvertCommand(doc: ModelDoc, to: UnitsKind): EditorCommand | null {
  const from = currentUnits(doc);
  if (from.kind === 'other' || from.kind === to) return null;
  return { type: 'units/convert', units: to };
}

/** Comando de la opción elegida en el diálogo (`null` = no hacer nada). */
export function unitsChoiceCommand(doc: ModelDoc, to: UnitsKind, choice: UnitsChoice): EditorCommand | null {
  if (choice === 'convert') return unitsConvertCommand(doc, to);
  if (choice === 'label') return unitsChangeCommand(doc, to);
  return null;
}

/** Aviso tras cambiar las unidades: el texto y las unidades (`doc.units`) en las que quedó el proyecto. */
export interface UnitsNotice {
  text: string;
  units: string;
}

/** ¿Sigue vigente el aviso? No si las unidades cambiaron desde fuera del panel (Ctrl+Z, Ctrl+Y, abrir otro archivo). */
export function unitsNoticeStillValid(notice: UnitsNotice | null, units: string | undefined): notice is UnitsNotice {
  return notice !== null && notice.units === (units ?? 'SI');
}
