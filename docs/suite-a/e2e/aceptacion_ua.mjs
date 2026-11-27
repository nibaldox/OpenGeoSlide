// Aceptación del bloque UA (contrato briefs/UA_CONTRATO.md §8, comprobaciones A01-A17).
//
//   OGS_URL=http://127.0.0.1:5188/ OGS_LABEL=base node aceptacion_ua.mjs
//
// Variables: OGS_URL (por defecto 5188), OGS_LABEL (etiqueta del json; por defecto «local»), OUT (carpeta de salida; por defecto
// $TMPDIR/ua1/Q/out), OGS_AXE_OFF (reglas de axe a apagar, por defecto ninguna), OGS_Q (carpeta con node_modules de playwright-core y axe-core; por defecto $TMPDIR/ua1/Q), OGS_EXAMPLE (id del
// ejemplo; por defecto V049 «ACADS 1(c): talud de tres estratos»: 3 regiones y 4 métodos).
// Salida: una línea `OK`/`FAIL` por comprobación, `RESUMEN N/17`, `aceptacion-<etiqueta>.json` y capturas `<etiqueta>-*.png` en OUT.
// Código de salida 1 si algo falla.
//
// Reglas del guion:
//  - Solo usa los selectores del contrato (§4.6-§4.8 y §5). Donde el armazón nuevo no existe, la comprobación falla con un mensaje claro;
//    cada parte va en su `try`, así que un fallo no tumba el resto.
//  - La visibilidad se mide con getClientRects() y visibility (un `position: fixed` tiene offsetParent nulo).
//  - El nombre accesible se calcula en la página (aria-labelledby, aria-label, contenido sin lo `aria-hidden`, title) y no depende del
//    arbol de Playwright, que omite lo oculto.
//  - A01 y A13 juzgan solo lo que existe: una vista ausente se anota como «omitida» en el detalle y la falla A09, no ellas.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = process.env.TMPDIR ?? os.tmpdir();
const Q = process.env.OGS_Q ?? path.join(TMP, 'ua1', 'Q');
const req = createRequire(path.join(Q, 'x.js'));
const { chromium } = req('playwright-core');
const AXE = req.resolve('axe-core/axe.min.js');
// Reglas de axe que se apagan a propósito (lista separada por comas). Por defecto ninguna: el criterio es el del contrato, «sin serias ni críticas».
const AXE_OFF = (process.env.OGS_AXE_OFF ?? '').split(',').map((x) => x.trim()).filter(Boolean);

const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5188/';
const LABEL = process.env.OGS_LABEL ?? 'local';
const OUT = process.env.OUT ?? path.join(Q, 'out');
const EXAMPLE = process.env.OGS_EXAMPLE ?? 'V049';
mkdirSync(OUT, { recursive: true });

const STEPS = ['Geometría', 'Materiales', 'Agua', 'Superficie', 'Búsqueda', 'Análisis', 'Cargas', 'Refuerzos', 'Sismo', 'Proyecto'];
const VIEW_NAMES = { lienzo: ['Lienzo', 'Editar'], resultados: ['Resultados'], casos: ['Casos de verificación'], informe: ['Informe'] };
const VIEW_KEYS = Object.keys(VIEW_NAMES);

// ───────── Registro de resultados ─────────
const TITLES = {
  A01: 'sin errores de consola ni HTTP ≥ 400', A02: 'sin scroll de página en Lienzo', A03: 'sin scroll horizontal',
  A04: 'tipografías Outfit y JetBrains Mono', A05: 'color del botón Comprobar', A06: 'tema oscuro por defecto, botón y persistencia',
  A07: 'marca, nombre y chip de la cabecera', A08: 'diez pasos en la barra lateral', A09: 'cuatro vistas y lienzo estable',
  A10: 'fs-min igual al mínimo de los FS', A11: 'un solo «Comprobar» visible', A12: 'sin emojis ni dingbats', A13: 'axe sin serias ni críticas',
  A14: 'objetivos de clic', A15: 'todo botón con nombre', A16: 'Encuadrar libre de paleta y leyenda', A17: 'pie de acción fijo a 390',
};
const EXPECT = {
  A01: ['recorrido'], A02: ['1440x900 oscuro', '1280x800 claro'], A03: ['320', '390', '768', '1024', '1280', '1440'],
  A04: ['tipografías'], A05: ['oscuro', 'claro'], A06: ['tema'], A07: ['cabecera'], A08: ['pasos'], A09: ['vistas'], A10: ['fs-min'],
  A11: ['antes de calcular', 'tras calcular'], A12: ['barrido'], A13: ['oscuro', 'claro'], A14: ['1440', '390'], A15: ['barrido'],
  A16: ['1440', '1280'], A17: ['390'],
};
const parts = Object.fromEntries(Object.keys(TITLES).map((id) => [id, []]));
const scenarioErrors = [];
const errors = [];
const shots = [];

/** Ejecuta una parte de una comprobación; cualquier excepción pasa a ser un FAIL de esa parte. */
async function P(id, label, fn) {
  try {
    const r = await fn();
    parts[id].push({ label, ok: !!r.ok, msg: r.msg ?? '', data: r.data });
  } catch (e) {
    parts[id].push({ label, ok: false, msg: `excepción: ${String(e.message ?? e).split('\n')[0].slice(0, 220)}` });
  }
}

