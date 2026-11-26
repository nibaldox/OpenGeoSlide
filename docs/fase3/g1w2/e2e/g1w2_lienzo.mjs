// F3G-G1 W2: agua embalsada y grieta de tracción en el lienzo, Resultados, Diagnósticos, CSV, PDF y Ayuda, en Chrome y en claro y oscuro.
// Modelo: V047a (v0.3) con la piezométrica 2 m sobre el pie (y = 27). El motor de la rama base aún no calcula la grieta (stubs de G0): con
// INJECT=1 el guion envuelve `Worker.prototype.addEventListener` y agrega `tension_crack` (SIMULADO, solo para ver el dibujo) al resultado.
// Uso: OGS_URL=http://127.0.0.1:5186/ OGS_REPO=$PWD INJECT=1 node docs/fase3/g1w2/e2e/g1w2_lienzo.mjs   (playwright-core desde docs/node_modules)
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5186/';
const REPO = process.env.OGS_REPO ?? process.cwd();
const INJECT = process.env.INJECT === '1';
const DRY = process.env.DRY === '1';
const SHOTS = path.join(process.env.TMPDIR, 'g1w2-shots');
mkdirSync(SHOTS, { recursive: true });
const AXE = process.env.AXE ?? path.join(process.env.TMPDIR, 'w2-e2e/node_modules/axe-core/axe.min.js');

const base = JSON.parse(readFileSync(path.join(REPO, 'verification/cases/V047a.json'), 'utf8')).model;
const model = { ...base, water: { piezometric_line: [[20, 27], [70, 27]], unit_weight: 9.81 } };
const modelPath = path.join(SHOTS, 'v047a-2m-agua.ogs.json');
writeFileSync(modelPath, JSON.stringify(model));

let failed = 0;
const step = (n, ok, data = {}) => {
  if (!ok) failed += 1;
  console.log(ok ? 'OK  ' : 'FAIL', n, JSON.stringify(data));
};

// Resultado simulado: la masa se trunca en x_c (se quitan las dovelas del lado de la cresta) y se agrega `tension_crack`.
const injectScript = (dry) => {
  const orig = Worker.prototype.addEventListener;
  Worker.prototype.addEventListener = function (type, fn, opts) {
    if (type !== 'message') return orig.call(this, type, fn, opts);
    const wrapped = (e) => {
      try {
        const d = e.data;
        if (d && d.ok && d.result) {
          const rep = typeof d.result === 'string' ? JSON.parse(d.result) : d.result;
          if (rep.results) {
            for (const r of rep.results) {
              if (!r.slices || r.slices.length < 4) continue;
              const xs = r.slices.map((s) => s.x_right);
              const xc = Math.max(...xs) - 0.12 * (Math.max(...xs) - Math.min(...r.slices.map((s) => s.x_left)));
              const kept = r.slices.filter((s) => s.x_right <= xc + 1e-9);
              const last = kept[kept.length - 1];
              r.slices = kept;
              // Profundidad = terreno − base en x_c (G1: la grieta llega justo a la superficie); con agua llena, Pw = ½·γw·d².
              const depth = last.y_top_mid - last.y_base_right;
              r.tension_crack = { x: last.x_right, depth, water_force: dry ? 0 : 0.5 * 9.81 * depth * depth };
            }
            d.result = typeof d.result === 'string' ? JSON.stringify(rep) : rep;
          }
        }
        fn.call(this, { data: e.data });
      } catch (err) {
        fn.call(this, e);
      }
    };
    return orig.call(this, type, wrapped, opts);
  };
};

async function openMenu(p, name) {
  const t = p.getByRole('button', { name, exact: true });
  if ((await t.getAttribute('aria-expanded')) !== 'true') await t.click();
  await p.waitForFunction((n) => [...document.querySelectorAll('button.dd-trigger')].some((x) => x.textContent.trim().startsWith(n) && x.getAttribute('aria-expanded') === 'true'), name);
}

async function axe(p, label) {
  await p.addScriptTag({ path: AXE });
  const r = await p.evaluate(async () => {
    const out = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] });
    return out.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  });
  const sc = r.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  step(`axe sin serious/critical: ${label}`, sc.length === 0, { sc, otras: r.filter((v) => !sc.includes(v)).map((v) => `${v.id}:${v.impact}`) });
}

