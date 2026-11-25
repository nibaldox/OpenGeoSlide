import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
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
    expect(assets).toContain('gh release view "$TAG"');
    expect(assets).toContain('gh release upload "$TAG" dist/*.whl dist/*.tar.gz --clobber');
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

describe('wheels.yml: adjuntar wheels a un Release existente y scripts .sh (F1-R)', () => {
  const workflowFiles = readdirSync(new URL('../../../../.github/workflows/', import.meta.url)).filter((f) => /\.ya?ml$/.test(f));
  const pushGuard = "github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')";

  it('todo script .sh que ejecuta un workflow se invoca con `bash ` delante (no depende del bit de ejecución)', () => {
    const offenders: string[] = [];
    for (const f of workflowFiles) {
      wf(f).split('\n').forEach((line, i) => {
        if (line.trim().startsWith('#')) return;
        for (const m of line.matchAll(/(^|[\s'"`;&|(])([\w./-]+\.sh)\b/g)) {
          const before = line.slice(0, (m.index ?? 0) + m[1].length);
          if (!/\bbash\s+$/.test(before)) offenders.push(`${f}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
    // Y sí hay al menos un script invocado (el test no es vacío).
    expect(wf('wheels.yml')).toContain('bash crates/ogs-py/scripts/prepare-license-files.sh');
    expect(wf('ci.yml')).toContain('bash apps/web/scripts/build-wasm.sh');
    expect(wf('pages.yml')).toContain('bash apps/web/scripts/build-wasm.sh');
  });

  it('release-assets acepta workflow_dispatch con release_tag y usa TAG por env (sin interpolar inputs en run:)', () => {
    const wheels = wf('wheels.yml');
    expect(wheels).toMatch(/workflow_dispatch:\n\s+inputs:\n\s+release_tag:/);
    const assets = jobBlock(wheels, 'release-assets');
    expect(assets).toContain("github.event_name == 'workflow_dispatch' && inputs.release_tag != ''");
    expect(assets).toContain(pushGuard);
    expect(assets).toContain('TAG: ${{ inputs.release_tag || github.ref_name }}');
    // Ninguna expresión ${{ }} dentro de un bloque `run:`: todo llega por env.
    const runBodies = [...assets.matchAll(/^\s+run: (?:\|\n((?:\s{10,}.*\n?|\n)+)|(.*))/gm)].map((m) => m[1] ?? m[2] ?? '');
    expect(runBodies.length).toBeGreaterThan(0);
    for (const body of runBodies) expect(body).not.toContain('${{');
    expect(assets).not.toContain('GITHUB_REF_NAME');
    expect(assets).toContain('--clobber');
    expect(assets).toContain('seq 1 60');
  });

  it('PyPI sigue con su guarda: solo push de tag v* y vars.PYPI_PUBLISH, nunca por release_tag', () => {
    const publish = jobBlock(wf('wheels.yml'), 'publish');
    expect(publish).toContain("vars.PYPI_PUBLISH == 'true'");
    expect(publish).toContain(pushGuard);
    expect(publish).not.toContain('release_tag');
    expect(publish).not.toContain('workflow_dispatch');
  });

  it('ci.yml: el job de aceptación no lleva una cifra fija de checks en su nombre', () => {
    const ci = wf('ci.yml');
    expect(ci).toContain('name: acceptance (checks publicados)');
    expect(ci).not.toMatch(/acceptance \(\d+\/\d+/);
  });

  it('todos los *.sh versionados tienen modo 100755 en el índice de git', () => {
    const root = new URL('../../../../', import.meta.url).pathname;
    const out = execFileSync('git', ['ls-files', '-s', '--', '*.sh'], { cwd: root, encoding: 'utf8' });
    const entries = out.split('\n').filter(Boolean).map((l) => ({ mode: l.split(/\s+/)[0], path: l.split('\t')[1] }));
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.filter((e) => e.mode !== '100755').map((e) => e.path)).toEqual([]);
  });
});
