import { describe, expect, it } from 'vitest';
import { INFO_LIFETIME_MS, MAX_NOTICES, MAX_STORED_NOTICES, addNotice, noticeLifetimeMs, pushNotice, visibleNotices, type Notice } from './notices';

const n = (id: number, kind: Notice['kind'], text = `t${id}`): Notice => ({ id, kind, text });

describe('pushNotice', () => {
  it('agrega al final', () => {
    expect(pushNotice([n(1, 'info')], n(2, 'info')).map((x) => x.id)).toEqual([1, 2]);
  });
  it('no apila el mismo mensaje: reemplaza al anterior', () => {
    const out = pushNotice([n(1, 'info', 'Guardado'), n(2, 'aviso', 'Otro')], n(3, 'info', 'Guardado'));
    expect(out.map((x) => x.id)).toEqual([2, 3]);
  });
  it('mismo texto con distinto tipo son avisos distintos', () => {
    expect(pushNotice([n(1, 'info', 'x')], n(2, 'error', 'x'))).toHaveLength(2);
  });
  it('nunca supera el máximo', () => {
    let list: Notice[] = [];
    for (let i = 1; i <= 10; i++) list = pushNotice(list, n(i, 'info'));
    expect(list).toHaveLength(MAX_NOTICES);
    expect(list.map((x) => x.id)).toEqual([8, 9, 10]);
  });
  it('al recortar descarta antes los informativos que los errores y avisos', () => {
    let list: Notice[] = [n(1, 'error', 'e'), n(2, 'info'), n(3, 'aviso', 'a')];
    list = pushNotice(list, n(4, 'info'));
    expect(list.map((x) => x.id)).toEqual([1, 3, 4]);
  });
  it('no muta la lista de entrada', () => {
    const list = [n(1, 'info')];
    pushNotice(list, n(2, 'info'));
    expect(list).toHaveLength(1);
  });
});

describe('noticeLifetimeMs', () => {
  it('solo los informativos se cierran solos, a los 6 s', () => {
    expect(INFO_LIFETIME_MS).toBe(6000);
    expect(noticeLifetimeMs('info')).toBe(6000);
    expect(noticeLifetimeMs('aviso')).toBeNull();
    expect(noticeLifetimeMs('error')).toBeNull();
  });
});

describe('addNotice (UX9-06): repetidos con contador y sin descartar errores', () => {
  it('el mismo mensaje no se apila: sube el contador y pasa al final', () => {
    let list: Notice[] = [];
    list = addNotice(list, n(1, 'error', 'El archivo no es un JSON válido'));
    list = addNotice(list, n(2, 'aviso', 'Otro'));
    list = addNotice(list, n(3, 'error', 'El archivo no es un JSON válido'));
    list = addNotice(list, n(4, 'error', 'El archivo no es un JSON válido'));
    expect(list.map((x) => [x.id, x.count ?? 1])).toEqual([[2, 1], [4, 3]]);
  });
  it('mismo texto con distinto tipo son avisos distintos', () => {
    expect(addNotice([n(1, 'info', 'x')], n(2, 'error', 'x'))).toHaveLength(2);
  });
  it('no descarta errores por llegar más de 3: se guardan todos hasta el tope', () => {
    let list: Notice[] = [];
    for (let i = 1; i <= 8; i++) list = addNotice(list, n(i, 'error'));
    expect(list).toHaveLength(8);
  });
  it('el tope de almacenamiento descarta primero los informativos y después lo más antiguo', () => {
    let list: Notice[] = [n(0, 'error', 'e0')];
    for (let i = 1; i <= MAX_STORED_NOTICES + 5; i++) list = addNotice(list, n(i, i % 2 ? 'info' : 'error'));
    expect(list).toHaveLength(MAX_STORED_NOTICES);
    expect(list.at(-1)!.id).toBe(MAX_STORED_NOTICES + 5);
  });
  it('no muta la lista de entrada', () => {
    const list = [n(1, 'info', 'a')];
    addNotice(list, n(2, 'info', 'a'));
    expect(list[0]!.count).toBeUndefined();
  });
});

describe('visibleNotices (UX9-06): máximo visible con «ver más»', () => {
  const list = [n(1, 'info'), n(2, 'error'), n(3, 'aviso'), n(4, 'info'), n(5, 'error'), n(6, 'info')];
  it('hasta el máximo se ve todo', () => {
    expect(visibleNotices(list.slice(0, 3), false)).toEqual({ shown: list.slice(0, 3), hidden: 0 });
  });
  it('con más, se ven primero los errores, después avisos y lo más reciente, en orden cronológico', () => {
    const v = visibleNotices(list, false);
    expect(v.shown.map((x) => x.id)).toEqual([2, 3, 5]);
    expect(v.hidden).toBe(3);
  });
  it('expandido muestra todo', () => {
    expect(visibleNotices(list, true)).toEqual({ shown: list, hidden: 0 });
  });
  it('lista vacía', () => {
    expect(visibleNotices([], false)).toEqual({ shown: [], hidden: 0 });
  });
});