// ───────── Funciones dentro de la página ─────────
function installLib() {
  const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
  const vis = (el) => {
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.visibility === 'visible' || cs.visibility === '';
  };
  const txt = (n, forced) => {
    if (n.nodeType === 3) return n.nodeValue;
    if (n.nodeType !== 1) return '';
    if (!forced) {
      if (n.getAttribute('aria-hidden') === 'true') return '';
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return '';
    }
    if (n instanceof SVGElement) { const t = n.querySelector(':scope > title'); return t ? t.textContent : ''; }
    if (n.tagName === 'IMG') return n.getAttribute('alt') ?? '';
    return [...n.childNodes].map((c) => txt(c, forced)).join(n.tagName === 'DIV' || n.tagName === 'P' ? ' ' : '');
  };
  const accName = (el) => {
    const lb = el.getAttribute('aria-labelledby');
    if (lb) {
      const s = norm(lb.split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean).map((e) => txt(e, true)).join(' '));
      if (s) return s;
    }
    const al = el.getAttribute('aria-label');
    if (al && norm(al)) return norm(al);
    const t = norm(txt(el, false));
    if (t) return t;
    return norm(el.getAttribute('title') ?? '');
  };
  const desc = (el) => {
    const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/)[0]}` : '';
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls}[${(accName(el) || el.textContent || '').trim().slice(0, 28)}]`;
  };
  const EMOJI = /[\u2190-\u21FF\u2300-\u23FF\u25A0-\u25FF\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u{1F000}-\u{1FAFF}]/u;
  const allVisible = (sel) => [...document.querySelectorAll(sel)].filter((e) => vis(e) && !e.closest('svg'));
  const TARGETS = 'button, a[href], [role=tab], [role=button], [role=menuitem], select, textarea, summary, input:not([type=hidden]):not([type=file])';

  const bg = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
    }
    return 'transparent';
  };
  const lum = (c) => {
    const m = String(c).match(/[\d.]+/g);
    return m ? (0.2126 * +m[0] + 0.7152 * +m[1] + 0.0722 * +m[2]) / 255 : 1;
  };

  window.__q = {
    vis, accName, desc, bg, lum,
    comprobar() {
      return allVisible('button, [role=button], a[href], input[type=button], input[type=submit]').filter((e) => accName(e) === 'Comprobar').map(desc);
    },
    /** Emojis, botones sin nombre y objetivos pequeños del estado actual de la página. */
    sweep(min = 24) {
      const emoji = [];
      for (const el of allVisible('button, [role=tab], [role=button], [role=menuitem], summary, h1, h2, h3, h4, h5, h6, [role=heading]')) {
        const m = el.textContent.match(EMOJI);
        if (m) emoji.push(`${desc(el)} «${m[0]}» U+${m[0].codePointAt(0).toString(16).toUpperCase()}`);
      }
      const unnamed = allVisible('button, [role=button]').filter((e) => !accName(e)).map(desc);
      const small = [];
      for (const el of allVisible(TARGETS)) {
        if (el.matches('a[href]') && el.closest('p, li, dd') && el.parentElement && norm(el.parentElement.textContent) !== norm(el.textContent)) continue; // enlace en línea (WCAG 2.5.8)
        let r = el.getBoundingClientRect();
        if (r.width <= 1 && r.height <= 1) continue; // texto solo para lectores
        if (el.matches('input[type=checkbox], input[type=radio]')) {
          const lab = el.closest('label') ?? (el.id ? document.querySelector(`label[for="${el.id}"]`) : null);
          if (lab) { const lr = lab.getBoundingClientRect(); if (lr.width * lr.height > r.width * r.height) r = lr; }
        }
        if (r.width + 0.5 < min || r.height + 0.5 < min) small.push(`${desc(el)} ${Math.round(r.width * 10) / 10}×${Math.round(r.height * 10) / 10}`);
      }
      return { emoji, unnamed, small };
    },
    /** Controles visibles con altura menor que `min` dentro de los contenedores dados. */
    heights(sel, min) {
      const els = allVisible(sel);
      return { n: els.length, bad: els.filter((e) => e.getBoundingClientRect().height + 0.5 < min).map((e) => `${desc(e)} ${Math.round(e.getBoundingClientRect().height * 10) / 10}`) };
    },
    overflowX() {
      const se = document.scrollingElement;
      const sw = Math.max(se.scrollWidth, document.body.scrollWidth);
      const wide = sw > innerWidth ? [...document.querySelectorAll('body *')].filter((e) => vis(e) && e.getBoundingClientRect().right > innerWidth + 1).slice(0, 4).map((e) => `${desc(e)} →${Math.round(e.getBoundingClientRect().right)}`) : [];
      return { sw, iw: innerWidth, wide };
    },
  };
}

// ───────── Navegación ─────────
const errTag = { current: 'arranque' };
async function launch({ theme, colorScheme, viewport }) {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport, colorScheme, acceptDownloads: true });
  await ctx.addInitScript((t) => {
    try { localStorage.setItem('ogs.onboarding.v1', 'seen'); if (t) localStorage.setItem('ogs.theme.v1', t); } catch { /* sin almacenamiento */ }
  }, theme);
  await ctx.addInitScript(installLib);
  const page = await ctx.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror', (e) => errors.push(`[${errTag.current}] pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${errTag.current}] consola: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`[${errTag.current}] HTTP ${r.status()} ${r.url()}`); });
  return { browser, ctx, page };
}

async function start(page) {
  await page.goto(URL_);
  await page.waitForSelector('[data-layer="regions"] polygon', { timeout: 30000 });
  await page.waitForFunction(() => /ogs-core/.test(document.querySelector('[data-testid="engine-banner"]')?.textContent ?? ''), null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
}

const popoverOpen = (page, name) => page.evaluate((n) => {
  const b = [...document.querySelectorAll('button.dd-trigger')].find((x) => x.textContent.trim().startsWith(n));
  const menu = b && document.getElementById(b.getAttribute('aria-controls'));
  return !!b && b.getAttribute('aria-expanded') === 'true' && !!menu && menu.matches(':popover-open');
}, name);

// Copia de openMenu de docs/fase3/iw/e2e/lib.mjs: espera a :popover-open y reintenta.
async function openMenu(page, name) {
  const trigger = page.getByRole('button', { name, exact: true });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!(await popoverOpen(page, name))) await trigger.click();
    try { await page.waitForFunction((n) => {
      const b = [...document.querySelectorAll('button.dd-trigger')].find((x) => x.textContent.trim().startsWith(n));
      const menu = b && document.getElementById(b.getAttribute('aria-controls'));
      return !!b && b.getAttribute('aria-expanded') === 'true' && !!menu && menu.matches(':popover-open');
    }, name, { timeout: 3000 }); } catch { continue; }
    await page.waitForTimeout(120);
    if (await popoverOpen(page, name)) return;
  }
  throw new Error(`el menú ${name} no se abrió`);
}

async function closeMenus(page) {
  for (const n of ['Archivo', 'Exportar']) if (await popoverOpen(page, n).catch(() => false)) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }
}

