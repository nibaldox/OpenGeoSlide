// CM-WB: invariantes de la hoja del armazón para pantallas de ≤ 360 px (cabecera, cabecera del lienzo y avisos compactos).
// Se leen las reglas, no el píxel: la medida en Chrome está en el barrido de `docs/cm/` (320 × 568 deja 210 px al lienzo sin avisos).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const raw = readFileSync(new URL('../editor/app/shell/shell.css', import.meta.url), 'utf8');
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');

/** Cuerpos (anidados) de todos los `@media (query)`, con equilibrio de llaves, y su posición. */
function mediaBlocks(src: string, query: string): Array<{ at: number; body: string }> {
  const out: Array<{ at: number; body: string }> = [];
  const head = `@media (${query}) {`;
  for (let from = 0; ; ) {
    const at = src.indexOf(head, from);
    if (at < 0) break;
    let depth = 1;
    let i = at + head.length;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    }
    out.push({ at, body: src.slice(at + head.length, i - 1) });
    from = i;
  }
  return out;
}
/** Parte una lista de selectores por las comas que no están dentro de paréntesis (`:is(a, b)`). */
function splitList(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of list) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
/** Cuerpos de las reglas cuyo selector (uno de la lista, sin espacios de más) es exactamente `selector`. */
function rule(src: string, selector: string): string {
  const bodies: string[] = [];
  const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
  for (const m of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (splitList(m[1]!).some((s) => norm(s) === norm(selector))) bodies.push(m[2]!);
  }
  if (!bodies.length) throw new Error(`no hay una regla con el selector «${selector}»`);
  return bodies.join('\n');
}

const narrow = mediaBlocks(css, 'max-width: 360px');
const mobile = mediaBlocks(css, 'max-width: 760px');

describe('CM-WB: hoja para ≤ 360 px', () => {
  it('hay un solo bloque @media (max-width: 360px), y va después del de 760 px que reglas suyas pisan', () => {
    expect(narrow).toHaveLength(1);
    expect(mobile.length).toBeGreaterThan(0);
    // Mismo peso de selector: gana el que viene después en la hoja.
    expect(narrow[0]!.at).toBeGreaterThan(Math.max(...mobile.map((m) => m.at)));
  });

  const n = narrow[0]!.body;

  it('la cabecera de la app: relleno de 6 × 10 y la marca de 28; sin tocar el markup', () => {
    expect(rule(n, '.ua-header')).toMatch(/padding:\s*6px 10px/);
    expect(rule(n, '.brand-mark')).toMatch(/width:\s*28px/);
    expect(rule(n, '.brand-mark')).toMatch(/height:\s*28px/);
    expect(rule(n, '.ua-brand h1')).toMatch(/font-size:\s*17px/);
  });
  it('la marca no se encoge y el chip toma el resto de la primera fila, con elipsis (el `title` lleva el texto completo)', () => {
    expect(rule(n, '.ua-brand')).toMatch(/flex:\s*0 0 auto/);
    const slot = rule(n, '.ua-chip-slot');
    expect(slot).toMatch(/flex:\s*1 1 0/);
    expect(slot).toMatch(/min-width:\s*0/);
    // El texto del chip ya corta con elipsis en la regla base.
    const base = rule(css, '.ua-chip-text');
    expect(base).toMatch(/text-overflow:\s*ellipsis/);
  });
  it('los botones de la cabecera caben en una sola fila y siguen midiendo 40 px de alto (objetivos de clic de UA4-P)', () => {
    expect(rule(n, '.ua-header-actions')).toMatch(/flex-wrap:\s*nowrap/);
    const btn = rule(n, '.ua-header :is(.help-button, .install-button, .dd-trigger)');
    expect(btn).toMatch(/padding:\s*0 8px/);
    expect(btn).not.toMatch(/(^|[^-])height:/);
    // La base móvil de 760 px es la que fija 40 px: aquí no se baja.
    expect(rule(mobile.map((m) => m.body).join('\n'), '.ua-header :is(.help-button, .install-button, .dd-trigger)')).toMatch(/min-height:\s*40px/);
    expect(n).not.toMatch(/\.ua-header[^{]*\{[^}]*(?:min-)?height:\s*(?:[0-9]|[12][0-9]|3[0-9])px/);
  });
  it('la cabecera del lienzo: aire arriba de 6 px, título y pestañas a 2 px; el título conserva 40 px de alto', () => {
    const head = rule(n, '.ua-main-head');
    expect(head).toMatch(/gap:\s*2px/);
    expect(head).toMatch(/padding:\s*6px 14px 0/);
    expect(rule(n, '.ua-title')).toMatch(/min-height:\s*40px/);
    expect(rule(n, '.ua-panels')).toMatch(/padding-top:\s*8px/);
    expect(rule(n, '.ua-canvas-card .ec-palette')).toMatch(/margin-top:\s*6px/);
  });
  it('ningún elemento de la cabecera se oculta con `display: none` (la marca, el chip y los botones siguen)', () => {
    expect(n).not.toMatch(/display:\s*none/);
  });

  it('cada aviso cabe en una línea con elipsis; el botón no se parte ni se aplasta', () => {
    const text = rule(n, '.ua-notices .ea-notice-bar .ea-notice > span');
    expect(text).toMatch(/white-space:\s*nowrap/);
    expect(text).toMatch(/text-overflow:\s*ellipsis/);
    expect(text).toMatch(/overflow:\s*hidden/);
    expect(text).toMatch(/min-width:\s*0/);
    expect(rule(n, '.ua-notices .banner.ea-draft > button')).toMatch(/flex:\s*none/);
    const row = rule(n, '.ua-notices .banner.ea-draft');
    expect(row).toMatch(/display:\s*flex/);
    expect(row).toMatch(/align-items:\s*center/);
  });
  it('los avisos sueltos de sesión (sin botones) también van en una línea con elipsis', () => {
    const b = rule(n, '.ua-notices .banner:not(.ea-draft)');
    expect(b).toMatch(/white-space:\s*nowrap/);
    expect(b).toMatch(/text-overflow:\s*ellipsis/);
    expect(b).toMatch(/overflow:\s*hidden/);
  });
  it('el texto completo se despliega con el foco de teclado sobre un botón del aviso (no con un toque)', () => {
    const open = rule(n, '.ua-notices .banner.ea-draft:has(:focus-visible) > span');
    expect(open).toMatch(/white-space:\s*normal/);
    expect(open).toMatch(/overflow:\s*visible/);
  });
  it('las reglas de 760 px que se mantienen: pie fijo de 57 px, lienzo de `--ua-canvas-h` y la paleta tras el lienzo', () => {
    const body = mobile.map((m) => m.body).join('\n');
    expect(rule(body, '.ua-actions')).toMatch(/position:\s*sticky/);
    expect(rule(body, '.ua-canvas-card .ec-root > .ec-svg')).toMatch(/height:\s*var\(--ua-canvas-h\)\s*!important/);
    expect(rule(body, '.ua-canvas-card .ec-palette')).toMatch(/order:\s*1/);
  });
});
