// F3G-R13 (I-G3, E15m-15): revisión en Chrome real, con el MOTOR REAL (WASM de la web, sin inyección ni datos simulados), del rótulo del
// «corte de la masa sin grieta de tracción» (`face_height` > 0 y `depth` = 0; p. ej., una sobrecarga sobre la corona), en claro y oscuro,
// con el modelo docs/fase3/r12/repro/a04_udl.json (talud con carga uniforme sobre la corona y grieta automática):
//   1. Editor: tras «Comprobar» el lienzo (SVG) rotula «Corte de la masa (cara de … m) sin grieta de tracción» (data-crack-label="cut"), sin el
//      rótulo «Sin grieta (z = 0)», sin línea ni hueco de agua de grieta; el título accesible trae la frase completa; el rótulo cae dentro del
//      lienzo y no se encima con ningún otro texto del SVG; la tabla de la grieta (Diagnósticos/Resultados) y el resumen dicen lo mismo.
//   2. Casos (Canvas 2D): el rótulo se dibuja una vez (se espía `fillText`: el Canvas 2D no tiene DOM), dentro del lienzo y sin encimarse con otro
//      texto del dibujo; la tabla de la grieta dice «Corte de la masa en x = … (cara de … m) sin grieta de tracción».
//   3. PDF: «Informe PDF» se descarga, se rasteriza con pdftoppm (para verlo) y su capa de texto trae el rótulo sin que sus palabras se
//      encimen con otras (`pdftotext -bbox`) y la nota explicativa del corte.
//   4. Un caso con grieta real (grieta fija de 1,5 m) NO usa el rótulo del corte (dibuja «Grieta d = …»).
//   5. axe-core sin serious/critical en el editor y en Casos; consola sin errores ni HTTP ≥ 400.
// Uso: OGS_URL=http://127.0.0.1:5186/ OGS_REPO=$PWD TMPDIR=<scratch> node docs/fase3/r13/e2e/r13_face_height.mjs
//   (playwright-core desde docs/node_modules; axe-core: AXE=<axe.min.js> o <scratch>/x8-ux/node_modules/axe-core/axe.min.js; pdftotext y pdftoppm de
//   poppler). SHOTS=<carpeta> cambia las capturas (por defecto <scratch>/r13-face-shots).
// Imprime una línea `OK` o `FAIL` por comprobación (el runner cuenta ^FAIL y exige al menos un ^OK).
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const TMP = process.env.TMPDIR ?? os.tmpdir();
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5186/';
const REPO = process.env.OGS_REPO ?? process.cwd();
const SHOTS = process.env.SHOTS ?? path.join(TMP, 'r13-face-shots');
mkdirSync(SHOTS, { recursive: true });
const AXE = [process.env.AXE, path.join(TMP, 'x8-ux/node_modules/axe-core/axe.min.js'), path.join(TMP, 'w2-e2e/node_modules/axe-core/axe.min.js')].find((p) => p && existsSync(p));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
let fails = 0, oks = 0; const errors = [];
const step = (n, ok, d = {}) => { if (ok) oks++; else fails++; console.log(ok ? 'OK  ' : 'FAIL', n, JSON.stringify(d)); };
step('axe-core disponible', !!AXE, { AXE });
async function axe(p, label) {
  if (!AXE) return;
  await p.addScriptTag({ path: AXE });
  const r = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] })).violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) })));
  const sc = r.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  step(`axe ${label}`, sc.length === 0, { sc, otras: r.filter((v) => !sc.includes(v)).map((v) => `${v.id}:${v.impact}`) });
}
const inter = (a, c, pad = 0) => a.x < c.x + c.w - pad && c.x < a.x + a.w - pad && a.y < c.y + c.h - pad && c.y < a.y + a.h - pad;

