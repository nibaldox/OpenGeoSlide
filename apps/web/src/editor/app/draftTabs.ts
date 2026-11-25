// Borrador por pestaña (R7-18). Lógica pura (sin DOM): una sola clave fija se pisaba entre pestañas.
//
// - Cada pestaña tiene un id (`sessionStorage`: sobrevive a recargar y no se comparte entre pestañas).
// - Su borrador va en `localStorage` bajo `ogs.editor.draft.v1.tab.<id>`, y un índice (`ogs.editor.draft.index.v1`) lista
//   `{tabId, savedAt, fileName}` para poder ofrecer el más reciente al abrir otra pestaña.
// - `tabDraftStorage` es un `DraftStorage` (el contrato de io/draft.ts) que redirige la clave fija a las de pestaña: escribe y
//   borra la propia y LEE la más reciente, así `saveDraft`, `loadDraft`, `clearDraft` y el autoguardado funcionan sin cambios.
// - Un borrador antiguo (clave `ogs.editor.draft.v1`) cuenta como una entrada más (`tabId: 'legacy'`).
// - `createPresence` avisa por `BroadcastChannel` cuando el mismo borrador está abierto en otra pestaña.

import { DRAFT_KEY, type DraftStorage } from '../../io/draft';

export const DRAFT_INDEX_KEY = 'ogs.editor.draft.index.v1';
export const TAB_ID_KEY = 'ogs.editor.tab.v1';
export const LEGACY_TAB = 'legacy';
export const MAX_DRAFTS = 8;
export const MAX_AGE_MS = 30 * 24 * 3600 * 1000;

export interface DraftIndexEntry {
  tabId: string;
  savedAt: string;
  fileName: string | null;
}

export const draftKeyFor = (tabId: string): string => (tabId === LEGACY_TAB ? DRAFT_KEY : `${DRAFT_KEY}.tab.${tabId}`);

const byRecent = (a: DraftIndexEntry, b: DraftIndexEntry): number => Date.parse(b.savedAt) - Date.parse(a.savedAt);

/** Índice leído de texto; lo ilegible se ignora. Orden: el más reciente primero. */
export function parseIndex(text: string | null): DraftIndexEntry[] {
  if (!text) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out: DraftIndexEntry[] = [];
  for (const e of raw) {
    const r = e as Partial<DraftIndexEntry> | null;
    if (r && typeof r.tabId === 'string' && typeof r.savedAt === 'string' && !Number.isNaN(Date.parse(r.savedAt)) && (r.fileName === null || typeof r.fileName === 'string')) {
      out.push({ tabId: r.tabId, savedAt: r.savedAt, fileName: r.fileName });
    }
  }
  return out.sort(byRecent);
}

/** Agrega o reemplaza la entrada de una pestaña; descarta las muy antiguas y las que sobran. `dropped`: ids a borrar del almacenamiento. */
export function upsertEntry(entries: DraftIndexEntry[], entry: DraftIndexEntry, now: Date): { entries: DraftIndexEntry[]; dropped: string[] } {
  const all = [entry, ...entries.filter((e) => e.tabId !== entry.tabId)].sort(byRecent);
  const kept = all.filter((e, i) => i < MAX_DRAFTS && (e.tabId === entry.tabId || now.getTime() - Date.parse(e.savedAt) <= MAX_AGE_MS));
  return { entries: kept, dropped: all.filter((e) => !kept.includes(e)).map((e) => e.tabId) };
}

export interface Recoverable {
  entry: DraftIndexEntry;
  /** Ese borrador pertenece a otra pestaña que sigue abierta (se está editando ahora). */
  openElsewhere: boolean;
  /** Otros borradores disponibles además de este. */
  others: number;
}

/** «Recuperar borrador» ofrece el más reciente; avisa si su pestaña dueña sigue abierta. */
export function pickRecoverable(entries: DraftIndexEntry[], ownTabId: string, liveTabIds: ReadonlySet<string>): Recoverable | null {
  const sorted = [...entries].sort(byRecent);
  const entry = sorted[0];
  if (!entry) return null;
  return { entry, openElsewhere: entry.tabId !== ownTabId && liveTabIds.has(entry.tabId), others: sorted.length - 1 };
}

