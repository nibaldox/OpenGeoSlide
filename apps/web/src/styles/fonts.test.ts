import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// UA-D6 (contrato §3.3): Outfit y JetBrains Mono locales, solo los subconjuntos pedidos y como mucho 160 KB de woff2.

const here = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));
const fonts = readFileSync(here('./fonts.css'), 'utf8');
const tokens = readFileSync(here('./tokens.css'), 'utf8');
const pkg = JSON.parse(readFileSync(here('../../package.json'), 'utf8')) as { dependencies: Record<string, string> };
const main = readFileSync(here('../main.tsx'), 'utf8');

const faces = [...fonts.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => {
  const body = m[1];
  return {
    family: /font-family:\s*'([^']+)'/.exec(body)![1],
    url: /url\('([^']+)'\)/.exec(body)![1],
    range: /unicode-range:\s*([^;]+);/.exec(body)![1],
    display: /font-display:\s*(\w+)/.exec(body)?.[1],
  };
});

describe('fonts.css: fuentes locales (UA-D6)', () => {
  it('declara exactamente los cinco subconjuntos del contrato', () => {
    const names = faces.map((f) => /([a-z-]+)-wght-normal\.woff2$/.exec(f.url)![1]).sort();
    expect(names).toEqual(['jetbrains-mono-greek', 'jetbrains-mono-latin', 'jetbrains-mono-latin-ext', 'outfit-latin', 'outfit-latin-ext']);
    expect(faces.filter((f) => f.family === 'Outfit Variable')).toHaveLength(2);
    expect(faces.filter((f) => f.family === 'JetBrains Mono Variable')).toHaveLength(3);
  });

  it('todos los woff2 existen en node_modules, salen del paquete -variable y suman ≤ 160 KB', () => {
    let total = 0;
    for (const f of faces) {
      expect(f.url).toMatch(/@fontsource-variable\/(outfit|jetbrains-mono)\/files\/.+\.woff2$/);
      const path = fileURLToPath(new URL(f.url, new URL('./fonts.css', import.meta.url)));
      expect(existsSync(path), path).toBe(true);
      total += statSync(path).size;
      expect(f.display).toBe('swap');
    }
    expect(total).toBeLessThanOrEqual(160 * 1000);
  });

  it('no pide nada a internet: ni Google Fonts ni @import remoto ni url(http…)', () => {
    expect(fonts).not.toMatch(/googleapis|gstatic|https?:\/\//);
  });

  it('JetBrains Mono trae el griego (γ, λ, φ) y ninguna familia trae cirílico ni vietnamita', () => {
    const greek = faces.find((f) => f.url.includes('jetbrains-mono-greek'))!;
    expect(greek.range).toContain('U+03A3-03FF');
    expect(fonts).not.toMatch(/cyrillic|vietnamese/);
  });

  it('los paquetes van fijados a la versión exacta 5.3.0', () => {
    expect(pkg.dependencies['@fontsource-variable/outfit']).toBe('5.3.0');
    expect(pkg.dependencies['@fontsource-variable/jetbrains-mono']).toBe('5.3.0');
  });

  it('las pilas de tokens.css usan los nombres de familia declarados aquí', () => {
    expect(tokens).toMatch(/--ui-font-sans:\s*'Outfit Variable',\s*system-ui,\s*-apple-system,\s*'Segoe UI',\s*Roboto,\s*sans-serif;/);
    expect(tokens).toMatch(/--ui-font-mono:\s*'JetBrains Mono Variable',\s*ui-monospace,\s*'SFMono-Regular',\s*Menlo,\s*monospace;/);
  });

  it('el cuerpo usa la pila de texto, los controles la heredan y las cifras usan la mono con tabular-nums', () => {
    expect(fonts).toMatch(/\nbody\s*\{\s*font-family:\s*var\(--ui-font-sans\);/);
    expect(fonts).toMatch(/button,\s*input,\s*select,\s*textarea\s*\{\s*font-family:\s*inherit;/);
    const mono = /([^{}]*)\{\s*font-family:\s*var\(--ui-font-mono\);\s*font-variant-numeric:\s*tabular-nums;/.exec(fonts)!;
    for (const sel of ['.num', '.rs-fs', '.gs-mono', "input[inputmode='decimal']", 'kbd']) expect(mono[1], sel).toContain(sel);
  });

  it('main.tsx importa fonts.css desde src/ (así Vite emite los woff2 y la PWA los precachea)', () => {
    expect(main).toMatch(/import '\.\/styles\/fonts\.css';/);
  });
});
