// U3-O: demostración en Chrome de la guía de primera visita, la ayuda, la confirmación, el panel Proyecto y «Instalar app».
// Uso: OGS_URL=http://127.0.0.1:5186/ node u3o_onboarding.mjs   (la pestaña «Proyecto» la registra el coordinador; aquí hay un parche temporal)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const SHOTS = path.join(process.env.TMPDIR, 'u3x-shots');
mkdirSync(SHOTS, { recursive: true });
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5186/';
const WITH_PROJECT = process.env.WITH_PROJECT !== '0';
const out = { steps: [], errors: [] };
const step = (name, ok, data = {}) => { out.steps.push({ name, ok, ...data }); console.log(ok ? 'OK  ' : 'FAIL', name, JSON.stringify(data)); };

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
const newPage = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', ...opts });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url ?? '').endsWith('/favicon.ico')) out.errors.push(m.text()); });
  page.on('pageerror', (e) => out.errors.push('pageerror: ' + e.message));
  return { ctx, page };
};
const shot = async (page, name) => { const p = path.join(SHOTS, name + '.png'); await page.screenshot({ path: p }); return p; };
const rectOf = (page, sel) => page.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; }, sel);
const tourState = (page) => page.evaluate(() => {
  const t = document.querySelector('[data-testid="guided-tour"]');
  const open = !!t && t.matches(':popover-open');
  const ring = document.querySelector('[data-testid="tour-ring"]');
  const rr = ring && ring.matches(':popover-open') ? ring.getBoundingClientRect() : null;
  return {
    open,
    step: t?.getAttribute('data-step'),
    placement: t?.getAttribute('data-placement'),
    progress: t?.querySelector('.tour-progress')?.textContent,
    ring: rr ? { x: Math.round(rr.x), y: Math.round(rr.y), w: Math.round(rr.width), h: Math.round(rr.height) } : null,
    pop: t && open ? (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(width), h: Math.round(height) }))(t.getBoundingClientRect()) : null,
    focusInTour: !!t && t.contains(document.activeElement),
    active: document.activeElement?.tagName + ':' + (document.activeElement?.textContent ?? '').trim().slice(0, 24),
    nextLabel: t?.querySelector('button.primary')?.textContent,
  };
});
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// ───────── 1. Primera visita ─────────
{
  const { ctx, page } = await newPage();
  await page.goto(URL_);
  await page.waitForSelector('[data-testid="editor-app"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="guided-tour"]')?.matches(':popover-open'));
  await page.waitForTimeout(400);
  const s = await tourState(page);
  const arch = await page.evaluate(() => { const b = [...document.querySelectorAll('.dd-trigger')].find((x) => x.textContent.trim().startsWith('Archivo')); const r = b.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  step('1 primera visita: la guía aparece sola, paso 1 de 5, con anillo sobre «Archivo»', s.open && s.step === 'open' && s.progress === 'Paso 1 de 5' && s.ring && Math.abs(s.ring.x - (arch.x - 4)) <= 2 && Math.abs(s.ring.w - (arch.w + 8)) <= 2, { s, arch });
  step('1b no secuestra el foco ni bloquea la página (no es modal)', !s.focusInTour && (await page.evaluate(() => !document.querySelector('main').inert && !document.querySelector('dialog[open]'))), { active: s.active });
  step('1c el cuadro no tapa el control destacado', s.pop && !overlap(s.pop, arch), { pop: s.pop });
  const live = await page.textContent('[data-testid="tour-live"]');
  step('1d anuncio en región viva, sin mover el foco', /Guía de primera visita, paso 1 de 5/.test(live), { live });
  await shot(page, 'o-tour-1-claro-1440');

  // La página sigue operable con la guía abierta: abrir un menú y cerrarlo.
  await page.locator('.dd-trigger', { hasText: 'Archivo' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.dd-trigger')].some((b) => b.getAttribute('aria-expanded') === 'true'), null, { timeout: 3000 }).catch(() => {});
  const expanded = await page.evaluate(() => [...document.querySelectorAll('.dd-trigger')].some((b) => b.getAttribute('aria-expanded') === 'true'));
  await page.keyboard.press('Escape');
  step('1e la aplicación sigue operable con la guía abierta (menú Archivo)', expanded);

  // Recorrido con teclado: Tab hasta el cuadro.
  // El punto de partida de Tab es el último punto de navegación, no `document.activeElement`: tras cerrar el menú «Archivo» (1e) es ese botón,
  // que está después de la guía, y `blur()` no lo reinicia. Se parte del primer elemento de la página («Saltar al contenido»).
  await page.getByRole('link', { name: 'Saltar al contenido' }).focus();
  await page.evaluate(() => window.scrollTo(0, 0));
  let tabs = 0;
  for (; tabs < 30; tabs++) {
    await page.keyboard.press('Tab');
    if ((await tourState(page)).focusInTour) break;
  }
  tabs++;
  const atTour = await tourState(page);
  step('2 con Tab se llega al cuadro de la guía (justo tras la cabecera)', atTour.focusInTour, { tabs, active: atTour.active });
  const order = [];
  // Tab: Omitir → Anterior (deshabilitado se salta) → Siguiente
  for (let i = 0; i < 2; i++) { await page.keyboard.press('Tab'); order.push((await tourState(page)).active); }
  step('2b orden de tabulación en el cuadro: Omitir, Siguiente', /Omitir/.test(atTour.active) && /Siguiente/.test(order[0]), { primero: atTour.active, order });

  const seen = [];
  await page.focus('[data-testid="guided-tour"] button.primary');
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);
    const st = await tourState(page);
    seen.push({ step: st.step, progress: st.progress, ring: st.ring, placement: st.placement });
  }
  const ids = seen.map((x) => x.step);
  step('3 Enter en «Siguiente» recorre los 5 pasos', JSON.stringify(ids) === JSON.stringify(['materials', 'check', 'results', 'report']), { seen });
  // Cada anillo envuelve al control real de su paso.
  const targets = { materials: '[role="tablist"][aria-label="Paneles del modelo"]', check: 'button.ea-primary', results: '[data-testid="result-summary"]', report: '.ea-group-main button:nth-of-type(1)' };
  let ringOk = true; const detail = {};
  for (const [id, sel] of Object.entries(targets)) { void id; void sel; }
  const rings = {};
  // Revisar el anillo de cada paso volviendo hacia atrás con «Anterior».
  for (let i = 3; i >= 0; i--) {
    const st = await tourState(page);
    const expectedSel = ['[role="tablist"][aria-label="Paneles del modelo"]', 'button.ea-primary', '[data-testid="result-summary"]', null][i];
    if (expectedSel) {
      const r = await rectOf(page, expectedSel);
      const ok = st.ring && r && Math.abs(st.ring.x - (r.x - 4)) <= 3 && Math.abs(st.ring.y - (r.y - 4)) <= 3 && Math.abs(st.ring.w - (r.w + 8)) <= 3 && Math.abs(st.ring.h - (r.h + 8)) <= 3;
      detail[st.step] = { ring: st.ring, target: r, ok };
      ringOk &&= !!ok;
      if (st.pop && r) ringOk &&= !overlap(st.pop, r);
    }
    await page.getByRole('button', { name: 'Anterior' }).click(); await page.waitForTimeout(350);
  }
  step('3b el anillo coincide con el control real de cada paso y el cuadro no lo tapa', ringOk, detail);
  const back = await tourState(page);
  step('3c «Anterior» regresa hasta el paso 1 (y «Anterior» se deshabilita)', back.step === 'open' && (await page.getByRole('button', { name: 'Anterior' }).isDisabled()), { back: back.step });

  // Llegar al último paso, comprobar el texto y cerrar con «Terminar».
  for (let i = 0; i < 4; i++) { await page.getByRole('button', { name: 'Siguiente' }).click(); await page.waitForTimeout(150); }
  const last = await tourState(page);
  await page.waitForTimeout(300);
  await shot(page, 'o-tour-5-claro-1440');
  step('4 último paso: «Terminar»', last.step === 'report' && last.nextLabel === 'Terminar', { last });
  await page.getByRole('button', { name: 'Terminar' }).click();
  await page.waitForTimeout(200);
  const closed = await tourState(page);
  step('4b «Terminar» cierra la guía y el foco queda en un control útil (Ayuda, porque «Informe PDF» aún está deshabilitado)', !closed.open && /Ayuda/.test(closed.active), { active: closed.active });
  const stored = await page.evaluate(() => localStorage.getItem('ogs.onboarding.v1'));
  step('5 la primera visita queda registrada en ogs.onboarding.v1', stored !== null, { stored });

  // Segunda visita
  await page.reload();
  await page.waitForSelector('[data-testid="editor-app"]');
  await page.waitForTimeout(900);
  const second = await tourState(page);
  step('5b segunda visita: la guía NO aparece', !second.open);

  // ───────── 6. Ayuda ▸ Recorrido guiado ─────────
  const helpBtn = page.getByRole('button', { name: 'Ayuda', exact: true });
  await helpBtn.focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('dialog[data-testid="help-dialog"][open]');
  const helpInfo = await page.evaluate(() => {
    const d = document.querySelector('dialog[data-testid="help-dialog"]');
    return {
      modal: d.matches(':modal'),
      label: d.getAttribute('aria-labelledby') && document.getElementById(d.getAttribute('aria-labelledby')).textContent,
      focus: document.activeElement?.tagName + ':' + document.activeElement?.textContent.trim().slice(0, 12),
      index: [...d.querySelectorAll('nav[aria-label="Contenido de la ayuda"] a')].map((a) => a.textContent),
      terms: [...d.querySelectorAll('.help-term dt')].map((x) => x.textContent),
      kbd: d.querySelectorAll('.help-table kbd').length,
      links: [...d.querySelectorAll('a[target="_blank"]')].map((a) => a.href),
    };
  });
  step('6 «Ayuda» abre un <dialog> modal con índice, glosario, atajos y enlaces', helpInfo.modal && helpInfo.index.length === 6 && helpInfo.terms.length === 21 && // F3R: 21 y no 17: la ayuda de refuerzos (R2) añadió cuatro términos al glosario (Refuerzos, Arrancamiento, Refuerzo activo y pasivo, Estado de un cruce). // I-W: 17 y no 12: F3a (W1e) añadió cinco términos al glosario (M-P, función f(ξ), Janbu corregido y f₀, Su, superficie polilínea). // U6-I: 12 y no 11: U6-G (R9-05b) añadió el término «Ángulo de la carga lineal» al glosario
     helpInfo.kbd >= 16 && helpInfo.links.length === 4, helpInfo);
  await shot(page, 'o-ayuda-claro-1440');
  // Índice: ir al glosario
  await page.getByRole('link', { name: 'Glosario' }).click();
  const gl = await page.evaluate(() => document.activeElement?.id);
  step('6b el índice interno lleva el foco al encabezado de la sección', gl === 'help-glossary', { gl });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const afterEsc = await page.evaluate(() => ({ open: !!document.querySelector('dialog[data-testid="help-dialog"][open]'), active: document.activeElement?.textContent?.trim() }));
  step('7 Esc cierra la ayuda y el foco vuelve al botón «Ayuda»', !afterEsc.open && afterEsc.active === 'Ayuda', afterEsc);

  // Reabrir la guía desde la ayuda
  await helpBtn.click();
  await page.waitForSelector('dialog[data-testid="help-dialog"][open]');
  await page.getByRole('button', { name: 'Recorrido guiado' }).click();
  await page.waitForTimeout(400);
  const reopened = await tourState(page);
  step('8 «Ayuda ▸ Recorrido guiado» reabre la guía en el paso 1, con el foco en «Siguiente»', reopened.open && reopened.step === 'open' && reopened.focusInTour && /Siguiente/.test(reopened.active) && !(await page.evaluate(() => !!document.querySelector('dialog[open]'))), { reopened });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const escTour = await tourState(page);
  step('8b Esc dentro de la guía la cierra y el foco vuelve al control destacado («Archivo»)', !escTour.open && /Archivo/.test(escTour.active), { active: escTour.active });

  // ───────── Instalar app ─────────
  const noBtn = await page.locator('[data-testid="install-app"]').count();
  await page.evaluate(() => {
    window.__prompted = 0;
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = async () => { window.__prompted += 1; };
    e.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
    window.dispatchEvent(e);
    window.__bip = e;
  });
  await page.waitForSelector('[data-testid="install-app"]');
  const prevented = await page.evaluate(() => window.__bip.defaultPrevented);
  await shot(page, 'o-instalar-claro-1440');
  await page.locator('[data-testid="install-app"]').click();
  await page.waitForTimeout(200);
  const gone = await page.locator('[data-testid="install-app"]').count();
  step('9 «Instalar app»: oculto sin oferta, aparece con beforeinstallprompt, llama a prompt() y se oculta tras instalar', noBtn === 0 && prevented && (await page.evaluate(() => window.__prompted)) === 1 && gone === 0, { noBtn, prevented, gone });
  await ctx.close();
}

// ───────── 9b. Ya instalada (display-mode: standalone) ─────────
{
  const { ctx, page } = await newPage();
  await ctx.addInitScript(() => localStorage.setItem('ogs.onboarding.v1', 'seen'));
  // Chrome de escritorio no emula display-mode: se simula la respuesta de matchMedia, que es lo que lee la aplicación.
  await ctx.addInitScript(() => { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (q === '(display-mode: standalone)' ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false } : mm(q)); });
  await page.goto(URL_);
  await page.waitForSelector('[data-testid="editor-app"]');
  const standalone = await page.evaluate(() => matchMedia('(display-mode: standalone)').matches);
  await page.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = async () => {}; e.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(e); });
  await page.waitForTimeout(200);
  step('9b en modo standalone el botón «Instalar app» no se muestra aunque llegue el evento', standalone && (await page.locator('[data-testid="install-app"]').count()) === 0, { standalone });
  await ctx.close();
}

