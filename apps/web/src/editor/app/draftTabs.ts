// Borrador por pestaña (R7-18). Lógica pura (sin DOM): una sola clave fija se pisaba entre pestañas.
//
// - Cada pestaña tiene un id (`sessionStorage`: sobrevive a recargar y no se comparte entre pestañas).
// - Su borrador va en `localStorage` bajo `ogs.editor.draft.v1.tab.<id>`, y un índice (`ogs.editor.draft.index.v1`) lista
//   `{tabId, savedAt, fileName}` para poder ofrecer el más reciente al abrir otra pestaña.
// - `tabDraftStorage` es un `DraftStorage` (el contrato de io/draft.ts) que redirige la clave fija a las de pestaña: escribe y
//   borra la propia y LEE la más reciente, así `saveDraft`, `loadDraft`, `clearDraft` y el autoguardado funcionan sin cambios.
// - Un borrador antiguo (clave `ogs.editor.draft.v1`) cuenta como una entrada más (`tabId: 'legacy'`).
// - `createPresence` avisa por `BroadcastChannel` cuando el mismo borrador está abierto en otra pestaña. Una pestaña
//   duplicada (hereda el id de `sessionStorage`) recibe un id propio, para que no se pisen (R9-02b).
// - Borrar es siempre selectivo (R9-01): `clearOwn()` solo toca el borrador de esta pestaña y `discard(id)` el de la entrada
//   ofrecida; guardar o descartar aquí nunca borra el borrador sin guardar de otra pestaña abierta.
// - Escribir es robusto (R9-08): el índice se calcula y las entradas sobrantes se borran ANTES de escribir; ante
//   `QuotaExceededError` se quita el borrador ajeno más antiguo y se reintenta una vez.

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

/** ¿El borrador ofrecido pertenece a otra pestaña que sigue abierta? (`pickRecoverable().openElsewhere` sobre la entrada ofrecida.) */
export function offeredDraftElsewhere(offered: DraftIndexEntry | null, ownTabId: string, live: ReadonlySet<string>): boolean {
  return offered !== null && pickRecoverable([offered], ownTabId, live)?.openElsewhere === true;
}

/** Aviso del banner de borrador cuando su pestaña dueña sigue abierta. */
export const OPEN_ELSEWHERE_TEXT = 'Este borrador es de otra pestaña que sigue abierta: recuperarlo aquí no la cierra, y las dos se guardarán por separado.';

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

/** ¿El almacenamiento rechazó la escritura por falta de espacio? (nombres y códigos de Chrome, Firefox y Safari). */
export function isQuotaError(e: unknown): boolean {
  const r = e as { name?: unknown; code?: unknown } | null;
  return !!r && (r.name === 'QuotaExceededError' || r.name === 'NS_ERROR_DOM_QUOTA_REACHED' || r.code === 22 || r.code === 1014);
}

/** Borrador heredado (`ogs.editor.draft.v1`) presente pero sin `savedAt` legible (R9-08b). */
export function hasCorruptLegacy(base: DraftStorage): boolean {
  const legacy = base.getItem(DRAFT_KEY);
  return legacy !== null && metaOf(legacy) === null;
}

/**
 * Índice vigente (con el borrador antiguo sin pestaña, si existe y aún no está indexado). Un borrador antiguo ilegible
 * cuenta como el más reciente para que `loadDraft` lo vea, avise (`io.draft_invalid`) y lo limpie (R9-08b).
 */
export function readIndex(base: DraftStorage, now: Date = new Date()): DraftIndexEntry[] {
  const entries = parseIndex(base.getItem(DRAFT_INDEX_KEY)).filter((e) => e.tabId !== LEGACY_TAB);
  const legacy = base.getItem(DRAFT_KEY);
  if (legacy !== null) {
    const meta = metaOf(legacy) ?? { savedAt: now.toISOString(), fileName: null };
    entries.push({ tabId: LEGACY_TAB, ...meta });
  }
  return entries.sort(byRecent);
}

export interface TabDraftStorageOptions {
  base: DraftStorage;
  tabId: string;
  now?: () => Date;
}

export interface TabDraftStorage extends DraftStorage {
  /** Entrada más reciente del índice (la que `getItem` ofrece). */
  latest(): DraftIndexEntry | null;
  /** Id de esta pestaña. */
  tabId(): string;
  /** Borra SOLO el borrador de esta pestaña (guardar un archivo, R9-01). */
  clearOwn(): void;
  /** Borra el borrador de la pestaña `id` (el que ofrecía el banner). */
  discard(id: string): void;
  /** Esta pestaña pasa a llamarse `id` (era un duplicado): lo que escribió con su id anterior se migra al nuevo (R9-02b). */
  rename(id: string): void;
}

