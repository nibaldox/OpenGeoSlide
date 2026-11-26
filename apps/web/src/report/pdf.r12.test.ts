// R12 / W2, E15l-22: la figura del PDF dibuja la flecha de un pilote Ito-Matsui en su punto de aplicación (y + arm con `centroid`).
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { Reinforcement, ReinforcementForce } from '../engine/types';

const spy = vi.hoisted(() => ({
  calls: [] as { forces: readonly ReinforcementForce[] | undefined; reinforcements: readonly Reinforcement[] | undefined; at: [number, number][]; atCrossing: [number, number][]; scale: number }[],
}));

vi.mock('../editor/canvas/reinforcements', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor/canvas/reinforcements')>();
  return {
    ...actual,
    forceShapes: (...args: Parameters<typeof actual.forceShapes>) => {
      const out = actual.forceShapes(...args);
      const base = actual.forceShapes(args[0], args[1], args[2]); // sin refuerzos: siempre en el cruce
      spy.calls.push({ forces: args[0], reinforcements: args[3], at: out.map((s) => s.at), atCrossing: base.map((s) => s.at), scale: args[1].scale });
      return out;
    },
  };
});

const { buildReportPdfWith } = await import('./pdf');
const { syntheticItoMatsuiInput } = await import('./reinforcementFixtures');

const loadFont = async (file: 'DejaVuSans.ttf' | 'DejaVuSans-Bold.ttf'): Promise<Uint8Array> => new Uint8Array(readFileSync(new URL(`../../public/fonts/${file}`, import.meta.url)));

describe('PDF: punto de aplicación de la fuerza (E15l-22)', () => {
  it('la figura pasa los refuerzos a forceShapes y la flecha de un pilote con centroid nace `arm` por encima del cruce', async () => {
    spy.calls.length = 0;
    const input = syntheticItoMatsuiInput();
    await buildReportPdfWith(input, { loadFont, compress: true });
    const call = spy.calls.find((c) => (c.forces?.length ?? 0) > 0);
    expect(call).toBeDefined();
    // 4.º argumento: la lista de refuerzos del modelo (sin ella no se conoce la `location`).
    expect(call!.reinforcements?.some((r) => r.type === 'pile' && r.lateral_pressure != null)).toBe(true);
    const idx = call!.forces!.findIndex((f) => f.soil_force !== undefined && f.status === 'applied' && (f.arm ?? 0) > 0);
    expect(idx).toBeGreaterThanOrEqual(0);
    const f = call!.forces![idx]!;
    const r = call!.reinforcements!.find((x) => x.id === f.id)!;
    expect(r.type === 'pile' && r.lateral_pressure?.location).toBe('centroid');
    // En píxeles de pantalla la y crece hacia abajo: el origen queda `arm · escala` más arriba que el cruce, con la misma x.
    expect(call!.at[idx]![0]).toBeCloseTo(call!.atCrossing[idx]![0], 9);
    expect(call!.atCrossing[idx]![1] - call!.at[idx]![1]).toBeCloseTo((f.arm as number) * call!.scale, 6);
    // Los cruces de pilotes con `force` no se mueven.
    call!.forces!.forEach((g, i) => {
      if (g.id !== f.id) expect(call!.at[i]).toEqual(call!.atCrossing[i]);
    });
  });
});