async function openExample(page) {
  await openMenu(page, 'Archivo');
  const sel = page.locator('select[aria-label="Abrir un caso publicado como modelo"]');
  const value = await sel.evaluate((s, id) => [...s.options].find((o) => o.textContent.startsWith(`${id}:`))?.value ?? null, EXAMPLE);
  if (!value) throw new Error(`el ejemplo ${EXAMPLE} no está en el selector «Ejemplos»`);
  await sel.selectOption({ value });
  const dlg = page.locator('[data-testid="confirm-dialog"]');
  try { await dlg.waitFor({ state: 'visible', timeout: 1200 }); await dlg.getByRole('button', { name: 'Descartar cambios', exact: true }).click(); } catch { /* sin confirmación */ }
  await page.waitForFunction(() => /ACADS 1\(c\)|tres estratos/.test(document.querySelector('[data-testid="file-status"]')?.textContent ?? ''), null, { timeout: 10000 });
  await closeMenus(page);
  await page.waitForFunction(() => document.querySelectorAll('[data-layer="regions"] polygon').length >= 2, null, { timeout: 10000 });
}

async function calc(page) {
  const btn = page.getByRole('button', { name: 'Comprobar', exact: true }).first();
  await btn.click();
  await page.waitForFunction(() => document.querySelector('[data-testid="result-summary"]')?.getAttribute('data-state') === 'current', null, { timeout: 60000 });
  await page.waitForSelector('[data-testid="results-panel"] table tbody tr', { state: 'attached', timeout: 10000 });
  await page.waitForFunction(() => ![...document.querySelectorAll('button')].some((x) => x.disabled && /^Comprobar|Calculando/.test(x.textContent.trim())), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(500);
}

/** Abre una vista por su nombre del contrato; para Lienzo acepta «Editar» (línea base). Devuelve el nombre usado o null. */
async function gotoView(page, key) {
  for (const n of VIEW_NAMES[key]) {
    const t = page.getByRole('tab', { name: n, exact: true });
    if ((await t.count()) > 0) { await t.first().click(); await page.waitForTimeout(450); return n; }
  }
  return null;
}

async function shot(page, name) {
  const p = path.join(OUT, `${LABEL}-${name}.png`);
  await page.screenshot({ path: p });
  shots.push(p);
  return p;
}

const stepTabs = (page) => page.locator('[role="tablist"][aria-label="Paneles del modelo"] [role="tab"]');
const evalQ = (page, fn, arg) => page.evaluate(fn, arg);
const resize = async (page, w, h) => { await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(500); };
/** Agrupa «contexto: elemento» por elemento: el mismo botón de la cabecera sale en todos los pasos y no hace falta repetirlo. */
const group = (list) => {
  const m = new Map();
  for (const e of list) { const i = e.indexOf(': '); const [ctx, item] = i < 0 ? ['', e] : [e.slice(0, i), e.slice(i + 2)]; m.set(item, [...(m.get(item) ?? []), ctx]); }
  return [...m].map(([item, ctxs]) => `${item}${ctxs[0] ? ` (en ${ctxs[0]}${ctxs.length > 1 ? ` y ${ctxs.length - 1} más` : ''})` : ''}`);
};
const short = (a, n = 6) => (a.length ? `${a.slice(0, n).join('; ')}${a.length > n ? `; … (+${a.length - n})` : ''}` : '');

async function runAxe(page) {
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ path: AXE });
  return page.evaluate(async (off) => {
    const r = await window.axe.run(document, { resultTypes: ['violations'], rules: Object.fromEntries(off.map((id) => [id, { enabled: false }])) });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0, 2).map((x) => x.target.join(' ')) }));
  }, AXE_OFF);
}

/** Encuadrar y mide los vértices de región contra la paleta y la leyenda. */
async function frameCheck(page) {
  await page.getByRole('button', { name: 'Encuadrar', exact: true }).first().click();
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const q = window.__q;
    const pal = [...document.querySelectorAll('nav[aria-label="Herramientas del lienzo"]')].filter(q.vis);
    const leg = [...document.querySelectorAll('ul.legend, [aria-label^="Leyenda"]')].filter(q.vis);
    const svg = document.querySelector('svg.ec-svg');
    const pts = [];
    for (const poly of document.querySelectorAll('[data-layer="regions"] polygon')) {
      const m = poly.getScreenCTM();
      for (let i = 0; i < poly.points.numberOfItems; i += 1) {
        const p = poly.points.getItem(i);
        pts.push({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f });
      }
    }
    const rect = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
    const inside = (p, r) => p.x >= r.l && p.x <= r.r && p.y >= r.t && p.y <= r.b;
    const sr = svg ? rect(svg) : null;
    const palR = pal.map(rect); const legR = leg.map(rect);
    return {
      npts: pts.length, pal: pal.length, leg: leg.length,
      underPal: pts.filter((p) => palR.some((r) => inside(p, r))).length,
      underLeg: pts.filter((p) => legR.some((r) => inside(p, r))).length,
      outside: sr ? pts.filter((p) => !inside(p, sr)).length : null,
    };
  });
  const faltan = [];
  if (!r.pal) faltan.push('no hay nav[aria-label="Herramientas del lienzo"] visible (paleta)');
  if (!r.leg) faltan.push('no hay leyenda visible (ul.legend)');
  if (!r.npts) faltan.push('no hay vértices de región');
  const ok = !faltan.length && r.underPal === 0 && r.underLeg === 0;
  return { ok, msg: ok ? `${r.npts} vértices, ninguno bajo la paleta ni la leyenda (fuera del lienzo: ${r.outside})` : `${faltan.join('; ')}${faltan.length ? '; ' : ''}bajo la paleta: ${r.underPal}, bajo la leyenda: ${r.underLeg}`, data: r };
}