export interface IdStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Id de esta pestaña: el de `sessionStorage` o uno nuevo (que se guarda). Sin almacenamiento, uno efímero. */
export function ensureTabId(session: IdStorage | null, generate: () => string): string {
  try {
    const have = session?.getItem(TAB_ID_KEY);
    if (have) return have;
    const id = generate();
    session?.setItem(TAB_ID_KEY, id);
    return id;
  } catch {
    return generate();
  }
}

function metaOf(payload: string): { savedAt: string; fileName: string | null } | null {
  try {
    const r = JSON.parse(payload) as { savedAt?: unknown; fileName?: unknown };
    if (typeof r.savedAt !== 'string') return null;
    return { savedAt: r.savedAt, fileName: typeof r.fileName === 'string' ? r.fileName : null };
  } catch {
    return null;
  }
}

/** Índice vigente (con el borrador antiguo sin pestaña, si existe y aún no está indexado). */
export function readIndex(base: DraftStorage): DraftIndexEntry[] {
  const entries = parseIndex(base.getItem(DRAFT_INDEX_KEY)).filter((e) => e.tabId !== LEGACY_TAB);
  const legacy = base.getItem(DRAFT_KEY);
  const meta = legacy ? metaOf(legacy) : null;
  if (meta) entries.push({ tabId: LEGACY_TAB, ...meta });
  return entries.sort(byRecent);
}

export interface TabDraftStorageOptions {
  base: DraftStorage;
  tabId: string;
  now?: () => Date;
}

/** `DraftStorage` por pestaña: escribe y borra la clave propia; lee el borrador más reciente de todas. */
export function tabDraftStorage(o: TabDraftStorageOptions): DraftStorage & { latest(): DraftIndexEntry | null } {
  const { base, tabId } = o;
  const now = o.now ?? ((): Date => new Date());
  const latest = (): DraftIndexEntry | null => readIndex(base)[0] ?? null;
  const writeIndex = (entries: DraftIndexEntry[]): void => base.setItem(DRAFT_INDEX_KEY, JSON.stringify(entries.filter((e) => e.tabId !== LEGACY_TAB)));
  return {
    latest,
    getItem(key) {
      if (key !== DRAFT_KEY) return base.getItem(key);
      const l = latest();
      return l ? base.getItem(draftKeyFor(l.tabId)) : null;
    },
    setItem(key, value) {
      if (key !== DRAFT_KEY) return base.setItem(key, value);
      base.setItem(draftKeyFor(tabId), value);
      const meta = metaOf(value) ?? { savedAt: now().toISOString(), fileName: null };
      const { entries, dropped } = upsertEntry(readIndex(base), { tabId, ...meta }, now());
      for (const d of dropped) base.removeItem(draftKeyFor(d));
      writeIndex(entries);
    },
    removeItem(key) {
      if (key !== DRAFT_KEY) return base.removeItem(key);
      // Descartar lo que se ofreció (el más reciente) y también el de esta pestaña, si lo hay.
      const l = latest();
      const ids = new Set([tabId, ...(l ? [l.tabId] : [])]);
      for (const id of ids) base.removeItem(draftKeyFor(id));
      writeIndex(readIndex(base).filter((e) => !ids.has(e.tabId)));
    },
  };
}

// ───────── Presencia entre pestañas (BroadcastChannel) ─────────

export interface ChannelLike {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (e: { data: unknown }) => void): void;
  close(): void;
}

export interface Presence {
  /** Ids de las demás pestañas que han avisado de que están abiertas. */
  live(): ReadonlySet<string>;
  close(): void;
}

/**
 * Cada pestaña dice «hola» al abrir y las demás responden «aquí». Si otra instancia usa el MISMO id de pestaña (una pestaña
 * duplicada hereda `sessionStorage`), se llama a `onSameDraft`: el mismo borrador está abierto en dos pestañas. No bloquea nada.
 */
export function createPresence(channel: ChannelLike, tabId: string, instanceId: string, onSameDraft: () => void): Presence {
  const live = new Set<string>();
  channel.addEventListener('message', (e) => {
    const m = e.data as { type?: string; tabId?: string; instanceId?: string } | null;
    if (!m || typeof m.tabId !== 'string' || m.instanceId === instanceId) return;
    if (m.tabId === tabId) onSameDraft();
    else live.add(m.tabId);
    if (m.type === 'hello') channel.postMessage({ type: 'here', tabId, instanceId });
  });
  channel.postMessage({ type: 'hello', tabId, instanceId });
  return { live: () => live, close: () => channel.close() };
}
