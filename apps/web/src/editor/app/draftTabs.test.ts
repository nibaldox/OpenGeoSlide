import { describe, expect, it } from 'vitest';
import { clearDraft, createMemoryStorage, DRAFT_KEY, loadDraft, loadDraftChain, saveDraft, type DraftStorage } from '../../io/draft';
import { SAME_DRAFT_TEXT, clearOwnDraft, discardOfferedDraft } from './useDraftAutosave';
import type { ModelDoc } from '../types';
import { DRAFT_INDEX_KEY, MAX_DRAFTS, TAB_ID_KEY, createPresence, draftKeyFor, ensureTabId, offeredDraftElsewhere, OPEN_ELSEWHERE_TEXT, parseIndex, pickRecoverable, tabDraftStorage, upsertEntry, type ChannelLike } from './draftTabs';

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

// Bus de prueba: cada canal recibe lo que publican los demás.
function busFor(): () => ChannelLike {
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
const bus = busFor;

describe('presencia entre pestañas (BroadcastChannel)', () => {
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
  it('onLiveChange avisa una sola vez por cada pestaña nueva (las repetidas no cuentan)', () => {
    const open = bus();
    let changes = 0;
    const a = createPresence(open(), 'A', 'i1', () => undefined, () => (changes += 1));
    expect(changes).toBe(0);
    createPresence(open(), 'B', 'i2', () => undefined); // dice «hola»: A la ve
    expect(changes).toBe(1);
    createPresence(open(), 'B', 'i4', () => undefined); // otra instancia con el id B: ya estaba
    expect(changes).toBe(1);
    createPresence(open(), 'C', 'i5', () => undefined);
    expect(changes).toBe(2);
    expect([...a.live()].sort()).toEqual(['B', 'C']);
  });
});

describe('aviso de borrador abierto en otra pestaña (U5-I, pickRecoverable().openElsewhere)', () => {
  const entry = { tabId: 'B', savedAt: t(2).toISOString(), fileName: 'b.ogs.json' };
  it('avisa solo si la pestaña dueña del borrador ofrecido sigue abierta y no es la propia', () => {
    expect(offeredDraftElsewhere(entry, 'C', new Set(['B']))).toBe(true);
    expect(offeredDraftElsewhere(entry, 'C', new Set(['A']))).toBe(false); // B ya se cerró (o no ha respondido)
    expect(offeredDraftElsewhere(entry, 'B', new Set(['B']))).toBe(false); // el propio no cuenta
    expect(offeredDraftElsewhere(null, 'C', new Set(['B']))).toBe(false); // sin borrador ofrecido
    expect(offeredDraftElsewhere({ ...entry, tabId: 'legacy' }, 'C', new Set(['B']))).toBe(false);
  });
  it('el texto dice que la otra pestaña sigue abierta', () => {
    expect(OPEN_ELSEWHERE_TEXT).toMatch(/otra pestaña que sigue abierta/);
  });
  it('de punta a punta con el almacenamiento: C ofrece el borrador de B y B aparece en la presencia', () => {
    const base = createMemoryStorage();
    saveDraft(tabDraftStorage({ base, tabId: 'A' }), doc('de A'), 'a.ogs.json', t(1));
    saveDraft(tabDraftStorage({ base, tabId: 'B' }), doc('de B'), 'b.ogs.json', t(2));
    const storageC = tabDraftStorage({ base, tabId: 'C' });
    const offered = storageC.latest();
    expect(offered?.tabId).toBe('B');
    const open = busFor();
    const c = createPresence(open(), 'C', 'ic', () => undefined);
    expect(offeredDraftElsewhere(offered, 'C', c.live())).toBe(false); // todavía nadie ha respondido
    createPresence(open(), 'B', 'ib', () => undefined);
    expect(offeredDraftElsewhere(offered, 'C', c.live())).toBe(true);
  });
});

// ───────── U6-D ─────────

/** Almacenamiento con cuota: lanza `QuotaExceededError` al escribir si se superaría `maxKeys` claves de borrador. */
function quotaStorage(maxBytes: number): DraftStorage & { map: Map<string, string>; log: string[] } {
  const map = new Map<string, string>();
  const log: string[] = [];
  const used = (): number => [...map.entries()].reduce((n, [k, v]) => n + k.length + v.length, 0);
  return {
    map,
    log,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      log.push(`set ${k}`);
      if (used() - (map.get(k)?.length ?? 0) - (map.has(k) ? k.length : 0) + k.length + v.length > maxBytes) {
        throw Object.assign(new Error('cuota'), { name: 'QuotaExceededError', code: 22 });
      }
      map.set(k, v);
    },
    removeItem: (k) => {
      log.push(`del ${k}`);
      map.delete(k);
    },
  };
}

