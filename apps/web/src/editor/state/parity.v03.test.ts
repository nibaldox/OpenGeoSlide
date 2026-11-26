// Paridad editor/motor para las reglas de la v0.3 (F3.2, F3.3, F3.4, F3.6): `validateLocal` rechaza y acepta lo mismo que `ogs analyze`.
// Mismo criterio que parity.test.ts: `reject` ⇔ el motor da InvalidModel (antes de resolver ninguna superficie) ⇔ hay un error local.
// Cada documento declara la versión "0.3" (el editor la sube al guardar: `saveOgsJson`).

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AnalysisSettings, Material } from '../../engine/types';
import type { ModelDoc } from '../types';
import { saveOgsJson } from '../../io/ogsJson';
import { mat, square } from './testFixtures';
import { validateLocal } from './validateLocal';

const OGS_BIN = process.env.OGS_BIN;
const haveEngine = OGS_BIN !== undefined && existsSync(OGS_BIN);

function engineVerdict(text: string): { verdict: 'accept' | 'reject'; message: string } {
  const dir = mkdtempSync(join(tmpdir(), 'ogs-parity03-'));
  try {
    const file = join(dir, 'm.ogs.json');
    writeFileSync(file, text);
    const r = spawnSync(OGS_BIN as string, ['analyze', file], { encoding: 'utf8' });
    const out = `${r.stderr}${r.stdout}`;
    return { verdict: r.status !== 0 && /InvalidModel|NoSurface|Json|json/.test(out) ? 'reject' : 'accept', message: out.trim().split('\n')[0] ?? '' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const circle = { type: 'circle' as const, xc: 50, yc: 120, r: 100 };
const su = (extra: Partial<Material> = {}): Material => ({ id: 'm1', name: 'm1', model: 'undrained', unit_weight: 18, undrained_strength: 25, ...extra });

function doc(material: Material, analysis: Partial<AnalysisSettings> = {}): ModelDoc {
  return {
    format: 'opengeoslide',
    version: '0.3',
    meta: {},
    materials: [material],
    regions: [{ material: 'm1', polygon: square(0, 0, 100, 100) }],
    slope: { direction: 'left_to_right' },
    analysis: { methods: ['spencer'], slices: 20, surface: circle, ...analysis },
  };
}
const poly = (points: [number, number][], analysis: Partial<AnalysisSettings> = {}): ModelDoc => doc(mat('m1'), { surface: { type: 'polyline', points }, ...analysis });
const GOOD: [number, number][] = [[20, 40], [50, 20], [80, 45]];

interface Case {
  name: string;
  doc: ModelDoc;
  verdict: 'accept' | 'reject';
}

const CASES: Case[] = [
  { name: 'no drenado con Su constante', doc: doc(su()), verdict: 'accept' },
  { name: 'no drenado con perfil lineal y límite', doc: doc(su({ strength_datum: 50, strength_gradient: 1, strength_limit: 80 })), verdict: 'accept' },
  { name: 'no drenado con Su = 0', doc: doc(su({ undrained_strength: 0 })), verdict: 'accept' },
  { name: 'no drenado con gradiente negativo y límite', doc: doc(su({ strength_datum: 50, strength_gradient: -1, strength_limit: 10 })), verdict: 'accept' },
  { name: 'no drenado con ru (se admite)', doc: doc(su({ ru: 0.3 })), verdict: 'accept' },
  { name: 'no drenado sin Su', doc: doc({ id: 'm1', name: 'm1', model: 'undrained', unit_weight: 18 }), verdict: 'reject' },
  { name: 'no drenado con Su negativa', doc: doc(su({ undrained_strength: -1 })), verdict: 'reject' },
  { name: 'no drenado con cohesión', doc: doc(su({ cohesion: 5 })), verdict: 'reject' },
  { name: 'no drenado con ángulo de fricción', doc: doc(su({ friction_angle: 20 })), verdict: 'reject' },
  { name: 'no drenado con cota sin gradiente', doc: doc(su({ strength_datum: 50 })), verdict: 'reject' },
  { name: 'no drenado con gradiente sin cota', doc: doc(su({ strength_gradient: 1 })), verdict: 'reject' },
  { name: 'no drenado con límite sin gradiente', doc: doc(su({ strength_limit: 50 })), verdict: 'reject' },
  { name: 'no drenado con límite negativo', doc: doc(su({ strength_datum: 50, strength_gradient: 1, strength_limit: -2 })), verdict: 'reject' },
  { name: 'Mohr-Coulomb con Su', doc: doc(mat('m1', { undrained_strength: 20 })), verdict: 'reject' },
  { name: 'Mohr-Coulomb con gradiente', doc: doc(mat('m1', { strength_gradient: 1 })), verdict: 'reject' },
  { name: 'polilínea de 2 puntos con Spencer', doc: poly([[20, 40], [80, 45]]), verdict: 'accept' },
  { name: 'polilínea de 3 puntos con Spencer', doc: poly(GOOD), verdict: 'accept' },
  { name: 'polilínea con un solo punto', doc: poly([[20, 40]]), verdict: 'reject' },
  { name: 'polilínea con x repetida', doc: poly([[20, 40], [20, 30], [80, 45]]), verdict: 'reject' },
  { name: 'polilínea con x decreciente', doc: poly([[50, 40], [20, 30], [80, 45]]), verdict: 'reject' },
  { name: 'polilínea con separación menor que 1e-9 por el ancho', doc: poly([[20, 40], [20 + 1e-9, 30], [80, 45]]), verdict: 'reject' },
  { name: 'polilínea con Bishop', doc: poly(GOOD, { methods: ['bishop'] }), verdict: 'reject' },
  { name: 'polilínea con Bishop y Spencer', doc: poly(GOOD, { methods: ['bishop', 'spencer'] }), verdict: 'reject' },
  { name: 'polilínea con Bishop y búsqueda (la superficie fija se ignora)', doc: poly(GOOD, { methods: ['bishop'], search: { type: 'circular_entry_exit', n_entry: 3, n_exit: 3, n_radius: 3 } }), verdict: 'accept' },
  { name: 'círculo con Bishop', doc: doc(mat('m1'), { methods: ['bishop'] }), verdict: 'accept' },
  { name: 'M-P sin interslice (medio seno)', doc: doc(mat('m1'), { methods: ['morgenstern_price'] }), verdict: 'accept' },
  { name: 'M-P con función constante', doc: doc(mat('m1'), { methods: ['morgenstern_price'], interslice: { function: 'constant' } }), verdict: 'accept' },
  { name: 'M-P con trapezoidal', doc: doc(mat('m1'), { methods: ['morgenstern_price'], interslice: { function: 'trapezoidal' } }), verdict: 'accept' },
  { name: 'M-P con data_points válida', doc: doc(mat('m1'), { methods: ['morgenstern_price'], interslice: { function: 'data_points', points: [[0, 0], [0.5, 1], [1, 0]] } }), verdict: 'accept' },
  { name: 'interslice sin morgenstern_price', doc: doc(mat('m1'), { methods: ['spencer'], interslice: { function: 'half_sine' } }), verdict: 'reject' },
  { name: 'data_points sin points', doc: doc(mat('m1'), { methods: ['morgenstern_price'], interslice: { function: 'data_points' } }), verdict: 'reject' },
  { name: 'points con una función que no es data_points', doc: doc(mat('m1'), { methods: ['morgenstern_price'], interslice: { function: 'constant', points: [[0, 0], [1, 1]] } }), verdict: 'reject' },
  { name: 'data_points con un solo punto', doc: doc(mat('m1'), { methods: ['morgenstern_price'], interslice: { function: 'data_points', points: [[0, 1]] } }), verdict: 'reject' },
  { name: 'data_points que no empieza en ξ = 0', doc: doc(mat('m1'), { methods: ['morgenstern_price'], interslice: { function: 'data_points', points: [[0.1, 1], [1, 1]] } }), verdict: 'reject' },
  { name: 'data_points que no termina en ξ = 1', doc: doc(mat('m1'), { methods: ['morgenstern_price'], interslice: { function: 'data_points', points: [[0, 1], [0.9, 1]] } }), verdict: 'reject' },
  { name: 'data_points con ξ no creciente', doc: doc(mat('m1'), { methods: ['morgenstern_price'], interslice: { function: 'data_points', points: [[0, 1], [0.5, 1], [0.5, 2], [1, 1]] } }), verdict: 'reject' },
  { name: 'data_points con f negativa', doc: doc(mat('m1'), { methods: ['morgenstern_price'], interslice: { function: 'data_points', points: [[0, 1], [0.5, -1], [1, 1]] } }), verdict: 'reject' },
  { name: 'data_points con f ≡ 0', doc: doc(mat('m1'), { methods: ['morgenstern_price'], interslice: { function: 'data_points', points: [[0, 0], [1, 0]] } }), verdict: 'reject' },
];

describe('paridad editor/motor de la v0.3', () => {
  it('los nombres no se repiten', () => {
    expect(new Set(CASES.map((c) => c.name)).size).toBe(CASES.length);
  });

  describe.each(CASES)('$name', (c) => {
    it(`el editor ${c.verdict === 'reject' ? 'rechaza' : 'acepta'} como el motor`, () => {
      const errors = validateLocal(c.doc).filter((i) => i.severity === 'error');
      expect(errors.length > 0 ? 'reject' : 'accept', errors.map((i) => i.text).join(' | ')).toBe(c.verdict);
    });

    it.skipIf(!haveEngine)('el motor real da el veredicto de la tabla', () => {
      // Lo que llega al motor es lo que guarda la web (versión mínima, orden canónico), salvo en los casos sin campos que el guardado normalizaría.
      const r = engineVerdict(saveOgsJson(c.doc));
      expect(r.verdict, r.message).toBe(c.verdict);
    });
  });
});
