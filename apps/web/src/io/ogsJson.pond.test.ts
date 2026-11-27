// E15l-19 (R12 B-10): al abrir un modelo con la piezométrica sobre el terreno (de cualquier versión) hay una nota `io.pond_changed`, y
// `io.version_upgraded` no afirma que «el resultado del cálculo no cambia».
import { describe, expect, it } from 'vitest';
import { openOgsJson } from './ogsJson';

const base = (version: string, piezo: [number, number][] | null): Record<string, unknown> => ({
  format: 'opengeoslide',
  version,
  meta: { id: 'pond', title: 'Agua sobre el terreno' },
  materials: [{ id: 'm', name: 'm', model: 'mohr_coulomb', unit_weight: 19, cohesion: 5, friction_angle: 30 }],
  regions: [{ material: 'm', polygon: [[0, 0], [0, 5], [30, 5], [50, 15], [80, 15], [80, 0]] }],
  ...(piezo ? { water: { piezometric_line: piezo } } : {}),
  analysis: { methods: ['bishop'], surface: { type: 'circle', xc: 35, yc: 25, r: 20 } },
});
const ABOVE: [number, number][] = [[0, 8], [80, 8]]; // el nivel 8 queda sobre el terreno (y = 5) al pie
const BELOW: [number, number][] = [[0, 3], [80, 3]];
const NOTE = 'La piezométrica pasa sobre el terreno: desde la v0.4.0 se suma el agua embalsada (peso y empuje), así que el FS puede diferir del calculado con la v0.3.0 o anteriores.';
const open = (m: Record<string, unknown>) => openOgsJson(JSON.stringify(m));

describe('E15l-19: nota de cambio de criterio del agua embalsada al abrir', () => {
  it.each(['0.1', '0.2', '0.3', '0.4'])('v%s con la piezométrica sobre el terreno: nota io.pond_changed con el texto del contrato', (v) => {
    const r = open(base(v, ABOVE));
    expect(r.doc).not.toBeNull();
    const n = r.issues.find((i) => i.code === 'io.pond_changed');
    expect(n, JSON.stringify(r.issues)).toMatchObject({ severity: 'nota', text: NOTE });
  });

  it('también con la v0.5 (cualquier versión)', () => {
    expect(open(base('0.5', ABOVE)).issues.map((i) => i.code)).toContain('io.pond_changed');
  });

  it('sin agua o con la piezométrica bajo el terreno no hay nota', () => {
    expect(open(base('0.2', null)).issues.map((i) => i.code)).not.toContain('io.pond_changed');
    expect(open(base('0.2', BELOW)).issues.map((i) => i.code)).not.toContain('io.pond_changed');
  });

  it('v0.1 con agua sobre el terreno: io.version_upgraded no dice que el cálculo no cambia', () => {
    const r = open(base('0.1', ABOVE));
    const up = r.issues.find((i) => i.code === 'io.version_upgraded');
    expect(up?.text).toContain('0.2');
    expect(up?.text).not.toContain('no cambia');
    expect(r.issues.map((i) => i.code)).toContain('io.pond_changed');
  });

  it('v0.1 sin agua sobre el terreno conserva «el resultado del cálculo no cambia»', () => {
    const up = open(base('0.1', BELOW)).issues.find((i) => i.code === 'io.version_upgraded');
    expect(up?.text).toContain('el resultado del cálculo no cambia');
  });
});

describe('E15l-19: la misma frase en la Ayuda y en las convenciones del informe', () => {
  it('POND_CONVENTIONS y el término «Agua embalsada» de la Ayuda la incluyen', async () => {
    const { POND_CONVENTIONS } = await import('../report/crackReport');
    const help = await import('../onboarding/helpContent');
    expect(POND_CONVENTIONS).toContain(NOTE);
    const entries = Object.values(help).flatMap((v) => (Array.isArray(v) ? v : []));
    const pond = entries.find((e) => (e as { id?: string }).id === 'ponded-water') as { definition: string } | undefined;
    expect(pond?.definition).toContain(NOTE);
  });
});