describe('R9-01: guardar o descartar en una pestaña no borra el borrador de otra', () => {
  it('«Guardar» en B (clearOwnDraft) deja el borrador sin guardar de A', () => {
    const base = createMemoryStorage();
    saveDraft(tabDraftStorage({ base, tabId: 'A' }), doc('de A'), 'a.ogs.json', t(1));
    const b = tabDraftStorage({ base, tabId: 'B' });
    saveDraft(b, doc('de B'), 'b.ogs.json', t(5));
    clearOwnDraft(b);
    expect(base.getItem(draftKeyFor('B'))).toBeNull();
    expect(base.getItem(draftKeyFor('A'))).toContain('de A');
    expect(parseIndex(base.getItem(DRAFT_INDEX_KEY)).map((e) => e.tabId)).toEqual(['A']);
  });
  it('«Guardar» en B sin borrador propio tampoco toca el de A, aunque sea el más reciente', () => {
    const base = createMemoryStorage();
    saveDraft(tabDraftStorage({ base, tabId: 'A' }), doc('de A'), null, t(9));
    clearOwnDraft(tabDraftStorage({ base, tabId: 'B' }));
    expect(base.getItem(draftKeyFor('A'))).toContain('de A');
  });
  it('«Descartar» en B con A abierta solo oculta el aviso: el borrador de A sigue', () => {
    const base = createMemoryStorage();
    saveDraft(tabDraftStorage({ base, tabId: 'A' }), doc('de A'), null, t(1));
    const b = tabDraftStorage({ base, tabId: 'B' });
    const offered = b.latest();
    expect(discardOfferedDraft(b, offered, true)).toBe(false);
    expect(base.getItem(draftKeyFor('A'))).toContain('de A');
    expect(loadDraft(b).draft?.doc.meta.title).toBe('de A');
  });
  it('«Descartar» con la pestaña dueña cerrada borra solo el ofrecido', () => {
    const base = createMemoryStorage();
    saveDraft(tabDraftStorage({ base, tabId: 'A' }), doc('de A'), null, t(1));
    saveDraft(tabDraftStorage({ base, tabId: 'Z' }), doc('de Z'), null, t(7));
    const b = tabDraftStorage({ base, tabId: 'B' });
    saveDraft(b, doc('de B'), null, t(3));
    const offered = b.latest(); // Z (más reciente)
    expect(discardOfferedDraft(b, offered, false)).toBe(true);
    expect(base.getItem(draftKeyFor('Z'))).toBeNull();
    expect(base.getItem(draftKeyFor('B'))).toContain('de B'); // el propio sigue
    expect(base.getItem(draftKeyFor('A'))).toContain('de A');
  });
  it('si el borrador ofrecido es el propio (recarga), «Descartar» sí lo borra', () => {
    const base = createMemoryStorage();
    const a = tabDraftStorage({ base, tabId: 'A' });
    saveDraft(a, doc('de A'), null, t(1));
    expect(discardOfferedDraft(a, a.latest(), false)).toBe(true);
    expect(base.getItem(draftKeyFor('A'))).toBeNull();
  });
  it('sin almacenamiento por pestaña (memoria) clearOwnDraft y discardOfferedDraft borran la clave única', () => {
    const base = createMemoryStorage();
    saveDraft(base, doc('x'), null, t(1));
    clearOwnDraft(base);
    expect(base.getItem(DRAFT_KEY)).toBeNull();
    saveDraft(base, doc('y'), null, t(2));
    expect(discardOfferedDraft(base, null, false)).toBe(true);
    expect(base.getItem(DRAFT_KEY)).toBeNull();
  });
});

