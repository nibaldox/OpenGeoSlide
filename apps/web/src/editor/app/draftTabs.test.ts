import { describe, expect, it } from 'vitest';
import { clearDraft, createMemoryStorage, DRAFT_KEY, loadDraft, saveDraft } from '../../io/draft';
import type { ModelDoc } from '../types';
import { DRAFT_INDEX_KEY, MAX_DRAFTS, createPresence, draftKeyFor, ensureTabId, parseIndex, pickRecoverable, tabDraftStorage, upsertEntry, type ChannelLike } from './draftTabs';

const doc = (title: string): ModelDoc => ({
  format: 'opengeoslide',
  version: '0.2',
  meta: { id: 'x', title },
  materials: [{ id: 's', name: 'S', model: 'mohr_coulomb', unit_weight: 20, cohesion: 3, friction_angle: 20 }],
  regions: [{ material: 's', polygon: [[0, 0], [10, 0], [10, 5]] }],
  analysis: { methods: ['bishop'] },
});
const t = (m: number): Date => new Date(Date.UTC(2026, 10, 25, 12, m));

describe('borrador por pestaña (R7-18)', () => {
  it('dos pestañas escriben claves distintas y no se pisan', () => {
    const base = createMemoryStorage();
    saveDraft(tabDraftStorage({ base, tabId: 'A' }), doc('de A'), 'a.ogs.json', t(1));
    saveDraft(tabDraftStorage({ base, tabId: 'B' }), doc('de B'), 'b.ogs.json', t(2));
    expect(base.getItem(draftKeyFor('A'))).toContain('de A');
    expect(base.getItem(draftKeyFor('B'))).toContain('de B');
    expect(base.getItem(DRAFT_KEY)).toBeNull(); // la clave fija ya no se usa
    expect(parseIndex(base.getItem(DRAFT_INDEX_KEY)).map((e) => e.tabId)).toEqual(['B', 'A']);
  });

  it('«Recuperar» ofrece el más reciente (de cualquier pestaña)', () => {
    const base = createMemoryStorage();
    saveDraft(tabDraftStorage({ base, tabId: 'A' }), doc('de A'), null, t(1));
    saveDraft(tabDraftStorage({ base, tabId: 'B' }), doc('de B'), 'b.ogs.json', t(5));
    const loaded = loadDraft(tabDraftStorage({ base, tabId: 'C' }));
    expect(loaded.draft?.doc.meta.title).toBe('de B');
    expect(loaded.draft?.fileName).toBe('b.ogs.json');
  });

  it('descartar lo ofrecido borra ese borrador y deja los demás', () => {
    const base = createMemoryStorage();
    saveDraft(tabDraftStorage({ base, tabId: 'A' }), doc('de A'), null, t(1));
    saveDraft(tabDraftStorage({ base, tabId: 'B' }), doc('de B'), null, t(5));
    const c = tabDraftStorage({ base, tabId: 'C' });
    clearDraft(c);
    expect(base.getItem(draftKeyFor('B'))).toBeNull();
    expect(loadDraft(c).draft?.doc.meta.title).toBe('de A');
  });

  it('un borrador de la clave antigua cuenta como una entrada más', () => {
    const base = createMemoryStorage();
    saveDraft(base, doc('antiguo'), 'v.ogs.json', t(0)); // clave fija, sin pestaña
    expect(loadDraft(tabDraftStorage({ base, tabId: 'A' })).draft?.doc.meta.title).toBe('antiguo');
    saveDraft(tabDraftStorage({ base, tabId: 'A' }), doc('nuevo'), null, t(9));
    expect(loadDraft(tabDraftStorage({ base, tabId: 'Z' })).draft?.doc.meta.title).toBe('nuevo');
  });

  it('upsertEntry reemplaza la propia y poda por cantidad y por antigüedad', () => {
    const now = t(0);
    let entries = [] as ReturnType<typeof parseIndex>;
    const dropped: string[] = [];
    for (let i = 0; i < MAX_DRAFTS + 2; i += 1) {
      const r = upsertEntry(entries, { tabId: `T${i}`, savedAt: new Date(now.getTime() - (MAX_DRAFTS + 2 - i) * 1000).toISOString(), fileName: null }, now);
      entries = r.entries;
      dropped.push(...r.dropped);
    }
    expect(entries).toHaveLength(MAX_DRAFTS);
    expect(dropped).toEqual(['T0', 'T1']);
    const old = upsertEntry([{ tabId: 'viejo', savedAt: '2026-01-01T00:00:00Z', fileName: null }], { tabId: 'N', savedAt: now.toISOString(), fileName: null }, now);
    expect(old.dropped).toEqual(['viejo']);
  });

  it('pickRecoverable: el más reciente, con aviso si su pestaña sigue abierta', () => {
    const entries = [
      { tabId: 'A', savedAt: t(1).toISOString(), fileName: null },
      { tabId: 'B', savedAt: t(7).toISOString(), fileName: 'b' },
    ];
    expect(pickRecoverable([], 'C', new Set())).toBeNull();
    expect(pickRecoverable(entries, 'C', new Set())).toMatchObject({ entry: { tabId: 'B' }, openElsewhere: false, others: 1 });
    expect(pickRecoverable(entries, 'C', new Set(['B']))?.openElsewhere).toBe(true);
    expect(pickRecoverable(entries, 'B', new Set(['B']))?.openElsewhere).toBe(false); // el propio no cuenta
  });

  it('ensureTabId conserva el id de la pestaña y lo genera una sola vez', () => {
    const m = new Map<string, string>();
    const s = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    let n = 0;
    const gen = (): string => `id${(n += 1)}`;
    expect(ensureTabId(s, gen)).toBe('id1');
    expect(ensureTabId(s, gen)).toBe('id1');
    expect(ensureTabId(null, gen)).toBe('id2');
  });

  it('un índice corrupto se ignora', () => {
    expect(parseIndex('no es json')).toEqual([]);
    expect(parseIndex('[{"tabId":1}]')).toEqual([]);
  });
});

describe('presencia entre pestañas (BroadcastChannel)', () => {
  function bus(): () => ChannelLike {
    const listeners: { own: object; fn: (e: { data: unknown }) => void }[] = [];
    return () => {
      const own = {};
      return {
        postMessage: (data) => listeners.filter((l) => l.own !== own).forEach((l) => l.fn({ data })),
        addEventListener: (_t, fn) => void listeners.push({ own, fn }),
        close: () => undefined,
      };
    };
  }
  it('las pestañas distintas se ven; el mismo borrador en dos pestañas avisa', () => {
    const open = bus();
    let same = 0;
    const a = createPresence(open(), 'A', 'i1', () => (same += 1));
    const b = createPresence(open(), 'B', 'i2', () => undefined);
    expect([...a.live()]).toEqual(['B']);
    expect([...b.live()]).toEqual(['A']);
    expect(same).toBe(0);
    createPresence(open(), 'A', 'i3', () => undefined); // pestaña duplicada: mismo id de pestaña
    expect(same).toBe(1);
  });
});