// ───────── 10. Panel Proyecto y confirmación ─────────
if (WITH_PROJECT) {
  const { ctx, page } = await newPage();
  await ctx.addInitScript(() => localStorage.setItem('ogs.onboarding.v1', 'seen'));
  await page.goto(URL_);
  await page.waitForSelector('[data-testid="editor-app"]');
  await page.getByRole('tab', { name: 'Proyecto' }).click();
  const title = page.getByLabel('Título', { exact: true });
  await title.fill('Talud norte, corte 12');
  await title.press('Enter');
  await page.waitForTimeout(150);
  const status = (await page.textContent('[data-testid="file-status"]')).trim();
  step('10 el título del proyecto se muestra en la barra de estado', /Talud norte, corte 12/.test(status), { status });
  const notes0 = await page.getByLabel('Descripción').inputValue();
  await page.getByLabel('Descripción').fill('Primera línea\nSegunda línea');
  await page.getByLabel('Descripción').blur();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  const notesAfterUndo = await page.getByLabel('Descripción').inputValue();
  step('10b descripción: un solo paso de historial (Deshacer restaura el texto anterior)', notesAfterUndo === notes0 && notes0.length > 0, { notesAfterUndo: notesAfterUndo.slice(0, 30) });
  await page.getByLabel('Descripción').fill('Nota para el informe');
  await page.getByLabel('Descripción').blur();

  const units = page.getByLabel('Unidades');
  const before = await units.inputValue();
  await units.focus();
  await units.selectOption('imperial');
  // U5-E (R8 A-02): el cambio de unidades abre un diálogo propio con tres opciones; la opción por defecto es «Convertir los valores».
  const UNITS = 'dialog:has([data-testid="units-dialog"])';
  await page.waitForSelector(UNITS + '[open]');
  await page.waitForTimeout(200);
  const dlg = await page.evaluate((q) => {
    const d = document.querySelector(q);
    return { modal: d.matches(':modal'), text: d.textContent, focus: document.activeElement?.textContent, name: document.getElementById(d.getAttribute('aria-labelledby')).textContent };
  }, UNITS);
  await shot(page, 'o-confirm-claro-1440');
  step('11 cambiar unidades abre el diálogo propio (modal) con tres opciones y el foco en «Convertir los valores»', dlg.modal && /Convertir los valores/.test(dlg.focus) && /Solo cambiar la etiqueta/.test(dlg.text) && /no cambia/.test(dlg.text), dlg);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const afterCancel = await page.evaluate(() => ({ open: !!document.querySelector('[data-testid="units-dialog"]'), units: document.querySelector('select[data-path="/units"]').value, active: document.activeElement?.getAttribute('data-path') }));
  step('11b Esc cancela: las unidades no cambian y el foco vuelve al selector', !afterCancel.open && afterCancel.units === before && afterCancel.active === '/units', afterCancel);

  await units.selectOption('imperial');
  await page.waitForSelector(UNITS + '[open]');
  await page.getByRole('button', { name: 'Solo cambiar la etiqueta' }).click();
  await page.waitForTimeout(200);
  const afterOk = await page.evaluate(() => ({ units: document.querySelector('select[data-path="/units"]').value, dialog: !!document.querySelector('[data-testid="units-dialog"]') }));
  await page.getByRole('tab', { name: 'Materiales' }).click();
  const unitLabel = await page.locator('#ea-tabpanel').textContent();
  const dirty = (await page.textContent('[data-testid="file-status"]')).includes('con cambios');
  step('11c «Solo cambiar la etiqueta» aplica las unidades imperiales (etiquetas pcf/psf) sin convertir valores y deja cambios sin guardar', afterOk.units === 'imperial' && /pcf/.test(unitLabel) && dirty, { afterOk, pcf: /pcf/.test(unitLabel), dirty });
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await page.getByRole('tab', { name: 'Proyecto' }).click();
  step('11d Deshacer vuelve a SI en un solo paso', (await page.getByLabel('Unidades').inputValue()) === 'SI');
  await page.getByRole('tab', { name: 'Proyecto' }).click();
  await shot(page, 'o-proyecto-claro-1440');
  await ctx.close();
}

console.log('ERRORES DE CONSOLA:', JSON.stringify(out.errors));
step('sin errores de consola', out.errors.length === 0, { errors: out.errors });
const failed = out.steps.filter((s) => !s.ok).length;
console.log(`RESUMEN ${out.steps.length - failed}/${out.steps.length}`);
await browser.close();
