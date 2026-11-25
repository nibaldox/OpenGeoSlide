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
    // No crea el Release (lo hace release.yml): espera a que exista y sube con gh.
    expect(assets).not.toContain('softprops');
    expect(assets).toContain('gh release view "$GITHUB_REF_NAME"');
    expect(assets).toContain('gh release upload "$GITHUB_REF_NAME" dist/*.whl dist/*.tar.gz --clobber');
    expect(assets).toContain('contents: write');
    expect(assets).not.toContain('id-token');
    // El permiso global sigue siendo de solo lectura: contents: write solo aparece en release-assets.
    expect(wheels.match(/contents: write/g)).toHaveLength(1);
    // release.yml es el único workflow que usa softprops (el único que crea el Release).
    expect(wf('release.yml')).toContain('softprops/action-gh-release@v3');
    expect(wheels).not.toContain('softprops');
  });

  it('release.yml: github-release lleva la misma guarda', () => {
    expect(jobBlock(wf('release.yml'), 'github-release')).toContain(guard);
  });
});
