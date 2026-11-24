// Lógica de la aplicación sin React: preparación de modelos, evaluación de verificaciones,
// resumen de tiempos y lectura de archivos subidos. Se prueba en Vitest.

import type { Model, MethodKind, VerificationCase, VerificationCheck } from '../engine/types';

export function cloneModel(model: Model): Model {
  return structuredClone(model);
}

/** Modelo para el análisis principal: solo los métodos elegidos. */
export function runModel(model: Model, methods: MethodKind[]): Model {
  const copy = cloneModel(model);
  copy.analysis = { ...copy.analysis, methods: [...methods] };
  return copy;
}

/**
 * Modelo para una comprobación de §2: un método, el tipo de superficie pedido y, si existe,
 * el número de dovelas del check. Una comprobación `fixed` ignora la búsqueda y una `search`, la superficie fija.
 */
export function checkModel(model: Model, check: VerificationCheck): Model {
  const copy = cloneModel(model);
  copy.analysis = { ...copy.analysis, methods: [check.method] };
  if (check.options?.slices !== undefined) copy.analysis.slices = check.options.slices;
  if (check.kind === 'fixed') {
    copy.analysis.search = null;
  } else {
    copy.analysis.surface = null;
  }
  return copy;
}

export interface CheckEvaluation {
  fos: number | null;
  /** |FS − publicado| / publicado; null si no hay FS. */
  errorRel: number | null;
  ok: boolean;
}

/** Criterio de §2: pasa si |FS − published| / published ≤ tolerance. */
export function evaluateCheck(check: VerificationCheck, fos: number | null): CheckEvaluation {
  if (fos === null || !Number.isFinite(fos)) {
    return { fos: null, errorRel: null, ok: false };
  }
  const errorRel = Math.abs(fos - check.published) / check.published;
  return { fos, errorRel, ok: errorRel <= check.tolerance };
}

export interface TimeSummary {
  runs: number;
  avg: number;
  min: number;
  max: number;
}

export function summarizeTimes(times: number[]): TimeSummary | null {
  if (times.length === 0) return null;
  const sum = times.reduce((acc, t) => acc + t, 0);
  return {
    runs: times.length,
    avg: sum / times.length,
    min: Math.min(...times),
    max: Math.max(...times),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Lee un archivo subido: un caso de verificación (con `model`) o un modelo .ogs.json suelto.
 * Lanza Error con un mensaje en español si el contenido no sirve.
 */
export function parseUploadedCase(text: string, fileName: string): VerificationCase {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`${fileName}: el archivo no es JSON válido.`);
  }
  if (!isRecord(raw)) {
    throw new Error(`${fileName}: el contenido debe ser un objeto JSON.`);
  }

  let model: unknown;
  let caseLike: Record<string, unknown> = {};
  if ('model' in raw) {
    model = raw.model;
    caseLike = raw;
  } else if ('regions' in raw) {
    model = raw;
  } else {
    throw new Error(`${fileName}: no contiene un modelo .ogs.json ni un caso de verificación.`);
  }

  if (!isRecord(model) || !Array.isArray(model.regions) || !Array.isArray(model.materials) || !isRecord(model.analysis)) {
    throw new Error(`${fileName}: el modelo no tiene regiones, materiales o bloque analysis.`);
  }

  const meta = isRecord(model.meta) ? model.meta : {};
  const id = typeof caseLike.id === 'string' ? caseLike.id : typeof meta.id === 'string' ? meta.id : fileName;
  const title =
    typeof caseLike.title === 'string' ? caseLike.title : typeof meta.title === 'string' ? meta.title : fileName;
  const checks = Array.isArray(caseLike.checks) ? (caseLike.checks as VerificationCheck[]) : [];

  return { id, title, model: model as unknown as Model, checks };
}
