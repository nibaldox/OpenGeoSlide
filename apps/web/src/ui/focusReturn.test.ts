import { describe, expect, it } from 'vitest';
import { pickReturnFocus, returnFocusCandidates, type FocusLookup } from './focusReturn';

interface El {
  name: string;
  alive: boolean;
  trigger?: El;
}
const el = (name: string, alive = true, trigger?: El): El => ({ name, alive, trigger });
const main = el('main');
const lookup: FocusLookup<El> = {
  menuTrigger: (e) => e.trigger ?? null,
  main: () => main,
  usable: (e) => e.alive,
  isResolver: (s): s is () => El | null => typeof s === 'function',
};

describe('pickReturnFocus', () => {
  it('el disparador, si se puede enfocar', () => {
    const opener = el('nuevo');
    expect(pickReturnFocus(undefined, opener, lookup)).toBe(opener);
  });
  it('un returnFocus explícito (elemento o función) va primero', () => {
    const opener = el('a');
    const other = el('b');
    expect(pickReturnFocus(other, opener, lookup)).toBe(other);
    expect(pickReturnFocus(() => other, opener, lookup)).toBe(other);
  });
  it('un explícito que ya no sirve cae al disparador', () => {
    const opener = el('a');
    expect(pickReturnFocus(el('muerto', false), opener, lookup)).toBe(opener);
    expect(pickReturnFocus(() => null, opener, lookup)).toBe(opener);
  });
  it('un elemento de menú oculto devuelve el foco al botón que abre el menú («Archivo»)', () => {
    const archivo = el('Archivo');
    const item = el('Nuevo', false, archivo);
    expect(pickReturnFocus(undefined, item, lookup)).toBe(archivo);
  });
  it('sin ninguno utilizable (tarjeta de región eliminada) cae en #main-content, no en <body>', () => {
    expect(pickReturnFocus(undefined, el('tarjeta', false), lookup)).toBe(main);
    expect(pickReturnFocus(undefined, null, lookup)).toBe(main);
  });
  it('si ni main sirve, devuelve null', () => {
    main.alive = false;
    expect(pickReturnFocus(undefined, null, lookup)).toBeNull();
    main.alive = true;
  });
  it('orden de los candidatos: explícito, disparador, menú del disparador, main', () => {
    const archivo = el('Archivo');
    const item = el('Nuevo', false, archivo);
    const exp = el('exp');
    expect(returnFocusCandidates(exp, item, lookup).filter((c) => c !== null).map((c) => c.name)).toEqual(['exp', 'Nuevo', 'Archivo', 'main']);
  });
});
