import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// U1-T: ningún color literal fuera de tokens.css y de la paleta fija del PDF. Todo lo demás consume var(--…).

const SRC = fileURLToPath(new URL('..', import.meta.url));
const ALLOWED = new Set(['styles/tokens.css', 'report/palette.ts']);
const COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'wasm' || e.name === 'fixtures' ? [] : walk(path);
    return /\.(ts|tsx|css)$/.test(e.name) ? [path] : [];
  });
}

const isTestOrFixture = (rel: string): boolean => /\.test\.tsx?$/.test(rel) || /(^|\/)(fixtures|testFixtures)\.ts$/.test(rel);

describe('sin colores literales fuera de tokens.css y report/palette.ts', () => {
  const files = walk(SRC)
    .map((f) => relative(SRC, f).split(sep).join('/'))
    .filter((rel) => !ALLOWED.has(rel) && !isTestOrFixture(rel));

  it('revisa los archivos esperados (no está vacío)', () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain('App.css');
    expect(files).toContain('editor/canvas/EditorCanvas.tsx');
    expect(files).toContain('render/drawSection.ts');
    expect(files).toContain('pwa/updatePrompt.ts');
  });

  it('no hay #hex, rgb(), rgba(), hsl() ni hsla()', () => {
    const offenders: string[] = [];
    for (const rel of files) {
      readFileSync(join(SRC, rel), 'utf8')
        .split('\n')
        .forEach((line, i) => {
          for (const m of line.matchAll(COLOR)) offenders.push(`${rel}:${i + 1}: ${m[0]}`);
        });
    }
    expect(offenders).toEqual([]);
  });

  it('el detector reconoce los formatos prohibidos', () => {
    for (const bad of ['#fff', '#1f2937', '#12345678', 'rgb(0 0 0)', 'rgba(0,0,0,.5)', 'hsl(10 20% 30%)', 'hsla(1,2%,3%,.4)']) {
      expect(bad.match(COLOR), bad).not.toBeNull();
    }
    for (const ok of ['var(--ui-bg)', 'url(#arrow)', 'Región #12 de', 'light-dark(a, b)']) expect(ok.match(COLOR), ok).toBeNull();
  });
});
