// Borrador del editor en `localStorage` (X3 §2.6, riesgo R9).
//
// - Clave `ogs.editor.draft.v1`, valor `{schema: 1, savedAt, fileName, doc}`; tope de 1 MB.
// - Autoguardado 1 s después de la última edición (`createDraftAutosaver`).
// - El almacenamiento es inyectable (pruebas en Node). Si `localStorage` no existe o falla, se pasa a un
//   almacenamiento en memoria y se devuelve un aviso.
// - Metadatos de UI (vista, selección) no se guardan: solo el documento.

import type { Issue, ModelDoc } from '../editor/types';
import { canonicalDoc, openOgsJson } from './ogsJson';

export const DRAFT_KEY = 'ogs.editor.draft.v1';
export const DRAFT_MAX_BYTES = 1_000_000;
export const DRAFT_DELAY_MS = 1000;

/** Subconjunto de `Storage` que usa el borrador. */
export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Draft {
  schema: 1;
  savedAt: string;
  fileName: string | null;
  doc: ModelDoc;
}

export type DraftSaveResult =
  | { ok: true; bytes: number; savedAt: string }
  | { ok: false; reason: 'too_large' | 'storage_error'; text: string };

export function createMemoryStorage(): DraftStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

export interface ResolvedDraftStorage {
  storage: DraftStorage;
  /** `false` si se usa el almacenamiento en memoria (el borrador no sobrevive a recargar). */
  persistent: boolean;
  /** Aviso para mostrar al usuario cuando `persistent` es `false`. */
  issue: Issue | null;
}

function defaultStorage(): DraftStorage | null | undefined {
  return (globalThis as { localStorage?: DraftStorage }).localStorage;
}

/** Comprueba que el almacenamiento funciona (escritura y borrado) y, si no, cae a memoria con un aviso. */
export function resolveDraftStorage(getter: () => DraftStorage | null | undefined = defaultStorage): ResolvedDraftStorage {
  try {
    const s = getter();
    if (s) {
      const probe = `${DRAFT_KEY}.probe`;
      s.setItem(probe, '1');
      s.removeItem(probe);
      return { storage: s, persistent: true, issue: null };
    }
  } catch {
    // Cae al modo memoria.
  }
  return {
    storage: createMemoryStorage(),
    persistent: false,
    issue: {
      source: 'local',
      severity: 'aviso',
      code: 'io.draft_memory',
      text: 'No se puede usar el almacenamiento local del navegador: el borrador solo se conserva mientras la página esté abierta.',
      path: null,
    },
  };
}

function utf8Length(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** Guarda el documento como borrador. No lanza: devuelve el motivo del fallo. */
export function saveDraft(storage: DraftStorage, doc: ModelDoc, fileName: string | null, now: Date = new Date()): DraftSaveResult {
  const savedAt = now.toISOString();
  let payload: string;
  try {
    const draft: Draft = { schema: 1, savedAt, fileName, doc: canonicalDoc(doc) };
    payload = JSON.stringify(draft);
  } catch (e) {
    return { ok: false, reason: 'storage_error', text: `No se pudo preparar el borrador: ${e instanceof Error ? e.message : String(e)}` };
  }
  const bytes = utf8Length(payload);
  if (bytes > DRAFT_MAX_BYTES) {
    return {
      ok: false,
      reason: 'too_large',
      text: `El borrador (${(bytes / 1_000_000).toFixed(2).replace('.', ',')} MB) supera el tope de 1 MB y no se guardó.`,
    };
  }
  try {
    storage.setItem(DRAFT_KEY, payload);
  } catch {
    return { ok: false, reason: 'storage_error', text: 'No se pudo guardar el borrador (almacenamiento lleno o bloqueado).' };
  }
  return { ok: true, bytes, savedAt };
}

export interface LoadDraftResult {
  draft: Draft | null;
  issues: Issue[];
}

/** Lee el borrador. Uno corrupto o con otro esquema se elimina y se informa con un aviso. */
export function loadDraft(storage: DraftStorage): LoadDraftResult {
  let text: string | null;
  try {
    text = storage.getItem(DRAFT_KEY);
  } catch {
    return {
      draft: null,
      issues: [{ source: 'local', severity: 'aviso', code: 'io.draft_unreadable', text: 'No se pudo leer el borrador local.', path: null }],
    };
  }
  if (text === null) return { draft: null, issues: [] };

  const discard = (why: string): LoadDraftResult => {
    try {
      storage.removeItem(DRAFT_KEY);
    } catch {
      // Sin efecto: el borrador sigue sin poder usarse.
    }
    return {
      draft: null,
      issues: [{ source: 'local', severity: 'aviso', code: 'io.draft_invalid', text: `Se descartó el borrador local: ${why}.`, path: null }],
    };
  };

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return discard('no es JSON válido');
  }
  if (typeof raw !== 'object' || raw === null) return discard('formato desconocido');
  const r = raw as Record<string, unknown>;
  if (r.schema !== 1) return discard('esquema desconocido');
  if (typeof r.savedAt !== 'string' || Number.isNaN(Date.parse(r.savedAt))) return discard('fecha inválida');
  if (r.fileName !== null && typeof r.fileName !== 'string') return discard('nombre de archivo inválido');
  const opened = openOgsJson(JSON.stringify(r.doc));
  if (opened.doc === null) return discard('el modelo no es válido');
  return { draft: { schema: 1, savedAt: r.savedAt, fileName: r.fileName, doc: opened.doc }, issues: [] };
}

export function clearDraft(storage: DraftStorage): void {
  try {
    storage.removeItem(DRAFT_KEY);
  } catch {
    // Sin efecto.
  }
}

export interface DraftAutosaverOptions {
  storage: DraftStorage;
  delayMs?: number;
  now?: () => Date;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  onResult?: (result: DraftSaveResult) => void;
}

export interface DraftAutosaver {
  /** Programa el guardado `delayMs` después de la última llamada. */
  schedule(doc: ModelDoc, fileName: string | null): void;
  /** Guarda ya lo pendiente (p. ej. al cerrar la página). Devuelve `null` si no había nada pendiente. */
  flush(): DraftSaveResult | null;
  /** Descarta lo pendiente sin guardar. */
  cancel(): void;
}

export function createDraftAutosaver(options: DraftAutosaverOptions): DraftAutosaver {
  const delayMs = options.delayMs ?? DRAFT_DELAY_MS;
  const now = options.now ?? ((): Date => new Date());
  const setTimer = options.setTimer ?? ((fn: () => void, ms: number): unknown => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((h: unknown): void => clearTimeout(h as ReturnType<typeof setTimeout>));
  let handle: unknown = null;
  let pending: { doc: ModelDoc; fileName: string | null } | null = null;

  const run = (): DraftSaveResult | null => {
    handle = null;
    if (!pending) return null;
    const { doc, fileName } = pending;
    pending = null;
    const result = saveDraft(options.storage, doc, fileName, now());
    options.onResult?.(result);
    return result;
  };

  return {
    schedule(doc, fileName) {
      pending = { doc, fileName };
      if (handle !== null) clearTimer(handle);
      handle = setTimer(run, delayMs);
    },
    flush() {
      if (handle !== null) clearTimer(handle);
      return run();
    },
    cancel() {
      if (handle !== null) clearTimer(handle);
      handle = null;
      pending = null;
    },
  };
}
