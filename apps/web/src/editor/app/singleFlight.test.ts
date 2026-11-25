import { describe, expect, it, vi } from 'vitest';
import { createSingleFlight } from './singleFlight';

describe('createSingleFlight (R7-28: doble clic en Guardar)', () => {
  it('ignora una segunda llamada mientras la primera sigue en curso', async () => {
    const flight = createSingleFlight();
    let release!: () => void;
    const fn = vi.fn(() => new Promise<void>((r) => (release = r)));
    const first = flight.run(fn);
    expect(flight.busy()).toBe(true);
    expect(await flight.run(fn)).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
    release();
    expect(await first).toBe(true);
    expect(flight.busy()).toBe(false);
  });
  it('se libera aunque la función lance', async () => {
    const flight = createSingleFlight();
    await expect(flight.run(() => Promise.reject(new Error('x')))).rejects.toThrow('x');
    expect(flight.busy()).toBe(false);
    expect(await flight.run(async () => undefined)).toBe(true);
  });
});