const MODEL = path.join(REPO, 'docs/fase3/r12/repro/a04_udl.json');
const CUT_SHORT = /^Corte de la masa \(cara de \d+,\d+ m\) sin grieta de tracción$/;
const CUT_LONG = /Corte de la masa en x = [−-]?\d+(,\d+)? \(cara de \d+(,\d+)? m\) sin grieta de tracción: la profundidad de Rankine es 0 en ese punto/;
const base = JSON.parse(readFileSync(MODEL, 'utf8'));
step('el modelo a04_udl es v0.5 con grieta automática y una sobrecarga', base.version === '0.5' && base.analysis.tension_crack?.depth === 'auto' && base.loads?.[0]?.type === 'udl', {});
const fCrack = path.join(TMP, 'r13face-grieta-fija.ogs.json');
{ const m = structuredClone(base); m.analysis.tension_crack = { depth: 1.5, water_fill: 1 }; writeFileSync(fCrack, JSON.stringify(m)); }

for (const theme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: theme, acceptDownloads: true });
  await ctx.addInitScript((t) => { try { localStorage.setItem('ogs.onboarding.v1', 'seen'); localStorage.setItem('ogs.theme.v1', t); } catch {} }, theme);
  // Espía del Canvas 2D: cada texto con su posición, su fuente y su ancho medido (Casos no tiene DOM para los rótulos).
  await ctx.addInitScript(() => {
    window.__fill = [];
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t, x, y, ...rest) {
      const m = this.measureText(String(t));
      const px = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? 12);
      const tr = this.getTransform();
      window.__fill.push({ t: String(t), x: tr.a * x + tr.e, y: tr.d * y + tr.f, w: m.width * tr.a, h: px * tr.d, align: this.textAlign, base: this.textBaseline, canvas: [this.canvas.width, this.canvas.height] });
      return orig.call(this, t, x, y, ...rest);
    };
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url ?? '').endsWith('/favicon.ico')) errors.push(m.text()); });
  p.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  await p.goto(URL_);
  await p.waitForSelector('[data-layer="regions"] polygon');
  await p.waitForFunction(() => /ogs-core/.test(document.querySelector('[data-testid="engine-banner"]')?.textContent ?? ''));
  const openFile = async (f) => {
    await p.setInputFiles('[data-testid="file-open"]', f);
    await p.waitForTimeout(300);
    if (await p.locator('[data-testid="confirm-dialog"]').isVisible()) await p.getByRole('button', { name: 'Descartar cambios' }).click();
    await p.waitForTimeout(500);
  };

  // ── 1. Editor ──
  await openFile(MODEL);
  await p.getByRole('tab', { name: 'Análisis' }).click();
  await p.getByRole('button', { name: 'Comprobar' }).click();
  await p.waitForSelector('[data-crack-label="cut"]', { state: 'attached', timeout: 30000 });
  await p.waitForTimeout(400);
  const lab = await p.evaluate(() => {
    const t = document.querySelector('[data-crack-label="cut"]');
    const svg = t.closest('svg');
    const r = (e) => { const q = e.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; };
    const handles = [...svg.querySelectorAll('[data-handle-shape]')].map((e) => r(e));
    const others = [...svg.querySelectorAll('text')].filter((e) => e !== t && (e.textContent ?? '').trim() && getComputedStyle(e).visibility !== 'hidden').map((e) => ({ text: e.textContent, ...r(e) }));
    return {
      text: t.textContent, rect: r(t), svg: r(svg), others, handles,
      title: t.parentElement.querySelector('title')?.textContent ?? '',
      layer: t.parentElement.getAttribute('data-layer'),
      none: !!document.querySelector('[data-crack-label="none"]'), depthLabel: !!document.querySelector('[data-crack-label="depth"]'),
      crackLine: !!document.querySelector('[data-crack-line]'), crackWater: !!document.querySelector('[data-crack-water]'),
      fs: /FS \d/.test(document.body.innerText),
    };
  });
  step(`${theme}: editor: el lienzo rotula el corte de la masa sin grieta de tracción`, CUT_SHORT.test(lab.text), { text: lab.text });
  step(`${theme}: editor: no hay «Sin grieta (z = 0)», ni línea, ni hueco de agua, ni rótulo de profundidad`, !lab.none && !lab.depthLabel && !lab.crackLine && !lab.crackWater && lab.layer === 'tension-crack-cut', lab);
  step(`${theme}: editor: el título accesible trae la frase completa de E15m-15`, CUT_LONG.test(lab.title), { title: lab.title });
  const R = lab.rect, S = lab.svg;
  step(`${theme}: editor: el rótulo cae dentro del lienzo (${Math.round(R.w)}×${Math.round(R.h)} px)`, R.w > 100 && R.x >= S.x - 0.5 && R.y >= S.y - 0.5 && R.x + R.w <= S.x + S.w + 0.5 && R.y + R.h <= S.y + S.h + 0.5, { R, S });
  const clash = lab.others.filter((o) => o.w > 0 && inter(R, o, 1));
  step(`${theme}: editor: no se encima con ninguno de los ${lab.others.length} demás textos del lienzo`, clash.length === 0, { clash });
  const clashH = lab.handles.filter((h) => inter(R, h, 0.5));
  step(`${theme}: editor: no tapa ni lo tapa ninguno de los ${lab.handles.length} tiradores (su figura visible; el área de acierto de 24 px puede rozar el rótulo, que no intercepta el puntero)`, lab.handles.length > 0 && clashH.length === 0, { clashH });
  const tbl = await p.locator('[data-testid="crack-results"]').first().innerText().catch(() => '');
  step(`${theme}: editor: la tabla de la grieta dice lo mismo (frase completa, sin «Sin grieta»)`, CUT_LONG.test(tbl) && !/Sin grieta \(z = 0\)/.test(tbl), { tbl: tbl.slice(0, 400) });
  const sum = await p.locator('[data-testid="crack-summary"]').first().innerText().catch(() => '');
  step(`${theme}: editor: el resumen de la grieta dice lo mismo`, CUT_LONG.test(sum), { sum: sum.slice(0, 300) });
  await p.screenshot({ path: path.join(SHOTS, `${theme}-1-editor.png`) });
  // Recorte del lienzo alrededor del rótulo (para verlo a tamaño real)
  const clip = { x: Math.max(0, Math.min(R.x - 40, 1440 - 600)), y: Math.max(0, R.y - 60), width: 600, height: 140 };
  await p.screenshot({ path: path.join(SHOTS, `${theme}-1b-editor-rotulo.png`), clip });
  const canvasBox = await p.locator('[data-layer="regions"]').first().evaluate((e) => { const s = e.closest('svg').getBoundingClientRect(); return { x: s.x, y: s.y, width: s.width, height: s.height }; });
  await p.screenshot({ path: path.join(SHOTS, `${theme}-1c-lienzo.png`), clip: canvasBox });
  await axe(p, `${theme} editor con el corte sin grieta de tracción`);

  // ── 3. PDF (el mismo cálculo del editor) ──
  const [pdfDl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Informe PDF' }).click()]);
  const pdfPath = path.join(SHOTS, `${theme}-a04-corte.pdf`); await pdfDl.saveAs(pdfPath);
  step(`${theme}: PDF generado`, readFileSync(pdfPath).subarray(0, 5).toString('latin1') === '%PDF-', { bytes: readFileSync(pdfPath).length });
  const bbox = spawnSync('pdftotext', ['-bbox', pdfPath, '-'], { encoding: 'utf8' }).stdout ?? '';
  const pages = bbox.split('<page ').slice(1).map((pg) => [...pg.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)].map((m) => ({ x: +m[1], y: +m[2], w: +m[3] - +m[1], h: +m[4] - +m[2], t: m[5].replaceAll('&amp;', '&') })));
  // La frase del corte aparece en la tabla de la grieta (sección 5, celda que se parte en 3 líneas) y, resumida, en la nota. La figura del PDF
  // no lleva rótulo de grieta si no hay grieta (tampoco «Sin grieta (z = 0)»): el corte se lee en la tabla y en la nota.
  const seq = ['Corte', 'de', 'la', 'masa', 'en', 'x'];
  const hits = [];
  pages.forEach((ws, pi) => { for (let i = 0; i + seq.length < ws.length; i++) if (seq.every((s, k) => ws[i + k].t === s)) { let e = i + seq.length; while (e < ws.length && !/^sobrecarga\)$/.test(ws[e].t) && e - i < 40) e++; if (/^sobrecarga\)$/.test(ws[e]?.t ?? '')) hits.push({ pi, i, e }); } });
  step(`${theme}: PDF: la tabla de la grieta trae la frase del corte, una vez por método (Bishop y Spencer)`, hits.length === 2 && hits.every((h) => h.pi === hits[0].pi), { hits: hits.length, paginas: pages.length });
  const clashP = [];
  for (const h of hits) {
    const ws = pages[h.pi];
    const mine = ws.slice(h.i, h.e + 1), rest = ws.filter((_, k) => k < h.i || k > h.e);
    for (const w of mine) for (const o of rest) if (inter(w, o, 0.3)) clashP.push({ w: w.t, o: o.t });
  }
  step(`${theme}: PDF: las palabras de la frase del corte no se encima con otras de la página`, hits.length > 0 && clashP.length === 0, { clashP: clashP.slice(0, 5) });
  const flat = (spawnSync('pdftotext', ['-raw', pdfPath, '-'], { encoding: 'utf8' }).stdout ?? '').replace(/\s+/g, ' ');
  step(`${theme}: PDF: la nota explica «Corte de la masa … sin grieta de tracción» y la cara cortada`, /«Corte de la masa … sin grieta de tracción» indica que la masa se cortó en x_c pero la profundidad de Rankine es 0 en ese punto/.test(flat) && /La cara cortada es la altura de la cara vertical de la masa en x_c/.test(flat), {});
  spawnSync('pdftoppm', ['-r', '110', '-png', '-f', '1', '-l', '4', pdfPath, path.join(SHOTS, `${theme}-a04-corte-pdf`)]);
  step(`${theme}: PDF rasterizado (${SHOTS})`, existsSync(path.join(SHOTS, `${theme}-a04-corte-pdf-1.png`)) || existsSync(path.join(SHOTS, `${theme}-a04-corte-pdf-01.png`)), {});

  // ── 2. Casos ──
  const casos = async (file) => {
    await p.getByRole('tab', { name: 'Casos de verificación' }).click();
    await p.waitForSelector('.cases-view');
    await p.locator('.cases-view input[type="file"]').setInputFiles(file);
    await p.waitForTimeout(300);
    await p.evaluate(() => { window.__fill.length = 0; });
    await p.getByRole('button', { name: 'Comprobar caso', exact: true }).click();
    await p.waitForSelector('.cases-view #results-title', { timeout: 60000 });
    await p.waitForFunction(() => document.querySelector('.cases-view table') && !/Comprobando/.test(document.body.innerText), null, { timeout: 60000 });
    await p.waitForTimeout(900);
    return p.evaluate(() => window.__fill.slice());
  };
  let fill = await casos(MODEL);
  const cut = fill.filter((f) => CUT_SHORT.test(f.t));
  step(`${theme}: Casos: el Canvas 2D dibuja el rótulo del corte (una vez) y no «Sin grieta (z = 0)»`, new Set(cut.map((f) => `${f.t}@${Math.round(f.x)},${Math.round(f.y)}`)).size === 1 && !fill.some((f) => f.t === 'Sin grieta (z = 0)'), { cut: cut.map((f) => f.t), grieta: fill.filter((f) => /grieta|Pw/i.test(f.t)).map((f) => f.t) });
  if (cut.length) {
    const c = cut[cut.length - 1];
    const left = c.align === 'right' || c.align === 'end' ? c.x - c.w : c.align === 'center' ? c.x - c.w / 2 : c.x;
    const top = c.base === 'middle' ? c.y - c.h / 2 : c.base === 'top' ? c.y : c.y - c.h * 0.8;
    const R = { x: left, y: top, w: c.w, h: c.h };
    step(`${theme}: Casos: el rótulo cae dentro del lienzo (${Math.round(c.w)} px de ancho en ${c.canvas[0]}×${c.canvas[1]})`, R.x >= -0.5 && R.y >= -0.5 && R.x + R.w <= c.canvas[0] + 0.5 && R.y + R.h <= c.canvas[1] + 0.5, { R, canvas: c.canvas });
    const seen = new Set();
    const others = fill.filter((f) => f !== c && f.canvas[0] === c.canvas[0] && f.canvas[1] === c.canvas[1] && !CUT_SHORT.test(f.t)).filter((f) => { const k = `${f.t}@${Math.round(f.x)},${Math.round(f.y)}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .map((f) => { const l = f.align === 'right' || f.align === 'end' ? f.x - f.w : f.align === 'center' ? f.x - f.w / 2 : f.x; const t = f.base === 'middle' ? f.y - f.h / 2 : f.base === 'top' ? f.y : f.y - f.h * 0.8; return { t: f.t, x: l, y: t, w: f.w, h: f.h }; });
    const clashC = others.filter((o) => inter(R, o, 1));
    step(`${theme}: Casos: el rótulo no se encima con ninguno de los ${others.length} demás textos del dibujo`, clashC.length === 0, { clashC });
  }
  const tableText = await p.locator('.cases-view').innerText();
  step(`${theme}: Casos: la tabla de la grieta dice «Corte de la masa en x = … sin grieta de tracción» y no «Sin grieta (z = 0)»`, CUT_LONG.test(tableText) && !/Sin grieta \(z = 0\)/.test(tableText), { t: (/Corte de la masa[^\n]*/.exec(tableText) ?? [''])[0].slice(0, 200) });
  await p.screenshot({ path: path.join(SHOTS, `${theme}-2-casos.png`), fullPage: true });
  const cv = await p.locator('.cases-view canvas').first().screenshot({ path: path.join(SHOTS, `${theme}-2b-casos-lienzo.png`) }).then(() => true).catch(() => false);
  step(`${theme}: Casos: captura del lienzo`, cv, {});
  const crackTbl = p.locator('.cases-view [data-testid="crack-results"]').first();
  if (await crackTbl.count()) await crackTbl.screenshot({ path: path.join(SHOTS, `${theme}-2c-casos-tabla-grieta.png`) });
  await axe(p, `${theme} Casos con el corte sin grieta de tracción`);

  // ── 4. Grieta real: sin rótulo de corte ──
  fill = await casos(fCrack);
  step(`${theme}: Casos (grieta fija de 1,5 m): dibuja «Grieta d = …» y NO el rótulo del corte ni «Sin grieta»`, fill.some((f) => /^Grieta d = /.test(f.t)) && !fill.some((f) => CUT_SHORT.test(f.t) || f.t === 'Sin grieta (z = 0)'), { textos: fill.filter((f) => /grieta|Pw/i.test(f.t)).map((f) => f.t) });
  await p.getByRole('tab', { name: 'Editar' }).click();
  await p.waitForSelector('[data-layer="regions"] polygon');
  await openFile(fCrack);
  await p.getByRole('tab', { name: 'Análisis' }).click();
  await p.getByRole('button', { name: 'Comprobar' }).click();
  await p.waitForSelector('[data-crack-label="depth"]', { state: 'attached', timeout: 30000 });
  step(`${theme}: editor (grieta fija): rotula la profundidad y no el corte`, (await p.locator('[data-crack-label="cut"]').count()) === 0, {});
  step(`${theme}: consola sin errores ni HTTP ≥ 400`, errors.length === 0, { errors });
  await ctx.close();
}
await b.close();
console.log(`RESUMEN OK=${oks} FAIL=${fails} errores_consola=${errors.length}`);
