import { describe, expect, it } from 'vitest';
import { isEditableTag, shortcutFor, type KeyLike } from './shortcuts';

const k = (key: string, over: Partial<KeyLike> = {}): KeyLike => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...over });

describe('shortcutFor', () => {
  it('deshacer y rehacer', () => {
    expect(shortcutFor(k('z', { ctrlKey: true }))).toBe('undo');
    expect(shortcutFor(k('Z', { ctrlKey: true, shiftKey: true }))).toBe('redo');
    expect(shortcutFor(k('y', { ctrlKey: true }))).toBe('redo');
    expect(shortcutFor(k('z', { metaKey: true }))).toBe('undo');
  });

  it('guardar, abrir y comprobar', () => {
    expect(shortcutFor(k('s', { ctrlKey: true }))).toBe('save');
    expect(shortcutFor(k('o', { ctrlKey: true }))).toBe('open');
    expect(shortcutFor(k('Enter', { ctrlKey: true }))).toBe('check');
  });

  it('herramientas con una letra, salvo en un campo de texto', () => {
    expect(shortcutFor(k('v'))).toBe('tool:select');
    expect(shortcutFor(k('a'))).toBe('tool:add_vertex');
    expect(shortcutFor(k('h'))).toBe('tool:pan');
    expect(shortcutFor(k('r'))).toBe('tool:draw_region');
    expect(shortcutFor(k('d'))).toBe('tool:split_region');
    expect(shortcutFor(k('D'))).toBe('tool:split_region');
    expect(shortcutFor(k('e'))).toBe('tool:draw_reinforcement');
    expect(shortcutFor(k('E'))).toBe('tool:draw_reinforcement');
    expect(shortcutFor(k('f'))).toBe('tool:draw_reinforcement');
    expect(shortcutFor(k('F'))).toBe('tool:draw_reinforcement');
    expect(shortcutFor(k('f', { inField: true }))).toBeNull();
    expect(shortcutFor(k('f', { ctrlKey: true }))).toBeNull();
    expect(shortcutFor(k('e', { inField: true }))).toBeNull();
    expect(shortcutFor(k('e', { ctrlKey: true }))).toBeNull();
    expect(shortcutFor(k('d', { inField: true }))).toBeNull();
    expect(shortcutFor(k('d', { ctrlKey: true }))).toBeNull();
    expect(shortcutFor(k('R'))).toBe('tool:draw_region');
    expect(shortcutFor(k('r', { inField: true }))).toBeNull();
    expect(shortcutFor(k('r', { ctrlKey: true }))).toBeNull();
    expect(shortcutFor(k('a', { inField: true }))).toBeNull();
  });

  it('en un campo, Ctrl+Z y Ctrl+Y son del campo; Ctrl+S sigue guardando', () => {
    expect(shortcutFor(k('z', { ctrlKey: true, inField: true }))).toBeNull();
    expect(shortcutFor(k('Z', { ctrlKey: true, shiftKey: true, inField: true }))).toBeNull();
    expect(shortcutFor(k('s', { ctrlKey: true, inField: true }))).toBe('save');
  });

  it('un evento ya gestionado (por el lienzo) se ignora', () => {
    expect(shortcutFor(k('z', { ctrlKey: true, defaultPrevented: true }))).toBeNull();
  });

  it('teclas no asignadas', () => {
    expect(shortcutFor(k('q'))).toBeNull();
    expect(shortcutFor(k('a', { altKey: true }))).toBeNull();
    expect(shortcutFor(k('x', { ctrlKey: true }))).toBeNull();
  });

  it('isEditableTag', () => {
    expect(isEditableTag('INPUT')).toBe(true);
    expect(isEditableTag('select')).toBe(true);
    expect(isEditableTag('button')).toBe(false);
    expect(isEditableTag('div', true)).toBe(true);
  });
});