// ───────── Escenario 1: tema por defecto (A06) ─────────
async function scenarioTheme() {
  errTag.current = 'A06';
  const { browser, page } = await launch({ theme: null, colorScheme: 'light', viewport: { width: 1440, height: 900 } });
  try {
    await start(page);
    await P('A06', 'tema', async () => {
      const st = await page.evaluate(() => ({
        theme: document.documentElement.getAttribute('data-theme'), stored: localStorage.getItem('ogs.theme.v1'),
        bodyLum: window.__q.lum(getComputedStyle(document.body).backgroundColor),
      }));
      const fails = [];
      if (st.stored !== null) fails.push(`localStorage tenía ogs.theme.v1=${st.stored}`);
      if (st.theme !== 'dark') fails.push(`data-theme=${st.theme} con el sistema en claro y sin preferencia (se esperaba dark)`);
      if (st.bodyLum > 0.3) fails.push(`el fondo del body es claro (luminancia ${st.bodyLum.toFixed(2)})`);
      const bg0 = await page.evaluate(() => { window.__noReload = 1; return window.__q.bg(document.querySelector('svg.ec-svg')); });
      const toggle = page.getByRole('button', { name: /^Cambiar a tema (claro|oscuro)$/ });
      if ((await toggle.count()) === 0) { fails.push('no existe el botón «Cambiar a tema claro/oscuro»'); return { ok: false, msg: fails.join('; ') }; }
      const name0 = await toggle.first().getAttribute('aria-label');
      if (name0 !== 'Cambiar a tema claro') fails.push(`en oscuro el botón se llama «${name0}»`);
      await toggle.first().click();
      await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light', null, { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
      const after = await page.evaluate(() => ({ theme: document.documentElement.getAttribute('data-theme'), stored: localStorage.getItem('ogs.theme.v1'), noReload: window.__noReload === 1, bg: window.__q.bg(document.querySelector('svg.ec-svg')) }));
      if (after.theme !== 'light') fails.push(`tras pulsar, data-theme=${after.theme}`);
      if (after.stored !== 'light') fails.push(`localStorage ogs.theme.v1=${after.stored} (se esperaba light)`);
      if (!after.noReload) fails.push('la página se recargó al cambiar de tema');
      if (after.bg === bg0) fails.push(`el fondo del lienzo no cambió (${bg0})`);
      const name1 = await page.getByRole('button', { name: /^Cambiar a tema (claro|oscuro)$/ }).first().getAttribute('aria-label');
      if (name1 !== 'Cambiar a tema oscuro') fails.push(`en claro el botón se llama «${name1}»`);
      await page.reload();
      await page.waitForSelector('[data-layer="regions"] polygon', { timeout: 30000 });
      const rl = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      if (rl !== 'light') fails.push(`tras recargar, data-theme=${rl}`);
      return { ok: !fails.length, msg: fails.length ? fails.join('; ') : `vacío→dark; botón→light (${after.stored}); lienzo ${bg0}→${after.bg}; persiste al recargar`, data: { st, after, bg0 } };
    });
  } catch (e) { scenarioErrors.push(`A06: ${e.message}`); } finally { await browser.close(); }
}

