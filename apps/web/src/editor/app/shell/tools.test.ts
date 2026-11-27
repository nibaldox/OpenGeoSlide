import { describe, expect, it } from 'vitest';
import { shortcutFor } from '../shortcuts';
import { toolDef, TOOLS, toolStatusText, toolTitle } from './tools';

describe('herramientas del lienzo', () => {
  it('son las seis de siempre, en su orden y con sus nombres', () => {
    expect(TOOLS.map((t) => t.label)).toEqual(['Seleccionar', 'Agregar vértice', 'Dibujar región', 'Dividir región', 'Dibujar refuerzo', 'Mover vista']);
  });
  it('la tecla del tooltip dispara la herramienta en shortcuts.ts', () => {
    for (const t of TOOLS) {
      const keys = (t.shortcuts ?? '').split(' ').filter(Boolean);
      expect(keys.length, t.label).toBeGreaterThan(0);
      for (const key of keys) {
        expect(shortcutFor({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }), `${t.label} ${key}`).toBe(`tool:${t.tool}`);
      }
      expect(keys).toContain(t.key);
    }
  });
  it('«Dibujar refuerzo» anuncia F y conserva E', () => {
    expect(toolDef('draw_reinforcement')).toMatchObject({ key: 'F', shortcuts: 'F E' });
  });
  it('title: «Tecla X»; texto de la barra de estado: «Herramienta: …»', () => {
    expect(toolTitle(toolDef('select')!)).toBe('Tecla V');
    expect(toolStatusText('select')).toBe('Herramienta: Seleccionar');
    expect(toolStatusText('pan')).toBe('Herramienta: Mover vista');
  });
});
