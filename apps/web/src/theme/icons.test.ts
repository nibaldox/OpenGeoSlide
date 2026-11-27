import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// UA1-T (contrato §3.4): el ícono es la marca de la suite con colores fijos del tema oscuro y el manifiesto usa el fondo oscuro.

const here = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));
const read = (rel: string): string => readFileSync(here(rel), 'utf8');
const manifest = JSON.parse(read('../../public/manifest.webmanifest')) as {
  background_color: string;
  theme_color: string;
  icons: { src: string; sizes: string; purpose: string }[];
};

/** Ancho y alto del IHDR de un PNG. */
function pngSize(path: string): [number, number] {
  const b = readFileSync(path);
  expect(b.subarray(1, 4).toString('latin1')).toBe('PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe('ícono de la app y manifiesto', () => {
  it('manifest.webmanifest usa --ui-bg oscuro de tokens.css como background_color y theme_color', () => {
    const bg = /--ui-bg:\s*light-dark\(#[0-9a-f]{6},\s*(#[0-9a-f]{6})\)/i.exec(read('../styles/tokens.css'))![1];
    expect(bg).toBe('#0a0a0b');
    expect(manifest.background_color).toBe(bg);
    expect(manifest.theme_color).toBe(bg);
  });

  it('cada ícono del manifiesto existe y mide lo que declara', () => {
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
    for (const icon of manifest.icons) {
      const path = here(`../../public/${icon.src}`);
      expect(existsSync(path), icon.src).toBe(true);
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(pngSize(path), icon.src).toEqual([w, h]);
    }
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });

  it('icon.svg es la marca de la suite (cuadro r = 8, talud y arco discontinuo) con colores fijos, sin var() ni currentColor', () => {
    const svg = read('../../public/icons/icon.svg');
    expect(svg).toContain('viewBox="0 0 32 32"');
    expect(svg).toContain('rx="8"');
    expect(svg).toContain('M5 23h6.5l9-11H27');
    expect(svg).toContain('M10.5 23Q21 23.5 23.5 12');
    expect(svg).toContain('stroke-dasharray="2.2 2.4"');
    expect(svg).not.toMatch(/var\(|currentColor/);
    for (const hex of ['#161e27', '#2c77c3', '#6db3f2']) expect(svg).toContain(hex);
  });

  it('el favicon y el apple-touch-icon salen de public/icons y el theme-color de index.html es el de la app', () => {
    const html = read('../../index.html');
    expect(html).toContain('href="%BASE_URL%icons/icon.svg"');
    expect(html).toContain('href="%BASE_URL%icons/icon-192.png"');
    expect(html).toContain('data-scheme="dark" data-color="#0a0a0b"');
  });
});
