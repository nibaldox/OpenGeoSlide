import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const wf = (name: string): string => readFileSync(new URL(`../../../../.github/workflows/${name}`, import.meta.url), 'utf8');

/** Texto del bloque de un job de primer nivel (hasta el siguiente job o el final). */
function jobBlock(text: string, job: string): string {
  const m = new RegExp(`^  ${job}:\\n([\\s\\S]*?)(?=^  [A-Za-z0-9_-]+:\\n|(?![\\s\\S]))`, 'm').exec(text);
  return m?.[1] ?? '';
}

describe('workflows de publicación (R6-04)', () => {
  const guard = "github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')";

  it('wheels.yml: el job publish solo corre en un push de un tag v* (no con workflow_dispatch)', () => {
    const wheels = wf('wheels.yml');
    expect(wheels).toContain('workflow_dispatch');
    const publish = jobBlock(wheels, 'publish');
    expect(publish).toContain('pypi-publish');
    expect(publish).toContain(guard);
  });

  it('release.yml: github-release lleva la misma guarda', () => {
    expect(jobBlock(wf('release.yml'), 'github-release')).toContain(guard);
  });
});