describe('R9-02b: una pestaña duplicada recibe un id propio', () => {
  it('la nueva se renombra, migra lo que escribió y avisa; la original conserva id y borrador', () => {
    const base = createMemoryStorage();
    const original = tabDraftStorage({ base, tabId: 'A' });
    saveDraft(original, doc('original'), null, t(1));
    const open = busFor();
    const session: Record<string, string> = { [TAB_ID_KEY]: 'A' };
    let sameOriginal = 0;
    let sameDup = 0;
    const live = { dup: 0 };
    createPresence(open(), 'A', 'i-orig', () => (sameOriginal += 1), undefined, { born: 100, renameTab: () => 'never' });
    const dupStorage = tabDraftStorage({ base, tabId: 'A' }); // hereda el id de sessionStorage
    const dup = createPresence(
      open(),
      'A',
      'i-dup',
      () => (sameDup += 1),
      () => (live.dup += 1),
      {
        born: 200,
        renameTab: () => {
          session[TAB_ID_KEY] = 'A2';
          dupStorage.rename('A2');
          return 'A2';
        },
      },
    );
    expect(session[TAB_ID_KEY]).toBe('A2');
    expect(dupStorage.tabId()).toBe('A2');
    expect(sameDup).toBe(1);
    expect(sameOriginal).toBe(0);
    expect(dup.live().has('A')).toBe(true); // la original sigue abierta
    // La duplicada edita y guarda: ya no pisa a la original.
    saveDraft(dupStorage, doc('pisado por duplicada'), null, t(5));
    expect(base.getItem(draftKeyFor('A'))).toContain('original');
    expect(base.getItem(draftKeyFor('A2'))).toContain('pisado por duplicada');
  });
  it('la más antigua conserva su id aunque reciba el «hola» y el «aquí» de la duplicada', () => {
    const open = busFor();
    const renamed: string[] = [];
    createPresence(open(), 'A', 'i1', () => undefined, undefined, { born: 1, renameTab: (o) => (renamed.push(`1:${o}`), 'x') });
    createPresence(open(), 'A', 'i2', () => undefined, undefined, { born: 2, renameTab: (o) => (renamed.push(`2:${o}`), 'A2') });
    expect(renamed).toEqual(['2:A']);
  });
  it('con el mismo instante, el desempate por instanceId también elige una sola', () => {
    const open = busFor();
    const renamed: string[] = [];
    createPresence(open(), 'A', 'a', () => undefined, undefined, { born: 5, renameTab: () => (renamed.push('a'), 'A-a') });
    createPresence(open(), 'A', 'b', () => undefined, undefined, { born: 5, renameTab: () => (renamed.push('b'), 'A-b') });
    expect(renamed).toEqual(['b']);
  });
  it('rename() con un borrador propio ya escrito lo migra a la clave nueva', () => {
    const base = createMemoryStorage();
    const s = tabDraftStorage({ base, tabId: 'A' });
    saveDraft(s, doc('mío'), null, t(1));
    s.rename('A2');
    expect(base.getItem(draftKeyFor('A2'))).toContain('mío');
    expect(parseIndex(base.getItem(DRAFT_INDEX_KEY)).map((e) => e.tabId).sort()).toEqual(['A', 'A2']);
  });
  it('SAME_DRAFT_TEXT dice la verdad: duplicado, borrador propio, ninguna pisa a la otra', () => {
    expect(SAME_DRAFT_TEXT).toMatch(/duplicado/);
    expect(SAME_DRAFT_TEXT).toMatch(/propio/);
    expect(SAME_DRAFT_TEXT).toMatch(/ninguna pisa a la otra/);
  });
});