// ───────── Escenario 2: oscuro a 1440 (la mayoría) ─────────
async function scenarioDark() {
  errTag.current = 'oscuro-1440';
  const { browser, page } = await launch({ theme: 'dark', colorScheme: 'dark', viewport: { width: 1440, height: 900 } });
  const omitidas = new Set();
  const visitadas = [];
  try {
    await start(page);
    await openExample(page);
    await P('A11', 'antes de calcular', async () => {
      await gotoView(page, 'lienzo');
      const c = await page.evaluate(() => window.__q.comprobar());
      return { ok: c.length === 1, msg: `${c.length} control(es) visibles «Comprobar»${c.length ? `: ${c.join(', ')}` : ''}` };
    });
    await calc(page);
    await gotoView(page, 'lienzo');
    await shot(page, '1440-oscuro-lienzo');

    await P('A02', '1440x900 oscuro', async () => {
      const m = await page.evaluate(async () => {
        const se = document.scrollingElement; window.scrollTo(0, 99999); await new Promise((r) => setTimeout(r, 120));
        const y = window.scrollY; window.scrollTo(0, 0);
        return { sh: se.scrollHeight, ih: innerHeight, y };
      });
      return { ok: m.y === 0 && m.sh <= m.ih + 1, msg: `scrollHeight ${m.sh} / innerHeight ${m.ih}, scrollY tras forzar el scroll: ${m.y}` };
    });

    await P('A04', 'tipografías', async () => {
      const box = await page.locator('svg.ec-svg').first().boundingBox();
      if (box) { await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5, { steps: 4 }); await page.mouse.move(box.x + box.width * 0.56, box.y + box.height * 0.52, { steps: 3 }); await page.waitForTimeout(300); }
      const f = await page.evaluate(async () => {
        await document.fonts.ready;
        const fams = [...document.fonts].filter((x) => x.status === 'loaded').map((x) => x.family.replace(/["']/g, ''));
        const first = (el) => (el ? getComputedStyle(el).fontFamily.split(',')[0].replace(/["'\s]+$|^["'\s]+/g, '') : null);
        const num = (el) => (el ? getComputedStyle(el).fontVariantNumeric : null);
        const fsMin = [...document.querySelectorAll('[data-testid="fs-min"]')].find(window.__q.vis) ?? null;
        const cur = document.querySelector('[data-testid="cursor-readout"]');
        return { body: first(document.body), fams, fsMin: fsMin && { f: first(fsMin), n: num(fsMin) }, cur: cur && { f: first(cur), n: num(cur), t: cur.textContent.trim() } };
      });
      const fails = [];
      if (!/^Outfit/.test(f.body ?? '')) fails.push(`la familia del body es «${f.body}»`);
      if (!f.fams.includes('Outfit Variable')) fails.push('«Outfit Variable» no está cargada en document.fonts');
      if (!f.fams.includes('JetBrains Mono Variable')) fails.push('«JetBrains Mono Variable» no está cargada en document.fonts');
      if (!f.fsMin) fails.push('no hay [data-testid="fs-min"] visible (cifra del HUD)');
      else { if (!/^JetBrains Mono/.test(f.fsMin.f ?? '')) fails.push(`el FS del HUD va en «${f.fsMin.f}»`); if (!/tabular-nums/.test(f.fsMin.n ?? '')) fails.push(`el FS del HUD no usa tabular-nums (${f.fsMin.n})`); }
      if (!f.cur) fails.push('no existe [data-testid="cursor-readout"]');
      else if (!f.cur.t) fails.push('las coordenadas están vacías tras mover el puntero sobre el lienzo');
      else { if (!/^JetBrains Mono/.test(f.cur.f ?? '')) fails.push(`las coordenadas van en «${f.cur.f}»`); if (!/tabular-nums/.test(f.cur.n ?? '')) fails.push(`las coordenadas no usan tabular-nums (${f.cur.n})`); }
      return { ok: !fails.length, msg: fails.length ? fails.join('; ') : `body ${f.body}; Outfit y JetBrains Mono cargadas; FS y coordenadas «${f.cur.t}» en mono tabular`, data: f };
    });

    await P('A05', 'oscuro', async () => {
      await page.mouse.move(2, 2); await page.waitForTimeout(400);
      const c = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].filter(window.__q.vis).find((x) => window.__q.accName(x) === 'Comprobar'); if (!b) return null; const cs = getComputedStyle(b); return { bg: cs.backgroundColor, color: cs.color, disabled: b.disabled }; });
      if (!c) return { ok: false, msg: 'no hay botón «Comprobar» visible' };
      return { ok: c.bg === 'rgb(44, 119, 195)' && c.color === 'rgb(255, 255, 255)', msg: `fondo ${c.bg}, texto ${c.color}${c.disabled ? ' (deshabilitado)' : ''}; se esperaba rgb(44, 119, 195) y blanco`, data: c };
    });

    await P('A07', 'cabecera', async () => {
      const h = await page.evaluate(() => {
        const q = window.__q; const hd = document.querySelector('header');
        if (!hd) return { header: false };
        const marks = [...hd.querySelectorAll('svg')].filter((s) => q.vis(s) && !s.closest('button, [role=tab]'));
        const h1 = [...document.querySelectorAll('h1')].map((e) => e.textContent.trim());
        const chip = [...hd.querySelectorAll('.gs-chip[data-tone]')].find(q.vis) ?? null;
        return { header: true, marks: marks.length, h1, hdText: hd.textContent.includes('OpenGeoSlide'), chip: chip && { text: chip.textContent.trim(), h: chip.getBoundingClientRect().height, title: chip.getAttribute('title'), role: chip.getAttribute('role'), tone: chip.getAttribute('data-tone') } };
      });
      const fails = [];
      if (!h.header) return { ok: false, msg: 'no hay <header>' };
      if (!h.marks) fails.push('la cabecera no tiene la marca SVG');
      if (!h.hdText || !h.h1.includes('OpenGeoSlide')) fails.push(`h1 = ${JSON.stringify(h.h1)} (se esperaba «OpenGeoSlide» en la cabecera)`);
      if (!h.chip) fails.push('no hay .gs-chip[data-tone] visible en la cabecera');
      else {
        if (h.chip.h > 26) fails.push(`el chip mide ${h.chip.h} de alto (> 26)`);
        if (!h.chip.title || !h.chip.title.trim()) fails.push('el chip no tiene title');
        if (h.chip.role === 'status') fails.push('el chip lleva role="status"');
      }
      return { ok: !fails.length, msg: fails.length ? fails.join('; ') : `marca SVG, h1 «OpenGeoSlide», chip «${h.chip.text}» (${h.chip.tone}, alto ${h.chip.h}, title ${h.chip.title.length} caracteres)`, data: h };
    });

    await P('A08', 'pasos', async () => {
      const s = await page.evaluate(() => {
        const q = window.__q;
        const tl = document.querySelector('[role="tablist"][aria-label="Paneles del modelo"]');
        if (!tl) return null;
        const tabs = [...tl.querySelectorAll('[role="tab"]')];
        return {
          orient: tl.getAttribute('aria-orientation'), inAside: !!tl.closest('aside'),
          names: tabs.map(q.accName),
          desc: tabs.map((t) => (t.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean).map((id) => (document.getElementById(id)?.textContent ?? '').replace(/\s+/g, ' ').trim())),
          hasDescribedby: tabs.map((t) => !!t.getAttribute('aria-describedby')),
        };
      });
      if (!s) return { ok: false, msg: 'no existe [role=tablist][aria-label="Paneles del modelo"]' };
      const fails = [];
      if (s.orient !== 'vertical') fails.push(`aria-orientation=${s.orient}`);
      if (!s.inAside) fails.push('el tablist no está dentro de un <aside> (barra lateral)');
      if (JSON.stringify(s.names) !== JSON.stringify(STEPS)) fails.push(`nombres: ${JSON.stringify(s.names)}`);
      const sinResumen = []; const largos = [];
      s.desc.forEach((d, i) => {
        const textos = d.filter((x) => x.length);
        if (!s.hasDescribedby[i] || !textos.length) sinResumen.push(s.names[i]);
        else if (textos.some((x) => x.length > 40)) largos.push(`${s.names[i]} (${textos.map((x) => x.length).join('/')})`);
      });
      if (sinResumen.length) fails.push(`sin resumen en aria-describedby: ${sinResumen.join(', ')}`);
      if (largos.length) fails.push(`resumen de más de 40 caracteres: ${largos.join(', ')}`);
      return { ok: !fails.length, msg: fails.length ? fails.join('; ') : `10 pasos verticales en <aside>; resúmenes: ${s.desc.map((d) => d.filter(Boolean).join('|')).join(' · ')}`, data: s };
    });

    await P('A09', 'vistas', async () => {
      const v = await page.evaluate(() => {
        const q = window.__q; const tl = document.querySelector('[role="tablist"][aria-label="Vistas"]');
        if (!tl) return null;
        const tabs = [...tl.querySelectorAll('[role="tab"]')];
        return { names: tabs.map(q.accName), ids: tabs.map((t) => t.id), controls: tabs.map((t) => t.getAttribute('aria-controls')) };
      });
      if (!v) return { ok: false, msg: 'no existe [role=tablist][aria-label="Vistas"]' };
      const want = ['Lienzo', 'Resultados', 'Casos de verificación', 'Informe'];
      const wantIds = ['mode-edit', 'view-results', 'mode-cases', 'view-report'];
      const fails = [];
      if (JSON.stringify(v.names) !== JSON.stringify(want)) fails.push(`pestañas: ${JSON.stringify(v.names)}`);
      if (JSON.stringify(v.ids) !== JSON.stringify(wantIds)) fails.push(`ids: ${JSON.stringify(v.ids)} (se esperaba ${wantIds.join(', ')})`);
      const panels = await page.evaluate((ids) => ids.map((id) => { const p = document.getElementById(`${id}-panel`); return p ? { hidden: p.hidden, rects: p.getClientRects().length } : null; }), wantIds);
      panels.forEach((p, i) => { if (!p) fails.push(`falta el panel #${wantIds[i]}-panel`); });
      await page.evaluate(() => { window.__svg = document.querySelector('svg.ec-svg'); });
      const rotos = [];
      for (const key of ['resultados', 'casos', 'informe']) {
        const n = await gotoView(page, key);
        if (!n) { rotos.push(`${key}: sin pestaña`); continue; }
        const mid = await page.evaluate((ids) => ids.map((id) => document.getElementById(`${id}-panel`)).filter((p) => p && !p.hidden && p.getClientRects().length).length, wantIds);
        if (mid !== 1) rotos.push(`${key}: ${mid} paneles de vista visibles (se esperaba 1)`);
        await gotoView(page, 'lienzo');
        const same = await page.evaluate(() => { const s = document.querySelector('svg.ec-svg'); return s === window.__svg && s.isConnected; });
        if (!same) rotos.push(`${key}: el svg del lienzo cambió o se desmontó`);
      }
      if (rotos.length) fails.push(rotos.join('; '));
      return { ok: !fails.length, msg: fails.length ? fails.join('; ') : 'cuatro pestañas con sus ids; un panel visible por vista; el mismo nodo svg tras ir y volver de las tres vistas', data: { v, panels } };
    });

    await P('A10', 'fs-min', async () => {
      await gotoView(page, 'lienzo');
      const h = await page.evaluate(() => {
        const q = window.__q; const get = (t) => { const m = t.replace(/\s/g, '').match(/\d+(?:[.,]\d+)?/); return m ? Number(m[0].replace(',', '.')) : NaN; };
        const mins = [...document.querySelectorAll('[data-testid="fs-min"]')].filter(q.vis).map((e) => ({ text: e.textContent.trim(), v: get(e.textContent) }));
        const rows = [...document.querySelectorAll('li.rs-item')].map((li) => {
          const fs = li.querySelector('[data-testid^="fs-"]:not([data-testid="fs-min"])');
          const st = li.querySelector('.rs-status')?.textContent.trim() ?? '';
          return { id: fs?.getAttribute('data-testid'), text: fs?.textContent.trim() ?? '', v: fs ? get(fs.textContent) : NaN, st, conv: /^Convergió$/i.test(st) };
        }).filter((r) => r.id);
        return { mins, rows };
      });
      if (!h.mins.length) return { ok: false, msg: 'no hay [data-testid="fs-min"] visible' };
      const conv = h.rows.filter((r) => r.conv && Number.isFinite(r.v));
      if (!conv.length) return { ok: false, msg: `no hay FS de métodos convergidos (${JSON.stringify(h.rows)})` };
      const min = Math.min(...conv.map((r) => r.v));
      const ok = h.mins.length === 1 && Math.abs(h.mins[0].v - min) < 5e-4;
      return { ok, msg: `fs-min «${h.mins.map((m) => m.text).join('», «')}» · mínimo de ${conv.map((r) => `${r.id}=${r.v}`).join(', ')} = ${min}`, data: h };
    });

    await P('A16', '1440', async () => { await gotoView(page, 'lienzo'); return frameCheck(page); });
    await resize(page, 1280, 800);
    await P('A16', '1280', async () => { await gotoView(page, 'lienzo'); return frameCheck(page); });
    await shot(page, '1280-oscuro-lienzo');
    await resize(page, 1440, 900);

    // Barrido de A11, A12, A14 y A15: cada paso del modelo en Lienzo, cada vista y los menús.
    const acc = { emoji: [], unnamed: [], small: [], comp: [] };
    const sweep = async (ctxName) => {
      const s = await page.evaluate(() => ({ ...window.__q.sweep(24), comp: window.__q.comprobar() }));
      acc.emoji.push(...s.emoji.map((x) => `${ctxName}: ${x}`));
      acc.unnamed.push(...s.unnamed.map((x) => `${ctxName}: ${x}`));
      acc.small.push(...s.small.map((x) => `${ctxName}: ${x}`));
      if (ctxName.startsWith('Lienzo') && s.comp.length !== 1) acc.comp.push(`${ctxName}: ${s.comp.length} «Comprobar» (${s.comp.join(', ')})`);
    };
    const lienzoName = await gotoView(page, 'lienzo');
    const nSteps = await stepTabs(page).count();
    for (let i = 0; i < nSteps; i += 1) {
      try {
        const t = stepTabs(page).nth(i);
        const nm = STEPS[i] ?? String(i);
        await t.click(); await page.waitForTimeout(250);
        await sweep(`Lienzo/paso ${nm}`);
        if (i === 1) await shot(page, '1440-oscuro-materiales');
      } catch (e) { acc.small.push(`paso ${i}: excepción ${e.message.split('\n')[0]}`); }
    }
    if (nSteps) await stepTabs(page).first().click().catch(() => {});
    if (!nSteps) await sweep('Lienzo');
    for (const key of VIEW_KEYS) {
      const n = await gotoView(page, key);
      if (!n) { omitidas.add(key); continue; }
      visitadas.push(n);
      await sweep(`Vista ${n}`);
      if (key !== 'lienzo') await shot(page, `1440-oscuro-${key}`);
    }
    for (const menu of ['Archivo', 'Exportar']) {
      try { await gotoView(page, 'lienzo'); await openMenu(page, menu); await sweep(`Menú ${menu}`); await page.keyboard.press('Escape'); await page.waitForTimeout(150); } catch (e) { acc.small.push(`menú ${menu}: ${e.message.split('\n')[0]}`); }
    }
    await closeMenus(page);
    await gotoView(page, 'lienzo');

    await P('A11', 'tras calcular', async () => ({ ok: !acc.comp.length, msg: acc.comp.length ? short(acc.comp) : `un solo «Comprobar» visible en Lienzo con cada uno de los ${nSteps || 1} paneles abiertos` }));
    await P('A12', 'barrido', async () => ({ ok: !acc.emoji.length, msg: acc.emoji.length ? short(group(acc.emoji)) : 'ningún botón, pestaña ni encabezado con emoji o dingbat (pasos, vistas y menús)' }));
    await P('A15', 'barrido', async () => { const u = group(acc.unnamed); return { ok: !u.length, msg: u.length ? short(u) : 'todo botón visible tiene nombre accesible (pasos, vistas y menús)' }; });
    await P('A14', '1440', async () => { const s = group(acc.small); return { ok: !s.length, msg: s.length ? `${s.length} objetivos < 24 px: ${short(s, 8)}` : 'todo objetivo de clic ≥ 24 × 24 (pasos, vistas y menús)' }; });

    // A13 en oscuro
    await P('A13', 'oscuro', async () => axeViews(page, 'oscuro'));

    // A01: cambiar de tema al final del recorrido
    await P('A01', 'recorrido', async () => {
      errTag.current = 'oscuro-tema';
      const toggle = page.getByRole('button', { name: /^Cambiar a tema (claro|oscuro)$/ });
      let tema = 'sin botón de tema (omitido)';
      if ((await toggle.count()) > 0) { await toggle.first().click(); await page.waitForTimeout(600); await gotoView(page, 'casos'); await page.waitForTimeout(500); await gotoView(page, 'lienzo'); tema = 'tema cambiado'; await shot(page, '1440-oscuro-tras-cambio-de-tema'); }
      else omitidas.add('tema');
      return { ok: true, msg: `recorrido: arranque, ejemplo, Comprobar, vistas [${visitadas.join(', ')}], ${tema}` };
    });
  } catch (e) { scenarioErrors.push(`oscuro-1440: ${e.message}`); } finally { await browser.close(); }
  return omitidas;
}

async function axeViews(page, tag) {
  const bad = []; const omit = []; const seen = []; const todas = {};
  for (const key of VIEW_KEYS) {
    const n = await gotoView(page, key);
    if (!n) { omit.push(key); continue; }
    await page.waitForTimeout(300);
    const v = await runAxe(page);
    seen.push(n);
    todas[n] = v.map((x) => `${x.id}:${x.impact}:${x.n}`);
    for (const x of v.filter((y) => y.impact === 'serious' || y.impact === 'critical')) bad.push(`${n}: ${x.id} (${x.impact}, ${x.n} nodos: ${x.t.join(' | ')})`);
  }
  await gotoView(page, 'lienzo');
  const nota = `${omit.length ? ` [vistas omitidas por no existir: ${omit.join(', ')}]` : ''}${AXE_OFF.length ? ` [reglas apagadas: ${AXE_OFF.join(', ')}]` : ''}`;
  if (!seen.length) return { ok: false, msg: 'no se pudo abrir ninguna vista' };
  return { ok: !bad.length, msg: bad.length ? short(bad, 5) + nota : `axe sin violaciones serias ni críticas en ${seen.join(', ')}${nota}`, data: { todas, omit } };
}

// ───────── Escenario 3: claro (A05, A13, A02 a 1280×800) ─────────
async function scenarioLight() {
  errTag.current = 'claro-1440';
  const { browser, page } = await launch({ theme: 'light', colorScheme: 'light', viewport: { width: 1440, height: 900 } });
  try {
    await start(page);
    await openExample(page);
    await calc(page);
    await gotoView(page, 'lienzo');
    await shot(page, '1440-claro-lienzo');
    await P('A05', 'claro', async () => {
      await page.mouse.move(2, 2); await page.waitForTimeout(400);
      const c = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].filter(window.__q.vis).find((x) => window.__q.accName(x) === 'Comprobar'); if (!b) return null; const cs = getComputedStyle(b); return { bg: cs.backgroundColor, color: cs.color, theme: document.documentElement.getAttribute('data-theme') }; });
      if (!c) return { ok: false, msg: 'no hay botón «Comprobar» visible' };
      return { ok: c.bg === 'rgb(47, 109, 168)' && c.color === 'rgb(255, 255, 255)', msg: `fondo ${c.bg}, texto ${c.color} (data-theme=${c.theme}); se esperaba rgb(47, 109, 168) y blanco`, data: c };
    });
    await P('A13', 'claro', async () => axeViews(page, 'claro'));
    for (const key of ['resultados', 'casos', 'informe']) { if (await gotoView(page, key)) await shot(page, `1440-claro-${key}`); }
    await gotoView(page, 'lienzo');
    await resize(page, 1280, 800);
    await P('A02', '1280x800 claro', async () => {
      const m = await page.evaluate(async () => {
        const se = document.scrollingElement; window.scrollTo(0, 99999); await new Promise((r) => setTimeout(r, 120));
        const y = window.scrollY; window.scrollTo(0, 0);
        return { sh: se.scrollHeight, ih: innerHeight, y, theme: document.documentElement.getAttribute('data-theme') };
      });
      await shot(page, '1280-claro-lienzo');
      return { ok: m.y === 0 && m.sh <= m.ih + 1, msg: `scrollHeight ${m.sh} / innerHeight ${m.ih}, scrollY tras forzar el scroll: ${m.y}` };
    });
  } catch (e) { scenarioErrors.push(`claro-1440: ${e.message}`); } finally { await browser.close(); }
}