const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
for (const theme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: theme, acceptDownloads: true });
  await ctx.addInitScript((t) => { try { localStorage.setItem('ogs.theme.v1', t); localStorage.setItem('ogs.onboarding.v1', 'seen'); } catch {} }, theme);
  if (INJECT) await ctx.addInitScript(injectScript, DRY);
  const errors = [];
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url ?? '').endsWith('/favicon.ico')) errors.push(m.text()); });
  await p.goto(URL_);
  await p.waitForSelector('[data-testid="editor-app"]');
  await p.waitForFunction(() => /ogs-core/.test(document.querySelector('[data-testid="engine-banner"]')?.textContent ?? ''), null, { timeout: 30000 });
  await p.locator('[data-testid="file-open"]').setInputFiles(modelPath);
  await p.waitForSelector('[data-layer="regions"] polygon');
  await p.waitForTimeout(400);

  // Agua embalsada, antes de calcular.
  const pond = await p.locator('[data-layer="pond"] polygon').count();
  step(`${theme}: capa del agua embalsada con un polígono antes de calcular`, pond === 1, { pond });
  const fill = await p.locator('[data-layer="pond"] polygon').first().evaluate((el) => getComputedStyle(el).fill);
  step(`${theme}: el relleno resuelve --canvas-pond`, /rgb/.test(fill), { fill });
  const order = await p.evaluate(() => { const l = [...document.querySelectorAll('svg [data-layer]')].map((g) => g.getAttribute('data-layer')); return [l.indexOf('regions'), l.indexOf('pond'), l.indexOf('piezometric')]; });
  step(`${theme}: orden de capas regiones < agua < piezométrica`, order[0] < order[1] && order[1] < order[2], { order });
  await p.screenshot({ path: path.join(SHOTS, `${theme}-1-agua-sin-calcular.png`) });

  // Calcular.
  await p.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await p.waitForSelector('[data-testid="results-panel"] table', { timeout: 60000 });
  await p.waitForTimeout(500);
  const legend = await p.locator('ul.legend').innerText();
  step(`${theme}: la leyenda dice «Agua embalsada»`, legend.includes('Agua embalsada'), { legend: legend.split('\n').filter((x) => /Agua|Grieta/.test(x)) });
  if (INJECT) {
    const crack = p.locator('[data-layer="tension-crack"]');
    step(`${theme}: capa de la grieta presente (resultado simulado)`, (await crack.count()) === 1);
    step(`${theme}: línea discontinua vertical`, (await crack.locator('[data-crack-line]').getAttribute('stroke-dasharray')) === '5 4');
    const labels = await crack.locator('text').evaluateAll((els) => els.map((e) => e.textContent));
    step(`${theme}: rótulos de profundidad${DRY ? '' : ' y Pw'}`, labels.some((t) => t.startsWith('Grieta d =')) && (DRY ? !labels.some((t) => t.startsWith('Pw')) : labels.some((t) => t.startsWith('Pw ='))), { labels });
    step(`${theme}: flecha de Pw ${DRY ? 'ausente' : 'presente'}`, (await crack.locator('[data-crack-arrow]').count()) === (DRY ? 0 : 1));
    step(`${theme}: leyenda con «Grieta de tracción»`, legend.includes('Grieta de tracción'));
    step(`${theme}: tabla de la grieta bajo Resultados`, (await p.locator('[data-testid="crack-results"] tbody tr').count()) >= 1, { fila: await p.locator('[data-testid="crack-results"] tbody tr').first().innerText() });
    step(`${theme}: resumen de la grieta en Diagnósticos`, (await p.locator('[data-testid="crack-summary"]').count()) === 1, { texto: await p.locator('[data-testid="crack-summary"]').innerText() });
  }
  await p.locator('[data-testid="editor-canvas"]').screenshot({ path: path.join(SHOTS, `${theme}-2-lienzo${INJECT ? (DRY ? '-grieta-seca' : '-grieta') : ''}.png`) });
  await p.screenshot({ path: path.join(SHOTS, `${theme}-3-pagina${INJECT ? (DRY ? '-grieta-seca' : '-grieta') : ''}.png`), fullPage: true });

  // CSV de resultados.
  await openMenu(p, 'Exportar');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByText('Exportar resultados (CSV)').click()]);
  const csvPath = path.join(SHOTS, `${theme}-resultados.csv`);
  await dl.saveAs(csvPath);
  const csv = readFileSync(csvPath, 'utf8');
  const header = csv.replace(/^\ufeff/, '').split('\r\n')[0];
  step(`${theme}: CSV de resultados ${INJECT ? 'con' : 'sin'} columnas de la grieta`, INJECT ? /grieta_x_m,grieta_profundidad_m,grieta_pw_kn_m$/.test(header) : !header.includes('grieta'), { header });
  const warnCol = csv.includes('water_above_ground');
  step(`${theme}: CSV con el aviso water_above_ground en la columna avisos`, warnCol);

  // PDF.
  await p.keyboard.press('Escape');
  const [pdf] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }).catch(() => null), p.getByRole('button', { name: 'Informe PDF', exact: true }).click()]);
  if (pdf) {
    const pdfPath = path.join(SHOTS, `${theme}-informe.pdf`);
    await pdf.saveAs(pdfPath);
    const head = readFileSync(pdfPath).subarray(0, 5).toString('latin1');
    step(`${theme}: PDF generado`, head === '%PDF-', { bytes: readFileSync(pdfPath).length });
  } else {
    step(`${theme}: PDF generado`, false, { nota: 'sin descarga' });
  }

  // Ayuda.
  await p.getByRole('button', { name: 'Ayuda', exact: true }).click();
  await p.waitForSelector('[data-testid="help-dialog"]');
  const help = await p.locator('[data-testid="help-dialog"]').innerText();
  step(`${theme}: Ayuda con «Agua embalsada» y «Grieta de tracción»`, help.includes('Agua embalsada') && help.includes('Grieta de tracción'));
  await p.locator('#help-glossary').scrollIntoViewIfNeeded();
  await p.locator('[data-testid="help-dialog"] dt', { hasText: 'Agua embalsada' }).scrollIntoViewIfNeeded();
  await p.screenshot({ path: path.join(SHOTS, `${theme}-4-ayuda-agua.png`) });
  await axe(p, `${theme} Ayuda abierta`);
  await p.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await p.waitForTimeout(200);
  await axe(p, `${theme} editor con agua embalsada${INJECT ? ' y grieta' : ''}`);
  step(`${theme}: consola sin errores`, errors.length === 0, { errors });
  await ctx.close();
}
await b.close();
console.log(failed === 0 ? 'TODO OK' : `${failed} FALLOS`);
process.exit(failed === 0 ? 0 : 1);
