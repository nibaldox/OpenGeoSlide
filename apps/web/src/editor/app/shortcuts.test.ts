import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isEditableTag, runCheckShortcut, shortcutFor, type KeyLike } from './shortcuts';

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

describe('CM-WA 1d: Ctrl/Cmd+Intro con el foco en un campo', () => {
  it('con un campo enfocado, confirma el campo y comprueba después, con el estado ya repintado', () => {
    const log: string[] = [];
    let repaint: (() => void) | null = null;
    runCheckShortcut({
      commitFocused: () => {
        log.push('commit');
        return true;
      },
      check: () => log.push('check'),
      defer: (run) => {
        log.push('defer');
        repaint = run;
      },
    });
    expect(log).toEqual(['commit', 'defer']);
    repaint!();
    expect(log).toEqual(['commit', 'defer', 'check']);
  });

  it('sin campo enfocado, comprueba de inmediato (como antes)', () => {
    const log: string[] = [];
    runCheckShortcut({ commitFocused: () => false, check: () => log.push('check'), defer: () => log.push('defer') });
    expect(log).toEqual(['check']);
  });

  it('por defecto espera un turno (setTimeout)', async () => {
    const log: string[] = [];
    runCheckShortcut({ commitFocused: () => true, check: () => log.push('check') });
    expect(log).toEqual([]);
    await new Promise((r) => setTimeout(r, 5));
    expect(log).toEqual(['check']);
  });

  it('el evento que cancela el campo (defaultPrevented) no dispara el atajo; el campo ya no lo cancela con Ctrl/Cmd', () => {
    expect(shortcutFor(k('Enter', { ctrlKey: true, inField: true }))).toBe('check');
    expect(shortcutFor(k('Enter', { metaKey: true, inField: true }))).toBe('check');
    expect(shortcutFor(k('Enter', { ctrlKey: true, inField: true, defaultPrevented: true }))).toBeNull();
    expect(shortcutFor(k('Enter', { inField: true }))).toBeNull(); // Intro sin modificadores no es un atajo
  });

  it('EditorApp enruta `check` por runCheckShortcut, confirmando el campo con foco y leyendo el último onCheck', () => {
    const src = readFileSync(new URL('../EditorApp.tsx', import.meta.url), 'utf8');
    expect(src).toMatch(/check: \(\) => runCheckShortcut\(\{ commitFocused: \(\) => commitFocusedField\(document\.activeElement\), check: \(\) => void onCheckRef\.current\(\) \}\),/);
    expect(src).toMatch(/onCheckRef\.current = onCheck;/);
  });
});