// ───────── Escenario 4: anchos (A03) y 390 (A14, A17) ─────────
async function scenarioWidth(w, h, theme = 'dark') {
  errTag.current = `ancho-${w}-${theme}`;
  const { browser, page } = await launch({ theme, colorScheme: theme, viewport: { width: w, height: h } });
  try {
    await start(page);
    await openExample(page);
    await calc(page);
    const rows = []; const omit = [];
    for (const key of VIEW_KEYS) {
      const n = await gotoView(page, key);
      if (!n) { omit.push(key); continue; }
      const o = await page.evaluate(() => window.__q.overflowX());
      rows.push({ n, ...o });
      if (w === 390 && key !== 'lienzo') await shot(page, `390-${theme}-${key}`);
    }
    if (theme === 'dark') await P('A03', String(w), async () => {
      const bad = rows.filter((r) => r.sw > r.iw);
      return { ok: !bad.length && rows.length > 0, msg: bad.length ? bad.map((r) => `${r.n}: scrollWidth ${r.sw} > ${r.iw} (${r.wide.join(', ')})`).join('; ') : `scrollWidth ≤ ${w} en ${rows.map((r) => r.n).join(', ')}${omit.length ? ` [vistas omitidas: ${omit.join(', ')}]` : ''}`, data: rows };
    });
    if (w === 390) {
      await gotoView(page, 'lienzo');
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(page, `390-${theme}-lienzo`);
      if (theme === 'dark') {
        await P('A14', '390', async () => {
          const hdr = await page.evaluate(() => window.__q.heights('header button, header [role=tab], header a[href]', 40));
          const pal = await page.evaluate(() => window.__q.heights('nav[aria-label="Herramientas del lienzo"] button', 40));
          const acts = await page.evaluate(() => {
            const q = window.__q; const want = ['Comprobar', 'Informe PDF', 'Cancelar cálculo', 'Reiniciar el motor'];
            const els = [...document.querySelectorAll('button')].filter((b) => q.vis(b) && want.includes(q.accName(b)));
            return { n: els.length, bad: els.filter((e) => e.getBoundingClientRect().height + 0.5 < 40).map((e) => `${q.desc(e)} ${Math.round(e.getBoundingClientRect().height * 10) / 10}`) };
          });
          const fails = [];
          if (!hdr.n) fails.push('la cabecera no tiene botones visibles');
          if (!pal.n) fails.push('no hay paleta (nav[aria-label="Herramientas del lienzo"] con botones)');
          if (!acts.n) fails.push('no hay botones del pie de acción visibles');
          if (hdr.bad.length) fails.push(`cabecera < 40: ${short(hdr.bad, 4)}`);
          if (pal.bad.length) fails.push(`paleta < 40: ${short(pal.bad, 4)}`);
          if (acts.bad.length) fails.push(`pie de acción < 40: ${short(acts.bad, 4)}`);
          return { ok: !fails.length, msg: fails.length ? fails.join('; ') : `cabecera (${hdr.n}), paleta (${pal.n}) y pie de acción (${acts.n}) ≥ 40 de alto`, data: { hdr, pal, acts } };
        });
        await P('A17', '390', async () => {
          const info = await page.evaluate(() => { const se = document.scrollingElement; return { max: se.scrollHeight - innerHeight, ih: innerHeight }; });
          if (info.max < 100) return { ok: false, msg: `la página casi no hace scroll a 390 (recorrido ${info.max} px): no se puede comprobar el sticky` };
          const res = [];
          for (const f of [0, 0.25, 0.5]) {
            await page.evaluate((y) => window.scrollTo(0, y), Math.round(info.max * f));
            await page.waitForTimeout(250);
            const r = await page.evaluate(() => {
              const q = window.__q; const b = [...document.querySelectorAll('button')].find((x) => q.vis(x) && q.accName(x) === 'Comprobar');
              if (!b) return { found: false };
              const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
              let sticky = null; for (let n = b.parentElement; n; n = n.parentElement) if (getComputedStyle(n).position === 'sticky' || getComputedStyle(n).position === 'fixed') { sticky = `${n.tagName.toLowerCase()}.${n.className.toString().split(' ')[0]}:${getComputedStyle(n).position}`; break; }
              return { found: true, top: r.top, bottom: r.bottom, ih: innerHeight, hit: !!top && (top === b || b.contains(top)), sticky };
            });
            res.push({ f, ...r });
          }
          await page.evaluate(() => window.scrollTo(0, Math.round((document.scrollingElement.scrollHeight - innerHeight) / 2)));
          await page.waitForTimeout(250);
          await shot(page, `390-${theme}-lienzo-scroll-mitad`);
          const bad = res.filter((r) => !r.found || r.top < 0 || r.bottom > r.ih + 0.5 || !r.hit);
          return { ok: !bad.length, msg: bad.length ? `«Comprobar» fuera de la vista o tapado con el scroll al ${bad.map((r) => `${r.f * 100}% (${r.found ? `top ${Math.round(r.top)}, bottom ${Math.round(r.bottom)}, alto ${r.ih}, tapado ${!r.hit}` : 'no existe'})`).join(', ')}; recorrido total ${info.max} px` : `«Comprobar» visible al 0, 25 y 50 % del recorrido (${info.max} px); contenedor ${res[1].sticky}`, data: res };
        });
      }
    }
  } catch (e) { scenarioErrors.push(`ancho ${w}/${theme}: ${e.message}`); } finally { await browser.close(); }
}