/** `DraftStorage` por pestaña: escribe y borra la clave propia; lee el borrador más reciente de todas. */
export function tabDraftStorage(o: TabDraftStorageOptions): TabDraftStorage {
  const { base } = o;
  let tabId = o.tabId;
  let lastWritten: string | null = null;
  const now = o.now ?? ((): Date => new Date());
  const latest = (): DraftIndexEntry | null => readIndex(base, now())[0] ?? null;
  const writeIndex = (entries: DraftIndexEntry[]): void => base.setItem(DRAFT_INDEX_KEY, JSON.stringify(entries.filter((e) => e.tabId !== LEGACY_TAB)));
  const forget = (ids: ReadonlySet<string>): void => {
    for (const id of ids) base.removeItem(draftKeyFor(id));
    writeIndex(readIndex(base, now()).filter((e) => !ids.has(e.tabId)));
  };
  /** Quita del índice las entradas cuyo borrador ya no existe (tras borrar `dropped` o el más antiguo y fallar después). */
  const pruneIndex = (): void => {
    try {
      writeIndex(readIndex(base, now()).filter((e) => e.tabId === LEGACY_TAB || base.getItem(draftKeyFor(e.tabId)) !== null));
    } catch {
      // Sin efecto: el índice stale solo apunta a borradores que ya no existen y se ignora al leer.
    }
  };
  const store = (value: string, entry: DraftIndexEntry, entries: DraftIndexEntry[]): void => {
    base.setItem(draftKeyFor(entry.tabId), value);
    try {
      writeIndex(entries);
    } catch (e) {
      // Sin índice el borrador quedaría huérfano para siempre: se quita y se informa del fallo.
      try {
        base.removeItem(draftKeyFor(entry.tabId));
      } catch {
        // Sin efecto.
      }
      throw e;
    }
  };
  const api: TabDraftStorage = {
    latest,
    tabId: () => tabId,
    getItem(key) {
      if (key !== DRAFT_KEY) return base.getItem(key);
      const l = latest();
      return l ? base.getItem(draftKeyFor(l.tabId)) : null;
    },
    setItem(key, value) {
      if (key !== DRAFT_KEY) return base.setItem(key, value);
      const meta = metaOf(value) ?? { savedAt: now().toISOString(), fileName: null };
      const entry: DraftIndexEntry = { tabId, ...meta };
      // R9-08a: primero se calcula el índice y se libera lo sobrante; recién después se escribe.
      const { entries, dropped } = upsertEntry(readIndex(base, now()), entry, now());
      for (const d of dropped) base.removeItem(draftKeyFor(d));
      try {
        try {
          store(value, entry, entries);
        } catch (e) {
          if (!isQuotaError(e)) throw e;
          // Sin espacio: se quita el borrador ajeno más antiguo y se reintenta una sola vez.
          const oldest = [...entries].reverse().find((x) => x.tabId !== tabId);
          if (!oldest) throw e;
          base.removeItem(draftKeyFor(oldest.tabId));
          store(value, entry, entries.filter((x) => x.tabId !== oldest.tabId));
        }
      } catch (e) {
        pruneIndex(); // lo ya borrado no debe seguir en el índice
        throw e;
      }
      lastWritten = value;
    },
    // `loadDraft` descarta lo que leyó (el más reciente, incluso uno ilegible): solo esa entrada, no la de esta pestaña.
    removeItem(key) {
      if (key !== DRAFT_KEY) return base.removeItem(key);
      const l = latest();
      if (l) forget(new Set([l.tabId]));
    },
    clearOwn() {
      lastWritten = null;
      forget(new Set([tabId]));
    },
    discard(id) {
      if (id === tabId) lastWritten = null;
      forget(new Set([id]));
    },
    rename(id) {
      const old = tabId;
      tabId = id;
      if (old === id || lastWritten === null) return;
      // Migra lo que esta instancia escribió: el borrador queda a su nombre nuevo (el de la pestaña original no se toca).
      try {
        api.setItem(DRAFT_KEY, lastWritten);
      } catch {
        // El siguiente autoguardado lo reintenta y avisa si falla.
      }
    },
  };
  return api;
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

export interface PresenceOptions {
  /** Instante de nacimiento de esta instancia: ante un mismo id gana (sigue con él) la más antigua. */
  born?: number;
  /**
   * Esta instancia es un duplicado de otra (mismo id de pestaña): debe darse un id propio y devolverlo (`null`: no puede).
   * Quien lo implementa persiste el id nuevo y migra su borrador (R9-02b).
   */
  renameTab?: (oldId: string) => string | null;
}

/**
 * Cada pestaña dice «hola» al abrir y las demás responden «aquí». Si otra instancia usa el MISMO id de pestaña (una pestaña
 * duplicada hereda `sessionStorage`), la más nueva se da un id propio con `renameTab` (la original conserva el suyo y su
 * borrador) y se llama a `onSameDraft` solo en la nueva, para avisar con verdad. Sin `renameTab`, ambas llaman a `onSameDraft`.
 * `onLiveChange` se llama cuando aparece una pestaña nueva en `live()` (la original, tras un cambio de id, cuenta como abierta).
 */
export function createPresence(
  channel: ChannelLike,
  tabId: string,
  instanceId: string,
  onSameDraft: () => void,
  onLiveChange?: () => void,
  options: PresenceOptions = {},
): Presence {
  const live = new Set<string>();
  const born = options.born ?? Date.now();
  let currentId = tabId;
  const isNewerThan = (otherBorn: number, otherInstance: string): boolean => (born !== otherBorn ? born > otherBorn : instanceId > otherInstance);
  channel.addEventListener('message', (e) => {
    const m = e.data as { type?: string; tabId?: string; instanceId?: string; born?: number } | null;
    if (!m || typeof m.tabId !== 'string' || typeof m.instanceId !== 'string' || m.instanceId === instanceId) return;
    if (m.tabId === currentId) {
      if (!options.renameTab) onSameDraft();
      else if (isNewerThan(typeof m.born === 'number' ? m.born : 0, m.instanceId)) {
        const old = currentId;
        const next = options.renameTab(old);
        if (next && next !== old) {
          currentId = next;
          live.add(old); // la pestaña original sigue abierta con el id anterior
          onSameDraft();
          onLiveChange?.();
        }
      }
    } else if (!live.has(m.tabId)) {
      live.add(m.tabId);
      onLiveChange?.();
    }
    if (m.type === 'hello') channel.postMessage({ type: 'here', tabId: currentId, instanceId, born });
  });
  channel.postMessage({ type: 'hello', tabId: currentId, instanceId, born });
  return { live: () => live, close: () => channel.close() };
}
