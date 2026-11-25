import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../editor/types';
import {
  DRAFT_KEY,
  DRAFT_MAX_BYTES,
  clearDraft,
  createDraftAutosaver,
  createMemoryStorage,
  loadDraft,
  resolveDraftStorage,
  saveDraft,
  type DraftSaveResult,
  type DraftStorage,
} from './draft';

const doc = (title = 't'): ModelDoc => ({
  format: 'opengeoslide',
  version: '0.2',
  meta: { id: 'x', title },
  materials: [{ id: 's', name: 'S', model: 'mohr_coulomb', unit_weight: 20, cohesion: 3, friction_angle: 20 }],
  regions: [{ material: 's', polygon: [[0, 0], [10, 0], [10, 5]] }],
  analysis: { methods: ['bishop'] },
});

describe('draft', () => {
  it('guarda y recupera con {schema, savedAt, fileName, doc}', () => {
    const s = createMemoryStorage();
    const r = saveDraft(s, doc(), 'a.ogs.json', new Date('2026-11-25T12:00:00Z'));
    expect(r.ok).toBe(true);
    const raw = JSON.parse(s.getItem(DRAFT_KEY) as string) as Record<string, unknown>;
    expect(Object.keys(raw)).toEqual(['schema', 'savedAt', 'fileName', 'doc']);
    expect(raw.schema).toBe(1);
    const loaded = loadDraft(s);
    expect(loaded.issues).toEqual([]);
    expect(loaded.draft).toMatchObject({ schema: 1, savedAt: '2026-11-25T12:00:00.000Z', fileName: 'a.ogs.json' });
    expect(loaded.draft?.doc).toEqual(doc());
  });

  it('sin borrador devuelve null; clearDraft lo elimina', () => {
    const s = createMemoryStorage();
    expect(loadDraft(s)).toEqual({ draft: null, issues: [] });
    saveDraft(s, doc(), null);
    clearDraft(s);
    expect(loadDraft(s).draft).toBeNull();
  });

  it('rechaza por encima de 1 MB sin escribir', () => {
    const s = createMemoryStorage();
    const big = doc('x'.repeat(DRAFT_MAX_BYTES));
    const r = saveDraft(s, big, null);
    expect(r).toMatchObject({ ok: false, reason: 'too_large' });
    expect(s.getItem(DRAFT_KEY)).toBeNull();
  });

  it('un fallo de almacenamiento (cuota) no lanza', () => {
    const full: DraftStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => undefined,
    };
    expect(saveDraft(full, doc(), null)).toMatchObject({ ok: false, reason: 'storage_error' });
  });

  it('descarta borradores corruptos, de otro esquema o con modelo inválido', () => {
    const cases: [string, string][] = [
      ['{no', 'no es JSON'],
      ['[]', ''],
      [JSON.stringify({ schema: 2, savedAt: '2026-01-01T00:00:00Z', fileName: null, doc: doc() }), 'esquema'],
      [JSON.stringify({ schema: 1, savedAt: 'ayer', fileName: null, doc: doc() }), 'fecha'],
      [JSON.stringify({ schema: 1, savedAt: '2026-01-01T00:00:00Z', fileName: null, doc: { format: 'x' } }), 'modelo'],
    ];
    for (const [text] of cases) {
      const s = createMemoryStorage();
      s.setItem(DRAFT_KEY, text);
      const r = loadDraft(s);
      expect(r.draft).toBeNull();
      expect(r.issues[0]?.code).toBe('io.draft_invalid');
      expect(s.getItem(DRAFT_KEY)).toBeNull();
    }
  });

  it('un getItem que lanza se informa sin lanzar', () => {
    const bad: DraftStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(loadDraft(bad).issues[0]?.code).toBe('io.draft_unreadable');
  });

  it('resolveDraftStorage: usa el disponible, o memoria con aviso si falta o falla', () => {
    const ok = createMemoryStorage();
    expect(resolveDraftStorage(() => ok)).toMatchObject({ storage: ok, persistent: true, issue: null });
    const none = resolveDraftStorage(() => undefined);
    expect(none.persistent).toBe(false);
    expect(none.issue?.code).toBe('io.draft_memory');
    const throws = resolveDraftStorage(() => {
      throw new Error('SecurityError');
    });
    expect(throws.persistent).toBe(false);
    const readonly: DraftStorage = { getItem: () => null, setItem: () => { throw new Error('Quota'); }, removeItem: () => undefined };
    expect(resolveDraftStorage(() => readonly).persistent).toBe(false);
    // En Node no hay localStorage: el valor por defecto cae a memoria y sigue funcionando.
    const def = resolveDraftStorage();
    expect(def.persistent).toBe(false);
    expect(saveDraft(def.storage, doc(), null).ok).toBe(true);
  });
});

describe('draft: autoguardado', () => {
  function fakeTimers() {
    let next = 1;
    const timers = new Map<number, { fn: () => void; ms: number }>();
    return {
      setTimer: (fn: () => void, ms: number): unknown => {
        const id = next++;
        timers.set(id, { fn, ms });
        return id;
      },
      clearTimer: (h: unknown): void => {
        timers.delete(h as number);
      },
      timers,
      fireAll: (): void => {
        for (const [id, t] of [...timers]) {
          timers.delete(id);
          t.fn();
        }
      },
    };
  }

  it('agrupa varias ediciones en un solo guardado a 1 s de la última', () => {
    const s = createMemoryStorage();
    const t = fakeTimers();
    const results: DraftSaveResult[] = [];
    const a = createDraftAutosaver({ storage: s, setTimer: t.setTimer, clearTimer: t.clearTimer, onResult: (r) => results.push(r) });
    a.schedule(doc('uno'), null);
    a.schedule(doc('dos'), 'f.ogs.json');
    expect(t.timers.size).toBe(1);
    expect([...t.timers.values()][0]?.ms).toBe(1000);
    expect(s.getItem(DRAFT_KEY)).toBeNull();
    t.fireAll();
    expect(results).toHaveLength(1);
    expect(loadDraft(s).draft?.doc.meta.title).toBe('dos');
    expect(loadDraft(s).draft?.fileName).toBe('f.ogs.json');
  });

  it('flush guarda lo pendiente y cancel lo descarta', () => {
    const s = createMemoryStorage();
    const t = fakeTimers();
    const a = createDraftAutosaver({ storage: s, setTimer: t.setTimer, clearTimer: t.clearTimer });
    expect(a.flush()).toBeNull();
    a.schedule(doc('x'), null);
    expect(a.flush()?.ok).toBe(true);
    expect(t.timers.size).toBe(0);
    clearDraft(s);
    a.schedule(doc('y'), null);
    a.cancel();
    t.fireAll();
    expect(s.getItem(DRAFT_KEY)).toBeNull();
  });
});
