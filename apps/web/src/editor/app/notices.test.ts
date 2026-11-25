import { describe, expect, it } from 'vitest';
import { INFO_LIFETIME_MS, MAX_NOTICES, noticeLifetimeMs, pushNotice, type Notice } from './notices';

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
