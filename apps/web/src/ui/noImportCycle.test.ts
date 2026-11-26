import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// R2-I2: `ResultsTable` importa `ReinforcementForces`; este no debe volver a importar de `ResultsTable` (ciclo de módulos).
describe('ui: sin ciclo ResultsTable ↔ ReinforcementForces', () => {
  it('ReinforcementForces no importa ResultsTable', () => {
    const src = readFileSync(new URL('./ReinforcementForces.tsx', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from\s+['"]\.\/ResultsTable['"]/);
  });
  it('los rótulos de método viven en methodLabels y ResultsTable los reexporta', async () => {
    const a = await import('./methodLabels');
    const b = await import('./ResultsTable');
    expect(b.METHOD_LABELS).toBe(a.METHOD_LABELS);
  });
});
