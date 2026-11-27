// UA1-S: los 28 íconos de la suite (contrato §4.4): lineales, 24 × 24, trazo de 1,8 en currentColor, decorativos.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as icons from './icons';

const entries = Object.entries(icons).filter(([name]) => name.startsWith('Icon') && name !== 'IconProps') as [
  string,
  (props: { size?: number }) => React.ReactElement,
][];

const EXPECTED = [
  'IconSelect', 'IconAddVertex', 'IconDrawRegion', 'IconSplitRegion', 'IconReinforce', 'IconPan',
  'IconZoomIn', 'IconZoomOut', 'IconFit',
  'IconUndo', 'IconRedo', 'IconHelp', 'IconSun', 'IconMoon', 'IconFile', 'IconExport', 'IconInstall',
  'IconChevronDown', 'IconCollapse', 'IconCheck', 'IconWarning', 'IconClose',
  'IconCanvas', 'IconTable', 'IconShield', 'IconDoc',
  'IconPlay', 'IconPdf',
];

describe('UA1-S: íconos de la suite', () => {
  it('exporta los 28 nombres del contrato', () => {
    expect(EXPECTED).toHaveLength(28);
    expect(entries.map(([n]) => n).sort()).toEqual([...EXPECTED].sort());
  });

  it.each(entries)('%s es un svg decorativo lineal de 24 × 24 con trazo de 1,8 en currentColor', (_name, Icon) => {
    const html = renderToStaticMarkup(createElement(Icon, {}));
    expect(html.startsWith('<svg')).toBe(true);
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('stroke-width="1.8"');
    expect(html).toContain('fill="none"');
    expect(html).toContain('width="18"');
    expect(html).toContain('height="18"');
    // Dibuja algo y no es el cuadrado provisional de UA0.
    expect(html).toMatch(/<(path|circle)\b/);
    expect(html).not.toContain('<rect x="5" y="5" width="14" height="14" rx="3"');
    // Ningún color literal en el dibujo.
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
    // Sin texto: el ícono no entra en el nombre accesible.
    expect(html.replace(/<[^>]*>/g, '')).toBe('');
  });

  it('respeta `size`', () => {
    const html = renderToStaticMarkup(createElement(icons.IconCheck, { size: 28 }));
    expect(html).toContain('width="28"');
    expect(html).toContain('height="28"');
  });

  it('cada ícono tiene un dibujo distinto', () => {
    const drawings = new Map<string, string[]>();
    for (const [name, Icon] of entries) {
      const inner = renderToStaticMarkup(createElement(Icon, {})).replace(/^<svg[^>]*>/, '');
      drawings.set(inner, [...(drawings.get(inner) ?? []), name]);
    }
    expect([...drawings.values()].filter((names) => names.length > 1)).toEqual([]);
  });

  it('el archivo no contiene colores literales', () => {
    const src = readFileSync(new URL('./icons.tsx', import.meta.url), 'utf8');
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
