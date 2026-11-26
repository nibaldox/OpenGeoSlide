// Autosave del borrador (io/draft.ts): 1 s después de la última edición, y al ocultar o cerrar la página.
// No guarda mientras `enabled` sea falso (p. ej. mientras se ofrece «Recuperar», para no pisar el borrador).

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createDraftAutosaver, resolveDraftStorage, type DraftSaveResult, type DraftStorage, type ResolvedDraftStorage } from '../../io/draft';
import { createPresence, ensureTabId, offeredDraftElsewhere, tabDraftStorage, type DraftIndexEntry, type Presence } from './draftTabs';
import type { EditorStore } from '../types';

export interface UnloadGuardInput {
  /** Hay cambios sin guardar en archivo. */
  dirty: boolean;
  /** El autoguardado está activo (no está en pausa por un borrador pendiente de recuperar). */
  autosaveEnabled: boolean;
  /** El almacenamiento del borrador sobrevive a recargar (no es el modo memoria). */
  persistent: boolean;
  /** Último fallo del autoguardado (`null` si fue bien). */
  failure: string | null;
}

/** ¿Hay trabajo que se perdería al cerrar la pestaña? Con el borrador a salvo, no se molesta al usuario (R7-18). */
export function shouldWarnBeforeUnload(s: UnloadGuardInput): boolean {
  return s.dirty && (!s.autosaveEnabled || !s.persistent || s.failure !== null);
}

/** Pide confirmación del navegador al cerrar o recargar mientras `warn` sea verdadero. */
export function useUnloadGuard(warn: boolean): void {
  useEffect(() => {
    if (!warn) return;
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
      e.returnValue = ''; // algunos navegadores solo muestran el aviso si se asigna
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [warn]);
}

/** Último fallo del autosave (`null` si el último guardado fue bien). */
export function useDraftAutosave(store: EditorStore, storage: DraftStorage, enabled: boolean): string | null {
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const saver = createDraftAutosaver({
      storage,
      onResult: (r: DraftSaveResult) => setFailure(r.ok ? null : r.text),
    });
    // Solo las ediciones posteriores a este momento generan un borrador.
    let last = store.getState().revision;
    const unsubscribe = store.subscribe(() => {
      const s = store.getState();
      if (s.revision === last) return;
      last = s.revision;
      saver.schedule(s.doc, s.file.name);
    });
    const flush = (): void => {
      saver.flush();
    };
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      unsubscribe();
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      saver.flush();
    };
  }, [store, storage, enabled]);

  return failure;
}

// ───────── Borrador por pestaña (R7-18) ─────────

let sameDraft = false;
const sameDraftListeners = new Set<() => void>();
let ownTabId: string | null = null;
let presence: Presence | null = null;
let liveVersion = 0;
const liveListeners = new Set<() => void>();

/**
 * Como `resolveDraftStorage()`, pero el borrador es **por pestaña** (ver `draftTabs.ts`): el id de pestaña va en
 * `sessionStorage`, el borrador en `localStorage` con un índice, y «Recuperar» lee el más reciente de todas. Con
 * `BroadcastChannel` detecta que el mismo borrador está abierto en otra pestaña (`useSameDraftWarning`).
 */
export function resolveTabDraftStorage(): ResolvedDraftStorage {
  const resolved = resolveDraftStorage();
  if (!resolved.persistent) return resolved;
  const g = globalThis as { sessionStorage?: Storage; BroadcastChannel?: typeof BroadcastChannel };
  const generate = (): string => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
  const tabId = ensureTabId(g.sessionStorage ?? null, generate);
  ownTabId = tabId;
  if (typeof g.BroadcastChannel === 'function') {
    try {
      presence = createPresence(
        new g.BroadcastChannel('ogs.editor.draft'),
        tabId,
        generate(),
        () => {
          sameDraft = true;
          sameDraftListeners.forEach((l) => l());
        },
        () => {
          liveVersion += 1;
          liveListeners.forEach((l) => l());
        },
      );
    } catch {
      // Sin canal: solo se pierde el aviso de «abierto en otra pestaña».
    }
  }
  return { ...resolved, storage: tabDraftStorage({ base: resolved.storage, tabId }) };
}

/** `true` si otra pestaña tiene abierto este mismo borrador (aviso no bloqueante). */
export function useSameDraftWarning(): boolean {
  return useSyncExternalStore(
    (l) => {
      sameDraftListeners.add(l);
      return () => sameDraftListeners.delete(l);
    },
    () => sameDraft,
    () => false,
  );
}

/** Entrada del índice que `loadDraft` va a ofrecer (la más reciente), o `null` sin borrador o sin almacenamiento por pestaña. */
export function offeredDraftEntry(storage: DraftStorage): DraftIndexEntry | null {
  return (storage as { latest?: () => DraftIndexEntry | null }).latest?.() ?? null;
}

/**
 * `true` si el borrador ofrecido (`offered`) pertenece a otra pestaña que sigue abierta (R7-18, `pickRecoverable().openElsewhere`).
 * La presencia se conoce de forma asíncrona (las demás pestañas responden «aquí» al «hola»), así que se actualiza cuando llegan.
 * Una pestaña cerrada no avisa de que se fue: la lista es la de las que respondieron desde que esta pestaña abrió.
 */
export function useDraftOpenElsewhere(offered: DraftIndexEntry | null): boolean {
  return useSyncExternalStore(
    (l) => {
      liveListeners.add(l);
      return () => liveListeners.delete(l);
    },
    () => {
      void liveVersion;
      return ownTabId !== null && presence !== null && offeredDraftElsewhere(offered, ownTabId, presence.live());
    },
    () => false,
  );
}

export const SAME_DRAFT_TEXT = 'Este borrador está abierto también en otra pestaña: las dos se guardan por separado, y al recuperar se ofrece el más reciente.';