describe('R9-08a: escritura robusta ante cuota llena', () => {
  const seed = (s: DraftStorage, n: number, at: (i: number) => Date, size = 300): void => {
    for (let i = 0; i < n; i += 1) saveDraft(tabDraftStorage({ base: s, tabId: `T${i}` }), { ...doc(`d${i}`), meta: { id: 'x', title: 'x'.repeat(size) } }, null, at(i));
  };
  it('borra los `dropped` ANTES de escribir el nuevo borrador', () => {
    const s = quotaStorage(1_000_000);
    seed(s, MAX_DRAFTS, (i) => t(i)); // 8 entradas
    s.log.length = 0;
    saveDraft(tabDraftStorage({ base: s, tabId: 'NEW', now: () => t(30) }), doc('nuevo'), null, t(30));
    const firstSet = s.log.findIndex((l) => l === `set ${draftKeyFor('NEW')}`);
    const firstDel = s.log.findIndex((l) => l === `del ${draftKeyFor('T0')}`);
    expect(firstDel).toBeGreaterThanOrEqual(0);
    expect(firstDel).toBeLessThan(firstSet);
    expect(s.map.has(draftKeyFor('T0'))).toBe(false); // el más antiguo se podó
    expect(parseIndex(s.getItem(DRAFT_INDEX_KEY)).length).toBe(MAX_DRAFTS);
  });
  it('con la cuota casi llena por borradores viejos, guarda tras liberar espacio (antes fallaba)', () => {
    const s = quotaStorage(100_000);
    seed(s, MAX_DRAFTS, (i) => t(i), 10_000); // ~80 kB usados
    const r = saveDraft(tabDraftStorage({ base: s, tabId: 'NEW', now: () => t(30) }), { ...doc('n'), meta: { id: 'x', title: 'y'.repeat(30_000) } }, null, t(30));
    expect(r.ok).toBe(true);
    expect(s.map.get(draftKeyFor('NEW'))).toContain('yyy');
    const ids = parseIndex(s.getItem(DRAFT_INDEX_KEY)).map((e) => e.tabId);
    expect(ids).toContain('NEW');
    // Todo lo que hay en el almacenamiento está en el índice: nada huérfano.
    const keys = [...s.map.keys()].filter((k) => k.includes('.tab.')).map((k) => k.split('.tab.')[1]);
    expect(keys.sort()).toEqual([...ids].sort());
  });
  it('ante QuotaExceededError quita el borrador ajeno más antiguo y reintenta una sola vez', () => {
    const s = quotaStorage(40_000);
    seed(s, 3, (i) => t(i), 12_000);
    s.log.length = 0;
    const r = saveDraft(tabDraftStorage({ base: s, tabId: 'NEW', now: () => t(30) }), { ...doc('n'), meta: { id: 'x', title: 'z'.repeat(12_000) } }, null, t(30));
    expect(r.ok).toBe(true);
    expect(s.map.has(draftKeyFor('T0'))).toBe(false); // el más antiguo
    expect(s.map.has(draftKeyFor('T2'))).toBe(true);
    expect(s.log.filter((l) => l === `set ${draftKeyFor('NEW')}`).length).toBe(2); // un intento + un reintento, no más
  });
  it('si aun así no cabe: error visible (storage_error), sin huérfanos ni borrar el propio sin necesidad', () => {
    const s = quotaStorage(2_000);
    seed(s, 2, (i) => t(i), 200);
    const r = saveDraft(tabDraftStorage({ base: s, tabId: 'NEW', now: () => t(30) }), { ...doc('n'), meta: { id: 'x', title: 'w'.repeat(5_000) } }, null, t(30));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('storage_error');
      expect(r.text).toMatch(/No se pudo guardar el borrador/);
    }
    expect(s.map.has(draftKeyFor('NEW'))).toBe(false);
    const ids = parseIndex(s.getItem(DRAFT_INDEX_KEY)).map((e) => e.tabId);
    const keys = [...s.map.keys()].filter((k) => k.includes('.tab.')).map((k) => k.split('.tab.')[1]);
    expect(keys.sort()).toEqual([...ids].sort());
  });
  it('un error que no es de cuota no reintenta ni borra borradores ajenos', () => {
    const base = createMemoryStorage();
    saveDraft(tabDraftStorage({ base, tabId: 'A' }), doc('de A'), null, t(1));
    const broken: DraftStorage = { ...base, setItem: () => { throw new Error('bloqueado'); } };
    const r = saveDraft(tabDraftStorage({ base: broken, tabId: 'B' }), doc('de B'), null, t(2));
    expect(r.ok).toBe(false);
    expect(base.getItem(draftKeyFor('A'))).toContain('de A');
  });
  it('si el índice no cabe tras escribir el borrador, no queda huérfano', () => {
    const base = createMemoryStorage();
    const failIndex: DraftStorage = {
      ...base,
      setItem: (k, v) => {
        if (k === DRAFT_INDEX_KEY) throw Object.assign(new Error('cuota'), { name: 'QuotaExceededError' });
        base.setItem(k, v);
      },
    };
    const r = saveDraft(tabDraftStorage({ base: failIndex, tabId: 'B' }), doc('de B'), null, t(2));
    expect(r.ok).toBe(false);
    expect(base.getItem(draftKeyFor('B'))).toBeNull();
  });
});

describe('R9-08b: borrador heredado corrupto', () => {
  it('se muestra como io.draft_invalid y se limpia', () => {
    const base = createMemoryStorage();
    base.setItem(DRAFT_KEY, '{CORRUPT_JSON');
    const r = loadDraft(tabDraftStorage({ base, tabId: 'A' }));
    expect(r.draft).toBeNull();
    expect(r.issues.map((i) => i.code)).toEqual(['io.draft_invalid']);
    expect(base.getItem(DRAFT_KEY)).toBeNull();
  });
  it('con un borrador válido de otra pestaña, se avisa del corrupto y se sigue ofreciendo el válido', () => {
    const base = createMemoryStorage();
    saveDraft(tabDraftStorage({ base, tabId: 'B' }), doc('de B'), null, new Date(Date.now() - 3600_000));
    base.setItem(DRAFT_KEY, '{CORRUPT_JSON');
    const r = loadDraftChain(tabDraftStorage({ base, tabId: 'A' }));
    expect(r.issues.map((i) => i.code)).toEqual(['io.draft_invalid']);
    expect(r.draft?.doc.meta.title).toBe('de B');
    expect(base.getItem(DRAFT_KEY)).toBeNull();
    expect(base.getItem(draftKeyFor('B'))).toContain('de B'); // lo válido no se toca
  });
  it('el heredado corrupto nunca se queda para siempre en localStorage', () => {
    const base = createMemoryStorage();
    base.setItem(DRAFT_KEY, 'no es json');
    loadDraftChain(tabDraftStorage({ base, tabId: 'A' }));
    expect(base.getItem(DRAFT_KEY)).toBeNull();
    expect(loadDraftChain(tabDraftStorage({ base, tabId: 'A' })).issues).toEqual([]);
  });
});
