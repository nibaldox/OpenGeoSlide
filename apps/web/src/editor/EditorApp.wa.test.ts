// CM-WA (X35 §3, punto 8): el rótulo del modelo de arranque en la cabecera del lienzo.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { docLabelText } from './EditorApp';

describe('rótulo del documento en `.ua-main-head`', () => {
  it('el modelo de arranque dice que es un ejemplo y que no tiene cambios', () => {
    const t = docLabelText({ fileName: null, title: 'ACADS 1(a): talud homogéneo seco', example: true, dirty: false });
    expect(t).toBe('Ejemplo: ACADS 1(a): talud homogéneo seco · sin cambios');
  });

  it('con cambios sin guardar lo dice; un archivo lleva su nombre; un modelo sin título dice «Sin título»', () => {
    expect(docLabelText({ fileName: null, title: 'ACADS 1(a)', example: true, dirty: true })).toBe('Ejemplo: ACADS 1(a) · con cambios sin guardar');
    expect(docLabelText({ fileName: 'talud.ogs.json', title: 'Mi talud', example: false, dirty: false })).toBe('Mi talud (talud.ogs.json) · sin cambios');
    expect(docLabelText({ fileName: null, title: '', example: false, dirty: false })).toBe('Sin título · sin cambios');
  });

  const src = readFileSync(new URL('./EditorApp.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./app/docLabel.css', import.meta.url), 'utf8');

  it('EditorApp lo pinta dentro de `.ua-title`, en el lugar del espaciador, salvo en Casos', () => {
    const head = src.slice(src.indexOf('<div className="ua-main-head">'));
    const title = head.slice(0, head.indexOf('<ViewTabs'));
    expect(title).toContain('data-testid="doc-label"');
    expect(title).toContain('className="ua-spacer ua-doc-label"');
    expect(title).toContain('title={docLabel}');
    expect(title).toMatch(/view === 'cases' \? \(\s+<span className="ua-spacer" \/>/);
  });

  it('el estilo lo recorta en una línea con puntos suspensivos, sin alto propio', () => {
    expect(css).toMatch(/white-space:\s*nowrap/);
    expect(css).toMatch(/text-overflow:\s*ellipsis/);
    expect(css).toMatch(/overflow:\s*hidden/);
    expect(css).toMatch(/min-width:\s*0/);
    expect(css).not.toMatch(/\b(min-)?height\s*:/);
  });
});
