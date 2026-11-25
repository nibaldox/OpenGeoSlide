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

  it('wheels.yml: PyPI queda desactivado salvo con vars.PYPI_PUBLISH == true', () => {
    const publish = jobBlock(wf('wheels.yml'), 'publish');
    expect(publish).toContain("vars.PYPI_PUBLISH == 'true'");
  });

  it('wheels.yml: release-assets sube wheels y sdist al Release solo en el push de un tag v*, con contents: write', () => {
    const wheels = wf('wheels.yml');
    const assets = jobBlock(wheels, 'release-assets');
    expect(assets).toContain(guard);
    expect(assets).toContain('softprops/action-gh-release@v3');
    expect(assets).toContain('contents: write');
    expect(assets).not.toContain('id-token');
    // El permiso global sigue siendo de solo lectura: contents: write solo aparece en release-assets.
    expect(wheels.match(/contents: write/g)).toHaveLength(1);
    // La misma versión de la acción que usa release.yml.
    expect(wf('release.yml')).toContain('softprops/action-gh-release@v3');
  });

  it('release.yml: github-release lleva la misma guarda', () => {
    expect(jobBlock(wf('release.yml'), 'github-release')).toContain(guard);
  });
});