// ───────── Ejecución ─────────
const t0 = Date.now();
let omitidasGlobal = new Set();
await scenarioTheme();
omitidasGlobal = await scenarioDark();
await scenarioLight();
for (const [w, h] of [[320, 568], [390, 844], [768, 1024], [1024, 768], [1280, 800], [1440, 900]]) await scenarioWidth(w, h);
await scenarioWidth(390, 844, 'light');

// A01 (consola) se decide al final con todos los escenarios
{
  const n = parts.A01.length ? parts.A01 : [];
  const ya = n.find((x) => x.label === 'recorrido');
  const nota = ya ? ya.msg : 'el recorrido principal no llegó al final';
  parts.A01 = [{ label: 'recorrido', ok: !!ya && ya.ok && errors.length === 0, msg: errors.length ? `${errors.length} error(es): ${short([...new Set(errors)], 4)}` : `0 errores de consola ni HTTP ≥ 400 en todos los escenarios; ${nota}${omitidasGlobal.size ? ` [omitido por no existir: ${[...omitidasGlobal].join(', ')}]` : ''}` }];
}

const checks = Object.keys(TITLES).map((id) => {
  const ps = parts[id];
  const missing = EXPECT[id].filter((l) => !ps.some((p) => p.label === l));
  const fails = ps.filter((p) => !p.ok);
  const ok = missing.length === 0 && fails.length === 0;
  const partsMsg = ps.map((p) => `${ps.length > 1 ? `[${p.label}] ` : ''}${p.msg}`).join(' | ');
  const faltaMsg = missing.length ? ` | no se ejecutó: ${missing.join(', ')}${scenarioErrors.length ? ` (${scenarioErrors.join(' / ')})` : ''}` : '';
  return { id, titulo: TITLES[id], ok, detalle: `${partsMsg}${faltaMsg}`.slice(0, 1200), partes: ps };
});

for (const c of checks) console.log(`${c.ok ? 'OK  ' : 'FAIL'} ${c.id} ${c.titulo}: ${c.detalle}`);
const nOk = checks.filter((c) => c.ok).length;
console.log(`RESUMEN ${nOk}/17 (${((Date.now() - t0) / 1000).toFixed(0)} s) errores_consola=${errors.length}`);
const jsonPath = path.join(OUT, `aceptacion-${LABEL}.json`);
writeFileSync(jsonPath, JSON.stringify({ etiqueta: LABEL, url: URL_, fecha: new Date().toISOString(), ejemplo: EXAMPLE, resumen: { ok: nOk, total: 17 }, comprobaciones: checks, errores: errors, errores_de_escenario: scenarioErrors, capturas: shots }, null, 2));
console.log(`JSON ${jsonPath}`);
console.log(`CAPTURAS ${OUT}/${LABEL}-*.png (${shots.length})`);
process.exit(nOk === 17 ? 0 : 1);
