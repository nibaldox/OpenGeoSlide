// R10B-04b / R10B-02: la comprobación local de la polilínea (terreno + base: `checkPolylineAgainstModel`) da el mismo veredicto que el motor real en
// polilíneas aleatorias (semilla fija) sobre tres modelos: `polyline_*` ⇔ estado `invalid` con ese aviso, `polyline_outside_model` ⇔ NoValidSurface
// «la polilínea sale del modelo», y admisible ⇔ ninguno de los dos.
import { describe, expect, it } from 'vitest';
import type { Point } from '../../engine/types';
import { loadPublishedDoc } from '../../report/fixtures';
import { simpleSlope, slopeFormDefaults, slopeFromForm } from '../app/newModel';
import type { ModelDoc } from '../types';
import { engineRun, haveEngine } from './engineRun.testutil';
import { bottomAt, checkPolylineAgainstModel } from './polylineGround';

function talud(): ModelDoc {
  const out = slopeFromForm({ ...slopeFormDefaults('SI'), lowerOn: true, lowerContact: '3' });
  if (!out.ok) throw new Error('formulario de talud inválido');
  return simpleSlope(out.value);
}

const bounds = (doc: ModelDoc): { x0: number; x1: number; y0: number; y1: number } => {
  const pts = doc.regions.flatMap((r) => r.polygon);
  return { x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), y1: Math.max(...pts.map((p) => p[1])) };
};

/** Terreno (envolvente superior) en x. */
function topAt(doc: ModelDoc, x: number): number {
  let best = -Infinity;
  for (const r of doc.regions) {
    r.polygon.forEach((a, i) => {
      const c = r.polygon[(i + 1) % r.polygon.length]!;
      if (a[0] === c[0] || x < Math.min(a[0], c[0]) || x > Math.max(a[0], c[0])) return;
      best = Math.max(best, a[1] + ((x - a[0]) * (c[1] - a[1])) / (c[0] - a[0]));
    });
  }
  return best;
}

describe.skipIf(!haveEngine)('veredicto local = veredicto del motor (polilíneas aleatorias)', () => {
  for (const [name, make] of [['talud simple con estrato', talud], ['V047a', () => loadPublishedDoc('V047a')], ['V049 (tres estratos)', () => loadPublishedDoc('V049')]] as const) {
    it(`${name}: 150 polilíneas, mismo veredicto`, { timeout: 120_000 }, () => {
      const doc = make();
      const b = bounds(doc);
      let seed = 4242;
      const rnd = (): number => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 2 ** 32;
      };
      const tally = { ok: 0, ground: 0, crossing: 0, model: 0 };
      for (let k = 0; k < 150; k += 1) {
        const n = 3 + Math.floor(rnd() * 4);
        const w = b.x1 - b.x0;
        const h = b.y1 - b.y0;
        const xs = Array.from({ length: n }, () => b.x0 + (0.05 + rnd() * 0.9) * w).sort((p, q) => p - q);
                void h;
        const pts: Point[] = xs.map((x, i) => {
          const rx = Math.round(x * 100) / 100 + i * 0.01;
          const g = topAt(doc, rx);
          const base = bottomAt(doc.regions, rx) ?? g - 1;
          // Profundidad relativa entre −10 % (sobre el terreno) y 115 % (bajo la base), con extremos más someros.
          const frac = i === 0 || i === n - 1 ? 0.02 + rnd() * 0.5 : -0.1 + rnd() * 1.25;
          return [rx, Math.round((g - frac * (g - base)) * 100) / 100];
        });
        const local = checkPolylineAgainstModel(doc.regions, pts);
        const run = engineRun({ ...doc, analysis: { ...doc.analysis, search: undefined, surface: { type: 'polyline', points: pts }, methods: ['spencer'], interslice: undefined } } as ModelDoc);
        const engine = run.code !== 0 ? (/sale del modelo/.test(run.out) ? 'polyline_outside_model' : `error:${run.out.trim()}`) : (run.results[0]?.warnings?.find((w) => w.startsWith('polyline_')) ?? null);
        expect(local.ok ? null : local.reason, JSON.stringify(pts)).toBe(engine);
        if (local.ok) tally.ok += 1;
        else if (local.reason === 'polyline_outside_ground') tally.ground += 1;
        else if (local.reason === 'polyline_no_ground_crossing') tally.crossing += 1;
        else tally.model += 1;
      }
      // Que el barrido pruebe de verdad las cuatro salidas.
      expect(tally.ok).toBeGreaterThan(5);
      expect(tally.model + tally.ground + tally.crossing).toBeGreaterThan(20);
      expect(tally.model).toBeGreaterThan(3);
    });
  }
});
